// ~/.dsh/plugins/dsh-system-pedestal/index.mjs - dsh-system-pedestal v4.0 Entrypoint
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';

const MODULES = [
  { file: 'kernel-bus.mjs', name: 'kernelBus', bind: async (inst, p) => { p.kernel = inst?.kernel || inst; } },
  { file: 'worker-pool.mjs', name: 'workerPool', bind: async (inst, p) => { p.workerPool = inst?.workerPool || inst; p.kernel?.bindWorkerPool?.(p.workerPool); } },
  { file: 'dag-scheduler.mjs', name: 'dagScheduler', bind: async (inst, p) => { p.dagScheduler = inst?.dagScheduler || inst; p.kernel?.bindScheduler?.(p.dagScheduler); } },
  { file: 'gui-gateway.mjs', name: 'guiGateway', bind: async (inst, p) => { p.guiGateway = inst?.guiGateway || inst; p.kernel?.bindGuiGateway?.(p.guiGateway); await p.guiGateway?.start?.(p.kernel); } },
  { file: 'hotplug-loader.mjs', name: 'hotplugLoader', bind: async (inst, p) => { p.hotplugLoader = inst?.hotplugLoader || inst; p.kernel?.bindHotplugLoader?.(p.hotplugLoader); p.hotplugLoader?.init?.(p.kernel, p.pluginsDir); await p.hotplugLoader?.loadAll?.(); } }
];

export function getNodeExecutableInfo() {
  const possiblePaths = [
    path.join(os.homedir(), '.dsh', 'dsh-runtimes', 'dsh-next-primary-runtime', 'dependencies', 'node', 'bin', 'node.exe'),
    path.join(os.homedir(), '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'node', 'bin', 'node.exe')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return { bin: p, env: {} };
    }
  }
  if (process.execPath && !process.execPath.toLowerCase().includes('electron')) {
    return { bin: process.execPath, env: {} };
  }
  if (process.execPath) {
    return { bin: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } };
  }
  return { bin: 'node', env: {} };
}

export function getNodeExecutable() {
  return getNodeExecutableInfo().bin;
}

export async function isPortOpen(port = 18765, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.request({ host, port, path: '/api/sys/overview', method: 'GET', timeout: timeoutMs }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

let spawnLockPromise = null;
let watchdogTimer = null;

export function isDaemonContext(ctx) {
  if (process.env.DSH_PEDESTAL_DAEMON === '1') return true;
  if (typeof ctx === 'object' && ctx !== null && !ctx.fiber && Reflect.has(ctx, 'isDaemon')) {
    try {
      return Boolean(ctx.isDaemon);
    } catch {
      return false;
    }
  }
  return false;
}

export function normalizeParametersForDsh(rawParams) {
  if (!rawParams || typeof rawParams !== 'object') {
    return {
      type: 'object',
      properties: {},
      required: []
    };
  }

  let sanitized = rawParams;
  if (typeof rawParams.toJSON === 'function') {
    try {
      sanitized = rawParams.toJSON();
    } catch {}
  } else if (rawParams.dict && typeof rawParams.dict === 'object') {
    try {
      sanitized = rawParams.dict;
    } catch {}
  }

  try {
    const seen = new WeakSet();
    const clean = JSON.parse(JSON.stringify(sanitized, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      if (typeof value === 'bigint') return Number(value);
      if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) {
        return undefined;
      }
      return value;
    }));

    if (!clean || typeof clean !== 'object' || Array.isArray(clean)) {
      return {
        type: 'object',
        properties: {},
        required: []
      };
    }

    if (clean.type !== 'object') {
      clean.type = 'object';
    }
    if (!clean.properties || typeof clean.properties !== 'object' || Array.isArray(clean.properties)) {
      clean.properties = {};
    }
    if (!Array.isArray(clean.required)) {
      clean.required = [];
    }
    return clean;
  } catch {
    return {
      type: 'object',
      properties: {},
      required: []
    };
  }
}

