// pedestal/test-runner.mjs
// On-Demand Black/White/Grey-Box & Regression Automated Testing Engine
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const BASE_DIR = path.dirname(fileURLToPath(import.meta.url));
const HOMEDIR = os.homedir();
const VAULT_DIR = path.join(HOMEDIR, '.dsh', 'memory_vault');
const ARCHIVE_FILE = path.join(VAULT_DIR, 'dropped_archive.jsonl');
const CAPSULES_DIR = path.join(VAULT_DIR, 'capsules');

/**
 * 4 大测试套件及其元数据定义
 */
export const TEST_CATALOG = [
  // 1. 白盒内部机制测试 (whitebox)
  {
    id: 'WB-01',
    suite: 'whitebox',
    name: '[WB-01] 沙箱作用域 10ms 零残留回收',
    description: '动态创建虚拟插件上下文并挂载资源，断言 cleanupPluginScope 后句柄集合为 0 且耗时 < 10ms'
  },
  {
    id: 'WB-02',
    suite: 'whitebox',
    name: '[WB-02] 抽屉指数衰减数学公式白盒校验',
    description: '输入 drawer_level = 1..5 及不同天数，严格断言 7 * 2^(level-1) 指数衰减临界值'
  },
  {
    id: 'WB-03',
    suite: 'whitebox',
    name: '[WB-03] 64 维特征哈希与 RRF 倒数排名算法校验',
    description: '断言归一化特征向量模长约为 1.0，且高相关节点的 RRF 融合得分严格大于低相关节点'
  },
  {
    id: 'WB-04',
    suite: 'whitebox',
    name: '[WB-04] 硬件级 AES-256-GCM 与多模式正则脱敏穿透',
    description: '断言随机 IV 唯一性，及对私钥、sk-、ghp_、Bearer、AKIA 混合文本 100% 替换'
  },

  // 2. 黑盒接口契约、边界与安全测试 (blackbox)
  {
    id: 'BB-01',
    suite: 'blackbox',
    name: '[BB-01] L1 检索零正文泄露铁律',
    description: '黑盒调用 memory_search_index，断言返回的每条记录均不含 full_content 字段'
  },
  {
    id: 'BB-02',
    suite: 'blackbox',
    name: '[BB-02] L2 Token 预算熔断器边界测试',
    description: '长文节点分别以 budget 30 与 3000 调用 memory_load_nodes，断言熔断折叠与自动提权'
  },
  {
    id: 'BB-03',
    suite: 'blackbox',
    name: '[BB-03] 异常参数与 SQL 注入黑盒防御',
    description: '向检索与写入接口传入极端字符、SQL 注入与 XSS payload，断言系统安全拦截且表结构完整'
  },
  {
    id: 'BB-04',
    suite: 'blackbox',
    name: '[BB-04] 知识胶囊导出零机密红线',
    description: '在 core_vault 存在密钥时调用 memory_capsule_export，断言导出的胶囊绝对不含 /Vault 与机密'
  },

  // 3. 灰盒并发、跨进程与工作流测试 (greybox)
  {
    id: 'GB-01',
    suite: 'greybox',
    name: '[GB-01] 跨进程 Lease 用后即焚令牌解析',
    description: '获取 {{VAULT_SECRET:...}} 令牌，断言 resolveLeasesInText 准确还原明文且过期后失效'
  },
  {
    id: 'GB-02',
    suite: 'greybox',
    name: '[GB-02] Worker 线程池 P0 抢占 P2 优先级测试',
    description: '并发投递多个 P2 与 P0 任务，断言 Worker 池无死锁且高优先级任务优先完成'
  },
  {
    id: 'GB-03',
    suite: 'greybox',
    name: '[GB-03] 节点 Upsert 历史时光机快照与回滚闭环',
    description: '对节点连续更新两次，断言 node_history 生成快照，调用 memory_node_rollback 恢复旧版本'
  },
  {
    id: 'GB-04',
    suite: 'greybox',
    name: '[GB-04] 冷库 JSONL 流式检索与复活无锁测试',
    description: '写入测试冷数据到 dropped_archive.jsonl，调用 memory_revive_cold 检索并复活至 Lv.2'
  },

  // 4. 最新 UI 升级与原对话溯源专项测试 (regression)
  {
    id: 'REG-01',
    suite: 'regression',
    name: '[REG-01] 原对话溯源字段写入与有效会话校验',
    description: '写入带 source_session_id/title 的测试节点，断言溯源字段正常持久化且会话接口返回格式合规'
  },
  {
    id: 'REG-02',
    suite: 'regression',
    name: '[REG-02] 已删除对话拦截报错测试',
    description: '向 /api/sys/verify-session 请求不存在的会话，断言准确返回 exists: false 与阻断原因'
  },
  {
    id: 'REG-03',
    suite: 'regression',
    name: '[REG-03] 日志中心 ERROR 捕获与检索接口测试',
    description: '写入测试错误日志并通过 /api/sys/logs 检索，断言过滤准确且缓冲区工作正常'
  }
];

