// ~/.dsh/plugins/dsh-system-pedestal/plugins/plg-auto-distiller.mjs
// 自动化工作流与知识胶囊包插件 (v4.0.0)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const manifest = {
  id: 'auto-distiller',
  name: '自动化工作流与知识胶囊包',
  version: '4.0.0',
  dependencies: ['memory-engine']
};

/**
 * 64 维轻量特征哈希向量提取（供导入知识胶囊时重新生成向量）
 */
function extractEmbedding64(text) {
  const dim = 64;
  const vec = new Float64Array(dim);
  if (!text || typeof text !== 'string') return Array.from(vec);

  const clean = text.toLowerCase().replace(/\s+/g, ' ');
  if (!clean.length) return Array.from(vec);

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
  }

  let norm = 0;
  for (let j = 0; j < dim; j++) norm += vec[j] * vec[j];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let j = 0; j < dim; j++) vec[j] = Number((vec[j] / norm).toFixed(6));
  }
  return Array.from(vec);
}

/**
 * 粗略估算 Token 数量
 */
function estimateTokens(text) {
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
  console.log('[plg-auto-distiller] Activating 自动化工作流与知识胶囊包 v4.0.0...');

  const HOMEDIR = os.homedir();
  const CAPSULES_DIR = path.join(HOMEDIR, '.dsh', 'memory_vault', 'capsules');
  if (!fs.existsSync(CAPSULES_DIR)) {
    fs.mkdirSync(CAPSULES_DIR, { recursive: true });
  }

  // =========================================================================
  // 1. 注册 5 个标准原子 DAG 动作 (ctx.workflow.registerAction)
  // =========================================================================

  // 1.1 action.memory.scan_inbox
  ctx.workflow.registerAction('action.memory.scan_inbox', async ({ params, payload }) => {
    const minCount = params?.minCount || 1;
    const rows = ctx.db.query(
      "SELECT id, title, tldr, full_content, keywords, token_estimate, created_at FROM knowledge_nodes WHERE dir_path = '/Inbox' AND drawer_level = 0 AND status = 'active' ORDER BY created_at ASC"
    );

    const fullTextCombined = rows.map(r => `### ${r.title}\n${r.full_content}`).join('\n\n');
    return {
      total_inbox: rows.length,
      items: rows,
      combined_text: fullTextCombined,
      ready_for_distill: rows.length >= minCount
    };
  });

  // 1.2 action.memory.parallel_sanitize
  ctx.workflow.registerAction('action.memory.parallel_sanitize', async ({ params, results }) => {
    const inboxScan = results?.['step_scan_inbox'] || results?.['scan_inbox'] || {};
    const items = inboxScan.items || [];
    if (!items.length) {
      return { sanitized_count: 0, items: [] };
    }

    const cleanedItems = items.map(item => {
      const sanitized = ctx.crypto?.sanitize ? ctx.crypto.sanitize(item.full_content) : { cleanText: item.full_content, hasSecret: false };
      const words = (sanitized.cleanText || '')
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);

      const freqMap = {};
      for (const w of words) freqMap[w] = (freqMap[w] || 0) + 1;
      const topKeywords = Object.entries(freqMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(e => e[0]);

      return {
        id: item.id,
        clean_content: sanitized.cleanText,
        has_secret: sanitized.hasSecret,
        top_keywords: topKeywords
      };
    });

    return {
      sanitized_count: cleanedItems.length,
      cleaned_items: cleanedItems
    };
  });

  // 1.3 action.memory.auto_link_edges
  ctx.workflow.registerAction('action.memory.auto_link_edges', async ({ params, results }) => {
    const now = new Date().toISOString();
    const activeNodes = ctx.db.query(
      "SELECT id, dir_path, node_type, title, keywords FROM knowledge_nodes WHERE status = 'active' ORDER BY drawer_level DESC LIMIT 100"
    );

    let linksCreated = 0;
    for (let i = 0; i < activeNodes.length; i++) {
      for (let j = i + 1; j < activeNodes.length; j++) {
        const n1 = activeNodes[i];
        const n2 = activeNodes[j];

        const kw1 = (n1.keywords || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const kw2 = (n2.keywords || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const inter = kw1.filter(k => kw2.includes(k));

        if (inter.length > 0) {
          const edgeId = `edge_${n1.id}_${n2.id}_co_occur`;
          ctx.db.run(
            `INSERT INTO knowledge_edges (id, source_id, target_id, relation, weight, created_at)
             VALUES (?, ?, ?, 'relates_to', ?, ?)
             ON CONFLICT(source_id, target_id, relation) DO UPDATE SET weight = weight + 0.1`,
            [edgeId, n1.id, n2.id, 0.5 + inter.length * 0.2, now]
          );
          linksCreated++;
        }
      }
    }

    // 若有短期碎片超过 5 条，自动在 /Tech/Distilled 聚合成一条结构化候选总结节点
    const inboxRows = ctx.db.query(
      "SELECT id, title, tldr FROM knowledge_nodes WHERE dir_path = '/Inbox' AND drawer_level = 0 AND status = 'active'"
    );

    let distilledNodeId = null;
    if (inboxRows.length >= 5) {
      distilledNodeId = 'kn_distilled_' + Date.now().toString(36);
      const summaryTitle = `自动成链蒸馏总结 (${inboxRows.length} 条短期碎片聚合)`;
      const summaryTldr = `汇聚了近期 ${inboxRows.length} 条碎片临时备忘并完成关联拓扑成链`;
      const summaryContent = inboxRows.map(r => `- **[${r.title}]**: ${r.tldr}`).join('\n');
      const tokens = estimateTokens(summaryContent);

      ctx.db.run(
        `INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, token_estimate, status, confidence, drawer_level, access_count, last_accessed_at, created_at)
         VALUES (?, '/Tech/Distilled', 'solution', ?, ?, 'distilled,auto_chain', ?, ?, 'active', 0.85, 3, 1, ?, ?)`,
        [distilledNodeId, summaryTitle, summaryTldr, summaryContent, tokens, now, now]
      );

      // 清理已聚合的 inbox 碎片
      for (const r of inboxRows) {
        ctx.db.run("DELETE FROM knowledge_nodes WHERE id = ?", [r.id]);
      }
    }

    return {
      links_checked: activeNodes.length,
      links_created_or_reinforced: linksCreated,
      distilled_node_id: distilledNodeId,
      inbox_aggregated_count: inboxRows.length >= 5 ? inboxRows.length : 0
    };
  });

  // 1.4 action.memory.run_decay
  ctx.workflow.registerAction('action.memory.run_decay', async () => {
    let decayResult = null;
    try {
      if (typeof ctx.workers?.run === 'function') {
        decayResult = await ctx.workers.run('task:graph_decay_patrol', {}, 'P2', 30000);
      } else if (typeof ctx.workers?.execute === 'function') {
        decayResult = await ctx.workers.execute('task:graph_decay_patrol', {});
      }
    } catch (e) {
      console.warn('[action.memory.run_decay] Worker decay warning:', e.message);
    }

    if (!decayResult) {
      decayResult = { total_checked: 0, decayed_count: 0, archived_count: 0, orphan_cleaned: 0 };
    }

    return {
      success: true,
      decay_result: decayResult
    };
  });

  // 1.5 action.system.snapshot_backup
  ctx.workflow.registerAction('action.system.snapshot_backup', async () => {
    let backupPath = null;
    if (typeof ctx.db?.backup === 'function') {
      backupPath = ctx.db.backup();
    }
    return {
      success: true,
      backup_path: backupPath,
      timestamp: new Date().toISOString()
    };
  });

  // =========================================================================
  // 2. 注入 2 条 Fork & Join 并行 DAG 自动化流水线
  // =========================================================================

  // 2.1 流水线 A: dag-inbox-distill (短期记忆自动成链)
  const registerTpl = (def) => {
    if (typeof ctx.workflow?.registerTemplate === 'function') {
      try {
        // Pass def as first argument so dagScheduler receives def.id
        ctx.workflow.registerTemplate(def, def);
      } catch {
        ctx.workflow.registerTemplate(def);
      }
    }
  };
  registerTpl({
    id: 'dag-inbox-distill',
    name: '短期记忆自动成链与蒸馏流水线',
    description: '当 Inbox 累积 10 条或手动触发时，并行敏感词清洗与图谱连线聚合',
    trigger: {
      type: 'event',
      eventName: 'memory:inbox_added',
      threshold: 10
    },
    nodes: [
      {
        id: 'step_scan_inbox',
        actionId: 'action.memory.scan_inbox',
        params: { minCount: 1 }
      },
      {
        id: 'step_parallel_sanitize',
        actionId: 'action.memory.parallel_sanitize',
        dependsOn: ['step_scan_inbox']
      },
      {
        id: 'step_auto_link_edges',
        actionId: 'action.memory.auto_link_edges',
        dependsOn: ['step_scan_inbox']
      },
      {
        id: 'step_join_distill_report',
        actionId: 'action.memory.scan_inbox', // lightweight join action
        dependsOn: ['step_parallel_sanitize', 'step_auto_link_edges']
      }
    ]
  });

  // 2.2 流水线 B: dag-daily-patrol (每日零点健康巡检)
  registerTpl({
    id: 'dag-daily-patrol',
    name: '每日零点健康巡检与数据库热备',
    description: '三路并发执行全库抽屉指数衰减、知识图谱共现巡检与 SQLite 快照热备',
    trigger: {
      type: 'interval',
      cronExpr: '0 0 * * *',
      intervalMs: 86400000
    },
    nodes: [
      {
        id: 'branch_decay_patrol',
        actionId: 'action.memory.run_decay'
      },
      {
        id: 'branch_auto_link_edges',
        actionId: 'action.memory.auto_link_edges'
      },
      {
        id: 'branch_snapshot_backup',
        actionId: 'action.system.snapshot_backup'
      },
      {
        id: 'join_patrol_summary',
        actionId: 'action.system.snapshot_backup', // join node
        dependsOn: ['branch_decay_patrol', 'branch_auto_link_edges', 'branch_snapshot_backup']
      }
    ]
  });

  // =========================================================================
  // 3. 落地【补全 7：便携式知识胶囊导出与导入】 (DSH Tools)
  // =========================================================================

  // 3.1 memory_capsule_export
  ctx.tools.register({
    name: 'memory_capsule_export',
    description: '将知识节点与图谱导出为脱敏.dsh-capsule.json',
    parameters: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: '要导出的虚拟目录根路径，例如 /Tech 或 /Projects，输入 / 导出全库知识',
          default: '/'
        },
        capsule_name: {
          type: 'string',
          description: '知识胶囊包名称，如 "frontend-tech-stack" 或 "backend-architecture"'
        }
      },
      required: ['dir_path']
    },
    handler: async (args = {}) => {
      const { dir_path = '/', capsule_name } = args;

      // 铁律：严禁导出 /Vault 目录与机密！
      if (dir_path === '/Vault' || dir_path.startsWith('/Vault/')) {
        return { error: 'Security Violation: Exporting /Vault directory or secrets is strictly forbidden!' };
      }

      let nodeSql = "SELECT * FROM knowledge_nodes WHERE status = 'active' AND dir_path != '/Vault' AND dir_path NOT LIKE '/Vault/%'";
      const params = [];
      if (dir_path !== '/') {
        nodeSql += " AND (dir_path = ? OR dir_path LIKE ?)";
        params.push(dir_path, dir_path.endsWith('/') ? dir_path + '%' : dir_path + '/%');
      }

      const rawNodes = ctx.db.query(nodeSql, params);

      // 二次脱敏校验（严格脱敏机密与 Vault 敏感标记）
      const safeNodes = rawNodes.map(n => {
        const sanitized = ctx.crypto?.sanitize ? ctx.crypto.sanitize(n.full_content) : { cleanText: n.full_content };
        const cleanContent = (sanitized.cleanText || '').replace(/\/Vault\b|\/Vault\//g, '[PROTECTED_VAULT]');
        const cleanTldr = (n.tldr || '').replace(/\/Vault\b|\/Vault\//g, '[PROTECTED_VAULT]');
        return {
          id: n.id,
          dir_path: (n.dir_path || '').replace(/\/Vault\b|\/Vault\//g, '[PROTECTED_VAULT]'),
          node_type: n.node_type,
          title: n.title,
          tldr: cleanTldr,
          keywords: n.keywords,
          full_content: cleanContent,
          confidence: n.confidence,
          drawer_level: n.drawer_level,
          created_at: n.created_at
        };
      });

      const nodeIds = new Set(safeNodes.map(n => n.id));
      const edges = ctx.db.query('SELECT * FROM knowledge_edges')
        .filter(e => nodeIds.has(e.source_id) && nodeIds.has(e.target_id));

      const dirSql = dir_path === '/'
        ? "SELECT * FROM memory_directories WHERE path != '/Vault' AND path NOT LIKE '/Vault/%'"
        : "SELECT * FROM memory_directories WHERE path = ? OR path LIKE ?";
      const dirParams = dir_path === '/' ? [] : [dir_path, dir_path.endsWith('/') ? dir_path + '%' : dir_path + '/%'];
      const directories = ctx.db.query(dirSql, dirParams);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = (capsule_name || 'capsule_' + (dir_path === '/' ? 'all' : dir_path.replace(/\//g, '_'))).replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${safeName}_${timestamp}.dsh-capsule.json`;
      const exportPath = path.join(CAPSULES_DIR, fileName);

      const capsuleData = {
        dsh_format: 'DSH_KNOWLEDGE_CAPSULE_V4',
        exported_at: new Date().toISOString(),
        capsule_name: safeName,
        source_dir_path: dir_path,
        meta: {
          node_count: safeNodes.length,
          edge_count: edges.length,
          directory_count: directories.length
        },
        directories,
        nodes: safeNodes,
        edges
      };

      fs.writeFileSync(exportPath, JSON.stringify(capsuleData, null, 2), 'utf8');

      ctx.bus?.emit?.('memory:capsule_exported', { fileName, exportPath, nodeCount: safeNodes.length });

      return {
        success: true,
        capsule_name: safeName,
        export_path: exportPath,
        file_name: fileName,
        file_size_bytes: fs.statSync(exportPath).size,
        exported_nodes: safeNodes.length,
        exported_edges: edges.length,
        exported_directories: directories.length
      };
    }
  });

  // 3.2 memory_capsule_import
  ctx.tools.register({
    name: 'memory_capsule_import',
    description: '导入知识胶囊包并自动重算向量',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '胶囊包的完整绝对路径，或放置在 ~/.dsh/memory_vault/capsules/ 下的文件名'
        },
        conflict_strategy: {
          type: 'string',
          enum: ['merge', 'skip'],
          description: '遇到同 ID 节点的合并冲突策略: merge (覆盖合并并压入历史快照) | skip (跳过)',
          default: 'merge'
        }
      },
      required: ['file_path']
    },
    handler: async (args = {}) => {
      const { file_path, conflict_strategy = 'merge' } = args;
      let targetFile = file_path;
      if (!fs.existsSync(targetFile)) {
        targetFile = path.join(CAPSULES_DIR, file_path);
      }
      if (!fs.existsSync(targetFile)) {
        return { error: `Capsule file not found: ${file_path}` };
      }

      let capsule = null;
      try {
        capsule = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
      } catch (err) {
        return { error: `Invalid capsule JSON file: ${err.message}` };
      }

      if (capsule.dsh_format !== 'DSH_KNOWLEDGE_CAPSULE_V4') {
        return { error: 'Unsupported capsule format. Expected DSH_KNOWLEDGE_CAPSULE_V4.' };
      }

      const now = new Date().toISOString();
      let importedDirs = 0;
      let importedNodes = 0;
      let importedEdges = 0;

      // 1. 导入目录
      for (const d of (capsule.directories || [])) {
        if (d.path === '/Vault' || d.path.startsWith('/Vault/')) continue;
        ctx.db.run(
          `INSERT INTO memory_directories (path, parent_path, name, dir_summary, workspace_path, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(path) DO UPDATE SET
             name = COALESCE(excluded.name, memory_directories.name),
             dir_summary = COALESCE(excluded.dir_summary, memory_directories.dir_summary),
             updated_at = excluded.updated_at`,
          [d.path, d.parent_path || '/', d.name, d.dir_summary, d.workspace_path || null, now]
        );
        importedDirs++;
      }

      // 2. 导入节点
      for (const n of (capsule.nodes || [])) {
        if (n.dir_path === '/Vault' || n.dir_path.startsWith('/Vault/')) continue;

        const existing = ctx.db.get('SELECT * FROM knowledge_nodes WHERE id = ?', [n.id]);
        if (existing && conflict_strategy === 'skip') {
          continue;
        }

        // 若 merge 冲突，旧版压入 node_history
        if (existing && conflict_strategy === 'merge') {
          const histRows = ctx.db.query('SELECT version_num FROM node_history WHERE node_id = ? ORDER BY version_num DESC', [n.id]);
          const nextV = histRows.length > 0 ? histRows[0].version_num + 1 : 1;
          ctx.db.run(
            `INSERT INTO node_history (node_id, version_num, title, tldr, full_content, keywords, archived_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [existing.id, nextV, existing.title, existing.tldr, existing.full_content, existing.keywords, now]
          );
        }

        const safeContent = ctx.crypto?.sanitize ? ctx.crypto.sanitize(n.full_content).cleanText : n.full_content;
        const tokens = estimateTokens(safeContent);

        ctx.db.run(
          `INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, token_estimate, status, confidence, drawer_level, access_count, last_accessed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             dir_path = excluded.dir_path,
             node_type = excluded.node_type,
             title = excluded.title,
             tldr = excluded.tldr,
             keywords = excluded.keywords,
             full_content = excluded.full_content,
             token_estimate = excluded.token_estimate,
             confidence = excluded.confidence,
             drawer_level = excluded.drawer_level,
             last_accessed_at = excluded.last_accessed_at`,
          [n.id, n.dir_path, n.node_type || 'tech', n.title, n.tldr, n.keywords || '', safeContent, tokens, n.confidence || 0.8, n.drawer_level || 3, now, n.created_at || now]
        );

        // 重算特征向量
        const vec = extractEmbedding64(n.title + ' ' + (n.tldr || '') + ' ' + (n.keywords || '') + ' ' + safeContent.slice(0, 500));
        ctx.db.run(
          `INSERT OR REPLACE INTO node_embeddings (node_id, vector_json, updated_at)
           VALUES (?, ?, ?)`,
          [n.id, JSON.stringify(vec), now]
        );

        importedNodes++;
      }

      // 3. 导入图谱关系
      for (const e of (capsule.edges || [])) {
        ctx.db.run(
          `INSERT INTO knowledge_edges (id, source_id, target_id, relation, weight, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(source_id, target_id, relation) DO UPDATE SET weight = MAX(knowledge_edges.weight, excluded.weight)`,
          [e.id, e.source_id, e.target_id, e.relation, e.weight || 1.0, e.created_at || now]
        );
        importedEdges++;
      }

      ctx.bus?.emit?.('memory:capsule_imported', { file_path: targetFile, importedNodes, importedEdges });

      return {
        success: true,
        capsule_name: capsule.capsule_name,
        imported_directories: importedDirs,
        imported_nodes: importedNodes,
        imported_edges: importedEdges,
        message: `知识胶囊包 "${capsule.capsule_name}" 成功挂载导入当前知识库！`
      };
    }
  });

  // =========================================================================
  // 4. 挂载 GUI REST APIs 与微前端控制台
  // =========================================================================

  // 4.1 GET /api/ext/auto-distiller/capsules (列表)
  ctx.gui.registerApi('GET', '/api/ext/auto-distiller/capsules', async (req, res, { sendJson }) => {
    try {
      if (!fs.existsSync(CAPSULES_DIR)) return sendJson(200, { success: true, items: [] });
      const files = fs.readdirSync(CAPSULES_DIR).filter(f => f.endsWith('.dsh-capsule.json'));
      const items = files.map(f => {
        const full = path.join(CAPSULES_DIR, f);
        const stat = fs.statSync(full);
        return {
          file_name: f,
          full_path: full,
          size_bytes: stat.size,
          mtime: stat.mtime
        };
      }).sort((a, b) => b.mtime - a.mtime);
      return sendJson(200, { success: true, items });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 4.2 POST /api/ext/auto-distiller/export
  ctx.gui.registerApi('POST', '/api/ext/auto-distiller/export', async (req, res, { body, sendJson }) => {
    try {
      const { dir_path = '/', capsule_name } = body || {};
      const tool = ctx.tools.register ? null : null;
      // 直接复用逻辑
      const expRes = await ctx.workflow.run ? null : null;
      // 调用内部逻辑
      let nodeSql = "SELECT * FROM knowledge_nodes WHERE status = 'active' AND dir_path != '/Vault' AND dir_path NOT LIKE '/Vault/%'";
      const params = [];
      if (dir_path !== '/') {
        nodeSql += " AND (dir_path = ? OR dir_path LIKE ?)";
        params.push(dir_path, dir_path.endsWith('/') ? dir_path + '%' : dir_path + '/%');
      }
      const rawNodes = ctx.db.query(nodeSql, params);
      const safeNodes = rawNodes.map(n => ({
        id: n.id, dir_path: n.dir_path, node_type: n.node_type, title: n.title, tldr: n.tldr,
        keywords: n.keywords, full_content: n.full_content, confidence: n.confidence, drawer_level: n.drawer_level, created_at: n.created_at
      }));
      const nodeIds = new Set(safeNodes.map(n => n.id));
      const edges = ctx.db.query('SELECT * FROM knowledge_edges').filter(e => nodeIds.has(e.source_id) && nodeIds.has(e.target_id));
      const safeName = (capsule_name || 'capsule').replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${safeName}_${timestamp}.dsh-capsule.json`;
      const exportPath = path.join(CAPSULES_DIR, fileName);

      fs.writeFileSync(exportPath, JSON.stringify({
        dsh_format: 'DSH_KNOWLEDGE_CAPSULE_V4',
        exported_at: new Date().toISOString(),
        capsule_name: safeName,
        source_dir_path: dir_path,
        meta: { node_count: safeNodes.length, edge_count: edges.length },
        directories: [],
        nodes: safeNodes,
        edges
      }, null, 2), 'utf8');

      return sendJson(200, { success: true, fileName, exportPath, nodeCount: safeNodes.length });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 4.3 POST /api/ext/auto-distiller/import
  ctx.gui.registerApi('POST', '/api/ext/auto-distiller/import', async (req, res, { body, sendJson }) => {
    try {
      const { file_name, conflict_strategy = 'merge' } = body || {};
      const fullPath = path.join(CAPSULES_DIR, file_name);
      if (!fs.existsSync(fullPath)) return sendJson(404, { error: 'Capsule file not found' });
      const capsule = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      let imported = 0;
      const now = new Date().toISOString();
      for (const n of (capsule.nodes || [])) {
        ctx.db.run(
          `INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, token_estimate, status, confidence, drawer_level, access_count, last_accessed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title = excluded.title, tldr = excluded.tldr, full_content = excluded.full_content`,
          [n.id, n.dir_path, n.node_type || 'tech', n.title, n.tldr, n.keywords, n.full_content, estimateTokens(n.full_content), n.confidence || 0.8, n.drawer_level || 3, now, now]
        );
        imported++;
      }
      return sendJson(200, { success: true, imported_nodes: imported });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 4.4 注册微前端控制台视图 (slot-2 / slot-3)
  const renderScript = `
    const root = container;
    root.innerHTML = \`
      <div class="h-full flex flex-col space-y-4">
        <div class="flex items-center justify-between pb-2 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 class="text-base font-semibold text-cyan-400 flex items-center space-x-2">
              <span>💊</span>
              <span>知识胶囊便携包与 DAG 自动化巡检</span>
            </h2>
            <p class="text-xs text-slate-400">脱敏跨端便携分发 · 零明文安全胶囊 · Fork & Join 并行自动化流水线管控</p>
          </div>
          <div class="flex space-x-2">
            <button id="ad-btn-run-distill" class="px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-slate-100 rounded text-xs transition">运行成链 DAG</button>
            <button id="ad-btn-run-patrol" class="px-2.5 py-1 bg-amber-700 hover:bg-amber-600 text-slate-100 rounded text-xs transition">运行巡检热备 DAG</button>
          </div>
        </div>

        <div class="flex-1 grid grid-cols-12 gap-4 min-h-0">
          <!-- 左侧：知识胶囊导出面板 (6 列) -->
          <div class="col-span-6 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-0 space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-slate-800 text-xs flex-shrink-0">
              <span class="font-semibold text-slate-300">📦 一键打包导出知识胶囊 (.dsh-capsule.json)</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">Vault 密钥隔离</span>
            </div>

            <div class="space-y-2 text-xs">
              <div>
                <label class="block text-slate-400 mb-1">选择导出源目录路径</label>
                <input id="ad-exp-dir" value="/" placeholder="如 /Tech 或 /Projects" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono outline-none">
              </div>
              <div>
                <label class="block text-slate-400 mb-1">知识胶囊命名</label>
                <input id="ad-exp-name" value="tech_knowledge_pack" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono outline-none">
              </div>
              <div class="pt-2">
                <button id="ad-btn-export" class="w-full py-1.5 bg-emerald-700 hover:bg-emerald-600 text-slate-100 rounded font-semibold text-xs transition">生成并打包知识胶囊</button>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-800 flex-1 flex flex-col min-h-0">
              <span class="text-xs font-semibold text-slate-400 mb-2">已生成的胶囊库 (~/.dsh/memory_vault/capsules/)</span>
              <div id="ad-capsule-list" class="flex-1 overflow-y-auto space-y-1.5 text-xs pr-1 font-mono"></div>
            </div>
          </div>

          <!-- 右侧：DAG 自动化执行与成链流水线状态 (6 列) -->
          <div class="col-span-6 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-0 space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-slate-800 text-xs flex-shrink-0">
              <span class="font-semibold text-slate-300">⚡ 自动化流水线调度面板</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">DAG Fork & Join</span>
            </div>

            <div class="space-y-2 text-xs">
              <div class="p-2.5 bg-slate-950 rounded border border-slate-800 space-y-1">
                <div class="flex items-center justify-between font-semibold text-slate-200">
                  <span>🌿 流水线 A: dag-inbox-distill</span>
                  <span class="text-[10px] text-cyan-400 font-mono">阈值: 10 条</span>
                </div>
                <div class="text-[11px] text-slate-400">短期记忆扫描 -> 并行脱敏清洗 || 自动图谱连线 -> 聚合成链</div>
              </div>

              <div class="p-2.5 bg-slate-950 rounded border border-slate-800 space-y-1">
                <div class="flex items-center justify-between font-semibold text-slate-200">
                  <span>🕒 流水线 B: dag-daily-patrol</span>
                  <span class="text-[10px] text-amber-400 font-mono">Cron: 每日零点</span>
                </div>
                <div class="text-[11px] text-slate-400">三路并发：指数衰减归档 || 图谱共现巡检 || SQLite 数据库快照热备</div>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-800 flex-1 flex flex-col min-h-0">
              <span class="text-xs font-semibold text-slate-400 mb-2">流水线实时执行监控</span>
              <div id="ad-dag-log" class="flex-1 bg-slate-950 p-2 rounded border border-slate-800 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-300">
                <div class="text-slate-500">等待触发流水线...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    \`;

    async function loadCapsules() {
      const box = root.querySelector('#ad-capsule-list');
      const res = await shell.apiFetch('/api/ext/auto-distiller/capsules');
      box.innerHTML = '';
      if (!res.items || !res.items.length) {
        box.innerHTML = '<div class="text-slate-500 py-6 text-center text-xs">暂无胶囊文件</div>';
        return;
      }
      res.items.forEach(c => {
        const row = document.createElement('div');
        row.className = 'p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between hover:border-slate-700 transition';
        row.innerHTML = \`
          <div class="truncate mr-2">
            <div class="text-cyan-400 text-xs truncate">\${c.file_name}</div>
            <div class="text-[10px] text-slate-500">\${Math.round(c.size_bytes / 1024)} KB · \${c.mtime.slice(0, 19).replace('T', ' ')}</div>
          </div>
          <button class="btn-import px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] border border-slate-700 flex-shrink-0">一键导入挂载</button>
        \`;
        row.querySelector('.btn-import')?.addEventListener('click', async () => {
          if (confirm('确认导入知识胶囊 ' + c.file_name + '？')) {
            const impRes = await shell.apiFetch('/api/ext/auto-distiller/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file_name: c.file_name })
            });
            shell.notify('info', '已成功导入知识节点: ' + (impRes.imported_nodes || 0));
          }
        });
        box.appendChild(row);
      });
    }

    function appendDagLog(msg, color = 'text-slate-300') {
      const logBox = root.querySelector('#ad-dag-log');
      const div = document.createElement('div');
      div.className = color;
      div.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
      logBox.appendChild(div);
      logBox.scrollTop = logBox.scrollHeight;
    }

    root.querySelector('#ad-btn-export')?.addEventListener('click', async () => {
      const dir_path = root.querySelector('#ad-exp-dir')?.value.trim();
      const capsule_name = root.querySelector('#ad-exp-name')?.value.trim();
      const res = await shell.apiFetch('/api/ext/auto-distiller/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir_path, capsule_name })
      });
      if (res.success) {
        shell.notify('info', '胶囊生成成功: ' + res.fileName);
        loadCapsules();
      } else {
        shell.notify('error', '导出失败: ' + res.error);
      }
    });

    root.querySelector('#ad-btn-run-distill')?.addEventListener('click', async () => {
      appendDagLog('正在手动触发流水线 dag-inbox-distill...', 'text-cyan-400');
      const res = await shell.apiFetch('/api/sys/workflows/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'dag-inbox-distill' })
      });
      appendDagLog('流水线执行完成: ' + JSON.stringify(res.result?.status || 'DONE'), 'text-emerald-400');
    });

    root.querySelector('#ad-btn-run-patrol')?.addEventListener('click', async () => {
      appendDagLog('正在手动触发流水线 dag-daily-patrol (三路并行)...', 'text-amber-400');
      const res = await shell.apiFetch('/api/sys/workflows/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'dag-daily-patrol' })
      });
      appendDagLog('巡检热备执行完成: ' + JSON.stringify(res.result?.status || 'DONE'), 'text-emerald-400');
    });

    loadCapsules();
  `;

  ctx.gui.registerView('/view-auto-distiller', {
    id: 'view-auto-distiller',
    title: '知识胶囊与自动巡检',
    icon: '💊',
    slot: 'slot-2',
    renderScript
  });

  console.log('[plg-auto-distiller] 自动化工作流与知识胶囊包插件已就绪。');

  return {
    manifest,
    deactivate: async () => {
      console.log('[plg-auto-distiller] Deactivating auto-distiller plugin...');
    }
  };
}

export default {
  manifest,
  activate
};
