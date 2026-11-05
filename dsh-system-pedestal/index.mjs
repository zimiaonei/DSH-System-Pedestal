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

export function getNodeExecutable() {
  const possiblePaths = [
    path.join(os.homedir(), '.dsh', 'dsh-runtimes', 'dsh-next-primary-runtime', 'dependencies', 'node', 'bin', 'node.exe'),
    path.join(os.homedir(), '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'node', 'bin', 'node.exe')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  if (process.execPath && !process.execPath.toLowerCase().includes('electron')) {
    return process.execPath;
  }
  return 'node';
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

let isSpawning = false;
let watchdogTimer = null;

export async function ensureDaemon(baseDir) {
  if (isSpawning) return;
  const open = await isPortOpen(18765);
  if (!open) {
    isSpawning = true;
    const daemonScript = path.join(baseDir, 'daemon.mjs');
    const nodeBin = getNodeExecutable();
    console.log('[Pedestal Watchdog] GUI Gateway 18765 is down! Spawning detached daemon with:', nodeBin);
    try {
      const child = spawn(nodeBin, [daemonScript], {
        detached: true,
        stdio: 'ignore',
        cwd: baseDir,
        env: process.env
      });
      child.unref();
      console.log('[Pedestal Watchdog] Detached daemon process spawned successfully with PID:', child.pid);
    } catch (err) {
      console.error('[Pedestal Watchdog] Failed to spawn daemon process:', err);
    } finally {
      setTimeout(() => { isSpawning = false; }, 3000);
    }
  }
}

export function startWatchdog(baseDir) {
  if (watchdogTimer) return;
  console.log('[Pedestal] Starting 5s background watchdog for 127.0.0.1:18765...');
  // Initial check immediately
  ensureDaemon(baseDir).catch(() => {});
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

export async function bootstrapPedestal(dshContext = {}) {
  const baseDir = path.dirname(fileURLToPath(import.meta.url));

  // If not running inside the daemon itself, check and ensure the persistent daemon is alive
  if (!dshContext.isDaemon) {
    await ensureDaemon(baseDir);
  }

  if (globalThis.__DSH_PEDESTAL__?.shutdown) {
    console.log('[Pedestal] Gracefully shutting down existing pedestal instance...');
    await globalThis.__DSH_PEDESTAL__.shutdown();
  }

  const pedestalDir = path.join(baseDir, 'pedestal');
  const pluginsDir = path.join(baseDir, 'plugins');

  const instance = {
    version: '4.0.0',
    dshContext,
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

  if (dshContext.tools?.register) {
    dshContext.tools.register(statusTool);
  } else if (dshContext.registerTool) {
    dshContext.registerTool(statusTool);
  } else if (dshContext.registry?.register) {
    dshContext.registry.register(statusTool);
  }
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
      }
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

  if (dshContext.tools?.register) {
    dshContext.tools.register(testTool);
  } else if (dshContext.registerTool) {
    dshContext.registerTool(testTool);
  } else if (dshContext.registry?.register) {
    dshContext.registry.register(testTool);
  }
  instance.testTool = testTool;

  console.log('[Pedestal] Pedestal bootstrap sequence completed.');
  return instance;
}

export function apply(ctx, config) {
  console.log('[Pedestal] Cordis plugin apply hook invoked.');
  const baseDir = path.dirname(fileURLToPath(import.meta.url));
  // Mount 5-second background watchdog
  startWatchdog(baseDir);

  bootstrapPedestal(ctx).catch((err) => {
    console.error('[Pedestal] Failed during bootstrapPedestal in apply hook:', err);
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
  ensureDaemon,
  startWatchdog,
  stopWatchdog,
  isPortOpen,
  getNodeExecutable
};