export function normalizeToolForDsh(toolDef) {
  if (!toolDef || typeof toolDef !== 'object') return toolDef;
  const tool = { ...toolDef };
  if (!tool.execute && typeof tool.handler === 'function') {
    tool.execute = async (args, exec) => await tool.handler(args, exec);
  }
  if (!tool.handler && typeof tool.execute === 'function') {
    tool.handler = async (args, exec) => await tool.execute(args, exec);
  }
  tool.parameters = normalizeParametersForDsh(tool.parameters);
  if (!tool.output || typeof tool.output !== 'object') {
    tool.output = {
      schema: { type: 'object', additionalProperties: true },
      render: (args, value) => [
        { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value ?? null, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2) }
      ]
    };
  } else {
    const output = { ...tool.output };
    if (!output.schema) {
      output.schema = { type: 'object', additionalProperties: true };
    }
    if (typeof output.render !== 'function') {
      output.render = (args, value) => [
        { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value ?? null, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2) }
      ];
    }
    tool.output = output;
  }
  return tool;
}

export async function ensureDaemon(baseDir) {
  if (spawnLockPromise) return spawnLockPromise;
  spawnLockPromise = (async () => {
    try {
      // 1. 如果当前进程自己的 guiGateway 已经成功在运行/监听，绝不要 spawn 第二个 daemon 抢端口争 SQLite 锁！
      if (globalThis.__DSH_PEDESTAL__?.guiGateway?.server || globalThis.__DSH_PEDESTAL__?.guiGateway?.status === 'running') {
        return;
      }
      // 2. 检查 18765 端口是否已经有实例响应
      const open = await isPortOpen(18765);
      if (!open) {
        const daemonScript = path.join(baseDir, 'daemon.mjs');
        const { bin: nodeBin, env: extraEnv } = getNodeExecutableInfo();
        console.log('[Pedestal Watchdog] GUI Gateway 18765 is down! Spawning detached daemon with:', nodeBin);
        try {
          const child = spawn(nodeBin, [daemonScript], {
            detached: true,
            stdio: 'ignore',
            cwd: baseDir,
            env: { ...process.env, ...extraEnv, DSH_PEDESTAL_DAEMON: '1' }
          });
          child.unref();
          console.log('[Pedestal Watchdog] Detached daemon process spawned successfully with PID:', child.pid);
        } catch (err) {
          console.error('[Pedestal Watchdog] Failed to spawn daemon process:', err);
        }
      }
    } finally {
      setTimeout(() => { spawnLockPromise = null; }, 3000);
    }
  })();
  return spawnLockPromise;
}

export function startWatchdog(baseDir) {
  if (watchdogTimer) return;
  console.log('[Pedestal] Starting 5s background watchdog for 127.0.0.1:18765...');
  watchdogTimer = setInterval(() => {
    ensureDaemon(baseDir).catch((err) => {
      console.error('[Pedestal Watchdog] Check error:', err);
    });
  }, 5000);
  if (typeof watchdogTimer.unref === 'function') {
    watchdogTimer.unref();
  }
}

export function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
    console.log('[Pedestal] Background watchdog stopped.');
  }
}

/**
 * Creates a safe facade over the host context (which may be a strict Cordis Context Proxy,
 * a plain test/daemon options object, or undefined).
 * Cordis Context intercepts property access and throws "cannot get property X without inject"
 * if X is accessed directly. This facade prevents any such exceptions.
 */
