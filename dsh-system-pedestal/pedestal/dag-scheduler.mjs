// ~/.dsh/plugins/dsh-system-pedestal/pedestal/dag-scheduler.mjs
export function createDagScheduler(kernel) {
  // 1. Registries
  const actionsRegistry = new Map(); // actionId -> { meta, handler, pluginId }
  const templatesRegistry = new Map(); // templateId -> { definition, pluginId, eventListener }
  const runHistory = []; // circular buffer of 20 runs
  let executingCount = 0;

  // 2. Scheduler Timer for Interval/Cron triggers
  let cronTicker = null;

  function startCronTicker() {
    if (cronTicker) return;
    cronTicker = setInterval(() => {
      checkTimeTriggers();
    }, 60000); // 1-minute tick
  }

  function checkTimeTriggers() {
    const now = Date.now();
    for (const [id, tpl] of templatesRegistry.entries()) {
      const trigger = tpl.definition.trigger;
      if (!trigger) continue;

      if (trigger.type === 'interval' || trigger.intervalMs) {
        const interval = trigger.intervalMs || 3600000;
        tpl.lastRunAt = tpl.lastRunAt || 0;
        if (now - tpl.lastRunAt >= interval) {
          tpl.lastRunAt = now;
          executeDag(id, { triggeredBy: 'interval', timestamp: now }).catch(err => {
            console.error(`[DagScheduler] Interval run failed for template "${id}":`, err);
          });
        }
      }
    }
  }

  // 3. Register Action & Register Template
  function registerAction(actionId, metaOrHandler, optionalHandler = null, pluginId = 'sys') {
    let meta = {};
    let handler = null;
    if (typeof metaOrHandler === 'function') {
      handler = metaOrHandler;
    } else {
      meta = metaOrHandler || {};
      handler = optionalHandler;
    }

    if (typeof handler !== 'function') {
      throw new Error(`[DagScheduler] Action handler for "${actionId}" must be a function`);
    }

    actionsRegistry.set(actionId, { meta, handler, pluginId });
  }

  function unregisterAction(actionId) {
    actionsRegistry.delete(actionId);
  }

  function registerTemplate(dagDefinition, pluginId = 'sys') {
    const id = dagDefinition.id;
    if (!id) throw new Error('[DagScheduler] DAG template definition must include an "id"');

    // Clean up previous event listener if re-registering
    if (templatesRegistry.has(id)) {
      unregisterTemplate(id);
    }

    const tplRecord = {
      definition: dagDefinition,
      pluginId,
      eventCounter: 0,
      eventListener: null,
      lastRunAt: null
    };

    // Setup event trigger if applicable
    const trigger = dagDefinition.trigger;
    if (trigger && trigger.type === 'event' && trigger.eventName) {
      const threshold = trigger.threshold || 1;
      tplRecord.eventListener = (payload) => {
        tplRecord.eventCounter++;
        if (tplRecord.eventCounter >= threshold) {
          tplRecord.eventCounter = 0;
          executeDag(id, { triggeredBy: 'event', eventPayload: payload }).catch(err => {
            console.error(`[DagScheduler] Event triggered DAG "${id}" failed:`, err);
          });
        }
      };
      kernel?.bus?.on?.(trigger.eventName, tplRecord.eventListener, pluginId);
    }

    templatesRegistry.set(id, tplRecord);
    startCronTicker();
  }

  function unregisterTemplate(templateId) {
    const tpl = templatesRegistry.get(templateId);
    if (!tpl) return;
    if (tpl.eventListener && tpl.definition.trigger?.eventName) {
      kernel?.bus?.off?.(tpl.definition.trigger.eventName, tpl.eventListener);
    }
    templatesRegistry.delete(templateId);
  }

  function unregisterPluginEntities(pluginId) {
    for (const [actionId, actionMeta] of actionsRegistry.entries()) {
      if (actionMeta.pluginId === pluginId) {
        unregisterAction(actionId);
      }
    }
    for (const [tplId, tplMeta] of templatesRegistry.entries()) {
      if (tplMeta.pluginId === pluginId) {
        unregisterTemplate(tplId);
      }
    }
  }

  // 4. DAG Fork & Join Execution Engine
  async function executeDag(templateIdOrDag, initialPayload = {}) {
    let dag = null;
    let templateId = 'inline_dag';

    if (typeof templateIdOrDag === 'string') {
      const tpl = templatesRegistry.get(templateIdOrDag);
      if (!tpl) {
        throw new Error(`[DagScheduler] Template "${templateIdOrDag}" not found`);
      }
      dag = tpl.definition;
      templateId = templateIdOrDag;
    } else if (templateIdOrDag && typeof templateIdOrDag === 'object') {
      dag = templateIdOrDag;
      templateId = dag.id || 'inline_dag';
    } else {
      throw new Error('[DagScheduler] Invalid DAG template or definition supplied');
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    const runRecord = {
      runId,
      templateId,
      status: 'RUNNING',
      startTime,
      endTime: null,
      durationMs: 0,
      initialPayload,
      nodeStates: {},
      results: {},
      error: null
    };

    runHistory.unshift(runRecord);
    if (runHistory.length > 20) {
      runHistory.pop();
    }

    kernel?.bus?.emit?.('dag:run_started', { runId, templateId, startTime });

    // Validate nodes
    const nodes = dag.nodes || [];
    if (nodes.length === 0) {
      runRecord.status = 'COMPLETED';
      runRecord.endTime = Date.now();
      runRecord.durationMs = runRecord.endTime - startTime;
      kernel?.bus?.emit?.('dag:run_completed', { runId, templateId, durationMs: runRecord.durationMs });
      return runRecord;
    }

    // Build In-degree and Dependency Maps
    const inDegree = new Map();
    const downstream = new Map(); // nodeId -> [dependentNodeIds]
    const nodeMap = new Map();

    for (const node of nodes) {
      nodeMap.set(node.id, node);
      const deps = Array.isArray(node.dependsOn) ? node.dependsOn : [];
      inDegree.set(node.id, deps.length);
      downstream.set(node.id, []);
      runRecord.nodeStates[node.id] = { status: 'PENDING', durationMs: 0, error: null };
    }

    for (const node of nodes) {
      const deps = Array.isArray(node.dependsOn) ? node.dependsOn : [];
      for (const depId of deps) {
        if (!downstream.has(depId)) {
          downstream.set(depId, []);
        }
        downstream.get(depId).push(node.id);
      }
    }

    // Execution Context
    const runContext = {
      runId,
      templateId,
      initialPayload,
      results: {},
      kernel
    };

    // Helper to execute a single node
    async function runNode(node) {
      const nodeStart = Date.now();
      runRecord.nodeStates[node.id].status = 'RUNNING';
      kernel?.bus?.emit?.('dag:node_state', {
        runId,
        templateId,
        nodeId: node.id,
        status: 'RUNNING',
        durationMs: 0
      });

      try {
        const actionMeta = actionsRegistry.get(node.actionId);
        let result = null;
        if (actionMeta && typeof actionMeta.handler === 'function') {
          result = await actionMeta.handler({
            params: node.params || {},
            payload: initialPayload,
            results: runContext.results,
            ctx: runContext
          });
        } else {
          throw new Error(`Action "${node.actionId}" not found in registry`);
        }

        const durationMs = Date.now() - nodeStart;
        runContext.results[node.id] = result;
        runRecord.results[node.id] = result;
        runRecord.nodeStates[node.id].status = 'COMPLETED';
        runRecord.nodeStates[node.id].durationMs = durationMs;

        kernel?.bus?.emit?.('dag:node_state', {
          runId,
          templateId,
          nodeId: node.id,
          status: 'COMPLETED',
          durationMs
        });

        // Trigger downstream nodes whose in-degree reaches 0
        const readyDownstream = [];
        const nextIds = downstream.get(node.id) || [];
        for (const nextId of nextIds) {
          const newDeg = inDegree.get(nextId) - 1;
          inDegree.set(nextId, newDeg);
          if (newDeg === 0) {
            readyDownstream.push(nodeMap.get(nextId));
          }
        }

        if (readyDownstream.length > 0) {
          await Promise.all(readyDownstream.map(next => runNode(next)));
        }
      } catch (err) {
        const durationMs = Date.now() - nodeStart;
        runRecord.nodeStates[node.id].status = 'FAILED';
        runRecord.nodeStates[node.id].durationMs = durationMs;
        runRecord.nodeStates[node.id].error = err.message;

        kernel?.bus?.emit?.('dag:node_state', {
          runId,
          templateId,
          nodeId: node.id,
          status: 'FAILED',
          durationMs,
          error: err.message
        });

        throw err;
      }
    }

    executingCount++;
    try {
      // Find initial root nodes with in-degree == 0
      const rootNodes = nodes.filter(n => inDegree.get(n.id) === 0);
      if (rootNodes.length === 0) {
        throw new Error('[DagScheduler] Cyclic dependency or no entry node found in DAG');
      }

      // Parallel Fork execution of all root nodes
      await Promise.all(rootNodes.map(r => runNode(r)));

      runRecord.status = 'COMPLETED';
      runRecord.endTime = Date.now();
      runRecord.durationMs = runRecord.endTime - startTime;
      kernel?.bus?.emit?.('dag:run_completed', {
        runId,
        templateId,
        durationMs: runRecord.durationMs,
        results: runRecord.results
      });
      return runRecord;
    } catch (err) {
      runRecord.status = 'FAILED';
      runRecord.endTime = Date.now();
      runRecord.durationMs = runRecord.endTime - startTime;
      runRecord.error = err.message;
      kernel?.bus?.emit?.('dag:run_failed', {
        runId,
        templateId,
        durationMs: runRecord.durationMs,
        error: err.message
      });
      throw err;
    } finally {
      executingCount = Math.max(0, executingCount - 1);
    }
  }

  const scheduler = {
    registerAction,
    unregisterAction,
    registerTemplate(defOrName, optionalDefOrPluginId, optionalPluginId = 'sys') {
      let def = defOrName;
      let pid = optionalDefOrPluginId;
      if (typeof defOrName === 'string' && optionalDefOrPluginId && typeof optionalDefOrPluginId === 'object') {
        def = { ...optionalDefOrPluginId, id: optionalDefOrPluginId.id || defOrName };
        pid = optionalPluginId || 'sys';
      } else if (typeof optionalDefOrPluginId === 'object') {
        pid = optionalPluginId || 'sys';
      } else if (typeof optionalDefOrPluginId === 'string') {
        pid = optionalDefOrPluginId;
      }
      return registerTemplate(def, pid || 'sys');
    },
    unregisterTemplate,
    unregisterPluginEntities,
    executeDag,
    run: executeDag,
    getRegisteredActions() {
      return Array.from(actionsRegistry.entries()).map(([id, act]) => ({
        id,
        meta: act.meta,
        pluginId: act.pluginId
      }));
    },
    getRegisteredTemplates() {
      return Array.from(templatesRegistry.entries()).map(([id, tpl]) => ({
        id,
        name: tpl.definition.name || id,
        description: tpl.definition.description || '',
        trigger: tpl.definition.trigger,
        nodeCount: tpl.definition.nodes?.length || 0,
        pluginId: tpl.pluginId
      }));
    },
    getRunHistory() {
      return [...runHistory];
    },
    destroy() {
      if (cronTicker) {
        clearInterval(cronTicker);
        cronTicker = null;
      }
      for (const tpl of templatesRegistry.values()) {
        if (tpl.eventListener && tpl.definition.trigger?.eventName) {
          kernel?.bus?.off?.(tpl.definition.trigger.eventName, tpl.eventListener);
        }
      }
      templatesRegistry.clear();
      actionsRegistry.clear();
      runHistory.length = 0;
    }
  };

  return scheduler;
}

export default createDagScheduler;
