// ~/.dsh/plugins/dsh-system-pedestal/plugins/plg-cold-timemachine.mjs
// 冷数据召回与历史版本时光机插件 (v4.0.0)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

export const manifest = {
  id: 'cold-timemachine',
  name: '冷库打捞与版本时光机',
  version: '4.0.0',
  dependencies: ['memory-engine']
};

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

/**
 * 简易行级 Diff 计算（无需外部依赖）
 */
function computeLineDiff(oldText = '', newText = '') {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff = [];
  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === undefined) {
      diff.push({ type: 'added', line: n, lineNum: i + 1 });
    } else if (n === undefined) {
      diff.push({ type: 'removed', line: o, lineNum: i + 1 });
    } else if (o === n) {
      diff.push({ type: 'unchanged', line: o, lineNum: i + 1 });
    } else {
      diff.push({ type: 'removed', line: o, lineNum: i + 1 });
      diff.push({ type: 'added', line: n, lineNum: i + 1 });
    }
  }
  return diff;
}

export async function activate(ctx) {
  console.log('[plg-cold-timemachine] Activating 冷库打捞与版本时光机 v4.0.0...');

  const HOMEDIR = os.homedir();
  const ARCHIVE_FILE = path.join(HOMEDIR, '.dsh', 'memory_vault', 'dropped_archive.jsonl');

  // =========================================================================
  // 1. 注册 Worker 流式扫描任务 (task:cold_jsonl_scan)
  // =========================================================================
  const coldJsonlScanFn = async (payload) => {
    const { query, archiveFilePath, limit = 20 } = payload;
    const fs = await import('node:fs');
    const readline = await import('node:readline');

    if (!archiveFilePath || !fs.existsSync(archiveFilePath)) {
      return [];
    }

    const qLower = (query || '').toLowerCase().trim();
    const results = [];
    let lineNumber = 0;

    const fileStream = fs.createReadStream(archiveFilePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      lineNumber++;
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const item = JSON.parse(trimmed);
        const title = (item.title || '').toLowerCase();
        const tldr = (item.tldr || '').toLowerCase();
        const keywords = (item.keywords || '').toLowerCase();
        const fullContent = (item.full_content || '').toLowerCase();

        let matched = false;
        let matchScore = 0;

        if (!qLower) {
          matched = true;
        } else if (title.includes(qLower)) {
          matched = true;
          matchScore += 10;
        } else if (keywords.includes(qLower)) {
          matched = true;
          matchScore += 6;
        } else if (tldr.includes(qLower)) {
          matched = true;
          matchScore += 4;
        } else if (fullContent.includes(qLower)) {
          matched = true;
          matchScore += 2;
        }

        if (matched) {
          results.push({
            lineNumber,
            id: item.id,
            dir_path: item.dir_path,
            node_type: item.node_type,
            title: item.title,
            tldr: item.tldr,
            keywords: item.keywords,
            archived_at: item.archived_at,
            reason: item.reason,
            matchScore
          });

          if (results.length >= limit) {
            break;
          }
        }
      } catch {}
    }

    results.sort((a, b) => b.matchScore - a.matchScore);
    return results;
  };

  const fallbackTasks = new Map();
  fallbackTasks.set('task:cold_jsonl_scan', coldJsonlScanFn);

  // 注册到 worker pool
  ctx.workers.registerWorkerTask('task:cold_jsonl_scan', coldJsonlScanFn);

  const runWorkerTask = async (taskName, payload, prio = 'P2', timeout = 30000) => {
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
      console.warn(`[plg-cold-timemachine] Worker ${taskName} fallback: ${err.message}`);
    }

    const fallbackFn = fallbackTasks.get(taskName);
    if (fallbackFn) {
      return await fallbackFn(payload);
    }
    throw new Error(`Task ${taskName} execution failed and no fallback available`);
  };

  // =========================================================================
  // 2. 注册 2 个 DSH Tools
  // =========================================================================

  // 2.1 memory_revive_cold (冷数据检索与一键复活)
  ctx.tools.register({
    name: 'memory_revive_cold',
    description: '冷库打捞与复活：从 ~/.dsh/memory_vault/dropped_archive.jsonl 流式检索已衰减沉睡的历史节点并一键复活回主知识库（赋予 Lv.2 初始抽屉等级）',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'revive'],
          description: '操作类型: search (流式搜索冷库) | revive (一键复活回主库)'
        },
        query: {
          type: 'string',
          description: '检索词（当 action = search 时必填）'
        },
        node_id: {
          type: 'string',
          description: '需要复活的目标节点 ID（当 action = revive 时必填）'
        }
      },
      required: ['action']
    },
    handler: async (args = {}) => {
      const { action = 'search', query = '', node_id } = args;

      if (action === 'search') {
        if (!fs.existsSync(ARCHIVE_FILE)) {
          return { action: 'search', total_matched: 0, matches: [], message: '冷归档文件尚未生成或无归档记录' };
        }

        const matches = await runWorkerTask(
          'task:cold_jsonl_scan',
          { query, archiveFilePath: ARCHIVE_FILE, limit: 30 },
          'P2',
          15000
        );

        return {
          action: 'search',
          query,
          total_matched: matches.length,
          matches
        };
      }

      if (action === 'revive') {
        if (!node_id) {
          return { error: 'node_id is required for revive action' };
        }
        if (!fs.existsSync(ARCHIVE_FILE)) {
          return { error: 'Archive file dropped_archive.jsonl does not exist' };
        }

        let targetRecord = null;
        const keptLines = [];

        const fileStream = fs.createReadStream(ARCHIVE_FILE, { encoding: 'utf8' });
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        for await (const line of rl) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const item = JSON.parse(trimmed);
            if (item.id === node_id && !targetRecord) {
              targetRecord = item;
            } else {
              keptLines.push(trimmed);
            }
          } catch {
            keptLines.push(trimmed);
          }
        }

        if (!targetRecord) {
          return { error: `Node "${node_id}" not found in cold archive` };
        }

        const now = new Date().toISOString();
        const tokens = estimateTokens(targetRecord.full_content || '');

        // 重新插回 knowledge_nodes 主表，赋予 drawer_level = 2, status = 'active'
        ctx.db.run(
          `INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, token_estimate, status, confidence, drawer_level, access_count, last_accessed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 2, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             dir_path = excluded.dir_path,
             node_type = excluded.node_type,
             title = excluded.title,
             tldr = excluded.tldr,
             keywords = excluded.keywords,
             full_content = excluded.full_content,
             token_estimate = excluded.token_estimate,
             status = 'active',
             confidence = excluded.confidence,
             drawer_level = 2,
             last_accessed_at = excluded.last_accessed_at`,
          [
            targetRecord.id,
            targetRecord.dir_path || '/Projects',
            targetRecord.node_type || 'tech',
            targetRecord.title,
            targetRecord.tldr,
            targetRecord.keywords || '',
            targetRecord.full_content,
            tokens,
            targetRecord.confidence || 0.8,
            now,
            targetRecord.created_at || now
          ]
        );

        // 重写冷归档文件，移除已复活的记录
        const newContent = keptLines.length > 0 ? keptLines.join('\n') + '\n' : '';
        fs.writeFileSync(ARCHIVE_FILE, newContent, 'utf8');

        ctx.bus?.emit?.('memory:node_revived', { id: targetRecord.id, title: targetRecord.title });

        return {
          success: true,
          action: 'revive',
          node_id: targetRecord.id,
          title: targetRecord.title,
          dir_path: targetRecord.dir_path,
          drawer_level: 2,
          status: 'active',
          message: `知识节点 [#${targetRecord.id}: ${targetRecord.title}] 已成功打捞并复活，初始化抽屉等级 Lv.2！`
        };
      }

      return { error: `Unknown action: ${action}` };
    }
  });

  // 2.2 memory_node_rollback (节点多版本时光机与误改回滚)
  ctx.tools.register({
    name: 'memory_node_rollback',
    description: '知识节点版本时光机：查看节点历史版本快照列表或一键回滚到指定历史版本',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list_versions', 'rollback'],
          description: '操作: list_versions (查看最近 5 个版本快照) | rollback (一键回滚)'
        },
        node_id: {
          type: 'string',
          description: '知识节点 ID'
        },
        history_id: {
          type: 'number',
          description: '当 action = rollback 时必填，指定回滚到的历史快照 ID'
        }
      },
      required: ['action', 'node_id']
    },
    handler: async (args = {}) => {
      const { action = 'list_versions', node_id, history_id } = args;
      if (!node_id) {
        return { error: 'node_id is required' };
      }

      const currentNode = ctx.db.get('SELECT * FROM knowledge_nodes WHERE id = ?', [node_id]);

      if (action === 'list_versions') {
        const historyRows = ctx.db.query(
          'SELECT history_id, node_id, version_num, title, tldr, LENGTH(full_content) as char_count, keywords, archived_at FROM node_history WHERE node_id = ? ORDER BY version_num DESC LIMIT 5',
          [node_id]
        );

        return {
          action: 'list_versions',
          node_id,
          current_version: currentNode ? {
            title: currentNode.title,
            tldr: currentNode.tldr,
            char_count: (currentNode.full_content || '').length,
            drawer_level: currentNode.drawer_level,
            updated_at: currentNode.last_accessed_at || currentNode.created_at
          } : null,
          total_snapshots: historyRows.length,
          snapshots: historyRows.map(h => ({
            history_id: h.history_id,
            version_num: h.version_num,
            title: h.title,
            tldr: h.tldr,
            keywords: h.keywords,
            char_count: h.char_count,
            archived_at: h.archived_at
          }))
        };
      }

      if (action === 'rollback') {
        if (!history_id) {
          return { error: 'history_id is required for rollback action' };
        }

        const snapshot = ctx.db.get('SELECT * FROM node_history WHERE history_id = ? AND node_id = ?', [history_id, node_id]);
        if (!snapshot) {
          return { error: `History snapshot #${history_id} for node "${node_id}" not found` };
        }

        const now = new Date().toISOString();

        // 1. 如果主表有当前状态，先将当前主表状态备份压入 node_history
        if (currentNode) {
          const histRows = ctx.db.query('SELECT version_num FROM node_history WHERE node_id = ? ORDER BY version_num DESC', [node_id]);
          const nextVersion = histRows.length > 0 ? (histRows[0].version_num + 1) : 1;

          ctx.db.run(
            `INSERT INTO node_history (node_id, version_num, title, tldr, full_content, keywords, archived_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [currentNode.id, nextVersion, currentNode.title, currentNode.tldr, currentNode.full_content, currentNode.keywords, now]
          );

          // 保持只留最新 5 个快照
          const allHist = ctx.db.query('SELECT history_id FROM node_history WHERE node_id = ? ORDER BY version_num DESC', [node_id]);
          if (allHist.length > 5) {
            for (const d of allHist.slice(5)) {
              ctx.db.run('DELETE FROM node_history WHERE history_id = ?', [d.history_id]);
            }
          }
        }

        // 2. 将快照数据回滚写入 knowledge_nodes 主表
        const tokens = estimateTokens(snapshot.full_content || '');
        if (currentNode) {
          ctx.db.run(
            `UPDATE knowledge_nodes
             SET title = ?,
                 tldr = ?,
                 full_content = ?,
                 keywords = ?,
                 token_estimate = ?,
                 last_accessed_at = ?
             WHERE id = ?`,
            [snapshot.title, snapshot.tldr, snapshot.full_content, snapshot.keywords, tokens, now, node_id]
          );
        } else {
          ctx.db.run(
            `INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, token_estimate, status, confidence, drawer_level, access_count, last_accessed_at, created_at)
             VALUES (?, '/Projects', 'tech', ?, ?, ?, ?, ?, 'active', 0.8, 3, 1, ?, ?)`,
            [node_id, snapshot.title, snapshot.tldr, snapshot.keywords, snapshot.full_content, tokens, now, now]
          );
        }

        ctx.bus?.emit?.('memory:node_rolled_back', { node_id, history_id, version_num: snapshot.version_num });

        return {
          success: true,
          action: 'rollback',
          node_id,
          rolled_back_to_version: snapshot.version_num,
          history_id: snapshot.history_id,
          title: snapshot.title,
          token_estimate: tokens,
          message: `节点 [#${node_id}] 已成功回滚至版本 v${snapshot.version_num}（归档于 ${snapshot.archived_at}）！`
        };
      }

      return { error: `Unknown action: ${action}` };
    }
  });

  // =========================================================================
  // 3. 挂载 GUI REST APIs
  // =========================================================================

  // 3.1 GET /api/ext/cold-timemachine/history (支持 query param ?node_id=xxx)
  ctx.gui.registerApi('GET', '/api/ext/cold-timemachine/history', async (req, res, { query, sendJson }) => {
    try {
      const nodeId = query?.node_id;
      if (!nodeId) return sendJson(400, { error: 'node_id is required' });

      const current = ctx.db.get('SELECT * FROM knowledge_nodes WHERE id = ?', [nodeId]);
      const history = ctx.db.query(
        'SELECT * FROM node_history WHERE node_id = ? ORDER BY version_num DESC LIMIT 5',
        [nodeId]
      );

      const historyWithDiff = history.map(h => ({
        ...h,
        diff: current ? computeLineDiff(h.full_content, current.full_content) : []
      }));

      return sendJson(200, {
        success: true,
        node_id: nodeId,
        current_node: current,
        history: historyWithDiff
      });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 3.2 POST /api/ext/cold-timemachine/rollback (执行版本一键回滚)
  ctx.gui.registerApi('POST', '/api/ext/cold-timemachine/rollback', async (req, res, { body, sendJson }) => {
    try {
      const { node_id, history_id } = body || {};
      if (!node_id || !history_id) {
        return sendJson(400, { error: 'node_id and history_id are required' });
      }

      const tool = ctx.tools.register ? null : null; // use handler logic directly
      const snapshot = ctx.db.get('SELECT * FROM node_history WHERE history_id = ? AND node_id = ?', [history_id, node_id]);
      if (!snapshot) return sendJson(404, { error: 'Snapshot not found' });

      const current = ctx.db.get('SELECT * FROM knowledge_nodes WHERE id = ?', [node_id]);
      const now = new Date().toISOString();

      if (current) {
        const histRows = ctx.db.query('SELECT version_num FROM node_history WHERE node_id = ? ORDER BY version_num DESC', [node_id]);
        const nextVersion = histRows.length > 0 ? (histRows[0].version_num + 1) : 1;
        ctx.db.run(
          `INSERT INTO node_history (node_id, version_num, title, tldr, full_content, keywords, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [current.id, nextVersion, current.title, current.tldr, current.full_content, current.keywords, now]
        );
      }

      const tokens = estimateTokens(snapshot.full_content || '');
      ctx.db.run(
        `UPDATE knowledge_nodes
         SET title = ?, tldr = ?, full_content = ?, keywords = ?, token_estimate = ?, last_accessed_at = ?
         WHERE id = ?`,
        [snapshot.title, snapshot.tldr, snapshot.full_content, snapshot.keywords, tokens, now, node_id]
      );

      ctx.bus?.emit?.('memory:node_rolled_back', { node_id, history_id, version_num: snapshot.version_num });
      return sendJson(200, { success: true, node_id, version_num: snapshot.version_num });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 3.3 GET /api/ext/cold-timemachine/cold (流式检索冷库)
  ctx.gui.registerApi('GET', '/api/ext/cold-timemachine/cold', async (req, res, { query, sendJson }) => {
    try {
      const q = query?.q || '';
      if (!fs.existsSync(ARCHIVE_FILE)) {
        return sendJson(200, { success: true, count: 0, items: [] });
      }

      const matches = await runWorkerTask(
        'task:cold_jsonl_scan',
        { query: q, archiveFilePath: ARCHIVE_FILE, limit: 50 },
        'P2',
        15000
      );

      return sendJson(200, { success: true, count: matches.length, items: matches });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 3.4 POST /api/ext/cold-timemachine/revive (冷数据一键复活)
  ctx.gui.registerApi('POST', '/api/ext/cold-timemachine/revive', async (req, res, { body, sendJson }) => {
    try {
      const { node_id } = body || {};
      if (!node_id) return sendJson(400, { error: 'node_id is required' });
      if (!fs.existsSync(ARCHIVE_FILE)) return sendJson(404, { error: 'Archive file not found' });

      let targetRecord = null;
      const keptLines = [];

      const fileStream = fs.createReadStream(ARCHIVE_FILE, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const item = JSON.parse(trimmed);
          if (item.id === node_id && !targetRecord) targetRecord = item;
          else keptLines.push(trimmed);
        } catch {
          keptLines.push(trimmed);
        }
      }

      if (!targetRecord) return sendJson(404, { error: 'Node not found in cold archive' });

      const now = new Date().toISOString();
      const tokens = estimateTokens(targetRecord.full_content || '');

      ctx.db.run(
        `INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, token_estimate, status, confidence, drawer_level, access_count, last_accessed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 2, 1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           dir_path = excluded.dir_path,
           node_type = excluded.node_type,
           title = excluded.title,
           tldr = excluded.tldr,
           keywords = excluded.keywords,
           full_content = excluded.full_content,
           token_estimate = excluded.token_estimate,
           status = 'active',
           confidence = excluded.confidence,
           drawer_level = 2,
           last_accessed_at = excluded.last_accessed_at`,
        [
          targetRecord.id,
          targetRecord.dir_path || '/Projects',
          targetRecord.node_type || 'tech',
          targetRecord.title,
          targetRecord.tldr,
          targetRecord.keywords || '',
          targetRecord.full_content,
          tokens,
          targetRecord.confidence || 0.8,
          now,
          targetRecord.created_at || now
        ]
      );

      fs.writeFileSync(ARCHIVE_FILE, keptLines.length > 0 ? keptLines.join('\n') + '\n' : '', 'utf8');
      ctx.bus?.emit?.('memory:node_revived', { id: targetRecord.id, title: targetRecord.title });

      return sendJson(200, { success: true, node_id: targetRecord.id, title: targetRecord.title });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // =========================================================================
  // 4. 注册微前端视图 (slot-2 / slot-3)
  // =========================================================================
  const renderScript = `
    const root = container;
    root.innerHTML = \`
      <div class="h-full flex flex-col space-y-4">
        <!-- 头部 -->
        <div class="flex items-center justify-between pb-2 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 class="text-base font-semibold text-cyan-400 flex items-center space-x-2">
              <span>⏳</span>
              <span>版本时光机与冷库打捞中心</span>
            </h2>
            <p class="text-xs text-slate-400">滑动窗口多版本快照对比回滚 · JSONL 极低内存流式冷库打捞 · 一键升权唤醒</p>
          </div>
          <div class="flex items-center space-x-2">
            <button id="tm-btn-refresh" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded border border-slate-700">刷新全部</button>
          </div>
        </div>

        <!-- 主内容区 (上下两段或左右分栏) -->
        <div class="flex-1 grid grid-cols-12 gap-4 min-h-0">
          <!-- 上半/左半：节点多版本时光机 (7 列) -->
          <div class="col-span-7 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-0 overflow-hidden">
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs flex-shrink-0">
              <span class="font-semibold text-slate-300 flex items-center space-x-1.5">
                <span>🔄</span>
                <span>节点历史版本时光机 (最近 5 个版本快照)</span>
              </span>
              <div class="flex items-center space-x-2">
                <input id="tm-node-input" placeholder="输入节点 ID (如 kn_...)" class="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-200 font-mono text-[11px] w-36 outline-none">
                <button id="tm-btn-load-node" class="px-2 py-0.5 bg-cyan-700 hover:bg-cyan-600 text-slate-100 rounded text-[11px]">查看版本</button>
              </div>
            </div>

            <div id="tm-history-container" class="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              <div class="text-xs text-slate-500 py-12 text-center">请输入左上方知识节点 ID 查看历史版本快照与 Diff 对比</div>
            </div>
          </div>

          <!-- 下半/右半：冷库流式打捞中心 (5 列) -->
          <div class="col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-0 overflow-hidden">
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs flex-shrink-0">
              <span class="font-semibold text-slate-300 flex items-center space-x-1.5">
                <span>🧊</span>
                <span>冷归档打捞中心 (dropped_archive.jsonl)</span>
              </span>
              <span id="tm-cold-count" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">0 条冷数据</span>
            </div>

            <div class="pb-2 flex space-x-2 flex-shrink-0">
              <input id="tm-cold-query" placeholder="流式检索冷归档条目..." class="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs outline-none">
              <button id="tm-btn-search-cold" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded border border-slate-700 text-xs">检索</button>
            </div>

            <div id="tm-cold-container" class="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              <div class="text-xs text-slate-500 py-12 text-center">冷归档库暂无数据或输入关键词开始流式扫描</div>
            </div>
          </div>
        </div>
      </div>
    \`;

    // 1. 加载历史版本
    async function loadNodeHistory(nodeId) {
      if (!nodeId) return;
      const box = root.querySelector('#tm-history-container');
      box.innerHTML = '<div class="text-xs text-slate-400 py-6 text-center">正在加载版本快照...</div>';

      try {
        const res = await shell.apiFetch('/api/ext/cold-timemachine/history?node_id=' + encodeURIComponent(nodeId));
        box.innerHTML = '';

        if (!res.history || res.history.length === 0) {
          box.innerHTML = \`
            <div class="p-3 bg-slate-950/60 rounded border border-slate-800">
              <div class="font-semibold text-slate-200">当前版本: \${res.current_node?.title || nodeId}</div>
              <div class="text-[11px] text-slate-400 mt-1">此节点暂无历史快照版本记录（当对已存在节点执行更新提交时将自动触发版本快照压栈）</div>
            </div>
          \`;
          return;
        }

        // 渲染当前版本标头
        const cur = res.current_node;
        const curDiv = document.createElement('div');
        curDiv.className = 'p-2 bg-slate-950/80 rounded border border-cyan-800/80 flex items-center justify-between text-xs mb-3';
        curDiv.innerHTML = \`
          <div>
            <span class="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 mr-2">CURRENT LIVE</span>
            <span class="font-semibold text-slate-100">\${cur?.title || nodeId}</span>
          </div>
          <span class="text-[10px] text-slate-400 font-mono">\${(cur?.full_content || '').length} 字符</span>
        \`;
        box.appendChild(curDiv);

        // 渲染历史快照列表
        res.history.forEach((h, idx) => {
          const card = document.createElement('div');
          card.className = 'p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2 hover:border-slate-700 transition';
          card.innerHTML = \`
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="px-1.5 py-0.5 rounded text-[10px] bg-purple-950 text-purple-400 border border-purple-800 font-mono">Snapshot v\${h.version_num}</span>
                <span class="font-semibold text-slate-200 font-mono">#\${h.history_id}</span>
                <span class="text-[11px] text-slate-400">\${h.archived_at ? h.archived_at.slice(0, 19).replace('T', ' ') : ''}</span>
              </div>
              <div class="flex space-x-1.5">
                <button class="btn-toggle-diff px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] border border-slate-700">对比差异</button>
                <button class="btn-rollback px-2 py-0.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded text-[11px] border border-rose-800">回滚此版本</button>
              </div>
            </div>
            <div class="text-[11px] text-slate-300 font-semibold truncate">\${h.title}</div>
            <div class="text-[10px] text-slate-400 line-clamp-1">\${h.tldr || '无摘要'}</div>

            <!-- 差异对比容器 -->
            <div class="diff-container hidden pt-2 border-t border-slate-800/80 font-mono text-[10px] max-h-48 overflow-y-auto space-y-0.5 bg-slate-950 p-2 rounded"></div>
          \`;

          // 展开 Diff 对比
          card.querySelector('.btn-toggle-diff')?.addEventListener('click', () => {
            const diffBox = card.querySelector('.diff-container');
            const isHidden = diffBox.classList.contains('hidden');
            if (isHidden) {
              diffBox.innerHTML = '';
              (h.diff || []).forEach(d => {
                const lineDiv = document.createElement('div');
                if (d.type === 'added') {
                  lineDiv.className = 'text-emerald-400 bg-emerald-950/30 px-1 rounded';
                  lineDiv.textContent = '+ ' + d.line;
                } else if (d.type === 'removed') {
                  lineDiv.className = 'text-rose-400 bg-rose-950/30 px-1 rounded line-through';
                  lineDiv.textContent = '- ' + d.line;
                } else {
                  lineDiv.className = 'text-slate-500 px-1';
                  lineDiv.textContent = '  ' + d.line;
                }
                diffBox.appendChild(lineDiv);
              });
              diffBox.classList.remove('hidden');
            } else {
              diffBox.classList.add('hidden');
            }
          });

          // 执行一键回滚
          card.querySelector('.btn-rollback')?.addEventListener('click', async () => {
            if (confirm('确认回滚节点 [' + nodeId + '] 至历史版本 v' + h.version_num + '？')) {
              await shell.apiFetch('/api/ext/cold-timemachine/rollback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId, history_id: h.history_id })
              });
              shell.notify('warn', '节点已回滚至历史版本 v' + h.version_num);
              loadNodeHistory(nodeId);
            }
          });

          box.appendChild(card);
        });
      } catch (err) {
        box.innerHTML = \`<div class="text-rose-400 text-xs py-4">加载历史出错: \${err.message}</div>\`;
      }
    }

    // 2. 加载冷归档列表
    async function loadColdArchive(q = '') {
      const box = root.querySelector('#tm-cold-container');
      const countBadge = root.querySelector('#tm-cold-count');
      box.innerHTML = '<div class="text-xs text-slate-400 py-6 text-center">正在流式检索冷归档...</div>';

      try {
        const res = await shell.apiFetch('/api/ext/cold-timemachine/cold?q=' + encodeURIComponent(q));
        box.innerHTML = '';
        const items = res.items || [];
        countBadge.textContent = items.length + ' 条冷数据';

        if (items.length === 0) {
          box.innerHTML = '<div class="text-xs text-slate-500 py-12 text-center">未检索到匹配的冷归档条目</div>';
          return;
        }

        items.forEach(item => {
          const card = document.createElement('div');
          card.className = 'p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1.5 hover:border-slate-700 transition';
          card.innerHTML = \`
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-200 truncate" title="\${item.title}">\${item.title}</span>
              <button class="btn-revive px-2 py-0.5 bg-cyan-900/80 hover:bg-cyan-800 text-cyan-300 rounded text-[11px] border border-cyan-700 flex-shrink-0">一键复活 (Lv.2)</button>
            </div>
            <div class="text-[10px] text-slate-400 line-clamp-2">\${item.tldr || '无摘要'}</div>
            <div class="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
              <span>归档原因: \${item.reason || '抽屉自然衰减'}</span>
              <span>行号 #\${item.lineNumber}</span>
            </div>
          \`;

          card.querySelector('.btn-revive')?.addEventListener('click', async () => {
            if (confirm('确认将冷数据 [' + item.title + '] 复活回主库？')) {
              await shell.apiFetch('/api/ext/cold-timemachine/revive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: item.id })
              });
              shell.notify('info', '已成功复活知识节点: ' + item.title);
              loadColdArchive(q);
            }
          });

          box.appendChild(card);
        });
      } catch (err) {
        box.innerHTML = \`<div class="text-rose-400 text-xs py-4">检索冷库出错: \${err.message}</div>\`;
      }
    }

    // 事件绑定
    root.querySelector('#tm-btn-load-node')?.addEventListener('click', () => {
      const nid = root.querySelector('#tm-node-input')?.value.trim();
      loadNodeHistory(nid);
    });

    root.querySelector('#tm-btn-search-cold')?.addEventListener('click', () => {
      const q = root.querySelector('#tm-cold-query')?.value.trim();
      loadColdArchive(q);
    });

    root.querySelector('#tm-btn-refresh')?.addEventListener('click', () => {
      const nid = root.querySelector('#tm-node-input')?.value.trim();
      if (nid) loadNodeHistory(nid);
      loadColdArchive(root.querySelector('#tm-cold-query')?.value.trim());
    });

    // 初始执行一次冷库加载
    loadColdArchive();
  `;

  ctx.gui.registerView('/view-cold-timemachine', {
    id: 'view-cold-timemachine',
    title: '时光机与冷库打捞',
    icon: '⏳',
    slot: 'slot-2',
    renderScript
  });

  console.log('[plg-cold-timemachine] 冷库打捞与版本时光机插件已就绪。');

  return {
    manifest,
    deactivate: async () => {
      console.log('[plg-cold-timemachine] Deactivating cold-timemachine plugin...');
    }
  };
}

export default {
  manifest,
  activate
};