export function createSafeDshContext(raw = {}) {
  if (!raw) raw = {};
  const isCordis = typeof raw.get === 'function' || Boolean(raw.reflect) || Boolean(raw.fiber);
  const isDaemon = isDaemonContext(raw);

  const getTools = () => {
    if (isCordis) {
      try {
        return raw.get?.('tools') || null;
      } catch {
        return null;
      }
    }
    return raw.tools || null;
  };

  const _localToolsMap = new Map();
  const safeTools = {
    _tools: _localToolsMap,
    register(rawToolDef) {
      try {
        const toolDef = normalizeToolForDsh(rawToolDef);
        if (toolDef?.name) {
          _localToolsMap.set(toolDef.name, toolDef);
        }
        if (isCordis) {
          const t = raw.get?.('tools');
          try {
            const existing = t?.get?.(toolDef.name);
            if (existing && typeof existing === 'object') {
              existing.handler = toolDef.handler;
              existing.execute = toolDef.execute;
              existing.description = toolDef.description;
              existing.parameters = toolDef.parameters;
              return;
            }
          } catch {}
          if (t?.register) return t.register(toolDef);
          return;
        }
        if (raw.tools?.register) return raw.tools.register(toolDef);
        if (raw.registerTool) return raw.registerTool(toolDef);
        if (raw.registry?.register) return raw.registry.register(toolDef);
      } catch (err) {
        console.warn('[Pedestal] safeTools.register failed:', err.message);
      }
    },
    unregister(toolName) {
      try {
        _localToolsMap.delete(toolName);
        if (isCordis) {
          const t = raw.get?.('tools');
          if (t?.unregister) return t.unregister(toolName);
          return;
        }
        if (raw.tools?.unregister) return raw.tools.unregister(toolName);
        if (raw.unregisterTool) return raw.unregisterTool(toolName);
      } catch (err) {
        console.warn('[Pedestal] safeTools.unregister failed:', err.message);
      }
    },
    get(toolName) {
      if (_localToolsMap.has(toolName)) {
        return _localToolsMap.get(toolName);
      }
      try {
        const t = getTools();
        if (t?.get) {
          const found = t.get(toolName);
          if (found) return found;
        }
      } catch {}
      return null;
    }
  };

  return new Proxy(raw, {
    get(target, prop, receiver) {
      if (prop === 'isDaemon') {
        return isDaemon;
      }
      if (prop === 'tools') {
        return safeTools;
      }
      if (prop === 'sessionId') {
        return process.env.DSH_SESSION_ID || process.env.SESSION_ID || null;
      }
      if (prop === 'sessionTitle') {
        return process.env.DSH_SESSION_TITLE || null;
      }
      if (prop === 'registerTool') {
        return (t) => safeTools.register(t);
      }
      if (prop === 'unregisterTool') {
        return (name) => safeTools.unregister(name);
      }
      if (prop === 'raw') {
        return target;
      }
      if (isCordis) {
        try {
          if (typeof target.get === 'function') {
            return target.get(prop);
          }
        } catch {
          return undefined;
        }
        return undefined;
      }
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      if (prop === 'isDaemon' || prop === 'tools' || prop === 'sessionId' || prop === 'sessionTitle' || prop === 'raw' || prop === 'registerTool' || prop === 'unregisterTool') {
        return true;
      }
      if (isCordis) {
        try {
          return target.get?.(prop) !== undefined;
        } catch {
          return false;
        }
      }
      return Reflect.has(target, prop);
    }
  });
}

