// ~/.dsh/plugins/dsh-system-pedestal/pedestal/gui-gateway.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const BASE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHELL_HTML_PATH = path.join(BASE_DIR, 'gui-shell.html');

export function createGuiGateway(kernel) {
  let server = null;
  let port = 18765;
  let serverUrl = null;
  const sseClients = new Set();
  const pluginApis = new Map(); // key: "METHOD:/api/ext/pluginId/subPath" -> { handler, pluginId }
  const pluginViews = new Map(); // key: viewId -> { pluginId, slot, id, title, icon, renderScript }

  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // 1. JSON & SSE Helpers
  function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS
    });
    res.end(JSON.stringify(data));
  }

  function broadcastSse(eventType, data) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
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
      try {
        const tables = ['memory_directories', 'knowledge_nodes', 'knowledge_edges', 'core_vault', 'node_embeddings', 'node_history'];
        for (const t of tables) {
          const row = kernel.db.get(`SELECT COUNT(*) as count FROM ${t}`);
          dbStats[t] = row?.count || 0;
        }
      } catch {}
      return sendJson(res, 200, {
        status: 'online',
        version: '4.0.0',
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        dbStats,
        workerTelemetry: kernel.workerPool?.getTelemetry?.() || null,
        views: Array.from(pluginViews.values())
      });
    }

    // System Restart (Graceful daemon restart with Version Self-check & Anti-Zombie port release)
    if (pathname === '/api/sys/restart' && method === 'POST') {
      const body = await parseJsonBody(req);
      const baseDir = path.dirname(BASE_DIR);
      const pkgPath = path.join(baseDir, 'package.json');
      let currentVersion = '4.0.0';
      try {
        currentVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '4.0.0';
      } catch {}

      // 版本号校验逻辑
      const requestedVersion = body?.targetVersion || body?.version;
      const isVersionMatch = !requestedVersion || requestedVersion === currentVersion;

      sendJson(res, 200, {
        success: true,
        version: currentVersion,
        validated: isVersionMatch,
        pid: process.pid,
        message: `微内核守护进程 (v${currentVersion}) 正在优雅关闭数据库连接并平滑重启...`
      });

      setTimeout(async () => {
        try {
          console.log(`[GuiGateway] Processing graceful restart (v${currentVersion}, PID ${process.pid})...`);
          // 1. 关闭 SSE 客户端连接
          for (const client of sseClients) {
            try { client.end(); } catch {}
          }
          sseClients.clear();

          // 2. 优雅释放 18765 端口监听，防止 Windows 下 EADDRINUSE
          if (server) {
            try {
              await new Promise((resolve) => server.close(resolve));
              server = null;
            } catch {}
          }

          // 3. 优雅关闭 SQLite 数据库连接及清理资源
          if (kernel?.destroy) {
            try { await kernel.destroy(); } catch {}
          }

          // 4. 定位 Node 可执行文件并重新拉起独立守护进程
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
            env: process.env
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
      handler: async () => {
        if (!serverUrl) return { error: 'GUI Gateway is not running' };
        const cmd = process.platform === 'win32' ? `start ${serverUrl}` : process.platform === 'darwin' ? `open ${serverUrl}` : `xdg-open ${serverUrl}`;
        exec(cmd, () => {});
        return { success: true, url: serverUrl };
      }
    };
    if (kernel?.dshContext?.tools?.register) kernel.dshContext.tools.register(tool);
    else if (kernel?.dshContext?.registerTool) kernel.dshContext.registerTool(tool);
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
