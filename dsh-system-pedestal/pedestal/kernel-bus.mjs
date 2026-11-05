// ~/.dsh/plugins/dsh-system-pedestal/pedestal/kernel-bus.mjs
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOMEDIR = os.homedir();
const VAULT_DIR = path.join(HOMEDIR, '.dsh', 'memory_vault');
const BACKUPS_DIR = path.join(VAULT_DIR, 'backups');
const DB_PATH = path.join(VAULT_DIR, 'memory.db');
const KEY_PATH = path.join(VAULT_DIR, '.master_key');
const LEASE_CACHE_PATH = path.join(VAULT_DIR, '.vault_leases.enc');
const RUNTIME_LOG_PATH = path.join(VAULT_DIR, 'pedestal-runtime.log');

export function createKernelBus(context = {}) {
  const dshContext = context.dshContext || context;
  // Ensure directories exist
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  // 1. SQLite WAL Engine
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
  `);

  const dbWrapper = {
    raw: db,
    query(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    get(sql, params = []) {
      return db.prepare(sql).get(...params);
    },
    run(sql, params = []) {
      return db.prepare(sql).run(...params);
    },
    exec(sql) {
      return db.exec(sql);
    },
    backup() {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(BACKUPS_DIR, `memory-${timestamp}.db`);
      fs.copyFileSync(DB_PATH, backupPath);

      // Rotate backups, keep latest 5
      try {
        const files = fs.readdirSync(BACKUPS_DIR)
          .filter(f => f.startsWith('memory-') && f.endsWith('.db'))
          .map(f => ({ name: f, path: path.join(BACKUPS_DIR, f), time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time);

        if (files.length > 5) {
          for (const file of files.slice(5)) {
            try { fs.unlinkSync(file.path); } catch {}
          }
        }
      } catch {}

      return backupPath;
    }
  };

  // Schema Initialization
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_directories (
      path TEXT PRIMARY KEY,
      parent_path TEXT,
      name TEXT,
      dir_summary TEXT,
      workspace_path TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_nodes (
      id TEXT PRIMARY KEY,
      dir_path TEXT,
      node_type TEXT,
      title TEXT,
      tldr TEXT,
      keywords TEXT,
      full_content TEXT,
      token_estimate INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      superseded_by TEXT,
      confidence REAL DEFAULT 0.8,
      drawer_level INTEGER DEFAULT 3,
      access_count INTEGER DEFAULT 0,
      last_accessed_at TEXT,
      created_at TEXT,
      source_session_id TEXT,
      source_session_title TEXT,
      source_workspace TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_edges (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      target_id TEXT,
      relation TEXT,
      weight REAL DEFAULT 1.0,
      created_at TEXT,
      UNIQUE(source_id, target_id, relation)
    );

    CREATE TABLE IF NOT EXISTS core_vault (
      id TEXT PRIMARY KEY,
      dir_path TEXT DEFAULT '/Vault',
      category TEXT,
      key_name TEXT UNIQUE,
      tldr TEXT,
      cipher_text TEXT,
      iv TEXT,
      auth_tag TEXT,
      tags TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS node_embeddings (
      node_id TEXT PRIMARY KEY,
      vector_json TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS node_history (
      history_id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT,
      version_num INTEGER,
      title TEXT,
      tldr TEXT,
      full_content TEXT,
      keywords TEXT,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS vault_leases (
      key_name TEXT PRIMARY KEY,
      cipher_text TEXT,
      iv TEXT,
      auth_tag TEXT,
      expires_at INTEGER
    );
  `);

  // Idempotent column check for knowledge_nodes
  try {
    const existingCols = db.prepare("PRAGMA table_info(knowledge_nodes)").all().map(c => c.name);
    if (!existingCols.includes('source_session_id')) {
      db.exec("ALTER TABLE knowledge_nodes ADD COLUMN source_session_id TEXT;");
    }
    if (!existingCols.includes('source_session_title')) {
      db.exec("ALTER TABLE knowledge_nodes ADD COLUMN source_session_title TEXT;");
    }
    if (!existingCols.includes('source_workspace')) {
      db.exec("ALTER TABLE knowledge_nodes ADD COLUMN source_workspace TEXT;");
    }
  } catch (err) {
    console.warn('[Pedestal:DB] Migration check failed:', err.message);
  }

  // Default Root Directories
  const rootDirs = ['/Projects', '/Tech', '/Issues', '/Inbox', '/Vault'];
  const now = new Date().toISOString();
  for (const r of rootDirs) {
    db.prepare(`
      INSERT OR IGNORE INTO memory_directories (path, parent_path, name, dir_summary, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(r, '/', r.replace('/', ''), `Root directory for ${r.replace('/', '')}`, now);
  }

  // FTS5 Virtual Table (Optional with fallback)
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        id UNINDEXED,
        title,
        tldr,
        keywords,
        full_content
      );
    `);
  } catch (err) {
    console.warn('[Pedestal:DB] FTS5 virtual table initialization failed or not supported in this SQLite engine:', err.message);
  }

  // 2. Hardware-grade Crypto, Sanitization & Secret Leases
  let masterKeyBuffer = null;
  function getMasterKey() {
    if (!masterKeyBuffer) {
      if (!fs.existsSync(KEY_PATH)) {
        const hex = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(KEY_PATH, hex, { mode: 0o600 });
      }
      const rawHex = fs.readFileSync(KEY_PATH, 'utf8').trim();
      masterKeyBuffer = Buffer.from(rawHex, 'hex');
    }
    return masterKeyBuffer;
  }

  const leaseStore = new Map(); // keyName -> { secretValue, expiresAt }

  const cryptoEngine = {
    encrypt(plainText) {
      const key = getMasterKey();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let cipherText = cipher.update(String(plainText), 'utf8', 'hex');
      cipherText += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return {
        cipherText,
        iv: iv.toString('hex'),
        authTag
      };
    },
    decrypt(cipherText, iv, authTag) {
      const key = getMasterKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      let plainText = decipher.update(cipherText, 'hex', 'utf8');
      plainText += decipher.final('utf8');
      return plainText;
    },
    sanitize(text) {
      if (!text || typeof text !== 'string') return { cleanText: text, hasSecret: false, matchedCount: 0 };
      const patterns = [
        /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gi,
        /\bsk-[a-zA-Z0-9_-]{16,}\b/g,
        /\bghp_[a-zA-Z0-9]{20,}\b/g,
        /\bBearer\s+[a-zA-Z0-9._-]{20,}\b/gi,
        /\bAKIA[0-9A-Z]{16}\b/g
      ];

      let cleanText = text;
      let matchedCount = 0;
      for (const regex of patterns) {
        cleanText = cleanText.replace(regex, (match) => {
          matchedCount++;
          if (match.toLowerCase().startsWith('bearer ')) {
            return 'Bearer [REDACTED_BY_VAULT]';
          }
          return '[REDACTED_BY_VAULT]';
        });
      }
      return {
        cleanText,
        hasSecret: matchedCount > 0,
        matchedCount
      };
    },
    createLease(keyName, secretValue, ttlMs = 300000) {
      const expiresAt = Date.now() + ttlMs;
      // 1. 本地进程内存存一份
      leaseStore.set(keyName, { secretValue, expiresAt });

      let encrypted = null;
      try {
        encrypted = cryptoEngine.encrypt(secretValue);
      } catch (encErr) {
        console.warn('[Pedestal:Vault] Failed to encrypt lease secret:', encErr.message);
      }

      // 2. 加密后写入 SQLite vault_leases 共享临时表（支持跨进程如独立 daemon 与 DSH 聊天进程共享）
      if (encrypted) {
        try {
          db.prepare(`
            INSERT INTO vault_leases (key_name, cipher_text, iv, auth_tag, expires_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(key_name) DO UPDATE SET
              cipher_text = excluded.cipher_text,
              iv = excluded.iv,
              auth_tag = excluded.auth_tag,
              expires_at = excluded.expires_at
          `).run(keyName, encrypted.cipherText, encrypted.iv, encrypted.authTag, expiresAt);
        } catch (err) {
          console.warn('[Pedestal:Vault] Failed to persist lease to vault_leases table:', err.message);
        }

        // 3. 同步写入硬件级加密缓存文件 (.vault_leases.enc)，保证即使 SQLite 处于只读锁或跨进程临时表异常时仍能 100% 共享
        try {
          let cache = {};
          if (fs.existsSync(LEASE_CACHE_PATH)) {
            try {
              const raw = fs.readFileSync(LEASE_CACHE_PATH, 'utf8');
              const parts = JSON.parse(raw);
              if (parts.cipherText && parts.iv && parts.authTag) {
                const decryptedStr = cryptoEngine.decrypt(parts.cipherText, parts.iv, parts.authTag);
                const parsed = JSON.parse(decryptedStr);
                const now = Date.now();
                for (const [k, v] of Object.entries(parsed)) {
                  if (v && v.expiresAt > now) cache[k] = v;
                }
              }
            } catch {}
          }
          cache[keyName] = { secretValue, expiresAt };
          const payload = cryptoEngine.encrypt(JSON.stringify(cache));
          const tmpPath = LEASE_CACHE_PATH + '.' + Date.now() + '.tmp';
          fs.writeFileSync(tmpPath, JSON.stringify(payload), 'utf8');
          fs.renameSync(tmpPath, LEASE_CACHE_PATH);
        } catch (fErr) {
          console.warn('[Pedestal:Vault] Failed to sync lease cache file:', fErr.message);
        }
      }

      return `{{VAULT_SECRET:${keyName}}}`;
    },
    resolveLeasesInText(cmdString) {
      if (!cmdString || typeof cmdString !== 'string') return cmdString;
      const now = Date.now();
      return cmdString.replace(/\{\{VAULT_SECRET:([^}]+)\}\}/g, (match, keyName) => {
        // 1. 优先内存查找
        const item = leaseStore.get(keyName);
        if (item && item.expiresAt > now) {
          return item.secretValue;
        }

        // 2. 跨进程回退 1：从 SQLite vault_leases 共享表读取并解密
        try {
          const row = db.prepare('SELECT cipher_text, iv, auth_tag, expires_at FROM vault_leases WHERE key_name = ?').get(keyName);
          if (row && row.expires_at > now) {
            const plain = cryptoEngine.decrypt(row.cipher_text, row.iv, row.auth_tag);
            leaseStore.set(keyName, { secretValue: plain, expiresAt: row.expires_at });
            return plain;
          }
        } catch (err) {
          // ignore or fallback
        }

        // 3. 跨进程回退 2：从加密内存缓存文件 (.vault_leases.enc) 读取并解密
        try {
          if (fs.existsSync(LEASE_CACHE_PATH)) {
            const raw = fs.readFileSync(LEASE_CACHE_PATH, 'utf8');
            const parts = JSON.parse(raw);
            if (parts.cipherText && parts.iv && parts.authTag) {
              const decryptedStr = cryptoEngine.decrypt(parts.cipherText, parts.iv, parts.authTag);
              const cache = JSON.parse(decryptedStr);
              if (cache[keyName] && cache[keyName].expiresAt > now) {
                const plain = cache[keyName].secretValue;
                leaseStore.set(keyName, { secretValue: plain, expiresAt: cache[keyName].expiresAt });
                return plain;
              }
            }
          }
        } catch (err) {
          // ignore or fallback
        }

        // 4. 跨进程回退 3 (终极兜底)：直接从 core_vault 硬件保险箱表解析真实机密并自动签发 5 分钟租约
        try {
          const vRow = db.prepare('SELECT cipher_text, iv, auth_tag FROM core_vault WHERE key_name = ?').get(keyName);
          if (vRow) {
            const plain = cryptoEngine.decrypt(vRow.cipher_text, vRow.iv, vRow.auth_tag);
            cryptoEngine.createLease(keyName, plain, 300000);
            return plain;
          }
        } catch (err) {
          console.warn('[Pedestal:Vault] Failed to resolve lease fallback from core_vault:', err.message);
        }

        return match;
      });
    }
  };

  // 3. Kernel Event Bus
  const eventListeners = new Map(); // event -> [{ handler, pluginId }]
  const eventLogs = []; // circular buffer of 100 entries

  const bus = {
    on(event, handler, pluginId = 'sys') {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event).push({ handler, pluginId });
    },
    off(event, handler) {
      if (!eventListeners.has(event)) return;
      const list = eventListeners.get(event);
      const idx = list.findIndex(item => item.handler === handler);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
      if (list.length === 0) {
        eventListeners.delete(event);
      }
    },
    emit(event, payload) {
      const entry = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        event,
        payload,
        timestamp: Date.now()
      };
      eventLogs.push(entry);
      if (eventLogs.length > 100) {
        eventLogs.shift();
      }

      if (eventListeners.has(event)) {
        const list = [...eventListeners.get(event)];
        for (const item of list) {
          try {
            item.handler(payload, entry);
          } catch (err) {
            console.error(`[Pedestal:Bus] Error handling event "${event}" in plugin "${item.pluginId}":`, err);
          }
        }
      }
    },
    getRecentLogs() {
      return [...eventLogs];
    }
  };

  // 3.5 Structured Ring Buffer Logger & Error Diagnostic Stream
  const MAX_LOG_ENTRIES = 500;
  const memoryLogs = [];

  function appendLogEntry(level, moduleName, message, stack = null, context = null) {
    const entry = {
      id: 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      level: (level || 'INFO').toUpperCase(),
      module: moduleName || 'Kernel',
      message: typeof message === 'string' ? message : JSON.stringify(message),
      stack: stack || null,
      context: context || null
    };

    memoryLogs.push(entry);
    if (memoryLogs.length > MAX_LOG_ENTRIES) {
      memoryLogs.shift();
    }

    // Persist to ~/.dsh/memory_vault/pedestal-runtime.log
    try {
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(RUNTIME_LOG_PATH, line, 'utf8');
    } catch {}

    // Broadcast via bus to SSE clients
    try {
      bus.emit('sys:log', entry);
    } catch {}

    return entry;
  }

  // Initial startup log entry
  appendLogEntry('INFO', 'Kernel', 'Microkernel logging subsystem initialized', null, { runtimeLogPath: RUNTIME_LOG_PATH });

  // Hook global uncaughtException and unhandledRejection safely
  if (!globalThis.__PEDESTAL_ERRORS_ATTACHED__) {
    globalThis.__PEDESTAL_ERRORS_ATTACHED__ = true;
    process.on('uncaughtException', (err) => {
      console.error('[Pedestal:UncaughtException]', err);
      appendLogEntry('ERROR', 'Kernel', err.message || 'Uncaught Exception', err.stack, { type: 'uncaughtException' });
    });
    process.on('unhandledRejection', (reason) => {
      console.error('[Pedestal:UnhandledRejection]', reason);
      const msg = reason?.message || String(reason) || 'Unhandled Rejection';
      const stk = reason?.stack || null;
      appendLogEntry('ERROR', 'Kernel', msg, stk, { type: 'unhandledRejection' });
    });
  }

  // Forward bus events into structured log
  bus.on('*', (payload, entry) => {
    if (entry.event === 'sys:log') return; // prevent loop
    const level = entry.event.includes('error') || entry.event.includes('fail') ? 'ERROR' : 'INFO';
    appendLogEntry(level, 'EventBus', `Event: ${entry.event}`, null, payload);
  }, 'kernel-logger');

  const logger = {
    info(module, msg, ctx) { return appendLogEntry('INFO', module, msg, null, ctx); },
    warn(module, msg, ctx) { return appendLogEntry('WARN', module, msg, null, ctx); },
    error(module, msg, stack, ctx) { return appendLogEntry('ERROR', module, msg, stack, ctx); },
    getLogs(filter = {}) {
      const { level, module: mod, query, limit = 200 } = filter;
      let filtered = [...memoryLogs];
      if (level && level !== 'ALL') {
        filtered = filtered.filter(l => l.level === level.toUpperCase());
      }
      if (mod && mod !== 'ALL') {
        filtered = filtered.filter(l => l.module.toLowerCase() === mod.toLowerCase());
      }
      if (query) {
        const qLower = query.toLowerCase();
        filtered = filtered.filter(l =>
          (l.message && l.message.toLowerCase().includes(qLower)) ||
          (l.module && l.module.toLowerCase().includes(qLower)) ||
          (l.stack && l.stack.toLowerCase().includes(qLower))
        );
      }
      return filtered.slice(-Math.min(limit, 500));
    },
    clearLogs() {
      memoryLogs.length = 0;
      try {
        fs.writeFileSync(RUNTIME_LOG_PATH, '', 'utf8');
      } catch {}
      return true;
    }
  };

  // 4. Scoped Context Registry & Sandbox Isolation
  const scopeRegistry = new Map(); // pluginId -> resource sets

  function ensureScope(pluginId) {
    if (!scopeRegistry.has(pluginId)) {
      scopeRegistry.set(pluginId, {
        tools: new Set(),
        apis: new Set(),
        listeners: [], // array of { event, handler }
        timers: new Set(),
        views: new Set(),
        workerTasks: new Set(),
        dagActions: new Set(),
        dagTemplates: new Set(),
        promptHooks: new Set()
      });
    }
    return scopeRegistry.get(pluginId);
  }

  const kernel = {
    db: dbWrapper,
    crypto: cryptoEngine,
    bus,
    logger,
    dshContext,
    workerPool: null,
    dagScheduler: null,
    guiGateway: null,
    hotplugLoader: null,
    bindWorkerPool(pool) {
      this.workerPool = pool;
    },
    bindScheduler(scheduler) {
      this.dagScheduler = scheduler;
    },
    bindGuiGateway(gateway) {
      this.guiGateway = gateway;
    },
    bindHotplugLoader(loader) {
      this.hotplugLoader = loader;
    },
    createScopedContext(pluginId) {
      const scope = ensureScope(pluginId);

      const scopedCtx = {
        pluginId,
        db: dbWrapper,
        crypto: cryptoEngine,
        logger: {
          info: (msg, ctx) => logger.info(pluginId, msg, ctx),
          warn: (msg, ctx) => logger.warn(pluginId, msg, ctx),
          error: (msg, stack, ctx) => logger.error(pluginId, msg, stack, ctx)
        },
        bus: {
          on(event, handler) {
            bus.on(event, handler, pluginId);
            scope.listeners.push({ event, handler });
          },
          off(event, handler) {
            bus.off(event, handler);
            const idx = scope.listeners.findIndex(l => l.event === event && l.handler === handler);
            if (idx !== -1) scope.listeners.splice(idx, 1);
          },
          emit(event, payload) {
            bus.emit(event, payload);
          }
        },
        tools: {
          register(toolDef) {
            const toolName = toolDef.name;
            scope.tools.add(toolName);
            if (dshContext.tools?.register) {
              dshContext.tools.register(toolDef);
            } else if (dshContext.registerTool) {
              dshContext.registerTool(toolDef);
            } else if (dshContext.registry?.register) {
              dshContext.registry.register(toolDef);
            }
          },
          unregister(toolName) {
            scope.tools.delete(toolName);
            if (dshContext.tools?.unregister) {
              dshContext.tools.unregister(toolName);
            } else if (dshContext.unregisterTool) {
              dshContext.unregisterTool(toolName);
            }
          }
        },
        workers: {
          registerWorkerTask(taskName, workerConfig) {
            scope.workerTasks.add(taskName);
            return kernel.workerPool?.registerTask?.(taskName, workerConfig, pluginId);
          },
          run(taskName, payload, priority = 'P1', timeoutMs = 30000) {
            return kernel.workerPool?.run?.(taskName, payload, priority, timeoutMs);
          },
          execute(taskName, payload, priority = 'P1', timeoutMs = 30000) {
            return kernel.workerPool?.run?.(taskName, payload, priority, timeoutMs);
          }
        },
        workflow: {
          registerAction(actionName, actionHandler) {
            scope.dagActions.add(actionName);
            return kernel.dagScheduler?.registerAction?.(actionName, actionHandler);
          },
          registerTemplate(templateName, templateDef) {
            scope.dagTemplates.add(templateName);
            return kernel.dagScheduler?.registerTemplate?.(templateName, templateDef);
          },
          run(templateNameOrDag, inputs) {
            return kernel.dagScheduler?.run?.(templateNameOrDag, inputs);
          }
        },
        gui: {
          registerApi(method, route, handler) {
            const apiId = `${method.toUpperCase()}:${route}`;
            scope.apis.add(apiId);
            return kernel.guiGateway?.registerApi?.(method, route, handler, pluginId);
          },
          registerView(viewPath, viewConfig) {
            scope.views.add(viewPath);
            return kernel.guiGateway?.registerView?.(viewPath, viewConfig, pluginId);
          }
        },
        setInterval(fn, ms, ...args) {
          const timerId = setInterval(fn, ms, ...args);
          scope.timers.add(timerId);
          return timerId;
        },
        setTimeout(fn, ms, ...args) {
          const timerId = setTimeout(() => {
            scope.timers.delete(timerId);
            fn(...args);
          }, ms);
          scope.timers.add(timerId);
          return timerId;
        },
        clearInterval(timerId) {
          scope.timers.delete(timerId);
          clearInterval(timerId);
        },
        clearTimeout(timerId) {
          scope.timers.delete(timerId);
          clearTimeout(timerId);
        }
      };

      return scopedCtx;
    },
    getPluginScopeInfo(pluginId) {
      if (!scopeRegistry.has(pluginId)) return { toolsCount: 0, apisCount: 0, listenersCount: 0 };
      const s = scopeRegistry.get(pluginId);
      return {
        toolsCount: s.tools?.size || 0,
        apisCount: s.apis?.size || 0,
        listenersCount: s.listeners?.length || 0,
        tools: Array.from(s.tools || []),
        apis: Array.from(s.apis || [])
      };
    },
    cleanupPluginScope(pluginId) {
      if (!scopeRegistry.has(pluginId)) return false;
      const scope = scopeRegistry.get(pluginId);

      // 1. Clear Timers
      for (const t of scope.timers) {
        clearInterval(t);
        clearTimeout(t);
      }
      scope.timers.clear();

      // 2. Unbind EventBus Listeners
      for (const { event, handler } of scope.listeners) {
        bus.off(event, handler);
      }
      scope.listeners.length = 0;

      // 3. Remove Tools from DSH
      for (const toolName of scope.tools) {
        if (dshContext.tools?.unregister) {
          dshContext.tools.unregister(toolName);
        } else if (dshContext.unregisterTool) {
          dshContext.unregisterTool(toolName);
        }
      }
      scope.tools.clear();

      // 4. Remove GUI APIs and Views
      for (const apiId of scope.apis) {
        kernel.guiGateway?.unregisterApi?.(apiId, pluginId);
      }
      scope.apis.clear();
      for (const viewPath of scope.views) {
        kernel.guiGateway?.unregisterView?.(viewPath, pluginId);
      }
      scope.views.clear();

      // 5. Deregister Worker Tasks & DAG actions
      for (const taskName of scope.workerTasks) {
        kernel.workerPool?.unregisterTask?.(taskName);
      }
      scope.workerTasks.clear();

      for (const act of scope.dagActions) {
        kernel.dagScheduler?.unregisterAction?.(act);
      }
      scope.dagActions.clear();

      for (const tpl of scope.dagTemplates) {
        kernel.dagScheduler?.unregisterTemplate?.(tpl);
      }
      scope.dagTemplates.clear();

      // Remove from scope registry
      scopeRegistry.delete(pluginId);
      return true;
    },
    async destroy() {
      for (const pid of [...scopeRegistry.keys()]) {
        this.cleanupPluginScope(pid);
      }
      try {
        db.close();
      } catch {}
    }
  };

  return kernel;
}

export default createKernelBus;