export async function bootstrapPedestal(dshContext = {}) {
  const baseDir = path.dirname(fileURLToPath(import.meta.url));
  const safeContext = createSafeDshContext(dshContext);

  // In-process initialization: bootstrapPedestal hosts the kernel & guiGateway in this process.

  if (globalThis.__DSH_PEDESTAL__?.shutdown) {
    console.log('[Pedestal] Gracefully shutting down existing pedestal instance...');
    await globalThis.__DSH_PEDESTAL__.shutdown();
  }

  const pedestalDir = path.join(baseDir, 'pedestal');
  const pluginsDir = path.join(baseDir, 'plugins');

  const instance = {
    version: '4.0.0',
    dshContext: safeContext,
    baseDir,
    pedestalDir,
    pluginsDir,
    status: {},
    kernel: null,
    workerPool: null,
    dagScheduler: null,
    guiGateway: null,
    hotplugLoader: null,
    async shutdown() {
      console.log('[Pedestal] Shutting down pedestal services...');
      if (this.hotplugLoader?.destroy) await this.hotplugLoader.destroy();
      if (this.guiGateway?.stop) await this.guiGateway.stop();
      if (this.dagScheduler?.destroy) await this.dagScheduler.destroy();
      if (this.workerPool?.terminate) await this.workerPool.terminate();
      if (this.kernel?.destroy) await this.kernel.destroy();
      this.status = {};
      if (globalThis.__DSH_PEDESTAL__ === this) globalThis.__DSH_PEDESTAL__ = null;
    }
  };

  globalThis.__DSH_PEDESTAL__ = instance;
  console.log('[Pedestal] Initializing dsh-system-pedestal v4.0...');

  for (const mod of MODULES) {
    try {
      const modulePath = pathToFileURL(path.join(pedestalDir, mod.file)).href + `?t=${Date.now()}`;
      const imported = await import(modulePath);
      const modInst = imported.default ? await (typeof imported.default === 'function' ? imported.default(instance.kernel || instance) : imported.default) : imported;
      await mod.bind(modInst, instance);
      instance.status[mod.name] = { ready: true, loadedAt: Date.now() };
      console.log(`[Pedestal] Sub-module ${mod.name} mounted successfully.`);
    } catch (err) {
      instance.status[mod.name] = { ready: false, error: err.message };
      console.error(`[Pedestal] Sub-module ${mod.file} failed:`, err);
    }
  }

  const statusTool = {
    name: 'pedestal_status',
    description: 'Get status of dsh-system-pedestal microkernel subsystems and plugins',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          version: { type: 'string' },
          subsystems: { type: 'object' },
          guiUrl: { type: 'string' },
          loadedPlugins: { type: 'array' },
          details: { type: 'object' }
        },
        additionalProperties: true
      },
      render: (args, value) => [
        { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value ?? null, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2) }
      ]
    },
    handler: async () => {
      await ensureDaemon(baseDir);
      return {
        version: instance.version,
        subsystems: {
          kernelBus: !!instance.kernel,
          workerPool: !!instance.workerPool,
          dagScheduler: !!instance.dagScheduler,
          guiGateway: instance.guiGateway?.status || (instance.guiGateway ? 'running' : 'inactive'),
          hotplugLoader: !!instance.hotplugLoader
        },
        guiUrl: instance.guiGateway?.url || instance.guiGateway?.address || 'http://127.0.0.1:18765',
        loadedPlugins: instance.hotplugLoader?.getLoadedPlugins?.() || [],
        details: instance.status
      };
    }
  };

  safeContext.tools.register(statusTool);
  instance.statusTool = statusTool;

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
      try {
        const res = await fetch('http://127.0.0.1:18765/api/sys/tests/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suites: [suite], filter })
        }).then(r => r.json());
        return res;
      } catch (err) {
        if (instance.kernel) {
          const { runOnDemandTests } = await import(pathToFileURL(path.join(pedestalDir, 'test-runner.mjs')).href);
          return await runOnDemandTests(instance.kernel, { suites: [suite], filter });
        }
        return { error: 'Daemon not reachable: ' + err.message };
      }
    }
  };

  safeContext.tools.register(testTool);
  instance.testTool = testTool;

  console.log('[Pedestal] Pedestal bootstrap sequence completed.');
  return instance;
}

export function apply(ctx, config) {
  console.log('[Pedestal] Cordis plugin apply hook invoked.');
  const baseDir = path.dirname(fileURLToPath(import.meta.url));

  bootstrapPedestal(ctx)
    .then(() => {
      startWatchdog(baseDir);
    })
    .catch((err) => {
      console.error('[Pedestal] Failed during bootstrapPedestal in apply hook:', err);
      startWatchdog(baseDir);
    });
  if (ctx && typeof ctx.on === 'function') {
    ctx.on('dispose', async () => {
      console.log('[Pedestal] Cordis plugin dispose hook invoked.');
      stopWatchdog();
      if (globalThis.__DSH_PEDESTAL__?.shutdown) {
        await globalThis.__DSH_PEDESTAL__.shutdown();
      }
    });
  }
}

export const activate = async (ctx) => {
  const baseDir = path.dirname(fileURLToPath(import.meta.url));
  startWatchdog(baseDir);
  return await bootstrapPedestal(ctx);
};

export default {
  apply,
  activate,
  bootstrapPedestal,
  createSafeDshContext,
  ensureDaemon,
  startWatchdog,
  stopWatchdog,
  isPortOpen,
  getNodeExecutable,
  getNodeExecutableInfo
};
