// ~/.dsh/plugins/dsh-system-pedestal/plugins/plg-memory-engine.mjs
// L1/L2 混合检索引擎、抽屉衰减与知识图谱插件 (v4.0.0)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const manifest = {
  id: 'memory-engine',
  name: 'L1/L2 混合检索引擎与知识图谱',
  version: '4.0.0',
  dependencies: ['memory-vfs']
};

/**
 * 64 维轻量特征哈希 / 字符 N-gram 词袋向量化算法
 */
export function extractEmbedding64(text) {
  const dim = 64;
  const vec = new Float64Array(dim);
  if (!text || typeof text !== 'string') return Array.from(vec);

  const clean = text.toLowerCase().replace(/\s+/g, ' ');
  if (!clean.length) return Array.from(vec);

  // 1-gram / 2-gram / 3-gram 特征
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    let h1 = 0;
    for (let c = 0; c < ch.length; c++) h1 = ((h1 << 5) - h1 + ch.charCodeAt(c)) | 0;
    vec[Math.abs(h1) % dim] += 1.0;

    if (i < clean.length - 1) {
      const bi = clean.slice(i, i + 2);
      let h2 = 0;
      for (let c = 0; c < bi.length; c++) h2 = ((h2 << 5) - h2 + bi.charCodeAt(c)) | 0;
      vec[Math.abs(h2) % dim] += 1.5;
    }

    if (i < clean.length - 2) {
      const tri = clean.slice(i, i + 3);
      let h3 = 0;
      for (let c = 0; c < tri.length; c++) h3 = ((h3 << 5) - h3 + tri.charCodeAt(c)) | 0;
      vec[Math.abs(h3) % dim] += 2.0;
    }
  }

  // L2 范数归一化
  let norm = 0;
  for (let j = 0; j < dim; j++) norm += vec[j] * vec[j];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let j = 0; j < dim; j++) vec[j] = Number((vec[j] / norm).toFixed(6));
  }

  return Array.from(vec);
}

/**
 * 余弦相似度计算
 */
export function cosineSimilarity(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length) return 0;
  let dot = 0, n1 = 0, n2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    n1 += v1[i] * v1[i];
    n2 += v2[i] * v2[i];
  }
  const denom = Math.sqrt(n1) * Math.sqrt(n2);
  return denom > 0 ? dot / denom : 0;
}

/**
 * 粗略估算 Token 数量
 */
export function estimateTokens(text) {
  if (!text) return 0;
  let zhCount = 0;
  let enCount = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x4e00 && code <= 0x9fa5) zhCount++;
    else enCount++;
  }
  return Math.ceil(zhCount * 1.5 + enCount * 0.3);
}

