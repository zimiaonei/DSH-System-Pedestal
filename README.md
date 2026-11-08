# DSH System Pedestal

> **面向 DeepSeek Harness (DSH) 的本地微内核记忆底座 · 代码智能引擎 · 四层模型路由网关**
> 微内核 + 事件总线 + 8 大热插拔插件，全部数据留在本机。

<p align="left">
  <img alt="version" src="https://img.shields.io/badge/version-4.0.0-0ea5e9">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A522.5-339933">
  <img alt="sqlite" src="https://img.shields.io/badge/storage-SQLite%20WAL-003B57">
  <img alt="deps" src="https://img.shields.io/badge/dependencies-0%20runtime-22c55e">
</p>

---

## 一、这是什么

`dsh-system-pedestal` 是一个以 **DSH 插件**形态运行的本地微内核基座。它为 AI 会话提供三件长期记忆之外的基础设施：

| 能力 | 说明 | 实现位置 |
| :--- | :--- | :--- |
| **长期记忆** | L0 虚拟目录 → L1 摘要卡片 → L2 正文的按需寻址，FTS5 全文 + 向量 RRF 混合检索，双向知识图谱 | `plugins/plg-memory-*.mjs` |
| **代码理解** | 工作区源码 SHA-256 增量索引、AST 骨架摘要、L0/L1/L2 按需读取、import 依赖拓扑 | `plugins/plg-repo-intelligence.mjs` |
| **成本治理** | 7 维 Input Token 拆分审计、Tier 0~3 四层模型路由、主备降级与每日预算 | `plugins/plg-model-router.mjs` |

所有数据写入单文件数据库 `~/.dsh/memory_vault/memory.db`（SQLite，WAL 并发模式），**不依赖任何云端 embedding / 向量库**，断网可用。

---

## 二、架构总览

```
┌──────────────────────────────────────────────────────────────────────┐
│  GUI 控制台  http://127.0.0.1:18765   （纯白极简 · 6 大视图 · SSE 实时）  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ REST + Server-Sent Events
┌───────────────────────────────┴──────────────────────────────────────┐
│                      Pedestal 微内核（Kernel Bus）                     │
│  kernel-bus     gui-gateway     worker-pool     dag-scheduler        │
│  事件总线/DB     HTTP/SSE 网关    P0/P1/P2 线程池   模板化 DAG 工作流     │
│  hotplug-loader  SQLite 事务隔离  AES-256-GCM     安全审计与防误删锁      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ manifest.id / dependencies 拓扑加载
┌───────────────────────────────┴──────────────────────────────────────┐
│                        8 大热插拔插件（26 个工具）                       │
│  memory-vfs → memory-engine → auto-distiller → cold-timemachine      │
│  memory-hooks → repo-intelligence → model-router → continuity        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────────────┐
│              ~/.dsh/memory_vault/  （本地物理存储层）                   │
│  memory.db (WAL) · backups/ · capsules/ · dropped_archive.jsonl      │
│  .master_key (PBKDF2) · .vault_leases.enc · pedestal-runtime.log     │
└──────────────────────────────────────────────────────────────────────┘
```

**启动链路**：DSH 加载 `index.mjs` 的 `apply()/activate()` → `bootstrapPedestal()` 依次挂载
`kernel-bus → worker-pool → dag-scheduler → gui-gateway → hotplug-loader`（任一模组失败只降级，不阻断整体）→
`startWatchdog()` 每 5 秒探测 `127.0.0.1:18765`，端口无响应时以 `detached` 方式拉起 `daemon.mjs` 后台守护进程。

---

## 三、目录结构

