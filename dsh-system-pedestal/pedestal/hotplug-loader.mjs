// ~/.dsh/plugins/dsh-system-pedestal/pedestal/hotplug-loader.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PluginState = {
  UNLOADED: 'UNLOADED',
  LOADING: 'LOADING',
  ACTIVE: 'ACTIVE',
  DRAINING: 'DRAINING',
  DISPOSED: 'DISPOSED',
  ERROR: 'ERROR'
};

export function createHotplugLoader(kernel) {
  let pluginsDir = null;
  let watcher = null;
  const pluginsMap = new Map(); // id -> meta
  const fileToIdMap = new Map(); // fileName -> id
  const debounceTimers = new Map(); // fileName -> timer

  // 1. Scan and read manifests
  async function scanPluginManifests() {
    if (!pluginsDir || !fs.existsSync(pluginsDir)) return [];
    const files = fs.readdirSync(pluginsDir).filter(f => f.startsWith('plg-') && f.endsWith('.mjs'));
    const manifests = [];

    for (const fileName of files) {
      const filePath = path.join(pluginsDir, fileName);
      const fileUrl = pathToFileURL(filePath).href;
      try {
        const mod = await import(`${fileUrl}?t=${Date.now()}`);
        const manifest = mod.manifest || mod.default?.manifest || {};
        const id = manifest.id || fileName.replace(/^plg-|\.mjs$/g, '');
        const meta = {
          id,
          fileName,
          filePath,
          name: manifest.name || id,
          version: manifest.version || '1.0.0',
          dependencies: Array.isArray(manifest.dependencies) ? manifest.dependencies : [],
          module: mod.default && typeof mod.default.activate === 'function' ? mod.default : mod
        };
        manifests.push(meta);
      } catch (err) {
        console.error(`[HotplugLoader] Failed to read manifest from ${fileName}:`, err.message);
        pluginsMap.set(fileName, {
          id: fileName,
          fileName,
          name: fileName,
          version: 'unknown',
          dependencies: [],
          state: PluginState.ERROR,
          errorMsg: `Manifest import error: ${err.message}`,
          loadedAt: null
        });
      }
    }
    return manifests;
  }

  // 2. Topological Sort
  function topologicalSort(pluginMetas) {
    const metaMap = new Map();
    const inDegree = new Map();
    const adj = new Map(); // depId -> [dependentIds]

    for (const meta of pluginMetas) {
      metaMap.set(meta.id, meta);
      inDegree.set(meta.id, 0);
      adj.set(meta.id, []);
    }

    // Filter missing dependencies and build graph
    for (const meta of pluginMetas) {
      for (const dep of meta.dependencies) {
        if (!metaMap.has(dep)) {
          meta.state = PluginState.ERROR;
          meta.errorMsg = `Missing dependency: "${dep}"`;
          pluginsMap.set(meta.id, { ...meta, loadedAt: null });
        } else {
          adj.get(dep).push(meta.id);
          inDegree.set(meta.id, (inDegree.get(meta.id) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm for DAG topological sort
    const queue = [];
    for (const [id, deg] of inDegree.entries()) {
      const meta = metaMap.get(id);
      if (meta.state === PluginState.ERROR) continue;
      if (deg === 0) queue.push(id);
    }

    const sortedOrder = [];
    while (queue.length > 0) {
      const currentId = queue.shift();
      sortedOrder.push(metaMap.get(currentId));

      const neighbors = adj.get(currentId) || [];
      for (const nextId of neighbors) {
        const meta = metaMap.get(nextId);
        if (meta.state === PluginState.ERROR) continue;
        const newDeg = inDegree.get(nextId) - 1;
        inDegree.set(nextId, newDeg);
        if (newDeg === 0) {
          queue.push(nextId);
        }
      }
    }

    // Detect cycles
    for (const [id, deg] of inDegree.entries()) {
      const meta = metaMap.get(id);
      if (meta.state !== PluginState.ERROR && deg > 0) {
        meta.state = PluginState.ERROR;
        meta.errorMsg = 'Cyclic dependency detected';
        pluginsMap.set(id, { ...meta, loadedAt: null });
        console.error(`[HotplugLoader] Cycle detected for plugin "${id}"`);
      }
    }

    return sortedOrder;
  }

  // 3. Load / Unload Lifecycle
  async function loadPluginByMeta(meta) {
    const { id, fileName, module: mod } = meta;

    if (fileToIdMap.has(fileName)) {
      const existingId = fileToIdMap.get(fileName);
      await unloadPlugin(existingId);
    }

    fileToIdMap.set(fileName, id);
    const pluginRecord = {
      id,
      fileName,
      filePath: meta.filePath,
      name: meta.name,
      version: meta.version,
      dependencies: meta.dependencies,
      state: PluginState.LOADING,
      loadedAt: null,
      errorMsg: null,
      instance: null,
      module: mod
    };
    pluginsMap.set(id, pluginRecord);

    try {
      const ctx = kernel.createScopedContext(id);
      let inst = null;
      if (typeof mod.activate === 'function') {
        inst = await mod.activate(ctx);
      } else if (typeof mod.default === 'function') {
        inst = await mod.default(ctx);
      } else if (typeof mod.bootstrap === 'function') {
        inst = await mod.bootstrap(ctx);
      }

      pluginRecord.instance = inst;
      pluginRecord.state = PluginState.ACTIVE;
      pluginRecord.loadedAt = Date.now();
      kernel.bus?.emit?.('sys:plugin_loaded', { id, version: meta.version });
      console.log(`[HotplugLoader] Plugin "${id}" activated successfully.`);
      return true;
    } catch (err) {
      pluginRecord.state = PluginState.ERROR;
      pluginRecord.errorMsg = err.message;
      kernel.cleanupPluginScope(id);
      console.error(`[HotplugLoader] Error activating plugin "${id}":`, err);
      return false;
    }
  }

  async function loadPlugin(fileName) {
    if (!pluginsDir) return false;
    const filePath = path.join(pluginsDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`[HotplugLoader] File not found: ${fileName}`);
      return false;
    }

    const fileUrl = pathToFileURL(filePath).href;
    try {
      const mod = await import(`${fileUrl}?t=${Date.now()}`);
      const manifest = mod.manifest || mod.default?.manifest || {};
      const id = manifest.id || fileName.replace(/^plg-|\.mjs$/g, '');
      const meta = {
        id,
        fileName,
        filePath,
        name: manifest.name || id,
        version: manifest.version || '1.0.0',
        dependencies: Array.isArray(manifest.dependencies) ? manifest.dependencies : [],
        module: mod.default && typeof mod.default.activate === 'function' ? mod.default : mod
      };
      return await loadPluginByMeta(meta);
    } catch (err) {
      console.error(`[HotplugLoader] Failed to load plugin ${fileName}:`, err);
      return false;
    }
  }

  async function unloadPlugin(pluginId) {
    const pluginRecord = pluginsMap.get(pluginId);
    if (!pluginRecord) return false;

    pluginRecord.state = PluginState.DRAINING;
    console.log(`[HotplugLoader] Draining plugin "${pluginId}"...`);

    try {
      if (pluginRecord.instance && typeof pluginRecord.instance.deactivate === 'function') {
        await pluginRecord.instance.deactivate();
      } else if (pluginRecord.module && typeof pluginRecord.module.deactivate === 'function') {
        await pluginRecord.module.deactivate();
      }
    } catch (err) {
      console.warn(`[HotplugLoader] Error during deactivate() in plugin "${pluginId}":`, err.message);
    }

    kernel.cleanupPluginScope(pluginId);
    pluginRecord.state = PluginState.DISPOSED;
    pluginRecord.instance = null;

    if (fileToIdMap.get(pluginRecord.fileName) === pluginId) {
      fileToIdMap.delete(pluginRecord.fileName);
    }

    kernel.bus?.emit?.('sys:plugin_unloaded', { id: pluginId });
    console.log(`[HotplugLoader] Plugin "${pluginId}" disposed.`);
    return true;
  }

  async function reloadPlugin(pluginId) {
    const pluginRecord = pluginsMap.get(pluginId);
    if (!pluginRecord) return false;
    const fileName = pluginRecord.fileName;
    await unloadPlugin(pluginId);
    return await loadPlugin(fileName);
  }

  async function loadAll() {
    const metas = await scanPluginManifests();
    const sorted = topologicalSort(metas);
    console.log(`[HotplugLoader] Loading ${sorted.length} plugin(s) in topological order:`, sorted.map(s => s.id));
    for (const meta of sorted) {
      await loadPluginByMeta(meta);
    }
  }

  // 4. File Watcher with Debounce
  function startWatcher(dir) {
    if (watcher) {
      try { watcher.close(); } catch {}
    }
    pluginsDir = dir;
    if (!fs.existsSync(pluginsDir)) return;

    watcher = fs.watch(pluginsDir, (eventType, fileName) => {
      if (!fileName || !fileName.startsWith('plg-') || !fileName.endsWith('.mjs')) return;

      if (debounceTimers.has(fileName)) {
        clearTimeout(debounceTimers.get(fileName));
      }

      const timer = setTimeout(async () => {
        debounceTimers.delete(fileName);
        const fullPath = path.join(pluginsDir, fileName);
        if (fs.existsSync(fullPath)) {
          console.log(`[HotplugLoader] Detected change on ${fileName}, reloading...`);
          await loadPlugin(fileName);
        } else {
          const id = fileToIdMap.get(fileName);
          if (id) {
            console.log(`[HotplugLoader] Detected deletion of ${fileName}, unloading plugin "${id}"...`);
            await unloadPlugin(id);
          }
        }
      }, 300);

      debounceTimers.set(fileName, timer);
    });
  }

  const loader = {
    init(kernelRef, targetPluginsDir) {
      if (kernelRef) kernel = kernelRef;
      if (targetPluginsDir) {
        pluginsDir = targetPluginsDir;
        startWatcher(targetPluginsDir);
      }
      return this;
    },
    topologicalSort,
    scanPluginManifests,
    loadPlugin,
    unloadPlugin,
    reloadPlugin,
    loadAll,
    getLoadedPlugins() {
      const result = [];
      for (const p of pluginsMap.values()) {
        if (p.state === PluginState.ACTIVE) {
          result.push({ id: p.id, name: p.name, version: p.version, state: p.state });
        }
      }
      return result;
    },
    getAllPluginStatus() {
      return Array.from(pluginsMap.values()).map(p => ({
        id: p.id,
        name: p.name,
        fileName: p.fileName,
        version: p.version,
        dependencies: p.dependencies,
        state: p.state,
        loadedAt: p.loadedAt,
        errorMsg: p.errorMsg
      }));
    },
    async destroy() {
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
      if (watcher) {
        try { watcher.close(); } catch {}
        watcher = null;
      }
      for (const id of [...pluginsMap.keys()]) {
        await unloadPlugin(id);
      }
      pluginsMap.clear();
      fileToIdMap.clear();
    }
  };

  return loader;
}

export default createHotplugLoader;
