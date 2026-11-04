// ~/.dsh/plugins/dsh-system-pedestal/pedestal/worker-pool.mjs
import { Worker } from 'node:worker_threads';
import os from 'node:os';
import path from 'node:path';

const HOMEDIR = os.homedir();
const DB_PATH = path.join(HOMEDIR, '.dsh', 'memory_vault', 'memory.db');

// Inline Worker Thread bootstrap script with independent SQLite connection (ES module syntax)
const WORKER_SCRIPT = `
import { parentPort } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';

let db = null;
try {
  db = new DatabaseSync(${JSON.stringify(DB_PATH)});
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
} catch (err) {
  // DB connection is optional for pure compute tasks
}

const taskRegistry = new Map();

parentPort.on('message', async (msg) => {
  const { type } = msg;

  if (type === 'REGISTER_TASK') {
    const { taskName, fnSource } = msg;
    try {
      // Evaluate pure function source
      const fn = (new Function('return (' + fnSource + ')'))();
      taskRegistry.set(taskName, fn);
      parentPort.postMessage({ type: 'TASK_REGISTERED', taskName });
    } catch (err) {
      parentPort.postMessage({ type: 'TASK_REGISTER_ERROR', taskName, error: err.message });
    }
    return;
  }

  if (type === 'UNREGISTER_TASK') {
    const { taskName } = msg;
    taskRegistry.delete(taskName);
    return;
  }

  if (type === 'EXECUTE') {
    const { jobId, taskName, data } = msg;
    const fn = taskRegistry.get(taskName);
    if (!fn) {
      parentPort.postMessage({
        type: 'EXECUTE_ERROR',
        jobId,
        error: 'Task "' + taskName + '" is not registered on this worker'
      });
      return;
    }

    try {
      const result = await fn(data, { db });
      parentPort.postMessage({ type: 'EXECUTE_SUCCESS', jobId, result });
    } catch (err) {
      parentPort.postMessage({
        type: 'EXECUTE_ERROR',
        jobId,
        error: err ? (err.message || String(err)) : 'Unknown worker error'
      });
    }
  }
});
`;