```
.
├── dsh-system-pedestal/            # ★ 插件主体（可整体拷贝到 ~/.dsh/plugins/）
│   ├── index.mjs                   # 引导入口：bootstrapPedestal / watchdog / Cordis 安全上下文
│   ├── index.js                    # ESM 转发入口（package.json exports "."）
│   ├── core.mjs                    # 微内核聚合导出（kernel-bus / gui-gateway / test-runner）
│   ├── daemon.mjs                  # 常驻守护进程：僵尸进程清理 + PID 落盘 + 引导基座
│   ├── client.js                   # 桌面端原生客户端面板（纯白样式，3124 行）
│   ├── package.json                # v4.0.0，声明 dsh.bundle.patch 与 dsh.client 注入
│   ├── cordis.patch.yml            # Cordis 宿主插件补丁（insert: dsh-system-pedestal）
│   ├── icon.svg
│   ├── pedestal/                   # 微内核本体
│   │   ├── kernel-bus.mjs          # 事件总线 + node:sqlite(DatabaseSync) 数据层 + 模型/通知总线
│   │   ├── gui-gateway.mjs         # HTTP/SSE 网关（内置 GUI 页面 + 全部 /api/* 路由）
│   │   ├── worker-pool.mjs         # P0/P1/P2 三级优先级线程池（默认 30s 超时 / mapParallel）
│   │   ├── dag-scheduler.mjs       # DAG 模板注册、executeDag、定时区间触发
│   │   ├── hotplug-loader.mjs      # manifest 扫描 → 依赖拓扑 → 加载/热重载/卸载插件作用域
│   │   ├── test-runner.mjs         # 7 套件 28 用例的在线测试引擎（TEST_CATALOG）
│   │   ├── token-roi-benchmark.mjs # Token 节省率基准测试
│   │   └── gui-shell.html          # 控制台前端（6 视图 / Canvas 画布 / 命令面板）
│   ├── plugins/                    # 8 大插件（运行时加载）
│   ├── plugins_backup_v4.0/        # 上一版插件快照（升级对照，不加载）
│   ├── test-doctor.mjs             # 独立诊断脚本
│   └── README.md                   # 架构 / 21 张表字典 / 基准报告（详尽版）
├── memory_vault/                   # 本工作区内的知识库镜像快照（与 ~/.dsh/memory_vault 同构）
├── Python/                         # 随工作区携带的 Python 运行时（pythoncore-3.15-64 / site-packages）
├── .gitignore
└── README.md                       # 本文件
```

> 根目录的 `daemon.log`、`daemon_run.log`、`plg-model-router-content.txt`、`update-router.mjs`、`recovered_router.mjs`、`_analyze_tokens.py` 是开发期临时产物（日志/补丁草稿/分析脚本），不参与插件运行。

---

## 四、快速开始

### 1. 作为 DSH 插件安装

```powershell
# 将整个插件目录拷贝到 DSH 插件根目录（以下为 PowerShell）
Copy-Item -Recurse .\dsh-system-pedestal "$env:USERPROFILE\.dsh\plugins\dsh-system-pedestal" -Force
```

`package.json` 中已声明宿主挂载方式：`dsh.bundle.patch = ./cordis.patch.yml`、`dsh.client` 以 `web` 平台注入侧边栏。
重启 DSH 后，控制台地址为 **http://127.0.0.1:18765**。

### 2. 独立启动守护进程

```powershell
# 使用 DSH 自带 Node 运行时（已验证 v24.21.0；要求 ≥ 22.5，因为依赖 node:sqlite 的 DatabaseSync）
$node = "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-next-primary-runtime\dependencies\node\bin\node.exe"
& $node .\dsh-system-pedestal\daemon.mjs
```

启动时会自动清理上一次遗留的僵尸进程（读取 `memory_vault/daemon.pid`），并写入本次 PID / 版本 / 启动时间。

### 3. 运行在线测试

```powershell
# GUI 内「测试中心」一键执行，或直接调用接口（以下为 PowerShell）
Invoke-RestMethod -Method POST http://127.0.0.1:18765/api/sys/tests/run `
  -ContentType 'application/json' -Body '{"suites":["all"],"filter":""}'
