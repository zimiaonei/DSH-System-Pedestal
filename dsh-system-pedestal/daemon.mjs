// ~/.dsh/plugins/dsh-system-pedestal/daemon.mjs - Persistent Background Microkernel Daemon
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';

const baseDir = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(baseDir, 'index.mjs');
const pkgPath = path.join(baseDir, 'package.json');
const vaultDir = path.join(os.homedir(), '.dsh', 'memory_vault');
const pidFilePath = path.join(vaultDir, 'daemon.pid');

let currentVersion = '4.0.0';
try {
  currentVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '4.0.0';
} catch {}

console.log(`[Pedestal Daemon v${currentVersion}] Initializing persistent background daemon...`);

// 1. Anti-Zombie Process Guard: 检查并清理遗留僵尸 node.exe 进程，释放 18765 端口
fs.mkdirSync(vaultDir, { recursive: true });
if (fs.existsSync(pidFilePath)) {
  try {
    const rawPid = fs.readFileSync(pidFilePath, 'utf8').trim();
    const info = JSON.parse(rawPid);
    const oldPid = Number(info.pid || rawPid);
    if (oldPid && oldPid !== process.pid) {
      let isAlive = false;
      try {
        process.kill(oldPid, 0);
        isAlive = true;
      } catch {}

      if (isAlive) {
        console.warn(`[Pedestal Daemon] Detected previous zombie process (PID: ${oldPid}, version: ${info.version || 'unknown'}). Gracefully cleaning up...`);
        if (process.platform === 'win32') {
          try { execSync(`taskkill /F /PID ${oldPid}`, { stdio: 'ignore' }); } catch {}
        } else {
          try { process.kill(oldPid, 'SIGKILL'); } catch {}
        }
      }
    }
  } catch {}
}

// 记录当前 Daemon PID 与版本元数据
const pidRecord = {
  pid: process.pid,
  version: currentVersion,
  startedAt: new Date().toISOString(),
  platform: process.platform,
  nodeVersion: process.version
};
fs.writeFileSync(pidFilePath, JSON.stringify(pidRecord, null, 2), 'utf8');

function cleanPidFile() {
  try {
    if (fs.existsSync(pidFilePath)) {
      const raw = fs.readFileSync(pidFilePath, 'utf8').trim();
      const info = JSON.parse(raw);
      if (info.pid === process.pid) {
        fs.unlinkSync(pidFilePath);
      }
    }
  } catch {}
}

process.on('SIGINT', () => { cleanPidFile(); process.exit(0); });
process.on('SIGTERM', () => { cleanPidFile(); process.exit(0); });
process.on('exit', () => { cleanPidFile(); });

// 2. Bootstrap Pedestal Microkernel
let instance = null;
try {
  const indexUrl = pathToFileURL(indexPath).href;
  const { bootstrapPedestal } = await import(`${indexUrl}?t=${Date.now()}`);

  instance = await bootstrapPedestal({
    isDaemon: true,
    tools: {
      register(toolDef) {},
      unregister(name) {}
    }
  });

  console.log(`[Pedestal Daemon v${currentVersion}] Pedestal successfully bootstrapped (PID: ${process.pid}).`);
  console.log('[Pedestal Daemon] Subsystems:', Object.keys(instance.status));
  console.log('[Pedestal Daemon] GUI Gateway listening at http://127.0.0.1:18765');
} catch (err) {
  console.error('[Pedestal Daemon] Failed to bootstrap pedestal:', err);
  cleanPidFile();
  process.exit(1);
}

// Keep event loop alive indefinitely
setInterval(() => {}, 1000 * 60 * 60);