export function createWorkerPool(kernel, explicitPoolSize = null) {
  const cpuCount = os.cpus()?.length || 2;
  const poolSize = explicitPoolSize || Math.min(4, Math.max(2, cpuCount - 1));

  // Registered tasks: taskName -> { fnSource, pluginId }
  const registeredTasks = new Map();

  // Priority Queues: P0 (Realtime) > P1 (Normal) > P2 (Background)
  const queues = {
    P0: [],
    P1: [],
    P2: []
  };

  // Active Jobs: jobId -> { resolve, reject, timeoutTimer, startTime, priority }
  const activeJobs = new Map();

  // Worker Instances and Status
  const workers = [];
  let isTerminated = false;

  // Telemetry Metrics
  const telemetry = {
    totalCompleted: 0,
    totalFailed: 0,
    totalExecutionTimeMs: 0,
    averageExecutionTimeMs: 0
  };

  function spawnWorker(workerId) {
    const worker = new Worker(WORKER_SCRIPT, { eval: true });
    const workerWrapper = {
      id: workerId,
      raw: worker,
      busy: false,
      currentJobId: null
    };

    worker.on('message', (msg) => {
      handleWorkerMessage(workerWrapper, msg);
    });

    worker.on('error', (err) => {
      console.error(`[WorkerPool] Worker #${workerId} encountered an error:`, err);
      if (workerWrapper.currentJobId) {
        const job = activeJobs.get(workerWrapper.currentJobId);
        if (job) {
          clearTimeout(job.timeoutTimer);
          job.reject(err);
          activeJobs.delete(workerWrapper.currentJobId);
          telemetry.totalFailed++;
        }
      }
      workerWrapper.busy = false;
      workerWrapper.currentJobId = null;
      dispatchNext();
    });

    worker.on('exit', (code) => {
      if (!isTerminated && code !== 0) {
        console.warn(`[WorkerPool] Worker #${workerId} exited with code ${code}, respawning...`);
        const idx = workers.indexOf(workerWrapper);
        if (idx !== -1) {
          workers.splice(idx, 1);
        }
        const replacement = spawnWorker(workerId);
        // Re-sync registered tasks to replacement
        for (const [taskName, { fnSource }] of registeredTasks.entries()) {
          replacement.raw.postMessage({ type: 'REGISTER_TASK', taskName, fnSource });
        }
      }
    });

    workers.push(workerWrapper);
    return workerWrapper;
  }

  // Initialize Worker Pool
  for (let i = 0; i < poolSize; i++) {
    spawnWorker(i);
  }

  function handleWorkerMessage(workerWrapper, msg) {
    const { type, jobId, result, error } = msg;

    if (type === 'EXECUTE_SUCCESS' || type === 'EXECUTE_ERROR') {
      const job = activeJobs.get(jobId);
      if (job) {
        clearTimeout(job.timeoutTimer);
        const elapsed = Date.now() - job.startTime;
        telemetry.totalCompleted++;
        telemetry.totalExecutionTimeMs += elapsed;
        telemetry.averageExecutionTimeMs = Number((telemetry.totalExecutionTimeMs / telemetry.totalCompleted).toFixed(2));

        if (type === 'EXECUTE_SUCCESS') {
          job.resolve(result);
        } else {
          telemetry.totalFailed++;
          job.reject(new Error(error));
        }
        activeJobs.delete(jobId);
      }

      workerWrapper.busy = false;
      workerWrapper.currentJobId = null;
      dispatchNext();
    }
  }

  function getNextQueuedJob() {
    if (queues.P0.length > 0) return queues.P0.shift();
    if (queues.P1.length > 0) return queues.P1.shift();
    if (queues.P2.length > 0) return queues.P2.shift();
    return null;
  }

  function dispatchNext() {
    if (isTerminated) return;
    const idleWorker = workers.find(w => !w.busy);
    if (!idleWorker) return;

    const jobItem = getNextQueuedJob();
    if (!jobItem) return;

    idleWorker.busy = true;
    idleWorker.currentJobId = jobItem.jobId;

    idleWorker.raw.postMessage({
      type: 'EXECUTE',
      jobId: jobItem.jobId,
      taskName: jobItem.taskName,
      data: jobItem.data
    });
  }

  const pool = {
    poolSize,
    registerTask(taskName, pureFnOrString, pluginId = 'sys') {
      const fnSource = typeof pureFnOrString === 'function' ? pureFnOrString.toString() : String(pureFnOrString);
      registeredTasks.set(taskName, { fnSource, pluginId });

      for (const w of workers) {
        w.raw.postMessage({ type: 'REGISTER_TASK', taskName, fnSource });
      }
    },
    unregisterTask(taskName) {
      registeredTasks.delete(taskName);
      for (const w of workers) {
        w.raw.postMessage({ type: 'UNREGISTER_TASK', taskName });
      }
    },
    unregisterPluginTasks(pluginId) {
      for (const [taskName, taskMeta] of registeredTasks.entries()) {
        if (taskMeta.pluginId === pluginId) {
          this.unregisterTask(taskName);
        }
      }
    },
    run(taskName, data, priority = 'P1', timeoutMs = 30000) {
      if (isTerminated) return Promise.reject(new Error('WorkerPool is terminated'));
      const prio = ['P0', 'P1', 'P2'].includes(priority) ? priority : 'P1';

      return new Promise((resolve, reject) => {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        const timeoutTimer = setTimeout(() => {
          if (activeJobs.has(jobId)) {
            activeJobs.delete(jobId);
            telemetry.totalFailed++;
            reject(new Error(`Worker task "${taskName}" execution timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);

        activeJobs.set(jobId, {
          jobId,
          taskName,
          resolve,
          reject,
          timeoutTimer,
          startTime: Date.now(),
          priority: prio
        });

        queues[prio].push({ jobId, taskName, data, priority: prio });
        dispatchNext();
      });
    },
    async mapParallel(array, taskName, priority = 'P1') {
      if (!Array.isArray(array) || array.length === 0) return [];
      const promises = array.map(item => this.run(taskName, item, priority));
      return await Promise.all(promises);
    },
    getTelemetry() {
      return {
        poolSize: workers.length,
        busyWorkers: workers.filter(w => w.busy).length,
        idleWorkers: workers.filter(w => !w.busy).length,
        queueLengths: {
          P0: queues.P0.length,
          P1: queues.P1.length,
          P2: queues.P2.length,
          total: queues.P0.length + queues.P1.length + queues.P2.length
        },
        registeredTasksCount: registeredTasks.size,
        totalCompleted: telemetry.totalCompleted,
        totalFailed: telemetry.totalFailed,
        averageExecutionTimeMs: telemetry.averageExecutionTimeMs
      };
    },
    async terminate() {
      isTerminated = true;
      for (const job of activeJobs.values()) {
        clearTimeout(job.timeoutTimer);
        job.reject(new Error('WorkerPool terminated'));
      }
      activeJobs.clear();
      queues.P0.length = 0;
      queues.P1.length = 0;
      queues.P2.length = 0;

      const terminations = workers.map(w => w.raw.terminate());
      await Promise.all(terminations);
      workers.length = 0;
    }
  };

  return pool;
}

export default createWorkerPool;