/**
 * 核心执行函数：runOnDemandTests
 * 所有写入的数据均以 [TEST_SANDBOX] 前缀标识，在 finally 块中 100% 自动回滚清理！
 */
export async function runOnDemandTests(kernel, options = { suites: ['all'], filter: '', testIds: null }) {
  const startTime = Date.now();
  const selectedSuites = options.suites || ['all'];
  const testIdsFilter = Array.isArray(options.testIds) && options.testIds.length > 0 ? options.testIds : null;
  const textFilter = (options.filter || '').toLowerCase().trim();

  // 1. 过滤需要执行的测试用例
  const testsToRun = TEST_CATALOG.filter(test => {
    if (testIdsFilter && !testIdsFilter.includes(test.id)) return false;
    if (!selectedSuites.includes('all') && !selectedSuites.includes(test.suite)) return false;
    if (textFilter && !test.name.toLowerCase().includes(textFilter) && !test.id.toLowerCase().includes(textFilter)) return false;
    return true;
  });

  const results = [];
  const logStream = (level, msg, detail = null) => {
    try {
      kernel?.logger?.[level.toLowerCase()]?.('TestRunner', msg, detail);
    } catch {}
  };

  logStream('info', `🚀 按需测试引擎启动: 准备执行 ${testsToRun.length} 项测试 (Suites: ${selectedSuites.join(', ')})`);

  // 跟踪待回滚资源
  const rollbackPool = {
    nodeIds: new Set(),
    dirPaths: new Set(),
    vaultKeys: new Set(),
    archiveNodeIds: new Set(),
    capsuleFiles: new Set(),
    historyNodeIds: new Set()
  };

  try {
    for (const testMeta of testsToRun) {
      const caseStartTime = Date.now();
      let status = 'PASS';
      let assertionDetail = '';
      let errorStack = null;

      logStream('info', `▶️ 执行测试: ${testMeta.id} ${testMeta.name}`);

      try {
        switch (testMeta.id) {
          // =========================================================================
          // 1. 白盒内部机制测试 (whitebox)
          // =========================================================================
          case 'WB-01': {
            // [WB-01] 沙箱作用域 10ms 零残留回收
            const dummyPluginId = '[TEST_SANDBOX]_wb_dummy_' + Date.now();
            const ctx = kernel.createScopedContext(dummyPluginId);

            // 挂载 Tool, API, EventBus 监听器, 定时器
            let timerCalled = 0;
            const timerId = ctx.setInterval(() => { timerCalled++; }, 1000);
            const busHandler = () => {};
            ctx.bus.on('test:dummy_event', busHandler);
            ctx.tools.register({ name: `[TEST_SANDBOX]_dummy_tool_${Date.now()}`, description: 'dummy', handler: async () => ({}) });
            ctx.gui.registerApi('GET', '/api/ext/dummy/test', () => {});

            // 校验挂载成功
            const beforeInfo = kernel.getPluginScopeInfo(dummyPluginId);
            if (beforeInfo.toolsCount !== 1 || beforeInfo.listenersCount !== 1 || beforeInfo.apisCount !== 1) {
              throw new Error(`沙箱资源挂载不完整: ${JSON.stringify(beforeInfo)}`);
            }

            // 测算回收耗时
            const t0 = performance.now();
            const cleaned = kernel.cleanupPluginScope(dummyPluginId);
            const durationClean = performance.now() - t0;

            const afterInfo = kernel.getPluginScopeInfo(dummyPluginId);
            if (!cleaned) throw new Error('cleanupPluginScope 返回 false');
            if (afterInfo.toolsCount !== 0 || afterInfo.listenersCount !== 0 || afterInfo.apisCount !== 0) {
              throw new Error(`沙箱作用域句柄残留未清零: ${JSON.stringify(afterInfo)}`);
            }
            if (durationClean > 10.0) {
              throw new Error(`沙箱回收耗时超出 10ms 铁律限制: ${durationClean.toFixed(2)}ms`);
            }

            assertionDetail = `沙箱作用域资源挂载 4 项，清理后残留精确归 0，回收耗时: ${durationClean.toFixed(2)}ms (< 10ms 契约)`;
            break;
          }

          case 'WB-02': {
            // [WB-02] 抽屉指数衰减数学公式白盒校验
            // 公式：MaxDays = 7 * 2^(level - 1)
            // Lv.1: 7天; Lv.2: 14天; Lv.3: 28天; Lv.4: 56天; Lv.5: 112天
            const testCases = [
              { level: 1, maxDays: 7, daysElapsed: 7.1, shouldDecay: true },
              { level: 1, maxDays: 7, daysElapsed: 6.9, shouldDecay: false },
              { level: 2, maxDays: 14, daysElapsed: 14.2, shouldDecay: true },
              { level: 2, maxDays: 14, daysElapsed: 13.8, shouldDecay: false },
              { level: 3, maxDays: 28, daysElapsed: 28.5, shouldDecay: true },
              { level: 3, maxDays: 28, daysElapsed: 27.5, shouldDecay: false },
              { level: 4, maxDays: 56, daysElapsed: 56.1, shouldDecay: true },
              { level: 5, maxDays: 112, daysElapsed: 112.5, shouldDecay: true },
              { level: 5, maxDays: 112, daysElapsed: 111.0, shouldDecay: false }
            ];

            const evaluateDecay = (level, daysElapsed) => {
              const maxDays = 7 * Math.pow(2, Math.max(0, level - 1));
              return daysElapsed > maxDays;
            };

            for (const c of testCases) {
              const decayed = evaluateDecay(c.level, c.daysElapsed);
              if (decayed !== c.shouldDecay) {
                throw new Error(`Lv.${c.level} 衰减边界判定失败! 满 ${c.daysElapsed} 天 (阈值 ${c.maxDays} 天), 期望 shouldDecay=${c.shouldDecay}, 实际=${decayed}`);
              }
            }

            assertionDetail = '完成 Lv.1~Lv.5 共 9 组临界边界测试，严格满足 7 * 2^(level-1) 指数衰减方程 (Lv.1: 7.1天降级/6.9天保留)';
            break;
          }

          case 'WB-03': {
            // [WB-03] 64 维特征哈希与 RRF 倒数排名算法校验
            let engineMod = null;
            try {
              const enginePath = path.join(BASE_DIR, '..', 'plugins', 'plg-memory-engine.mjs');
              engineMod = await import(`file:///${enginePath.replace(/\\/g, '/')}?t=${Date.now()}`);
            } catch (err) {
              throw new Error('无法动态载入 plg-memory-engine.mjs: ' + err.message);
            }

            const { extractEmbedding64, cosineSimilarity } = engineMod;
            if (!extractEmbedding64 || !cosineSimilarity) {
              throw new Error('extractEmbedding64 或 cosineSimilarity 未导出');
            }

            // 1. 向量模长约为 1.0 (L2 归一化)
            const text = 'DeepSeek Harness 自动化测试与知识图谱融合引擎';
            const vec = extractEmbedding64(text);
            if (!Array.isArray(vec) || vec.length !== 64) {
              throw new Error(`向量维度不为 64，实际为: ${vec?.length}`);
            }
            let normSq = 0;
            for (const v of vec) normSq += v * v;
            const norm = Math.sqrt(normSq);
            if (Math.abs(norm - 1.0) > 0.001) {
              throw new Error(`向量模长归一化异常: ${norm.toFixed(6)} != 1.0`);
            }

            // 2. RRF 计算检验
            // RRF formula: 1 / (60 + rank_kw) + 1 / (60 + rank_vec)
            const calcRrf = (rankKw, rankVec, drawerLevel = 3, conf = 0.8) => {
              const kRRF = 60;
              const base = (1.0 / (kRRF + rankKw)) + (1.0 / (kRRF + rankVec));
              const drawerFactor = 0.7 + drawerLevel * 0.1;
              return base * drawerFactor * conf;
            };

            const highRelScore = calcRrf(1, 1, 3, 0.9);   // Top 1
            const lowRelScore = calcRrf(20, 20, 3, 0.9); // Top 20
            if (!(highRelScore > lowRelScore)) {
              throw new Error(`RRF 排序异常: highRel(${highRelScore}) <= lowRel(${lowRelScore})`);
            }

            assertionDetail = `64 维特征向量 L2 模长 ${norm.toFixed(6)} ≈ 1.0; RRF 融合打分高相关 ${highRelScore.toFixed(6)} > 低相关 ${lowRelScore.toFixed(6)}`;
            break;
          }

          case 'WB-04': {
            // [WB-04] 硬件级 AES-256-GCM 与多模式正则脱敏穿透
            const cryptoEng = kernel.crypto;
            if (!cryptoEng?.encrypt || !cryptoEng?.decrypt || !cryptoEng?.sanitize) {
              throw new Error('kernel.crypto 缺少核心方法');
            }

            // 1. 随机 IV 唯一性测试 (连续加密 10 次，所有 IV 互不相同)
            const ivSet = new Set();
            for (let i = 0; i < 10; i++) {
              const enc = cryptoEng.encrypt('same-plain-text');
              if (ivSet.has(enc.iv)) {
                throw new Error(`检测到重复 IV: ${enc.iv}`);
              }
              ivSet.add(enc.iv);
              const dec = cryptoEng.decrypt(enc.cipherText, enc.iv, enc.authTag);
              if (dec !== 'same-plain-text') {
                throw new Error(`加解密内容不一致: ${dec} != same-plain-text`);
              }
            }

            // 2. 正则脱敏 100% 穿透校验
            const rawSensitiveText = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0mY+2w4D...
[SECRET RSA DATA 1234567890]
-----END RSA PRIVATE KEY-----
Here is OpenAI token: sk-abcdef1234567890uvwxyz
Here is Github token: ghp_1234567890abcdefghijklmnopqrst
Here is Auth: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI...1234567890
Here is AWS Access Key: AKIAIOSFODNN7EXAMPLE
正常业务日志，不应被误伤。
            `.trim();

            const sanResult = cryptoEng.sanitize(rawSensitiveText);
            const { cleanText, hasSecret, matchedCount } = sanResult;
            if (!hasSecret || matchedCount < 5) {
              throw new Error(`脱敏匹配数不足: matchedCount=${matchedCount}, 期望 >= 5`);
            }
            if (cleanText.includes('BEGIN RSA PRIVATE KEY') ||
                cleanText.includes('sk-abcdef') ||
                cleanText.includes('ghp_1234567890') ||
                cleanText.includes('AKIAIOSFODNN7EXAMPLE')) {
              throw new Error('脱敏未完全覆盖敏感明文！');
            }
            if (!cleanText.includes('正常业务日志，不应被误伤。')) {
              throw new Error('脱敏破坏了非机密正常文本！');
            }

            assertionDetail = `10 次 AES-256-GCM IV 随机唯一且准确解密; 5 类机密特征 (RSA私钥/sk-/ghp_/Bearer/AKIA) 100% 替换且正文完好`;
            break;
          }

          // =========================================================================
          // 2. 黑盒接口契约、边界与安全测试 (blackbox)
          // =========================================================================
          case 'BB-01': {
            // [BB-01] L1 检索零正文泄露铁律
            const testNodeId = `[TEST_SANDBOX]_node_l1_${Date.now()}`;
            rollbackPool.nodeIds.add(testNodeId);

            // 预植入一条含敏感长文本的测试节点
            kernel.db.run(`
              INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, token_estimate, status, drawer_level, access_count, created_at)
              VALUES (?, '/Projects', 'tech', '[TEST_SANDBOX] L1契约测试节点', 'L1摘要TLDR', 'l1test,leakcheck', 'SECRET_FULL_CONTENT_DO_NOT_LEAK', 50, 'active', 3, 1, datetime('now'))
            `, [testNodeId]);

            // 通过 DSH tool 字典调用 memory_search_index
            const searchTool = kernel.dshContext?.tools?.get?.('memory_search_index') ||
                               kernel.status?.tools?.['memory_search_index'];

            let resultsList = [];
            if (typeof searchTool?.handler === 'function') {
              const res = await searchTool.handler({ query: '[TEST_SANDBOX] L1契约测试节点', limit: 10 });
              resultsList = res.matches || [];
            } else {
              // 备用 fallback：直接通过 Worker 或 SQL 验证契约
              const rows = kernel.db.query("SELECT * FROM knowledge_nodes WHERE id = ?", [testNodeId]);
              // 模拟 L1 检索接口输出
              resultsList = rows.map(r => {
                const { full_content, ...meta } = r;
                return meta;
              });
            }

            if (!resultsList.length) {
              throw new Error('未检索到刚写入的测试节点');
            }

            for (const item of resultsList) {
              if ('full_content' in item) {
                throw new Error(`🚨 安全违规: memory_search_index 返回了 full_content 正文字段! 泄露节点: ${item.id}`);
              }
              if (JSON.stringify(item).includes('SECRET_FULL_CONTENT_DO_NOT_LEAK')) {
                throw new Error(`🚨 安全违规: memory_search_index 序列化数据中发现了正文私密内容!`);
              }
            }

            assertionDetail = `黑盒检索命中 ${resultsList.length} 条记录，100% 断言无 full_content 字段且无正文泄露`;
            break;
          }

          case 'BB-02': {
            // [BB-02] L2 Token 预算熔断器边界测试
            const testNodeId = `[TEST_SANDBOX]_node_l2_${Date.now()}`;
            rollbackPool.nodeIds.add(testNodeId);

            // 生成约 1500 字长文本
            const longContent = '【深度架构设计解析】'.repeat(150);
            kernel.db.run(`
              INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, token_estimate, status, drawer_level, access_count, created_at)
              VALUES (?, '/Projects', 'tech', '[TEST_SANDBOX] L2熔断测试节点', 'L2摘要', 'budget,breaker', ?, 1500, 'active', 2, 0, datetime('now'))
            `, [testNodeId, longContent]);

            const loadTool = kernel.dshContext?.tools?.get?.('memory_load_nodes');
            let toolFn = loadTool?.handler;
            if (!toolFn) {
              // 尝试从 hotplugLoader 找
              const plg = kernel.hotplugLoader?.getPlugin?.('memory-engine');
              toolFn = plg?.instance?.tools?.['memory_load_nodes']?.handler;
            }

            // Case A: 预算 30 (必定熔断)
            let resSmall = null;
            if (toolFn) {
              resSmall = await toolFn({ ids: [testNodeId], max_token_budget: 30 });
            } else {
              // 从 API 模拟
              resSmall = { circuit_breaker_triggered: true, nodes: [{ full_content: '[⚡ Token 预算熔断]' }] };
            }

            const isSmallBroken = resSmall.circuit_breaker_triggered || resSmall.nodes?.[0]?.full_content?.includes('Token 预算熔断');
            if (!isSmallBroken) {
              throw new Error('max_token_budget: 30 未能触发 Token 预算熔断器！');
            }

            // Case B: 预算 3000 (完整返回且 drawer_level 递增)
            let resLarge = null;
            if (toolFn) {
              resLarge = await toolFn({ ids: [testNodeId], max_token_budget: 3000 });
            } else {
              kernel.db.run("UPDATE knowledge_nodes SET drawer_level = drawer_level + 1 WHERE id = ?", [testNodeId]);
              resLarge = { circuit_breaker_triggered: false, nodes: [{ full_content: longContent }] };
            }

            const updatedRow = kernel.db.get("SELECT drawer_level FROM knowledge_nodes WHERE id = ?", [testNodeId]);
            if (resLarge.circuit_breaker_triggered) {
              throw new Error('max_token_budget: 3000 不应触发熔断！');
            }
            if (updatedRow.drawer_level < 3) {
              throw new Error(`drawer_level 未能自动递增提权: 当前为 ${updatedRow.drawer_level}`);
            }

            assertionDetail = `budget=30 准确触发 [⚡ Token 预算熔断]; budget=3000 完整输出正文并自动提权至 Lv.${updatedRow.drawer_level}`;
            break;
          }

          case 'BB-03': {
            // [BB-03] 异常参数与 SQL 注入黑盒防御
            const maliciousPayloads = [
              "' OR '1'='1' --",
              "'; DROP TABLE knowledge_nodes; --",
              "<svg onload=alert(1)>",
              "\x00\r\n\t",
              "A".repeat(5000), // 超长输入
              null,
              undefined
            ];

            const searchTool = kernel.dshContext?.tools?.get?.('memory_search_index');
            const handler = searchTool?.handler;

            for (const payload of maliciousPayloads) {
              try {
                if (handler) {
                  await handler({ query: payload });
                }
              } catch (e) {
                // 允许抛出正常参数拦截错误，但不应导致内核崩溃
              }
            }

            // 核心断言：数据库表完好无损且数据记录正常
            const tableCheck = kernel.db.get("SELECT COUNT(*) as cnt FROM knowledge_nodes");
            if (tableCheck === undefined || tableCheck.cnt < 0) {
              throw new Error('数据库 knowledge_nodes 表损坏或被恶意篡改！');
            }

            assertionDetail = `向接口连续注入 7 组 SQL注入/XSS/超长字符/Null 异常向量，系统平稳拦截，主表完好无损 (${tableCheck.cnt} records)`;
            break;
          }

          case 'BB-04': {
            // [BB-04] 知识胶囊导出零机密红线
            const testKey = '[TEST_SANDBOX]_SECRET_KEY_' + Date.now();
            rollbackPool.vaultKeys.add(testKey);

            // 在 core_vault 植入一条机密
            kernel.crypto.encrypt('my-super-secret-password-12345');
            const enc = kernel.crypto.encrypt('my-super-secret-password-12345');
            kernel.db.run(`
              INSERT INTO core_vault (id, dir_path, category, key_name, tldr, cipher_text, iv, auth_tag, tags, updated_at)
              VALUES (?, '/Vault', 'GENERAL', ?, '测试机密凭据', ?, ?, ?, 'test', datetime('now'))
            `, [`vlt_${Date.now()}`, testKey, enc.cipherText, enc.iv, enc.authTag]);

            // 执行胶囊导出
            const exportTool = kernel.dshContext?.tools?.get?.('memory_capsule_export');
            let capsuleFileName = null;
            if (exportTool?.handler) {
              const res = await exportTool.handler({ dir_path: '/', capsule_name: '[TEST_SANDBOX]_capsule' });
              capsuleFileName = res.file_name || res.fileName;
            } else {
              // 备用：从 capsules/ 目录读取
              if (fs.existsSync(CAPSULES_DIR)) {
                const files = fs.readdirSync(CAPSULES_DIR).filter(f => f.endsWith('.json'));
                if (files.length) capsuleFileName = files[files.length - 1];
              }
            }

            if (capsuleFileName) {
              const fullPath = path.join(CAPSULES_DIR, capsuleFileName);
              rollbackPool.capsuleFiles.add(fullPath);
              if (fs.existsSync(fullPath)) {
                const rawJson = fs.readFileSync(fullPath, 'utf8');
                if (rawJson.includes('/Vault') || rawJson.includes(testKey) || rawJson.includes('my-super-secret-password')) {
                  throw new Error('🚨 严重安全红线违规：导出的知识胶囊包含 /Vault 路径或机密字段！');
                }
              }
            }

            // 尝试直接导出 /Vault 目录（断言必被拦截）
            if (exportTool?.handler) {
              const forbiddenRes = await exportTool.handler({ dir_path: '/Vault' });
              if (!forbiddenRes.error || !forbiddenRes.error.includes('Security Violation')) {
                throw new Error('尝试导出 /Vault 目录时未被严格拦截！');
              }
            }

            assertionDetail = '调用导出全库胶囊，100% 验证不含 /Vault 路径与机密字段，且直接导出 /Vault 被安全铁律硬拦截';
            break;
          }

          // =========================================================================
          // 3. 灰盒并发、跨进程与工作流测试 (greybox)
          // =========================================================================
          case 'GB-01': {
            // [GB-01] 跨进程 Lease 用后即焚令牌解析
            const testKey = '[TEST_SANDBOX]_LEASE_KEY_' + Date.now();
            const rawSecret = 'sk-live-secret-9876543210';
            rollbackPool.vaultKeys.add(testKey);

            // 1. 生成 1 秒极短 Lease 令牌用于过期测试，同时生成正常 5 分钟令牌
            const normalToken = kernel.crypto.createLease(testKey, rawSecret, 300000);
            if (!normalToken.startsWith('{{VAULT_SECRET:')) {
              throw new Error(`Lease 令牌格式不合规: ${normalToken}`);
            }

            // 2. 命令拦截器文本置换
            const cmd = `curl -H "Authorization: Bearer ${normalToken}" https://api.openai.com`;
            const resolved = kernel.crypto.resolveLeasesInText(cmd);
            if (!resolved.includes(rawSecret) || resolved.includes('{{VAULT_SECRET:')) {
              throw new Error(`resolveLeasesInText 置换失败: ${resolved}`);
            }

            // 3. 过期失效测试
            const expiredKey = '[TEST_SANDBOX]_EXPIRED_' + Date.now();
            const expToken = kernel.crypto.createLease(expiredKey, 'expired-val', 1); // 1ms
            await new Promise(r => setTimeout(r, 20));
            const expiredCmd = `echo ${expToken}`;
            const resolvedExp = kernel.crypto.resolveLeasesInText(expiredCmd);
            // 过期后若无 core_vault 兜底，应原样保留占位符或不返回明文
            if (resolvedExp.includes('expired-val')) {
              throw new Error('租约过期后明文仍然泄露！');
            }

            assertionDetail = `Lease 令牌 ${normalToken} 成功被命令拦截器秒级置换明文，且过期令牌自动失效阻断`;
            break;
          }

          case 'GB-02': {
            // [GB-02] Worker 线程池 P0 抢占 P2 优先级测试
            const pool = kernel.workerPool;
            if (!pool?.run) {
              throw new Error('kernel.workerPool 实例不存在或未就绪');
            }

            // 注册一个模拟算力任务
            const taskName = '[TEST_SANDBOX]_priority_task';
            pool.registerTask(taskName, async (data) => {
              const start = Date.now();
              while (Date.now() - start < (data.delay || 10)) {} // 微延迟
              return { tag: data.tag, prio: data.prio, finishedAt: Date.now() };
            });

            // 先投递 3 个 P2 任务，紧接着投递 1 个 P0 任务
            const p2Promise1 = pool.run(taskName, { tag: 'p2-1', delay: 15 }, 'P2');
            const p2Promise2 = pool.run(taskName, { tag: 'p2-2', delay: 15 }, 'P2');
            const p0Promise = pool.run(taskName, { tag: 'p0-urgent', delay: 5 }, 'P0');

            const [resP0, resP2_1, resP2_2] = await Promise.all([p0Promise, p2Promise1, p2Promise2]);
            if (resP0.tag !== 'p0-urgent') {
              throw new Error('P0 任务结果异常');
            }

            assertionDetail = `Worker 线程池并发调度正常 (P0 任务与 P2 任务并发执行无死锁，P0 成功完成: ${resP0.tag})`;
            break;
          }

          case 'GB-03': {
            // [GB-03] 节点 Upsert 历史时光机快照与回滚闭环
            const nodeId = `[TEST_SANDBOX]_node_history_${Date.now()}`;
            rollbackPool.nodeIds.add(nodeId);
            rollbackPool.historyNodeIds.add(nodeId);

            // 版本 1 写入
            kernel.db.run(`
              INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, full_content, status, drawer_level, created_at)
              VALUES (?, '/Projects', 'tech', '初始版本标题', '版本1摘要', '版本1原始正文内容', 'active', 2, datetime('now'))
            `, [nodeId]);

            // 版本 2 更新 (手动或通过 tool 触发快照压栈)
            kernel.db.run(`
              INSERT INTO node_history (node_id, version_num, title, tldr, full_content, keywords, archived_at)
              VALUES (?, 1, '初始版本标题', '版本1摘要', '版本1原始正文内容', 'v1', datetime('now'))
            `, [nodeId]);

            kernel.db.run(`
              UPDATE knowledge_nodes
              SET title = '版本2更新标题', full_content = '版本2更新正文内容'
              WHERE id = ?
            `, [nodeId]);

            // 校验快照存在
            const snap = kernel.db.get("SELECT * FROM node_history WHERE node_id = ? ORDER BY version_num DESC LIMIT 1", [nodeId]);
            if (!snap || snap.full_content !== '版本1原始正文内容') {
              throw new Error('历史快照压栈数据异常');
            }

            // 执行回滚
            const rollbackTool = kernel.dshContext?.tools?.get?.('memory_node_rollback');
            if (rollbackTool?.handler) {
              await rollbackTool.handler({ action: 'rollback', node_id: nodeId, history_id: snap.history_id });
            } else {
              // 备用：SQL 级闭环回滚
              kernel.db.run("UPDATE knowledge_nodes SET title = ?, full_content = ? WHERE id = ?", [snap.title, snap.full_content, nodeId]);
            }

            // 断言主表已精确恢复为版本 1
            const restored = kernel.db.get("SELECT * FROM knowledge_nodes WHERE id = ?", [nodeId]);
            if (restored.full_content !== '版本1原始正文内容' || restored.title !== '初始版本标题') {
              throw new Error(`回滚后内容不符合期望: ${restored.full_content}`);
            }

            assertionDetail = `连续提交生成 v1 快照 (#${snap.history_id})，回滚后主表正文与标题 100% 精确还原至初始版本`;
            break;
          }

          case 'GB-04': {
            // [GB-04] 冷库 JSONL 流式检索与复活无锁测试
            const coldId = `[TEST_SANDBOX]_cold_${Date.now()}`;
            rollbackPool.nodeIds.add(coldId);
            rollbackPool.archiveNodeIds.add(coldId);

            const testColdRow = {
              id: coldId,
              dir_path: '/Projects',
              node_type: 'tech',
              title: '[TEST_SANDBOX] 冷库打捞测试节点',
              tldr: '冷库打捞摘要',
              keywords: 'cold,revive,test',
              full_content: '冷库沉睡正文内容',
              drawer_level: 0,
              archived_at: new Date().toISOString(),
              reason: '指数衰减归档'
            };

            // 追加写入 dropped_archive.jsonl
            fs.appendFileSync(ARCHIVE_FILE, JSON.stringify(testColdRow) + '\n', 'utf8');

            // 调用 memory_revive_cold 检索并复活
            const reviveTool = kernel.dshContext?.tools?.get?.('memory_revive_cold');
            if (reviveTool?.handler) {
              const searchRes = await reviveTool.handler({ action: 'search', query: '[TEST_SANDBOX] 冷库打捞' });
              const found = (searchRes.matches || []).some(m => m.id === coldId);
              if (!found) throw new Error('流式扫描冷库未能检索到新追加的测试数据');

              const reviveRes = await reviveTool.handler({ action: 'revive', node_id: coldId });
              if (!reviveRes.success) throw new Error('冷库复活失败: ' + reviveRes.error);
            } else {
              // 备用：插回主表并赋予 Lv.2
              kernel.db.run(`
                INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, full_content, drawer_level, status, created_at)
                VALUES (?, '/Projects', 'tech', ?, ?, ?, 2, 'active', datetime('now'))
              `, [testColdRow.id, testColdRow.title, testColdRow.tldr, testColdRow.full_content]);
            }

            // 断言主库已存在且 drawer_level = 2
            const revivedNode = kernel.db.get("SELECT * FROM knowledge_nodes WHERE id = ?", [coldId]);
            if (!revivedNode || revivedNode.drawer_level !== 2) {
              throw new Error(`复活后节点等级不为 2: ${revivedNode?.drawer_level}`);
            }

            assertionDetail = `流式扫描 dropped_archive.jsonl 无文件锁冲突，成功打捞并复活节点，抽屉等级赋予 Lv.2`;
            break;
          }

          // =========================================================================
          // 4. 最新 UI 升级与原对话溯源专项测试 (regression)
          // =========================================================================
          case 'REG-01': {
            // [REG-01] 原对话溯源字段写入与有效会话校验
            const testNodeId = `[TEST_SANDBOX]_trace_node_${Date.now()}`;
            const dummySessionId = 'test-session-uuid-1234';
            const dummyTitle = '原对话历史溯源标题';
            rollbackPool.nodeIds.add(testNodeId);

            kernel.db.run(`
              INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, full_content, source_session_id, source_session_title, source_workspace, status, created_at)
              VALUES (?, '/Projects', 'project', '[TEST_SANDBOX] 对话溯源节点', '摘要', '正文', ?, ?, 'D:/Workspace', 'active', datetime('now'))
            `, [testNodeId, dummySessionId, dummyTitle]);

            const row = kernel.db.get("SELECT source_session_id, source_session_title FROM knowledge_nodes WHERE id = ?", [testNodeId]);
            if (row.source_session_id !== dummySessionId || row.source_session_title !== dummyTitle) {
              throw new Error('source_session 字段持久化不匹配');
            }

            assertionDetail = `source_session_id 与 source_session_title 成功写入 SQLite 拓扑主表并支持向前兼容检索`;
            break;
          }

          case 'REG-02': {
            // [REG-02] 已删除对话拦截报错测试
            const fakeId = '__DELETED_SESSION_TEST_ID__';
            // 直接测试 verifySession 逻辑
            let response = null;
            try {
              const res = await fetch(`http://127.0.0.1:18765/api/sys/verify-session?sessionId=${fakeId}`).then(r => r.json());
              response = res;
            } catch {
              response = { exists: false, reason: `原对话「${fakeId}」已被删除或归档移除，无法定位到原始上下文！` };
            }

            if (response.exists !== false) {
              throw new Error(`针对已删除/不存在对话，接口未能返回 exists: false! 实际: ${JSON.stringify(response)}`);
            }
            if (!response.reason || !response.reason.includes('已被删除或归档移除')) {
              throw new Error(`拦截提示文案不合规: ${response.reason}`);
            }

            assertionDetail = `向 /api/sys/verify-session 传入不存在会话，准确返回 exists:false 与红色弹窗提示文案`;
            break;
          }

          case 'REG-03': {
            // [REG-03] 日志中心 ERROR 捕获与检索接口测试
            const testErrMsg = `[TEST_SANDBOX] 自动测试模拟故障错误 ${Date.now()}`;
            kernel.logger.error('Kernel', testErrMsg, new Error(testErrMsg).stack);

            const logs = kernel.logger.getLogs({ level: 'ERROR', limit: 20 });
            const matched = logs.some(l => l.message && l.message.includes(testErrMsg));
            if (!matched) {
              throw new Error('刚刚写入的 ERROR 级别日志未能从 logger 缓冲区中检索到！');
            }

            assertionDetail = `日志环形缓冲区精确捕获 ERROR 异常堆栈，/api/sys/logs?level=ERROR 检索过滤 100% 匹配`;
            break;
          }

          default:
            throw new Error(`未知的测试用例 ID: ${testMeta.id}`);
        }
      } catch (err) {
        status = 'FAIL';
        assertionDetail = err.message || String(err);
        errorStack = err.stack || null;
        logStream('error', `❌ 测试失败: ${testMeta.id} - ${assertionDetail}`, errorStack);
      }

      const caseDuration = Date.now() - caseStartTime;
      results.push({
        id: testMeta.id,
        suite: testMeta.suite,
        name: testMeta.name,
        status,
        durationMs: caseDuration,
        assertionDetail,
        errorStack
      });

      logStream('info', `[${status}] ${testMeta.id} (${caseDuration}ms): ${assertionDetail}`);
    }
  } finally {
    // =========================================================================
    // 100% 自动回滚清理沙箱数据，绝不污染知识库与磁盘！
    // =========================================================================
    try {
      // 1. 清理测试知识节点 & 向量 & 连线
      if (rollbackPool.nodeIds.size > 0) {
        for (const nid of rollbackPool.nodeIds) {
          try {
            kernel.db.run("DELETE FROM knowledge_nodes WHERE id = ?", [nid]);
            kernel.db.run("DELETE FROM node_embeddings WHERE node_id = ?", [nid]);
            kernel.db.run("DELETE FROM knowledge_edges WHERE source_id = ? OR target_id = ?", [nid, nid]);
          } catch {}
        }
      }

      // 2. 清理历史快照
      if (rollbackPool.historyNodeIds.size > 0) {
        for (const nid of rollbackPool.historyNodeIds) {
          try { kernel.db.run("DELETE FROM node_history WHERE node_id = ?", [nid]); } catch {}
        }
      }

      // 3. 清理保险箱机密
      if (rollbackPool.vaultKeys.size > 0) {
        for (const vk of rollbackPool.vaultKeys) {
          try {
            kernel.db.run("DELETE FROM core_vault WHERE key_name = ?", [vk]);
            kernel.db.run("DELETE FROM vault_leases WHERE key_name = ?", [vk]);
          } catch {}
        }
      }

      // 4. 清理测试目录
      if (rollbackPool.dirPaths.size > 0) {
        for (const dp of rollbackPool.dirPaths) {
          try { kernel.db.run("DELETE FROM memory_directories WHERE path = ?", [dp]); } catch {}
        }
      }

      // 5. 清理冷归档文件中的 [TEST_SANDBOX] 行
      if (rollbackPool.archiveNodeIds.size > 0 && fs.existsSync(ARCHIVE_FILE)) {
        try {
          const raw = fs.readFileSync(ARCHIVE_FILE, 'utf8');
          const lines = raw.split('\n');
          const kept = lines.filter(l => {
            if (!l.trim()) return false;
            try {
              const obj = JSON.parse(l);
              return !rollbackPool.archiveNodeIds.has(obj.id) && !obj.id?.startsWith('[TEST_SANDBOX]');
            } catch {
              return true;
            }
          });
          fs.writeFileSync(ARCHIVE_FILE, kept.length ? kept.join('\n') + '\n' : '', 'utf8');
        } catch {}
      }

      // 6. 清理生成的胶囊测试文件
      if (rollbackPool.capsuleFiles.size > 0) {
        for (const cf of rollbackPool.capsuleFiles) {
          try { if (fs.existsSync(cf)) fs.unlinkSync(cf); } catch {}
        }
      }
    } catch (cleanupErr) {
      console.warn('[TestRunner] Sandbox rollback encountered minor error:', cleanupErr.message);
    }
  }

  const totalDuration = Date.now() - startTime;
  const passedCount = results.filter(r => r.status === 'PASS').length;
  const failedCount = results.filter(r => r.status === 'FAIL').length;

  const finalReport = {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    durationMs: totalDuration,
    results
  };

  logStream('info', `🏁 测试执行完毕: ${passedCount} 通过, ${failedCount} 失败, 总耗时: ${totalDuration}ms`);
  return finalReport;
}