```

---

## 五、插件与工具清单（26 + 3）

| 插件 | manifest.id | 版本 | 导出的 DSH Tools |
| :--- | :--- | :---: | :--- |
| L0 虚拟目录与加密保险箱 | `memory-vfs` | 4.0.0 | `memory_dir_tree` · `memory_dir_manage` · `vault_store_core` · `vault_fetch_core` |
| L1/L2 混合检索与知识图谱 | `memory-engine` | 4.0.0 | `memory_search_index` · `memory_load_nodes` · `memory_commit_chain` · `memory_feedback` |
| 知识胶囊与工作流 | `auto-distiller` | 4.0.0 | `memory_capsule_export` · `memory_capsule_import` |
| 冷库打捞与时光机 | `cold-timemachine` | 4.0.0 | `memory_revive_cold` · `memory_node_rollback` |
| 寻址铁律与短期缓冲 | `memory-hooks` | 4.0.0 | `memory_log_short_term` · `memory_consolidate_inbox` |
| 代码仓库增量索引 | `repo-intelligence` | 4.0.0 | `repo_index_status` · `repo_read_smart` · `repo_dep_graph` · `memory_update_fact_timeline` |
| 四层模型路由与成本审计 | `model-router` | 4.1.0 | `cost_token_analytics` · `model_route_decide` · `model_provider_manage` · `context_governance` · `model_call_dispatch` |
| 主动连续性 / ADR / 健康巡检 | `proactive-continuity` | 4.0.0 | `project_continuity_sync` · `decision_trace_manage` · `memory_quality_audit` |

内建内核工具：`pedestal_status`（子系统与插件状态）、`pedestal_run_tests`（在线测试）、`pedestal_open_gui`（打开控制台）。

**寻址铁律**（`memory-hooks` 注入的系统约束）：位置不明先查 L0 目录树 → 只取 L1 摘要卡片 → 仅在预算内拉取 1~3 个节点的 L2 正文（默认 2000 Token 熔断）→ 结论回写 `memory_commit_chain`；机密一律经保险箱存取，禁止明文外泄。

---

## 六、HTTP API

服务监听 `127.0.0.1:18765`（仅回环地址）。

| 方法 | 路径 | 用途 |
| :--- | :--- | :--- |
| GET | `/` | 内置 GUI 控制台页面 |
| GET | `/api/sys/overview` | 全量状态快照（也是 watchdog 探活端点） |
| GET | `/api/sys/sse` | Server-Sent Events 实时事件流 |
| GET | `/api/graph` | 知识图谱节点 + 边（自动修复空来源会话存量节点） |
| POST | `/api/node/bind-session` | 为节点补绑来源会话（id / title / workspace） |
| POST | `/api/node/delete` | 删除节点，级联清理 `knowledge_edges`/`node_embeddings`/`node_history`，写审计日志 |
| GET | `/api/sys/verify-session` | 校验来源对话是否存在（返回 `exists`） |
| GET | `/api/sys/plugins` | 插件列表与运行状态 |
| POST | `/api/sys/plugins/action` | 插件加载 / 卸载 / 重载 |
| GET | `/api/sys/workflows` | DAG 模板注册表 |
| POST | `/api/sys/workflows/trigger` | 触发指定 DAG 模板 |
| GET | `/api/sys/tests/catalog` | 测试用例目录 |
| POST | `/api/sys/tests/run` | 执行测试套件 |
| GET | `/api/sys/logs` · POST `/api/sys/logs/clear` | 运行时日志检索 / 清空 |
| GET | `/api/sys/security/audit` | 安全审计流水 |
| GET/POST | `/api/sys/backup` | 备份列表 / 一键创建快照 |
| POST | `/api/sys/restore` | 从备份包热恢复（自动生成 pre-restore 副本） |
| POST | `/api/sys/restart` | 重启基座 |
| ANY | `/api/ext/{pluginId}/{subPath}` | 插件自行注册的动态扩展路由 |

**防误删保护**：`drawer_level >= 4` 的节点在 `trigger_source = ai_tool` 时直接返回 **403**，仅允许标记归档；UI 人工删除需携带 `force_confirmed`，且删除前快照写入 `security_audit_log`。

---

## 七、GUI 控制台

`http://127.0.0.1:18765` — 左侧图标导航 + 主画布，含命令面板与实时刷新：

| 视图 | 内容 |
| :--- | :--- |
| 插件热控中心 | 插件卡片、依赖、加载/卸载/重载、日志尾流 |
| 多线程算力大盘 | Worker 池 P0/P1/P2 队列深度、活跃任务、耗时 |
| DAG 工作流画布 | Canvas 绘制模板拓扑（Start/Worker/Join）、触发执行 |
| 仓库与增量索引 | 索引覆盖率、SHA-256 命中、敏感文件防火墙 |
| 模型与成本账单 | 7 维 Token 拆分、Tier 成本、预算与降级轨迹 |
| 项目连续性与 ADR | 断点看板、ADR 生命周期、健康度巡检 |

---

## 八、数据模型

核心表（完整 21 张表字典见 [`dsh-system-pedestal/README.md`](dsh-system-pedestal/README.md)）：

`memory_directories` · `knowledge_nodes` · `knowledge_edges` · `core_vault` · `vault_leases` ·
`node_embeddings` · `node_history` · `knowledge_fts*` · `repo_file_index` · `repo_summaries` ·
`token_usage_ledger` · `model_provider_configs` · `project_continuity_state` ·
`architecture_decisions` · `security_audit_log`

关键约定：

- **抽屉等级** `drawer_level` 1~5，记忆权重按 `7 × 2^(level-1)` 天指数衰减；
- **时序事实** `fact_state`（`current` / `historical`）+ `valid_from` / `valid_until`，旧事实不物理删除只降级；
- **来源溯源** `source_session_id` / `source_session_title` / `source_workspace`，支持从知识卡片跳回原对话。