export async function activate(ctx) {
  console.log('[plg-memory-engine] Activating L1/L2 混合检索引擎与知识图谱 v4.0.0...');

  const HOMEDIR = os.homedir();
  const ARCHIVE_FILE = path.join(HOMEDIR, '.dsh', 'memory_vault', 'dropped_archive.jsonl');

  // =========================================================================
  // 1. 注册 3 个 Worker 后台算力任务 (ctx.workers)
  // =========================================================================

  // 辅助执行 worker 任务（兼容 run / execute，并在多线程不可用时提供零延迟安全回退）
  const fallbackTasks = new Map();
  const runWorkerTask = async (taskName, payload, prio = 'P1', timeout = 30000) => {
    try {
      if (typeof ctx.workers?.run === 'function') {
        const res = await ctx.workers.run(taskName, payload, prio, timeout);
        if (res !== undefined) return res;
      }
      if (typeof ctx.workers?.execute === 'function') {
        const res = await ctx.workers.execute(taskName, payload);
        if (res !== undefined) return res;
      }
    } catch (err) {
      // 若 worker 执行出现异常，回退到主进程执行本地逻辑
      console.warn(`[plg-memory-engine] Worker ${taskName} delegation fallback: ${err.message}`);
    }

    const fallbackFn = fallbackTasks.get(taskName);
    if (fallbackFn) {
      return await fallbackFn(payload, { db: ctx.db.raw || ctx.db });
    }
    throw new Error(`Task ${taskName} failed and no fallback available`);
  };

  // 1.1 task:hybrid_similarity_calc (P0 实时混合检索: 向量余弦 + 关键词 + RRF)
  const hybridSimilarityFn = async (payload, { db }) => {
    const { query, dir_path, node_type, min_drawer_level = 1, limit = 15 } = payload;
    if (!query) return [];

    // 内联向量化
    const extractVec = (text) => {
      const dim = 64;
      const v = new Float64Array(dim);
      const clean = (text || '').toLowerCase().replace(/\s+/g, ' ');
      if (!clean.length) return Array.from(v);
      for (let i = 0; i < clean.length; i++) {
        let h1 = clean.charCodeAt(i);
        v[Math.abs(h1) % dim] += 1.0;
        if (i < clean.length - 1) {
          let h2 = (h1 << 5) - h1 + clean.charCodeAt(i + 1);
          v[Math.abs(h2) % dim] += 1.5;
        }
        if (i < clean.length - 2) {
          let h3 = (h1 << 5) - h1 + clean.charCodeAt(i + 1) * 31 + clean.charCodeAt(i + 2);
          v[Math.abs(h3) % dim] += 2.0;
        }
      }
      let norm = 0;
      for (let j = 0; j < dim; j++) norm += v[j] * v[j];
      norm = Math.sqrt(norm);
      if (norm > 0) {
        for (let j = 0; j < dim; j++) v[j] = v[j] / norm;
      }
      return Array.from(v);
    };

    const cosSim = (v1, v2) => {
      if (!v1 || !v2 || v1.length !== v2.length) return 0;
      let dot = 0;
      for (let i = 0; i < v1.length; i++) dot += v1[i] * v2[i];
      return Math.max(0, dot);
    };

    const qVec = extractVec(query);

    // 1. 构建候选集 SQL (仅查元数据，严禁全量读 full_content)
    let sql = `
      SELECT n.id, n.dir_path, n.node_type, n.title, n.tldr, n.keywords,
             n.drawer_level, n.confidence, n.token_estimate, n.access_count, n.last_accessed_at,
             e.vector_json
      FROM knowledge_nodes n
      LEFT JOIN node_embeddings e ON n.id = e.node_id
      WHERE n.status = 'active' AND n.drawer_level >= ?
    `;
    const params = [min_drawer_level];

    if (dir_path) {
      sql += ' AND (n.dir_path = ? OR n.dir_path LIKE ?)';
      params.push(dir_path, dir_path.endsWith('/') ? dir_path + '%' : dir_path + '/%');
    }
    if (node_type) {
      sql += ' AND n.node_type = ?';
      params.push(node_type);
    }

    const rows = db.prepare(sql).all(...params);
    if (!rows.length) return [];

    // 2. 关键词匹配评分 (Rank 1: Keyword score)
    const qLower = query.toLowerCase().trim();
    const qTerms = qLower.split(/\s+/).filter(Boolean);

    const scoredKeyword = rows.map(r => {
      let kwScore = 0;
      const titleLower = (r.title || '').toLowerCase();
      const tldrLower = (r.tldr || '').toLowerCase();
      const keywordsLower = (r.keywords || '').toLowerCase();

      if (titleLower.includes(qLower)) kwScore += 10.0;
      if (keywordsLower.includes(qLower)) kwScore += 6.0;
      if (tldrLower.includes(qLower)) kwScore += 4.0;

      for (const t of qTerms) {
        if (titleLower.includes(t)) kwScore += 3.0;
        if (keywordsLower.includes(t)) kwScore += 2.0;
        if (tldrLower.includes(t)) kwScore += 1.0;
      }
      return { id: r.id, score: kwScore };
    }).sort((a, b) => b.score - a.score);

    const kwRankMap = new Map();
    scoredKeyword.forEach((item, idx) => kwRankMap.set(item.id, idx + 1));

    // 3. 向量余弦评分 (Rank 2: Vector cosine score)
    const scoredVector = rows.map(r => {
      let vec = null;
      if (r.vector_json) {
        try { vec = JSON.parse(r.vector_json); } catch {}
      }
      if (!vec) vec = extractVec((r.title || '') + ' ' + (r.tldr || '') + ' ' + (r.keywords || ''));
      const sim = cosSim(qVec, vec);
      return { id: r.id, sim };
    }).sort((a, b) => b.sim - a.sim);

    const vecRankMap = new Map();
    scoredVector.forEach((item, idx) => vecRankMap.set(item.id, idx + 1));

    // 4. RRF 倒数排名融合评分 + 抽屉等级与置信度调制
    // RRF formula: 1 / (60 + rank_kw) + 1 / (60 + rank_vec)
    const kRRF = 60;
    const finalResults = rows.map(r => {
      const rKw = kwRankMap.get(r.id) || 999;
      const rVec = vecRankMap.get(r.id) || 999;
      const rrfBase = (1.0 / (kRRF + rKw)) + (1.0 / (kRRF + rVec));

      // 抽屉等级权重调制 (Lv.1~Lv.5 -> 0.8 ~ 1.2)
      const drawerFactor = 0.7 + (r.drawer_level || 1) * 0.1;
      const confFactor = Math.max(0.5, Math.min(1.0, r.confidence || 0.8));
      const finalRrf = Number((rrfBase * drawerFactor * confFactor).toFixed(6));

      return {
        id: r.id,
        dir_path: r.dir_path,
        node_type: r.node_type,
        title: r.title,
        tldr: r.tldr,
        keywords: r.keywords,
        drawer_level: r.drawer_level,
        confidence: r.confidence,
        token_estimate: r.token_estimate || 0,
        rrf_score: finalRrf
      };
    });

    finalResults.sort((a, b) => b.rrf_score - a.rrf_score);
    return finalResults.slice(0, limit);
  };

  fallbackTasks.set('task:hybrid_similarity_calc', hybridSimilarityFn);
  ctx.workers.registerWorkerTask('task:hybrid_similarity_calc', hybridSimilarityFn);

  // 1.2 task:conflict_detect (P1 写入冲突嗅探)
  const conflictDetectFn = async (payload, { db }) => {
    const { target_id, dir_path, title, tldr, full_content, keywords } = payload;
    if (!dir_path || !title) return [];

    const simJaccard = (s1, s2) => {
      if (!s1 || !s2) return 0;
      const clean1 = s1.toLowerCase().replace(/\s+/g, '');
      const clean2 = s2.toLowerCase().replace(/\s+/g, '');
      if (!clean1.length || !clean2.length) return 0;
      if (clean1 === clean2) return 1.0;
      if (clean1.includes(clean2) || clean2.includes(clean1)) {
        return Math.min(clean1.length, clean2.length) / Math.max(clean1.length, clean2.length);
      }
      const g1 = new Set();
      for (let i = 0; i < clean1.length - 1; i++) g1.add(clean1.slice(i, i + 2));
      const g2 = new Set();
      for (let i = 0; i < clean2.length - 1; i++) g2.add(clean2.slice(i, i + 2));
      if (!g1.size || !g2.size) return 0;
      let inter = 0;
      for (const g of g1) if (g2.has(g)) inter++;
      return (2.0 * inter) / (g1.size + g2.size);
    };

    const siblings = db.prepare(
      "SELECT id, title, tldr, keywords, full_content FROM knowledge_nodes WHERE dir_path = ? AND status = 'active'"
    ).all(dir_path);

    const conflicts = [];
    for (const sib of siblings) {
      if (sib.id === target_id) continue;

      const titleSim = simJaccard(title, sib.title);
      const kwSim = simJaccard(keywords || '', sib.keywords || '');
      const tldrSim = simJaccard(tldr || '', sib.tldr || '');

      // 元数据综合相似度
      const metaSim = titleSim * 0.5 + kwSim * 0.3 + tldrSim * 0.2;

      // 如果标题高度相似 (>=0.70) 或元数据重合度高 (>=0.65)
      if (titleSim >= 0.70 || metaSim >= 0.65) {
        const contentSim = simJaccard(full_content || '', sib.full_content || '');
        // 正文结论存在差异 (contentSim < 0.90) 即为潜在冲突/结论演变
        if (contentSim < 0.90) {
          conflicts.push({
            id: sib.id,
            title: sib.title,
            tldr: sib.tldr,
            similarity: Number(metaSim.toFixed(3)),
            content_similarity: Number(contentSim.toFixed(3)),
            reason: `同目录节点标题/主题相似度高达 ${Math.round(metaSim * 100)}%，但正文结论存在差异`
          });
        }
      }
    }

    return conflicts;
  };

  fallbackTasks.set('task:conflict_detect', conflictDetectFn);
  ctx.workers.registerWorkerTask('task:conflict_detect', conflictDetectFn);

  // 1.3 task:graph_decay_patrol (P2 全库指数衰减巡检)
  const graphDecayPatrolFn = async (payload, { db }) => {
    const now = Date.now();
    const activeNodes = db.prepare(
      "SELECT id, dir_path, node_type, title, tldr, keywords, full_content, drawer_level, last_accessed_at, created_at FROM knowledge_nodes WHERE status = 'active'"
    ).all();

    let decayedCount = 0;
    let archivedCount = 0;
    const archivedRows = [];

    for (const node of activeNodes) {
      const lastAccessStr = node.last_accessed_at || node.created_at;
      const lastAccess = lastAccessStr ? new Date(lastAccessStr).getTime() : now;
      const diffDays = (now - lastAccess) / (1000 * 60 * 60 * 24);

      // MaxDays = 7 * 2^(drawer_level - 1)
      const maxDays = 7 * Math.pow(2, Math.max(0, (node.drawer_level || 1) - 1));

      if (diffDays > maxDays) {
        const newLevel = (node.drawer_level || 1) - 1;
        if (newLevel <= 0) {
          // 降至 0 级，归档移出主表
          archivedRows.push({
            ...node,
            archived_at: new Date().toISOString(),
            reason: `Exceeded decay period: ${Math.round(diffDays)} days > ${maxDays} days`
          });
          db.prepare('DELETE FROM knowledge_nodes WHERE id = ?').run(node.id);
          db.prepare('DELETE FROM node_embeddings WHERE node_id = ?').run(node.id);
          archivedCount++;
        } else {
          // 降级
          db.prepare('UPDATE knowledge_nodes SET drawer_level = ? WHERE id = ?').run(newLevel, node.id);
          decayedCount++;
        }
      }
    }

    // 清理无任何 edges 连线且超 30 天未访问的孤立 tech 节点
    const orphanTech = db.prepare(`
      SELECT n.id, n.title FROM knowledge_nodes n
      LEFT JOIN knowledge_edges e1 ON n.id = e1.source_id
      LEFT JOIN knowledge_edges e2 ON n.id = e2.target_id
      WHERE n.node_type = 'tech'
        AND e1.id IS NULL AND e2.id IS NULL
        AND (julianday('now') - julianday(COALESCE(n.last_accessed_at, n.created_at))) > 30
    `).all();

    let orphanCleaned = 0;
    for (const orp of orphanTech) {
      db.prepare('DELETE FROM knowledge_nodes WHERE id = ?').run(orp.id);
      db.prepare('DELETE FROM node_embeddings WHERE node_id = ?').run(orp.id);
      orphanCleaned++;
    }

    return {
      total_checked: activeNodes.length,
      decayed_count: decayedCount,
      archived_count: archivedCount,
      orphan_cleaned: orphanCleaned,
      archived_nodes: archivedRows
    };
  };

  fallbackTasks.set('task:graph_decay_patrol', graphDecayPatrolFn);
  ctx.workers.registerWorkerTask('task:graph_decay_patrol', graphDecayPatrolFn);

  // =========================================================================
  // 2. 注册 4 个核心 DSH Tools
  // =========================================================================

  // 2.1 memory_search_index (L1 级轻量混合检索，防撑爆核心，严禁返回 full_content)
  ctx.tools.register({
    name: 'memory_search_index',
    description: 'L1 级轻量混合检索（向量余弦 + 关键词 + RRF 融合重排）。严禁返回完整正文，仅返回节点摘要与元数据，保护 AI 上下文窗口',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '检索关键词或自然语言问题'
        },
        dir_path: {
          type: 'string',
          description: '可选限定虚拟目录路径，如 /Projects 或 /Tech'
        },
        node_type: {
          type: 'string',
          enum: ['project', 'issue', 'solution', 'tech', 'pattern'],
          description: '可选限定知识节点类型'
        },
        min_drawer_level: {
          type: 'number',
          description: '最低抽屉重要度等级 (1~5)，默认为 1',
          default: 1
        },
        limit: {
          type: 'number',
          description: '返回结果数量上限，默认 15',
          default: 15
        }
      },
      required: ['query']
    },
    handler: async (args = {}) => {
      const { query, dir_path, node_type, min_drawer_level = 1, limit = 15 } = args;
      if (!query || typeof query !== 'string') {
        return { error: 'query parameter is required' };
      }

      try {
        const results = await runWorkerTask(
          'task:hybrid_similarity_calc',
          { query, dir_path, node_type, min_drawer_level, limit },
          'P0',
          15000
        );

        return {
          query,
          dir_path: dir_path || 'all',
          total_matched: results.length,
          matches: results
        };
      } catch (err) {
        return { error: `Hybrid search failed: ${err.message}` };
      }
    }
  });

  // 2.2 memory_load_nodes (L2 级按需拉取正文 + Top-5 图谱限流 + Token 预算熔断器)
  ctx.tools.register({
    name: 'memory_load_nodes',
    description: 'L2 级按需拉取知识节点正文与 Top-5 关联图谱卡片。内置 Token 预算熔断器防止上下文撑爆，并自动递增抽屉等级与访问统计',
    parameters: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: '需要读取正文的知识节点 ID 数组（上限 5 个）'
        },
        max_token_budget: {
          type: 'number',
          description: '本次调用累积 Token 预算上限（默认 2000 Tokens）',
          default: 2000
        },
        section_offset: {
          type: 'number',
          description: '长文档分段读取字符偏移量，默认 0',
          default: 0
        }
      },
      required: ['ids']
    },
    handler: async (args = {}) => {
      let { ids, max_token_budget = 2000, section_offset = 0 } = args;
      if (!Array.isArray(ids) || ids.length === 0) {
        return { error: 'ids must be a non-empty array of strings' };
      }
      if (ids.length > 5) {
        ids = ids.slice(0, 5); // 限制单次最多拉取 5 个
      }

      let currentTokens = 0;
      let circuitBreakerTriggered = false;
      const loadedNodes = [];
      const now = new Date().toISOString();

      for (const id of ids) {
        const node = ctx.db.get('SELECT * FROM knowledge_nodes WHERE id = ?', [id]);
        if (!node) continue;

        // 访问提权：提升抽屉等级、增加访问计数
        const newLevel = Math.min(5, (node.drawer_level || 1) + 1);
        ctx.db.run(
          `UPDATE knowledge_nodes
           SET drawer_level = ?,
               access_count = access_count + 1,
               last_accessed_at = ?
           WHERE id = ?`,
          [newLevel, now, id]
        );

        // 获取 Top-5 关联邻居（按 edge.weight * neighbor.drawer_level 倒序）
        const edges = ctx.db.query(
          `SELECT e.relation, e.weight, n.id as neighbor_id, n.title, n.node_type, n.tldr, n.drawer_level
           FROM knowledge_edges e
           JOIN knowledge_nodes n ON (e.target_id = n.id OR e.source_id = n.id)
           WHERE (e.source_id = ? OR e.target_id = ?) AND n.id != ? AND n.status = 'active'
           ORDER BY (e.weight * COALESCE(n.drawer_level, 1)) DESC
           LIMIT 5`,
          [id, id, id]
        );

        const neighbors = edges.map(e => ({
          id: e.neighbor_id,
          title: e.title,
          relation: e.relation,
          node_type: e.node_type,
          tldr: e.tldr,
          weight: e.weight
        }));

        let content = node.full_content || '';
        if (section_offset > 0 && section_offset < content.length) {
          content = content.slice(section_offset);
        }

        const estimated = estimateTokens(content);

        // Token 预算熔断检查
        if (currentTokens + estimated > max_token_budget) {
          circuitBreakerTriggered = true;
          const allowedTokens = Math.max(0, max_token_budget - currentTokens);

          if (allowedTokens > 100) {
            // 截断部分正文
            const charLimit = Math.floor(allowedTokens * 1.5);
            const truncatedText = content.slice(0, charLimit);
            currentTokens += estimateTokens(truncatedText);

            loadedNodes.push({
              id: node.id,
              dir_path: node.dir_path,
              node_type: node.node_type,
              title: node.title,
              tldr: node.tldr,
              drawer_level: newLevel,
              full_content: truncatedText + `\n\n[⚡ Token 预算熔断：内容过长已折叠，可调高 max_token_budget 或指定 section_offset=${section_offset + charLimit} 分段读取]`,
              neighbors,
              circuit_broken: true
            });
          } else {
            // 完全折叠正文
            loadedNodes.push({
              id: node.id,
              dir_path: node.dir_path,
              node_type: node.node_type,
              title: node.title,
              tldr: node.tldr,
              drawer_level: newLevel,
              full_content: (node.tldr || '') + `\n\n[⚡ Token 预算熔断：本次查询预算已耗尽，正文已折叠，可调高 max_token_budget 或单次加载此节点]`,
              neighbors,
              circuit_broken: true
            });
          }
          break; // 触发熔断后停止拉取后续节点
        } else {
          currentTokens += estimated;
          loadedNodes.push({
            id: node.id,
            dir_path: node.dir_path,
            node_type: node.node_type,
            title: node.title,
            tldr: node.tldr,
            drawer_level: newLevel,
            full_content: content,
            neighbors,
            circuit_broken: false
          });
        }
      }

      return {
        requested_count: ids.length,
        loaded_count: loadedNodes.length,
        accumulated_tokens: currentTokens,
        max_token_budget,
        circuit_breaker_triggered: circuitBreakerTriggered,
        nodes: loadedNodes
      };
    }
  });

  // 2.3 memory_commit_chain (自动脱敏 + Upsert 去重 + 【补全 6 历史快照】 + 【补全 3 冲突嗅探】)
  ctx.tools.register({
    name: 'memory_commit_chain',
    description: '提交/更新知识节点：包含自动脱敏、历史快照压栈、向量更新、冲突嗅探与图谱连线维护',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '可选指定节点 ID，缺省时自动生成如 node_abc123'
        },
        dir_path: {
          type: 'string',
          description: '所属虚拟文件系统目录路径，如 /Projects/MyRepo 或 /Tech/React'
        },
        node_type: {
          type: 'string',
          enum: ['project', 'issue', 'solution', 'tech', 'pattern'],
          description: '知识节点类型'
        },
        title: {
          type: 'string',
          description: '知识节点标题'
        },
        tldr: {
          type: 'string',
          description: '核心摘要与一句话结论'
        },
        keywords: {
          type: 'string',
          description: '检索关键词（逗号分隔）'
        },
        full_content: {
          type: 'string',
          description: '完整正文内容（Markdown 格式）'
        },
        confidence: {
          type: 'number',
          description: '置信度 (0.1 ~ 1.0)，默认 0.8',
          default: 0.8
        },
        drawer_level: {
          type: 'number',
          description: '初始抽屉重要度等级 (1~5)，默认 3',
          default: 3
        },
        supersedes_node_id: {
          type: 'string',
          description: '被当前新知识废弃/取代的旧节点 ID（旧节点将被标为 deprecated）'
        },
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              target_id: { type: 'string' },
              relation: { type: 'string', description: '如 solves, depends_on, relates_to, caused_by' },
              weight: { type: 'number', default: 1.0 }
            },
            required: ['target_id', 'relation']
          },
          description: '关联的图谱连线列表'
        }
      },
      required: ['dir_path', 'title', 'full_content']
    },
    handler: async (args = {}) => {
      const {
        id: customId,
        dir_path,
        node_type = 'tech',
        title,
        tldr,
        keywords = '',
        full_content,
        confidence = 0.8,
        drawer_level = 3,
        supersedes_node_id,
        relations = []
      } = args;

      if (!dir_path || !title || !full_content) {
        return { error: 'dir_path, title, and full_content are required' };
      }

      // 1. 强制敏感信息脱敏
      const sanitizeResult = ctx.crypto?.sanitize ? ctx.crypto.sanitize(full_content) : { cleanText: full_content, hasSecret: false };
      const safeContent = sanitizeResult.cleanText;

      const tokenEstimate = estimateTokens(safeContent);
      const safeTldr = tldr || (safeContent.slice(0, 120).replace(/\n/g, ' ') + '...');
      const now = new Date().toISOString();

      // 2. 检查是否存在同名或同 ID 节点准备 Upsert
      let existingNode = null;
      if (customId) {
        existingNode = ctx.db.get('SELECT * FROM knowledge_nodes WHERE id = ?', [customId]);
      }
      if (!existingNode) {
        existingNode = ctx.db.get(
          'SELECT * FROM knowledge_nodes WHERE dir_path = ? AND title = ? AND status = ?',
          [dir_path, title, 'active']
        );
      }

      const nodeId = existingNode ? existingNode.id : (customId || 'kn_' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)));

      // 3. 【补全 6 历史快照压栈】：若存在旧版，先将旧内容备份至 node_history
      if (existingNode) {
        const histRows = ctx.db.query('SELECT version_num FROM node_history WHERE node_id = ? ORDER BY version_num DESC', [nodeId]);
        const nextVersion = histRows.length > 0 ? (histRows[0].version_num + 1) : 1;

        ctx.db.run(
          `INSERT INTO node_history (node_id, version_num, title, tldr, full_content, keywords, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [existingNode.id, nextVersion, existingNode.title, existingNode.tldr, existingNode.full_content, existingNode.keywords, now]
        );

        // 仅保留最近 5 个版本快照
        const allHist = ctx.db.query('SELECT history_id FROM node_history WHERE node_id = ? ORDER BY version_num DESC', [nodeId]);
        if (allHist.length > 5) {
          const dropHist = allHist.slice(5);
          for (const d of dropHist) {
            ctx.db.run('DELETE FROM node_history WHERE history_id = ?', [d.history_id]);
          }
        }
      }

      // 4. Upsert 写入 knowledge_nodes
      if (existingNode) {
        ctx.db.run(
          `UPDATE knowledge_nodes
           SET dir_path = ?,
               node_type = ?,
               title = ?,
               tldr = ?,
               keywords = ?,
               full_content = ?,
               token_estimate = ?,
               confidence = ?,
               drawer_level = MIN(5, drawer_level + 1),
               last_accessed_at = ?
           WHERE id = ?`,
          [dir_path, node_type, title, safeTldr, keywords, safeContent, tokenEstimate, confidence, now, nodeId]
        );
      } else {
        ctx.db.run(
          `INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, token_estimate, status, confidence, drawer_level, access_count, last_accessed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 1, ?, ?)`,
          [nodeId, dir_path, node_type, title, safeTldr, keywords, safeContent, tokenEstimate, confidence, drawer_level, now, now]
        );
      }

      // 5. 更新 node_embeddings
      const embeddingVec = extractEmbedding64(title + ' ' + safeTldr + ' ' + keywords + ' ' + safeContent.slice(0, 500));
      ctx.db.run(
        `INSERT OR REPLACE INTO node_embeddings (node_id, vector_json, updated_at)
         VALUES (?, ?, ?)`,
        [nodeId, JSON.stringify(embeddingVec), now]
      );

      // 6. 如果指定废弃旧节点
      if (supersedes_node_id) {
        ctx.db.run(
          "UPDATE knowledge_nodes SET status = 'deprecated', superseded_by = ? WHERE id = ?",
          [nodeId, supersedes_node_id]
        );
      }

      // 7. 处理图谱关系边 knowledge_edges
      if (Array.isArray(relations) && relations.length > 0) {
        for (const rel of relations) {
          if (!rel.target_id || !rel.relation) continue;
          const edgeId = `edge_${nodeId}_${rel.target_id}_${rel.relation}`;
          ctx.db.run(
            `INSERT INTO knowledge_edges (id, source_id, target_id, relation, weight, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(source_id, target_id, relation) DO UPDATE SET weight = weight + 0.2`,
            [edgeId, nodeId, rel.target_id, rel.relation, rel.weight || 1.0, now]
          );
        }
      }

      // 8. 【补全 3 写入冲突嗅探】：调用 Worker 扫描同目录下潜在冲突旧节点
      let conflictWarning = null;
      try {
        const conflicts = await runWorkerTask(
          'task:conflict_detect',
          { target_id: nodeId, dir_path, title, tldr: safeTldr, full_content: safeContent, keywords },
          'P1',
          10000
        );

        if (conflicts && conflicts.length > 0) {
          const listStr = conflicts.map(c => `[#${c.id}: ${c.title} (相似度 ${Math.round(c.similarity * 100)}%)]`).join(', ');
          conflictWarning = `⚠️ 检测到同目录下存在潜在冲突旧节点 ${listStr}，是否调用 memory_feedback 或 supersedes_node_id 将其标记为过时？`;
        }
      } catch (err) {
        console.warn('[plg-memory-engine] Conflict detect warning:', err.message);
      }

      // 9. 触发内核总线事件
      ctx.bus?.emit?.('memory:node_committed', { id: nodeId, dir_path, action: existingNode ? 'update' : 'create' });

      return {
        success: true,
        node_id: nodeId,
        action: existingNode ? 'updated' : 'created',
        dir_path,
        title,
        token_estimate: tokenEstimate,
        sanitized_secrets_count: sanitizeResult.matchedCount || 0,
        conflict_warning: conflictWarning
      };
    }
  });

  // 2.4 memory_feedback (用户/AI 反馈调节置信度与生命周期)
  ctx.tools.register({
    name: 'memory_feedback',
    description: '对知识节点提交使用反馈（helpful 提升置信度与抽屉等级，outdated/misleading 降低权重或废弃标记）',
    parameters: {
      type: 'object',
      properties: {
        node_id: {
          type: 'string',
          description: '目标知识节点 ID'
        },
        feedback: {
          type: 'string',
          enum: ['helpful', 'outdated', 'misleading'],
          description: '反馈类型'
        },
        superseded_by: {
          type: 'string',
          description: '当标记为 outdated 时，指定替代它的新节点 ID'
        }
      },
      required: ['node_id', 'feedback']
    },
    handler: async (args = {}) => {
      const { node_id, feedback, superseded_by } = args;
      const node = ctx.db.get('SELECT * FROM knowledge_nodes WHERE id = ?', [node_id]);
      if (!node) {
        return { error: `Node not found: ${node_id}` };
      }

      const now = new Date().toISOString();
      let newConfidence = node.confidence || 0.8;
      let newLevel = node.drawer_level || 3;
      let newStatus = node.status || 'active';

      if (feedback === 'helpful') {
        newConfidence = Math.min(1.0, Number((newConfidence + 0.1).toFixed(2)));
        newLevel = Math.min(5, newLevel + 1);
      } else if (feedback === 'outdated') {
        newConfidence = Math.max(0.1, Number((newConfidence - 0.2).toFixed(2)));
        newLevel = Math.max(1, newLevel - 1);
        if (superseded_by) {
          newStatus = 'deprecated';
        }
      } else if (feedback === 'misleading') {
        newConfidence = Math.max(0.0, Number((newConfidence - 0.4).toFixed(2)));
        newLevel = 1;
        newStatus = 'deprecated';
      }

      ctx.db.run(
        `UPDATE knowledge_nodes
         SET confidence = ?,
             drawer_level = ?,
             status = ?,
             superseded_by = COALESCE(?, superseded_by),
             last_accessed_at = ?
         WHERE id = ?`,
        [newConfidence, newLevel, newStatus, superseded_by || null, now, node_id]
      );

      ctx.bus?.emit?.('memory:feedback_applied', { node_id, feedback, newConfidence, newLevel, newStatus });

      return {
        success: true,
        node_id,
        feedback,
        new_confidence: newConfidence,
        new_drawer_level: newLevel,
        status: newStatus
      };
    }
  });

  // =========================================================================
  // 3. 挂载 GUI REST APIs
  // =========================================================================

  // 3.1 GET /api/ext/memory-engine/nodes
  ctx.gui.registerApi('GET', '/api/ext/memory-engine/nodes', async (req, res, { query, sendJson }) => {
    try {
      const { dir_path, node_type, status = 'active', min_level, q } = query || {};
      let sql = 'SELECT id, dir_path, node_type, title, tldr, keywords, drawer_level, confidence, token_estimate, status, access_count, last_accessed_at, created_at FROM knowledge_nodes WHERE 1=1';
      const params = [];

      if (status !== 'all') {
        sql += ' AND status = ?';
        params.push(status);
      }
      if (dir_path) {
        sql += ' AND (dir_path = ? OR dir_path LIKE ?)';
        params.push(dir_path, dir_path.endsWith('/') ? dir_path + '%' : dir_path + '/%');
      }
      if (node_type) {
        sql += ' AND node_type = ?';
        params.push(node_type);
      }
      if (min_level) {
        sql += ' AND drawer_level >= ?';
        params.push(Number(min_level));
      }
      if (q) {
        sql += ' AND (title LIKE ? OR tldr LIKE ? OR keywords LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }

      sql += ' ORDER BY drawer_level DESC, confidence DESC, last_accessed_at DESC LIMIT 100';
      const nodes = ctx.db.query(sql, params);
      return sendJson(200, { success: true, count: nodes.length, nodes });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 3.2 GET /api/ext/memory-engine/graph
  ctx.gui.registerApi('GET', '/api/ext/memory-engine/graph', async (req, res, { query, sendJson }) => {
    try {
      const nodes = ctx.db.query(
        "SELECT id, dir_path, node_type, title, tldr, drawer_level, confidence, status FROM knowledge_nodes WHERE status = 'active' LIMIT 200"
      );
      const nodeIds = new Set(nodes.map(n => n.id));

      const edges = ctx.db.query('SELECT id, source_id, target_id, relation, weight FROM knowledge_edges LIMIT 500')
        .filter(e => nodeIds.has(e.source_id) && nodeIds.has(e.target_id));

      return sendJson(200, { success: true, nodes, edges });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 3.3 POST /api/ext/memory-engine/action (升降级、编辑正文、手动触发衰减)
  ctx.gui.registerApi('POST', '/api/ext/memory-engine/action', async (req, res, { body, sendJson }) => {
    try {
      const { action, node_id, level_delta, status, full_content } = body || {};

      if (action === 'commit') {
        const { dir_path, node_type = 'tech', title, tldr, keywords = '', full_content, confidence = 0.8, drawer_level = 3, supersedes_node_id, relations = [] } = body || {};
        if (!dir_path || !title || !full_content) {
          return sendJson(400, { error: 'dir_path, title, and full_content are required' });
        }
        const sanitizeResult = ctx.crypto?.sanitize ? ctx.crypto.sanitize(full_content) : { cleanText: full_content, hasSecret: false };
        const safeContent = sanitizeResult.cleanText;
        const tokenEstimate = estimateTokens(safeContent);
        const finalTldr = tldr || (safeContent.slice(0, 140).replace(/\n/g, ' ') + '...');
        const now = new Date().toISOString();

        // 冲突嗅探 (Top-1 相似度)
        let conflictWarning = null;
        const currentVec = extractEmbedding64(title + ' ' + keywords + ' ' + finalTldr);
        const candidates = ctx.db.query("SELECT id, title, tldr, status FROM knowledge_nodes WHERE dir_path = ? AND status = 'active'", [dir_path]);
        for (const c of candidates) {
          const embRow = ctx.db.get("SELECT vector_json FROM node_embeddings WHERE node_id = ?", [c.id]);
          if (embRow && embRow.vector_json) {
            try {
              const prevVec = JSON.parse(embRow.vector_json);
              const sim = cosineSimilarity(currentVec, prevVec);
              if (sim > 0.88) {
                conflictWarning = { conflicting_node_id: c.id, conflicting_title: c.title, similarity: Math.round(sim * 100) / 100 };
                break;
              }
            } catch {}
          }
        }

        const nodeId = body.id || ('kn_' + Math.random().toString(36).substring(2, 10));
        ctx.db.run(
          `INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, drawer_level, confidence, token_estimate, status, access_count, last_accessed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             dir_path = excluded.dir_path,
             node_type = excluded.node_type,
             title = excluded.title,
             tldr = excluded.tldr,
             keywords = excluded.keywords,
             full_content = excluded.full_content,
             drawer_level = excluded.drawer_level,
             confidence = excluded.confidence,
             token_estimate = excluded.token_estimate,
             last_accessed_at = excluded.last_accessed_at`,
          [nodeId, dir_path, node_type, title, finalTldr, keywords, safeContent, drawer_level, confidence, tokenEstimate, now, now]
        );

        // 更新向量表
        ctx.db.run(
          `INSERT INTO node_embeddings (node_id, vector_json, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(node_id) DO UPDATE SET vector_json = excluded.vector_json, updated_at = excluded.updated_at`,
          [nodeId, JSON.stringify(Array.from(currentVec)), now]
        );

        if (supersedes_node_id) {
          ctx.db.run("UPDATE knowledge_nodes SET status = 'deprecated' WHERE id = ?", [supersedes_node_id]);
        }

        // 图谱连线
        for (const rel of relations) {
          if (rel.target_id && rel.relation) {
            const edgeId = 'edg_' + Math.random().toString(36).substring(2, 10);
            ctx.db.run(
              `INSERT OR REPLACE INTO knowledge_edges (id, source_id, target_id, relation, weight, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [edgeId, nodeId, rel.target_id, rel.relation, rel.weight || 1.0, now]
            );
          }
        }

        ctx.bus?.emit?.('memory:node_committed', { id: nodeId, dir_path, action: 'create' });
        return sendJson(200, { success: true, node_id: nodeId, conflict_warning: conflictWarning });
      }

      if (action === 'adjust_level') {
        const delta = Number(level_delta) || 0;
        ctx.db.run(
          'UPDATE knowledge_nodes SET drawer_level = MAX(1, MIN(5, drawer_level + ?)) WHERE id = ?',
          [delta, node_id]
        );
        return sendJson(200, { success: true, node_id });
      }

      if (action === 'toggle_status') {
        ctx.db.run('UPDATE knowledge_nodes SET status = ? WHERE id = ?', [status || 'active', node_id]);
        return sendJson(200, { success: true, node_id, status });
      }

      if (action === 'update_content') {
        const tokens = estimateTokens(full_content);
        ctx.db.run(
          'UPDATE knowledge_nodes SET full_content = ?, token_estimate = ?, last_accessed_at = ? WHERE id = ?',
          [full_content, tokens, new Date().toISOString(), node_id]
        );
        return sendJson(200, { success: true, node_id, tokens });
      }

      if (action === 'trigger_decay') {
        const decayResult = await runWorkerTask('task:graph_decay_patrol', {}, 'P2', 30000);
        // 若有归档节点，写入 dropped_archive.jsonl
        if (decayResult.archived_nodes && decayResult.archived_nodes.length > 0) {
          const lines = decayResult.archived_nodes.map(n => JSON.stringify(n)).join('\n') + '\n';
          fs.appendFileSync(ARCHIVE_FILE, lines, 'utf8');
        }
        return sendJson(200, { success: true, result: decayResult });
      }

      // Demo Seed: 一键载入架构示例知识星系
      if (action === 'load_demo_seed') {
        const now = new Date().toISOString();
        const demoNodes = [
          {
            id: 'kn_demo_project',
            dir_path: '/Projects/DeepSeekHarness',
            node_type: 'project',
            title: 'DSH System Pedestal 微内核架构',
            tldr: '基于 Node.js 22 + SQLite WAL + WorkerPool 的系统级插件化底座',
            keywords: 'pedestal,microkernel,architecture,sqlite,workerpool',
            full_content: '# DSH System Pedestal 微内核架构\n\n采用轻量化微内核平台思想，支持双进程架构：\n- **daemon.mjs**: 18765 守护进程与 GUI 网关\n- **index.mjs**: DSH 工具与环境适配器\n- **5 大热插拔插件**: VFS保险箱、记忆检索引擎、短期缓冲、版本时光机、自动成链胶囊',
            drawer_level: 5,
            confidence: 0.95
          },
          {
            id: 'kn_demo_tech_bus',
            dir_path: '/Tech/Kernel',
            node_type: 'tech',
            title: '内核总线与用后即焚安全令牌机制',
            tldr: 'AES-256-GCM 硬件加密与跨进程 SQLite 租约共享机制',
            keywords: 'crypto,vault,lease,security,aes-gcm',
            full_content: '# 用后即焚安全令牌机制 (Lease Protocol)\n\n1. 机密写入 core_vault 表，AES-256-GCM 硬件级强加密。\n2. 访问密钥时生成 `{{VAULT_SECRET:key}}` 占位符并持久化至 vault_leases。\n3. 在命令执行或脚本运行前由内存拦截器置换为明文，保证会话中零密码泄露。',
            drawer_level: 4,
            confidence: 0.90
          },
          {
            id: 'kn_demo_issue_concurrency',
            dir_path: '/Issues/Windows',
            node_type: 'issue',
            title: 'Windows 跨进程 SQLite 文件锁与守护进程防僵尸排查',
            tldr: '解决 Windows 下路径含空格、子进程孤儿化与 WAL 模式并发锁问题',
            keywords: 'windows,sqlite,wal,zombie_process,path_space',
            full_content: '# 故障排查：Windows 跨进程与文件锁\n\n- **现象**: 多进程并发读写 SQLite 可能抛出 busy 或 locked。\n- **排查**: Windows 路径含空格会导致 powershell 转义异常。\n- **方案**: 开启 WAL 模式、5000ms busy_timeout，统一通过跨平台 spawn 直接启动后台 daemon。',
            drawer_level: 4,
            confidence: 0.88
          },
          {
            id: 'kn_demo_solution_wal',
            dir_path: '/Tech/Database',
            node_type: 'solution',
            title: 'WAL 模式高并发读写与版本时光机快照回滚方案',
            tldr: '通过 SQLite WAL + node_history 历史版本表实现零锁高频回滚',
            keywords: 'sqlite,wal,timemachine,rollback,history',
            full_content: '# 解决方案：WAL 并发与版本时光机\n\n1. `PRAGMA journal_mode = WAL;` 彻底解耦读写事务。\n2. 对相同节点更新时，前序快照自动压入 `node_history` 表，保留最近 5 版。\n3. 支持一键回滚恢复主表内容，毫秒级生效。',
            drawer_level: 4,
            confidence: 0.92
          },
          {
            id: 'kn_demo_pattern_dag',
            dir_path: '/Tech/Workflow',
            node_type: 'pattern',
            title: 'DAG 工作流 Fork & Join 并行调度模式',
            tldr: '拓扑排序驱动多分支无阻塞并行执行与最终汇总 Join',
            keywords: 'dag,fork_join,pattern,scheduler,workflow',
            full_content: '# 设计模式：DAG Fork & Join\n\n- **入度计算**: 统计每个节点的依赖前驱数量。\n- **并发 Fork**: 入度为 0 的节点并行放入 Promise.all 执行。\n- **下游 Join**: 依赖节点完成时递减入度，归零时无缝激活后继步骤。',
            drawer_level: 3,
            confidence: 0.85
          }
        ];

        // 写入节点与向量
        for (const n of demoNodes) {
          const tokens = estimateTokens(n.full_content);
          ctx.db.run(`
            INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, drawer_level, confidence, token_estimate, status, access_count, last_accessed_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title, tldr = excluded.tldr, keywords = excluded.keywords, full_content = excluded.full_content, drawer_level = excluded.drawer_level
          `, [n.id, n.dir_path, n.node_type, n.title, n.tldr, n.keywords, n.full_content, n.drawer_level, n.confidence, tokens, now, now]);

          const vec = extractEmbedding64(n.title + ' ' + n.keywords + ' ' + n.tldr);
          ctx.db.run(`
            INSERT INTO node_embeddings (node_id, vector_json, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(node_id) DO UPDATE SET vector_json = excluded.vector_json, updated_at = excluded.updated_at
          `, [n.id, JSON.stringify(Array.from(vec)), now]);
        }

        // 写入示例图谱连线
        const demoEdges = [
          { src: 'kn_demo_project', tgt: 'kn_demo_tech_bus', rel: 'implements', w: 1.0 },
          { src: 'kn_demo_project', tgt: 'kn_demo_pattern_dag', rel: 'uses', w: 0.9 },
          { src: 'kn_demo_issue_concurrency', tgt: 'kn_demo_solution_wal', rel: 'solves', w: 1.2 },
          { src: 'kn_demo_solution_wal', tgt: 'kn_demo_project', rel: 'reinforces', w: 0.8 },
          { src: 'kn_demo_tech_bus', tgt: 'kn_demo_solution_wal', rel: 'relates_to', w: 0.7 }
        ];

        for (const e of demoEdges) {
          const edgeId = `edge_${e.src}_${e.tgt}_${e.rel}`;
          ctx.db.run(`
            INSERT OR REPLACE INTO knowledge_edges (id, source_id, target_id, relation, weight, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [edgeId, e.src, e.tgt, e.rel, e.w, now]);
        }

        // 写入 1 条历史快照供立即体验「版本时光机 Diff 对比」与「一键回滚」
        ctx.db.run(`
          DELETE FROM node_history WHERE node_id = 'kn_demo_solution_wal'
        `);
        ctx.db.run(`
          INSERT INTO node_history (node_id, version_num, title, tldr, full_content, keywords, archived_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          'kn_demo_solution_wal',
          1,
          'WAL 模式高并发读写与版本时光机快照初始设想 (v1)',
          '初期采用纯内存互斥锁方案，存在并发写入锁争用',
          '# 初始版本架构设想\n\n1. 最初采用应用层互斥锁排队机制。\n2. 在高频多线程 WorkerPool 并发读写时出现锁等待超时。\n3. 随后升级为 PRAGMA journal_mode = WAL 模式彻底解决并发。',
          'sqlite,lock,mutex,v1',
          new Date(Date.now() - 3600000).toISOString()
        ]);

        ctx.bus?.emit?.('memory:seed_loaded', { count: demoNodes.length });
        return sendJson(200, { success: true, count: demoNodes.length, edgesCount: demoEdges.length });
      }

      // 清空示例数据
      if (action === 'clear_demo_seed') {
        const demoIds = ['kn_demo_project', 'kn_demo_tech_bus', 'kn_demo_issue_concurrency', 'kn_demo_solution_wal', 'kn_demo_pattern_dag'];
        for (const id of demoIds) {
          ctx.db.run('DELETE FROM knowledge_nodes WHERE id = ?', [id]);
          ctx.db.run('DELETE FROM node_embeddings WHERE node_id = ?', [id]);
          ctx.db.run('DELETE FROM node_history WHERE node_id = ?', [id]);
          ctx.db.run('DELETE FROM knowledge_edges WHERE source_id = ? OR target_id = ?', [id, id]);
        }
        ctx.bus?.emit?.('memory:seed_cleared', { count: demoIds.length });
        return sendJson(200, { success: true, cleared: demoIds.length });
      }

      return sendJson(400, { error: `Unknown action: ${action}` });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // =========================================================================
  // 4. 注册主画布微前端视图: 记忆网格与知识星系 (slot-3)
  // =========================================================================
  const renderScript = `
    const root = container;
    root.innerHTML = \`
      <div class="h-full flex flex-col space-y-3">
        <!-- 头部工具栏 -->
        <div class="flex items-center justify-between pb-2 border-b border-slate-800 flex-shrink-0">
          <div class="flex items-center space-x-3">
            <h2 class="text-base font-semibold text-cyan-400 flex items-center space-x-2">
              <span>🧠</span>
              <span>记忆网格与知识星系</span>
            </h2>
            <div class="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button id="me-tab-grid" class="px-3 py-1 rounded bg-slate-800 text-cyan-400 font-semibold transition">网格卡片</button>
              <button id="me-tab-graph" class="px-3 py-1 rounded text-slate-400 hover:text-slate-200 transition">知识星系 (Canvas)</button>
            </div>
          </div>

          <div class="flex items-center space-x-2 text-xs">
            <input id="me-search-input" placeholder="模糊检索或关键词过滤..." class="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs outline-none w-52">
            <select id="me-type-select" class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none">
              <option value="">全部类型</option>
              <option value="project">项目 (Project)</option>
              <option value="issue">问题 (Issue)</option>
              <option value="solution">方案 (Solution)</option>
              <option value="tech">技术 (Tech)</option>
              <option value="pattern">模式 (Pattern)</option>
            </select>
            <button id="me-btn-decay" title="手动执行一次 P2 抽屉指数衰减巡检" class="px-2.5 py-1 bg-amber-950/80 text-amber-400 hover:bg-amber-900 border border-amber-800 rounded transition">衰减巡检</button>
            <button id="me-btn-refresh" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">刷新</button>
          </div>
        </div>

        <!-- 卡片网格视图 -->
        <div id="me-view-grid" class="flex-1 overflow-y-auto min-h-0 pr-1">
          <div id="me-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"></div>
        </div>

        <!-- Canvas 知识星系视图 -->
        <div id="me-view-graph" class="flex-1 bg-slate-950 border border-slate-800 rounded-lg relative overflow-hidden hidden min-h-0">
          <canvas id="me-galaxy-canvas" class="w-full h-full block"></canvas>
          <div class="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] text-slate-400 flex items-center space-x-4 pointer-events-none">
            <span class="flex items-center space-x-1"><span class="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span><span>Project</span></span>
            <span class="flex items-center space-x-1"><span class="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span><span>Issue</span></span>
            <span class="flex items-center space-x-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span><span>Solution</span></span>
            <span class="flex items-center space-x-1"><span class="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"></span><span>Tech</span></span>
          </div>
        </div>
      </div>
    \`;

    let currentMode = 'grid';
    let cachedNodes = [];

    async function loadCards() {
      const q = root.querySelector('#me-search-input')?.value.trim();
      const node_type = root.querySelector('#me-type-select')?.value;
      const url = \`/api/ext/memory-engine/nodes?status=all\${q ? '&q=' + encodeURIComponent(q) : ''}\${node_type ? '&node_type=' + node_type : ''}\`;
      const res = await shell.apiFetch(url);
      cachedNodes = res.nodes || [];
      renderCards(cachedNodes);
    }

    function renderCards(nodes) {
      const box = root.querySelector('#me-cards-container');
      box.innerHTML = '';
      if (!nodes.length) {
        box.innerHTML = '<div class="col-span-3 text-center text-xs text-slate-500 py-12">未检索到匹配的知识节点</div>';
        return;
      }

      const levelColors = {
        1: 'bg-slate-800 text-slate-400 border-slate-700',
        2: 'bg-sky-950 text-sky-400 border-sky-800',
        3: 'bg-emerald-950 text-emerald-400 border-emerald-800',
        4: 'bg-amber-950 text-amber-400 border-amber-800',
        5: 'bg-rose-950 text-rose-400 border-rose-800'
      };

      const typeBadges = {
        project: 'text-cyan-400 bg-cyan-950/60 border-cyan-800',
        issue: 'text-rose-400 bg-rose-950/60 border-rose-800',
        solution: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
        tech: 'text-purple-400 bg-purple-950/60 border-purple-800',
        pattern: 'text-indigo-400 bg-indigo-950/60 border-indigo-800'
      };

      nodes.forEach(n => {
        const card = document.createElement('div');
        card.className = 'p-3 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition flex flex-col justify-between space-y-2 cursor-pointer';

        const isDeprecated = n.status === 'deprecated';
        const lvlClass = levelColors[n.drawer_level] || levelColors[1];
        const typeClass = typeBadges[n.node_type] || 'text-slate-400 bg-slate-800 border-slate-700';

        card.innerHTML = \`
          <div>
            <div class="flex items-center justify-between">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-mono border \${typeClass}">\${(n.node_type || 'tech').toUpperCase()}</span>
              <div class="flex items-center space-x-1.5">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-mono border \${lvlClass}">Lv.\${n.drawer_level || 1}</span>
                \${isDeprecated ? '<span class="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-400 border border-rose-800">已过时</span>' : ''}
              </div>
            </div>
            <div class="text-xs font-semibold text-slate-100 mt-2 truncate" title="\${n.title}">\${n.title}</div>
            <div class="text-[11px] text-slate-400 mt-1 line-clamp-2">\${n.tldr || '暂无摘要'}</div>
          </div>

          <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>置信度: <span class="text-cyan-400">\${Math.round((n.confidence || 0.8) * 100)}%</span></span>
            <div class="flex items-center space-x-1">
              <button class="btn-lvl-up px-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded" title="抽屉升权 +1">+1</button>
              <button class="btn-lvl-down px-1 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded" title="抽屉降权 -1">-1</button>
            </div>
          </div>
        \`;

        card.querySelector('.btn-lvl-up')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await shell.apiFetch('/api/ext/memory-engine/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'adjust_level', node_id: n.id, level_delta: 1 })
          });
          loadCards();
        });

        card.querySelector('.btn-lvl-down')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await shell.apiFetch('/api/ext/memory-engine/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'adjust_level', node_id: n.id, level_delta: -1 })
          });
          loadCards();
        });

        card.addEventListener('click', () => {
          shell.openInspector('知识节点详情: ' + n.id, \`
            <div class="space-y-3">
              <div><span class="text-slate-400">ID:</span> <span class="font-mono text-cyan-400">\${n.id}</span></div>
              <div><span class="text-slate-400">目录:</span> <span class="font-mono text-slate-200">\${n.dir_path}</span></div>
              <div><span class="text-slate-400">标题:</span> <p class="text-slate-100 font-semibold mt-0.5">\${n.title}</p></div>
              <div><span class="text-slate-400">TL;DR:</span> <p class="text-slate-300 mt-0.5 text-xs">\${n.tldr}</p></div>
              <div><span class="text-slate-400">关键词:</span> <p class="text-emerald-400 text-xs">\${n.keywords || '无'}</p></div>
              <div><span class="text-slate-400">Token 估算:</span> <span class="font-mono text-slate-300">\${n.token_estimate || 0} Tokens</span></div>
              <div class="pt-2 border-t border-slate-800 flex space-x-2">
                <button id="insp-deprecate-btn" class="px-2.5 py-1 bg-rose-950 text-rose-300 border border-rose-800 text-xs rounded">\${n.status === 'deprecated' ? '恢复激活' : '标为过时'}</button>
              </div>
            </div>
          \`);

          setTimeout(() => {
            document.getElementById('insp-deprecate-btn')?.addEventListener('click', async () => {
              const nextStatus = n.status === 'deprecated' ? 'active' : 'deprecated';
              await shell.apiFetch('/api/ext/memory-engine/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_status', node_id: n.id, status: nextStatus })
              });
              shell.closeInspector();
              loadCards();
            });
          }, 50);
        });

        box.appendChild(card);
      });
    }

    // Canvas 星系渲染
    async function loadGalaxy() {
      const graphData = await shell.apiFetch('/api/ext/memory-engine/graph');
      const canvas = root.querySelector('#me-galaxy-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      const nodes = (graphData.nodes || []).map((n, i) => {
        const angle = (i / Math.max(1, graphData.nodes.length)) * Math.PI * 2;
        const radius = 120 + Math.random() * (Math.min(canvas.width, canvas.height) / 2 - 160);
        return {
          ...n,
          x: canvas.width / 2 + Math.cos(angle) * radius,
          y: canvas.height / 2 + Math.sin(angle) * radius,
          r: 6 + (n.drawer_level || 1) * 3
        };
      });

      const nodeMap = new Map();
      nodes.forEach(n => nodeMap.set(n.id, n));

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制连线
      ctx.lineWidth = 1;
      (graphData.edges || []).forEach(e => {
        const src = nodeMap.get(e.source_id);
        const tgt = nodeMap.get(e.target_id);
        if (src && tgt) {
          ctx.strokeStyle = '#334155';
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.stroke();
        }
      });

      // 绘制节点
      const colorMap = {
        project: '#06b6d4',
        issue: '#f43f5e',
        solution: '#10b981',
        tech: '#a855f7',
        pattern: '#6366f1'
      };

      nodes.forEach(n => {
        ctx.fillStyle = colorMap[n.node_type] || '#94a3b8';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.title.slice(0, 10), n.x, n.y + n.r + 12);
      });
    }

    // 切换 Tab
    root.querySelector('#me-tab-grid')?.addEventListener('click', () => {
      currentMode = 'grid';
      root.querySelector('#me-tab-grid').className = 'px-3 py-1 rounded bg-slate-800 text-cyan-400 font-semibold transition';
      root.querySelector('#me-tab-graph').className = 'px-3 py-1 rounded text-slate-400 hover:text-slate-200 transition';
      root.querySelector('#me-view-grid').classList.remove('hidden');
      root.querySelector('#me-view-graph').classList.add('hidden');
      loadCards();
    });

    root.querySelector('#me-tab-graph')?.addEventListener('click', () => {
      currentMode = 'graph';
      root.querySelector('#me-tab-graph').className = 'px-3 py-1 rounded bg-slate-800 text-cyan-400 font-semibold transition';
      root.querySelector('#me-tab-grid').className = 'px-3 py-1 rounded text-slate-400 hover:text-slate-200 transition';
      root.querySelector('#me-view-graph').classList.remove('hidden');
      root.querySelector('#me-view-grid').classList.add('hidden');
      loadGalaxy();
    });

    root.querySelector('#me-search-input')?.addEventListener('input', () => loadCards());
    root.querySelector('#me-type-select')?.addEventListener('change', () => loadCards());
    root.querySelector('#me-btn-refresh')?.addEventListener('click', () => {
      if (currentMode === 'grid') loadCards();
      else loadGalaxy();
    });

    root.querySelector('#me-btn-decay')?.addEventListener('click', async () => {
      const res = await shell.apiFetch('/api/ext/memory-engine/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_decay' })
      });
      shell.notify('info', \`抽屉衰减巡检完成：检查 \${res.result?.total_checked || 0} 节点，衰减 \${res.result?.decayed_count || 0} 项，归档 \${res.result?.archived_count || 0} 项\`);
      loadCards();
    });

    // 初始加载
    loadCards();
  `;

  ctx.gui.registerView('/view-memory-engine', {
    id: 'view-memory-engine',
    title: '记忆网格与知识星系',
    icon: '🧠',
    slot: 'slot-3',
    renderScript
  });

  console.log('[plg-memory-engine] L1/L2 混合检索引擎与知识图谱插件已就绪。');

  return {
    manifest,
    deactivate: async () => {
      console.log('[plg-memory-engine] Deactivating memory-engine plugin...');
    }
  };
}

export default {
  manifest,
  activate
};
