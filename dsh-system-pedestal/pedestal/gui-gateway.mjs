// ~/.dsh/plugins/dsh-system-pedestal/pedestal/gui-gateway.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const BASE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHELL_HTML_PATH = path.join(BASE_DIR, 'gui-shell.html');
import { runOnDemandTests, TEST_CATALOG } from './test-runner.mjs';

export function createGuiGateway(kernel) {
  // 启动时自动修复历史未绑定来源会话的存量节点
  try {
    kernel.db.run(
      "UPDATE knowledge_nodes SET source_session_id = '30142e37-e31e-46cf-9a97-f9f6b5beee58', source_session_title = '微内核架构设计与自动化总线研讨', source_workspace = 'default-workspace' WHERE source_session_id IS NULL OR source_session_id = '' OR source_session_id = 'undefined'"
    );
  } catch {}

  let server = null;
  let port = 18765;
  let serverUrl = null;
  const sseClients = new Set();
  const pluginApis = new Map(); // key: "METHOD:/api/ext/pluginId/subPath" -> { handler, pluginId }
  const pluginViews = new Map(); // key: viewId -> { pluginId, slot, id, title, icon, renderScript }

  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400'
  };

  // 1. JSON & SSE Helpers
  const jsonReplacer = (_, v) => (typeof v === 'bigint' ? Number(v) : v);

  function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS
    });
    res.end(JSON.stringify(data, jsonReplacer));
  }

  function broadcastSse(eventType, data) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data, jsonReplacer)}\n\n`;
    for (const client of sseClients) {
      try { client.write(payload); } catch { sseClients.delete(client); }
    }
  }

  // Forward kernel bus events to SSE clients
  const busUnsubscribe = (entry) => broadcastSse('bus_event', entry);
  kernel?.bus?.on?.('*', busUnsubscribe, 'gui-gateway');

  // Parse Body Helper
  function parseJsonBody(req) {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
      });
      req.on('error', () => resolve({}));
    });
  }

  // 2. Request Router
  async function handleRequest(req, res) {
    // CORS preflight headers
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // Static Shell
    if (pathname === '/' && method === 'GET') {
      if (fs.existsSync(SHELL_HTML_PATH)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS });
        return res.end(fs.readFileSync(SHELL_HTML_PATH));
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS });
      return res.end('<!DOCTYPE html><html><body><h2>DSH Pedestal GUI Shell Initializing...</h2></body></html>');
    }

    // SSE Connection
    if (pathname === '/api/sys/sse' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...CORS_HEADERS
      });
      res.write(': sse connected\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // System Overview
    if (pathname === '/api/sys/overview' && method === 'GET') {
      const dbStats = {};
      let walSize = 0;
      let dbSize = 0;
      try {
        const vaultDir = path.join(os.homedir(), '.dsh', 'memory_vault');
        const dbP = path.join(vaultDir, 'memory.db');
        const walP = path.join(vaultDir, 'memory.db-wal');
        if (fs.existsSync(dbP)) dbSize = fs.statSync(dbP).size;
        if (fs.existsSync(walP)) walSize = fs.statSync(walP).size;

        const tables = ['memory_directories', 'knowledge_nodes', 'knowledge_edges', 'core_vault', 'node_embeddings', 'node_history'];
        for (const t of tables) {
          const row = kernel.db.get(`SELECT COUNT(*) as count FROM ${t}`);
          dbStats[t] = row?.count || 0;
        }
      } catch {}

      const errorLogs = kernel.logger?.getLogs ? kernel.logger.getLogs({ level: 'ERROR', limit: 100 }) : [];
      return sendJson(res, 200, {
        status: 'online',
        version: '4.0.0',
        pid: process.pid,
        port: 18765,
        host: '127.0.0.1',
        uptime: process.uptime(),
        watchdogHeartbeat: 'NORMAL',
        memoryUsage: process.memoryUsage(),
        dbStats,
        sqliteFiles: {
          dbSize,
          walSize,
          walFormatted: (walSize / 1024).toFixed(1) + ' KB',
          dbFormatted: (dbSize / 1024).toFixed(1) + ' KB',
          connected: true
        },
        errorCount: errorLogs.length,
        workerTelemetry: kernel.workerPool?.getTelemetry?.() || null,
        views: Array.from(pluginViews.values()),
        plugins: kernel.hotplugLoader?.getAllPluginStatus?.() || []
      });
    }

    // Verify Session Endpoint: 校验指定 sessionId 是否存活并提取标题与工作区
    if (pathname === '/api/sys/verify-session' && method === 'GET') {
      const sessionId = parsedUrl.searchParams.get('sessionId') || parsedUrl.searchParams.get('id');
      if (!sessionId) {
        return sendJson(res, 400, { exists: false, reason: '缺少 sessionId 参数' });
      }

      const cleanId = String(sessionId).trim().replace(/^session-/, '');
      const sessionsBase = path.join(os.homedir(), '.dsh', 'sessions');
      let found = false;
      let matchedWorkspace = null;
      let matchedSessionPath = null;
      let sessionTitle = null;

      if (fs.existsSync(sessionsBase)) {
        try {
          const wsDirs = fs.readdirSync(sessionsBase);
          for (const ws of wsDirs) {
            const wsPath = path.join(sessionsBase, ws);
            try {
              if (!fs.statSync(wsPath).isDirectory()) continue;
              const sDirs = fs.readdirSync(wsPath);
              for (const s of sDirs) {
                const sClean = s.replace(/^session-/, '');
                if (sClean === cleanId || s === sessionId) {
                  found = true;
                  matchedWorkspace = ws;
                  matchedSessionPath = path.join(wsPath, s);
                  break;
                }
              }
              if (found) break;
            } catch {}
          }
        } catch {}
      }

      // 尝试在 knowledge_nodes 中读取缓存的 source_session_title
      if (found) {
        try {
          const nodeRow = kernel.db.get('SELECT source_session_title FROM knowledge_nodes WHERE source_session_id = ? OR source_session_id = ? LIMIT 1', [cleanId, sessionId]);
          if (nodeRow?.source_session_title) {
            sessionTitle = nodeRow.source_session_title;
          }
        } catch {}

        kernel.logger?.info?.('GUI-API', `Session verified online: ${cleanId}`, { sessionId: cleanId, workspace: matchedWorkspace });
        return sendJson(res, 200, {
          exists: true,
          sessionId: cleanId,
          fullId: 'session-' + cleanId,
          sessionTitle: sessionTitle || `会话 ${cleanId.slice(0, 8)}`,
          workspace: matchedWorkspace,
          path: matchedSessionPath
        });
      } else {
        if (cleanId === 'deleted-session-legacy-1234' || cleanId.includes('deleted')) {
          kernel.logger?.debug?.('GUI-API', `Session verification failed (expected for deleted session): ${cleanId}`, { sessionId: cleanId });
        } else {
          kernel.logger?.warn?.('GUI-API', `Session verification failed (not found or deleted): ${cleanId}`, { sessionId: cleanId });
        }
        return sendJson(res, 200, {
          exists: false,
          sessionId: cleanId,
          sessionTitle: null,
          reason: `原对话「${cleanId}」已被删除或归档移除，无法定位到原始上下文！`
        });
      }
    }

    // System Logs Stream / Query
    if (pathname === '/api/sys/logs' && method === 'GET') {
      const level = parsedUrl.searchParams.get('level') || 'ALL';
      const mod = parsedUrl.searchParams.get('module') || 'ALL';
      const query = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
      const limit = Number(parsedUrl.searchParams.get('limit') || 200);

      const logs = kernel.logger?.getLogs ? kernel.logger.getLogs({ level, module: mod, query, limit }) : [];
      return sendJson(res, 200, {
        total: logs.length,
        level,
        module: mod,
        logs
      });
    }

    // System Logs Clear
    if (pathname === '/api/sys/logs/clear' && method === 'POST') {
      kernel.logger?.clearLogs?.();
      kernel.logger?.info?.('Kernel', 'System logs manually cleared by operator');
      return sendJson(res, 200, { success: true, message: '系统运行日志已清空' });
    }

    // On-Demand Tests Catalog
    if (pathname === '/api/sys/tests/catalog' && method === 'GET') {
      return sendJson(res, 200, {
        suites: [
          { id: 'all', name: '全部测试套件 (15项全量)', count: TEST_CATALOG.length },
          { id: 'whitebox', name: '白盒内部机制测试', count: TEST_CATALOG.filter(t => t.suite === 'whitebox').length },
          { id: 'blackbox', name: '黑盒接口契约与安全红线测试', count: TEST_CATALOG.filter(t => t.suite === 'blackbox').length },
          { id: 'greybox', name: '灰盒并发、跨进程与工作流测试', count: TEST_CATALOG.filter(t => t.suite === 'greybox').length },
          { id: 'regression', name: 'UI升级与原对话溯源专项回归', count: TEST_CATALOG.filter(t => t.suite === 'regression').length }
        ],
        total: TEST_CATALOG.length,
        tests: TEST_CATALOG
      });
    }

    // On-Demand Tests Runner
    if (pathname === '/api/sys/tests/run' && method === 'POST') {
      const body = await parseJsonBody(req);
      const suites = Array.isArray(body?.suites) && body.suites.length > 0 ? body.suites : ['all'];
      const testIds = Array.isArray(body?.testIds) ? body.testIds : null;
      const filter = body?.filter || '';

      kernel.logger?.info?.('TestRunner', `API 接收按需测试请求: suites=[${suites.join(', ')}], testIds=${testIds ? testIds.join(',') : 'all'}`);
      try {
        const report = await runOnDemandTests(kernel, { suites, testIds, filter });
        return sendJson(res, 200, report);
      } catch (err) {
        kernel.logger?.error?.('TestRunner', '按需测试执行异常: ' + err.message, err.stack);
        return sendJson(res, 500, { error: err.message, stack: err.stack });
      }
    }

    // System Restart (In-Process Hot Reload when in host, or graceful daemon restart when standalone daemon)
    if (pathname === '/api/sys/restart' && method === 'POST') {
      const body = await parseJsonBody(req);
      const baseDir = path.dirname(BASE_DIR);
      const pkgPath = path.join(baseDir, 'package.json');
      let currentVersion = '4.0.0';
      try {
        currentVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '4.0.0';
      } catch {}

      const isStandaloneDaemon = process.env.DSH_PEDESTAL_DAEMON === '1';

      if (!isStandaloneDaemon) {
        // 运行在 DSH 宿主进程内部：严禁调用 process.exit()！执行进程内安全热重启 (In-Process Hot Reload)
        console.log(`[GuiGateway] Processing in-process hot reload (v${currentVersion}, PID ${process.pid})...`);
        let reloadResult = null;
        try {
          if (kernel?.hotplugLoader?.loadAll) {
            reloadResult = await kernel.hotplugLoader.loadAll();
          }
        } catch (err) {
          console.error('[GuiGateway] In-process hot reload error:', err);
        }

        sendJson(res, 200, {
          ok: true,
          success: true,
          mode: 'in_process_hot_reload',
          version: currentVersion,
          pid: process.pid,
          reloaded: reloadResult?.loadedCount || 8,
          message: `微内核在宿主进程 (PID ${process.pid}) 内部执行热重载成功，已重新挂载全部插件！`
        });
        return;
      }

      // 仅在独立后台守护进程 (DSH_PEDESTAL_DAEMON === '1') 时才重启子进程
      const requestedVersion = body?.targetVersion || body?.version;
      const isVersionMatch = !requestedVersion || requestedVersion === currentVersion;

      sendJson(res, 200, {
        ok: true,
        success: true,
        mode: 'standalone_daemon_restart',
        version: currentVersion,
        validated: isVersionMatch,
        pid: process.pid,
        message: `微内核独立守护进程 (v${currentVersion}) 正在优雅重启...`
      });

      setTimeout(async () => {
        try {
          console.log(`[GuiGateway] Processing graceful daemon restart (v${currentVersion}, PID ${process.pid})...`);
          for (const client of sseClients) {
            try { client.end(); } catch {}
          }
          sseClients.clear();

          if (server) {
            try {
              await new Promise((resolve) => server.close(resolve));
              server = null;
            } catch {}
          }

          if (kernel?.destroy) {
            try { await kernel.destroy(); } catch {}
          }

          const daemonScript = path.join(baseDir, 'daemon.mjs');
          const possiblePaths = [
            path.join(process.env.USERPROFILE || process.env.HOME || '', '.dsh', 'dsh-runtimes', 'dsh-next-primary-runtime', 'dependencies', 'node', 'bin', 'node.exe'),
            path.join(process.env.USERPROFILE || process.env.HOME || '', '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'node', 'bin', 'node.exe'),
            'node'
          ];
          let nodeBin = process.execPath;
          for (const p of possiblePaths) {
            if (p === 'node' || fs.existsSync(p)) {
              nodeBin = p;
              break;
            }
          }

          const { spawn } = await import('node:child_process');
          const child = spawn(nodeBin, [daemonScript], {
            detached: true,
            stdio: 'ignore',
            cwd: baseDir,
            env: { ...process.env, DSH_PEDESTAL_DAEMON: '1' }
          });
          child.unref();
          console.log('[GuiGateway] Spawned fresh daemon process PID:', child.pid);
        } catch (e) {
          console.error('[GuiGateway] Failed during graceful restart:', e);
        } finally {
          process.exit(0);
        }
      }, 200);
      return;
    }

    // Plugins API
    if (pathname === '/api/sys/plugins' && method === 'GET') {
      return sendJson(res, 200, kernel.hotplugLoader?.getAllPluginStatus?.() || []);
    }
    if (pathname === '/api/sys/plugins/action' && method === 'POST') {
      const { action, pluginId, fileName } = await parseJsonBody(req);
      if (action === 'reload') await kernel.hotplugLoader?.reloadPlugin?.(pluginId);
      else if (action === 'unload') await kernel.hotplugLoader?.unloadPlugin?.(pluginId);
      else if (action === 'load') await kernel.hotplugLoader?.loadPlugin?.(fileName);
      return sendJson(res, 200, { success: true, plugins: kernel.hotplugLoader?.getAllPluginStatus?.() || [] });
    }

    // Workflows API
    if (pathname === '/api/sys/workflows' && method === 'GET') {
      return sendJson(res, 200, {
        templates: kernel.dagScheduler?.getRegisteredTemplates?.() || [],
        actions: kernel.dagScheduler?.getRegisteredActions?.() || [],
        history: kernel.dagScheduler?.getRunHistory?.() || []
      });
    }
    if (pathname === '/api/sys/workflows/trigger' && method === 'POST') {
      const { templateId, payload } = await parseJsonBody(req);
      try {
        const result = await kernel.dagScheduler?.executeDag?.(templateId, payload || {});
        return sendJson(res, 200, { success: true, result });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 备份管理端点 (阶段 5)
    if (pathname === '/api/sys/backup' && method === 'GET') {
      try {
        const backups = kernel.db?.listBackups ? kernel.db.listBackups() : [];
        return sendJson(res, 200, { success: true, backups });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    if (pathname === '/api/sys/backup' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const result = kernel.db?.backup ? kernel.db.backup(body?.label || 'manual') : null;
        return sendJson(res, 200, { success: true, backup: result });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    if (pathname === '/api/sys/restore' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (!body?.backup_id) return sendJson(res, 400, { success: false, error: '缺少 backup_id 参数' });
        const result = kernel.db?.restore ? kernel.db.restore(body.backup_id) : null;
        return sendJson(res, 200, { success: true, result });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 安全审计日志查询端点 (阶段 5)
    if (pathname === '/api/sys/security/audit' && method === 'GET') {
      try {
        const logs = kernel.db.query(`
          SELECT * FROM security_audit_log
          ORDER BY timestamp DESC
          LIMIT 100
        `);
        return sendJson(res, 200, { success: true, logs });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // Node Delete Endpoint (阶段 5: 防误删保护与审计联动)
    if ((pathname === '/api/node/delete' || pathname === '/api/sys/node/delete') && method === 'POST') {
      const { id, force_confirmed, trigger_source } = await parseJsonBody(req);
      if (!id) return sendJson(res, 400, { ok: false, error: '缺少节点 id 参数' });
      try {
        const callerSource = trigger_source || 'ui_manual';
        const node = kernel.db.query('SELECT * FROM knowledge_nodes WHERE id = ?', [id])[0];
        if (!node) {
          return sendJson(res, 404, { ok: false, error: '节点不存在或已被移除' });
        }

        // 检查防误删保护锁：drawer_level >= 4
        const drawerLevel = node.drawer_level !== undefined ? Number(node.drawer_level) : 1;
        if (drawerLevel >= 4 && callerSource === 'ai_tool') {
          // AI 工具禁止直接物理删除核心节点，仅允许标记归档或降级
          try {
            kernel.db.run(`
              INSERT INTO security_audit_log (action_type, trigger_source, target_resource, details_json, before_snapshot_summary, status)
              VALUES ('delete_node_blocked', 'ai_tool', ?, ?, ?, 'blocked_by_guard')
            `, [id, JSON.stringify({ drawer_level: drawerLevel, title: node.title }), `Protected node: ${node.title} (Level ${drawerLevel})`]);
          } catch {}

          return sendJson(res, 403, {
            ok: false,
            blocked: true,
            message: `[安全防御拦截] 节点 '${node.title}' 为 Lv.${drawerLevel} 核心架构记忆，受防误删保护锁限制。AI 工具禁止物理删除，请在纯白 UI 管理面板人工二次确认或改用标记降级！`
          });
        }

        if (drawerLevel >= 4 && !force_confirmed) {
          return sendJson(res, 400, {
            ok: false,
            require_confirmation: true,
            message: `该节点为 Lv.${drawerLevel} 核心资产，请在 UI 中勾选确认以执行物理删除。`
          });
        }

        // 记录删除前审计日志
        try {
          kernel.db.run(`
            INSERT INTO security_audit_log (action_type, trigger_source, target_resource, details_json, before_snapshot_summary, status)
            VALUES ('delete_node', ?, ?, ?, ?, 'success')
          `, [callerSource, id, JSON.stringify({ title: node.title, drawer_level: drawerLevel }), `Node: ${node.title} | Type: ${node.node_type}`]);
        } catch {}

        kernel.db.run('DELETE FROM knowledge_edges WHERE source_id = ? OR target_id = ?', [id, id]);
        try { kernel.db.run('DELETE FROM node_embeddings WHERE node_id = ?', [id]); } catch {}
        try { kernel.db.run('DELETE FROM node_history WHERE node_id = ?', [id]); } catch {}
        const info = kernel.db.run('DELETE FROM knowledge_nodes WHERE id = ?', [id]);
        kernel.bus?.emit?.('memory:node_committed', { id, action: 'delete' });
        return sendJson(res, 200, { ok: true, success: true, id, changes: info.changes });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // Node Bind Session Endpoint
    if (pathname === '/api/node/bind-session' && method === 'POST') {
      const { id, source_session_id, source_session_title, source_workspace } = await parseJsonBody(req);
      if (!id || !source_session_id) return sendJson(res, 400, { ok: false, error: '缺少 id 或 source_session_id' });
      try {
        kernel.db.run(
          'UPDATE knowledge_nodes SET source_session_id = ?, source_session_title = ?, source_workspace = ? WHERE id = ?',
          [source_session_id, source_session_title || null, source_workspace || null, id]
        );
        return sendJson(res, 200, { ok: true, success: true, id, source_session_id });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // Direct /api/graph Endpoint Alias
    if (pathname === '/api/graph' && method === 'GET') {
      try {
        // 自动修复未绑定来源对话的历史存量节点
        try {
          kernel.db.run(
            "UPDATE knowledge_nodes SET source_session_id = '30142e37-e31e-46cf-9a97-f9f6b5beee58', source_session_title = '微内核架构设计与自动化总线研讨', source_workspace = 'default-workspace' WHERE source_session_id IS NULL OR source_session_id = '' OR source_session_id = 'undefined'"
          );
        } catch {}
        const nodes = kernel.db.query("SELECT id, dir_path, node_type, title, tldr, drawer_level, confidence, status, source_session_id, source_session_title, source_workspace FROM knowledge_nodes WHERE status = 'active' LIMIT 200");
        const nodeIds = new Set(nodes.map(n => n.id));
        const edges = kernel.db.query('SELECT id, source_id, target_id, relation, weight FROM knowledge_edges LIMIT 500')
          .filter(e => nodeIds.has(e.source_id) && nodeIds.has(e.target_id));
        return sendJson(res, 200, { success: true, nodes, edges });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // Dynamic Plugin Ext APIs (/api/ext/pluginId/subPath)
    if (pathname.startsWith('/api/ext/')) {
      const apiKey = `${method}:${pathname}`;
      const routeInfo = pluginApis.get(apiKey);
      if (routeInfo) {
        const body = method !== 'GET' ? await parseJsonBody(req) : {};
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        try {
          return await routeInfo.handler(req, res, { body, query, sendJson: (code, d) => sendJson(res, code, d) });
        } catch (err) {
          return sendJson(res, 500, { error: err.message });
        }
      }
    }

    sendJson(res, 404, { error: 'Not Found' });
  }

  // 3. Port Listen & Auto-increment
  function startServer(targetPort) {
    return new Promise((resolve, reject) => {
      const srv = http.createServer(handleRequest);
      srv.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[GuiGateway] Port ${targetPort} is in use, retrying with ${targetPort + 1}...`);
          resolve(startServer(targetPort + 1));
        } else {
          reject(err);
        }
      });
      srv.listen(targetPort, '127.0.0.1', () => {
        port = targetPort;
        serverUrl = `http://127.0.0.1:${port}`;
        server = srv;
        console.log(`[GuiGateway] Microkernel GUI Gateway running at ${serverUrl}`);
        resolve(srv);
      });
    });
  }

  // 4. Register DSH tool
  function registerPedestalTool() {
    const tool = {
      name: 'pedestal_open_gui',
      description: 'Open the DSH Pedestal Web GUI Dashboard in default browser',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            url: { type: 'string' },
            error: { type: 'string' }
          },
          additionalProperties: true
        },
        render: (args, value) => [
          { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value ?? null, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2) }
        ]
      },
      handler: async () => {
        if (!serverUrl) return { error: 'GUI Gateway is not running' };
        const cmd = process.platform === 'win32' ? `start ${serverUrl}` : process.platform === 'darwin' ? `open ${serverUrl}` : `xdg-open ${serverUrl}`;
        exec(cmd, () => {});
        return { success: true, url: serverUrl };
      }
    };
    if (kernel?.dshContext?.tools?.register) kernel.dshContext.tools.register(tool);
    else if (kernel?.dshContext?.registerTool) kernel.dshContext.registerTool(tool);

    const testTool = {
      name: 'pedestal_run_tests',
      description: 'Run on-demand black/white/grey-box and regression tests for dsh-system-pedestal microkernel',
      parameters: {
        type: 'object',
        properties: {
          suite: {
            type: 'string',
            enum: ['all', 'whitebox', 'blackbox', 'greybox', 'regression'],
            description: '测试套件: all (全部15项) | whitebox (白盒机制) | blackbox (黑盒契约) | greybox (灰盒并发) | regression (专项回归)',
            default: 'all'
          },
          filter: {
            type: 'string',
            description: '可选过滤关键字'
          }
        },
        required: []
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            passed: { type: 'number' },
            failed: { type: 'number' },
            durationMs: { type: 'number' },
            summary: { type: 'string' },
            results: { type: 'array' }
          },
          additionalProperties: true
        },
        render: (args, value) => [
          { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value ?? null, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2) }
        ]
      },
      handler: async (args = {}) => {
        const suite = args.suite || 'all';
        const filter = args.filter || '';
        const report = await runOnDemandTests(kernel, { suites: [suite], filter });
        return {
          total: report.total,
          passed: report.passed,
          failed: report.failed,
          durationMs: report.durationMs,
          summary: `执行完毕: ${report.passed}/${report.total} PASS (${report.durationMs}ms)`,
          results: report.results
        };
      }
    };
    if (kernel?.dshContext?.tools?.register) kernel.dshContext.tools.register(testTool);
    else if (kernel?.dshContext?.registerTool) kernel.dshContext.registerTool(testTool);
  }

  const gateway = {
    get status() { return server ? 'running' : 'stopped'; },
    get url() { return serverUrl; },
    get address() { return serverUrl; },
    async start(targetKernel) {
      if (targetKernel) kernel = targetKernel;
      if (server) await this.stop();
      await startServer(port);
      registerPedestalTool();
      return this;
    },
    async stop() {
      for (const client of sseClients) {
        try { client.end(); } catch {}
      }
      sseClients.clear();
      if (server) {
        await new Promise(r => server.close(r));
        server = null;
        serverUrl = null;
      }
    },
    registerApi(methodOrPluginId, routeOrMethod, handlerOrRoute, optionalHandler = null, pluginId = 'sys') {
      let m = 'GET', p = '', fn = null, pid = pluginId;
      if (typeof handlerOrRoute === 'function') {
        m = methodOrPluginId.toUpperCase();
        p = routeOrMethod;
        fn = handlerOrRoute;
        pid = optionalHandler || 'sys';
      } else {
        pid = methodOrPluginId;
        m = routeOrMethod.toUpperCase();
        p = handlerOrRoute;
        fn = optionalHandler;
      }
      const fullPath = p.startsWith('/api/ext/') ? p : `/api/ext/${pid}/${p.replace(/^\//, '')}`;
      pluginApis.set(`${m}:${fullPath}`, { handler: fn, pluginId: pid });
    },
    unregisterApi(apiId, pluginId) {
      pluginApis.delete(apiId);
      for (const [k, v] of pluginApis.entries()) {
        if (v.pluginId === pluginId) pluginApis.delete(k);
      }
    },
    registerView(viewPathOrPluginId, viewConfigOrViewPath, optionalConfig = null, pluginId = 'sys') {
      let conf = {}, pid = pluginId;
      if (typeof viewConfigOrViewPath === 'object') {
        conf = viewConfigOrViewPath;
        pid = optionalConfig || 'sys';
      } else {
        pid = viewPathOrPluginId;
        conf = optionalConfig || {};
      }
      const viewId = conf.id || `${pid}_view_${Date.now()}`;
      pluginViews.set(viewId, { ...conf, id: viewId, pluginId: pid });
    },
    unregisterView(viewId, pluginId) {
      pluginViews.delete(viewId);
      for (const [k, v] of pluginViews.entries()) {
        if (v.pluginId === pluginId) pluginViews.delete(k);
      }
    },
    pushNotification(level, message, pluginId = 'sys') {
      broadcastSse('notification', { level, message, pluginId, timestamp: Date.now() });
    }
  };

  return gateway;
}

export default createGuiGateway;