---

## 九、自动化测试

`pedestal/test-runner.mjs` 内建 **7 套件 / 28 用例**，可在线执行（`POST /api/sys/tests/run`）或通过 `pedestal_run_tests` 工具调用：

| 套件 | 用例数 | 覆盖重点 |
| :--- | :---: | :--- |
| `whitebox` | 4 | 沙箱作用域 10ms 零残留、抽屉衰减公式、64 维特征哈希与 RRF、AES-256-GCM 与脱敏穿透 |
| `blackbox` | 4 | L1 检索零正文泄露、L2 Token 熔断边界、SQL 注入/XSS 防御、胶囊导出零机密 |
| `greybox` | 4 | 跨进程 Lease 用后即焚、P0 抢占 P2、节点历史快照回滚、冷库流式复活 |
| `regression` | 3 | 原对话溯源字段、已删除对话拦截、日志中心 ERROR 检索 |
| `stage2_repo` | 4 | 双重指纹缓存命中、L0 骨架 Token 节省、敏感文件防火墙、时序事实演进 |
| `stage3_router_cost` | 6 | 7 维恒等式、Tier 0~3 路由决策、超时/429 自动降级、明细闭合 |
| `stage4_5` | 3 | 跨会话断点续传、ADR 与质量巡检、防误删锁与热备份 |

---

## 十、安全设计

1. **保险箱**：API Key / SSH Key / DB 口令以 **AES-256-GCM** 加密存入 `core_vault`，主密钥由 PBKDF2 派生并落盘于 `.master_key`。
2. **租约机制**：`vault_fetch_core` 默认返回占位符 `{{VAULT_SECRET:key}}`，由 `resolveLeasesInText` 在调用瞬间还原并即刻焚毁租约，避免明文进入上下文。
3. **自动脱敏**：写入前对 `sk-`、`ghp_`、`Bearer`、`AKIA`、私钥块等模式统一替换。
4. **防误删锁**：AI 工具无法物理删除 Lv.4+ 核心节点与 `accepted` 状态 ADR，全部拦截记入 `security_audit_log`。
5. **网络面收敛**：网关只绑定 `127.0.0.1`；无外部依赖、无遥测、无云端 embedding。

---

## 十一、运行时与排障

| 项 | 值 |
| :--- | :--- |
| Node.js | ≥ 22.5（依赖内置 `node:sqlite` 的 `DatabaseSync`；实测 v24.21.0） |
| 第三方依赖 | 无（package.json 无 dependencies，零安装） |
| 监听端口 | `127.0.0.1:18765` |
| 进程锁 | `~/.dsh/memory_vault/daemon.pid`（含 pid / version / startedAt / nodeVersion） |
| 运行时日志 | `~/.dsh/memory_vault/pedestal-runtime.log` |
| 守护策略 | 5 秒 watchdog 探活，端口不可达即 detached 拉起 `daemon.mjs` |

常见故障：

- **控制台打不开 / 接口 502** → 检查 18765 是否被占用或进程已退出；删除残留 `daemon.pid` 后重启。
- **SQLite 报 `database is locked`** → 说明同时存在两个 daemon 抢锁；`daemon.mjs` 的僵尸清理会处理，也可手动 `taskkill` 旧 PID。
- **插件未加载** → 看 `/api/sys/plugins` 的 `error` 字段，通常是 `manifest.dependencies` 中前置插件缺失。

---

## 十二、开发与提交

```powershell
git remote -v
# origin  https://github.com/zimiaonei/DSH--.git

# 认证推送（Token 不要写进提交内容）
git remote set-url origin https://<user>:<token>@github.com/zimiaonei/DSH--.git
git push origin main
git remote set-url origin https://github.com/zimiaonei/DSH--.git   # 立即还原
```

改后端 `core.mjs` / `pedestal/*.mjs` 后必须**重启守护进程**，新路由与 SQLite 逻辑才会真正生效；改 `gui-shell.html` 可直接刷新页面。

---

## 十三、延伸阅读

- [`dsh-system-pedestal/README.md`](dsh-system-pedestal/README.md) — 完整架构图、21 张表字典、8 插件 24 工具速查、升级前后基准测试数据（扫描耗时 1840ms → 29ms、单次检索 850~1500ms → 0.85ms 等实测对比）、灾备自愈指南。

---

*DeepSeek Harness Architecture Committee · 2026*
