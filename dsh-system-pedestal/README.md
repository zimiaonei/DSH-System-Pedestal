# DSH 图形化微内核基座与热插拔记忆生态 (v4.0) 架构与二次开发手册

> **DSH System Pedestal v4.0** 是专为 DeepSeek Harness 设计的高性能图形化微内核基座与多维记忆中枢。采用类似 VSCode / Eclipse 的微内核（Microkernel）与微前端（Microfrontend）解耦架构，内建硬件级 AES-256-GCM 加密保险箱、独立多线程并发算力池、DAG 自动化编排引擎及热插拔沙箱生命周期状态机。

---

## 一、 系统全景架构与目录结构

```
~/.dsh/plugins/dsh-system-pedestal/
├── index.mjs                    # 基座统一启动入口（bootstrapPedestal / activate）
├── package.json                 # 模块声明与 DSH 插件元数据规范
├── README.md                    # 本开发手册与架构参考
├── pedestal/                    # 🏛️ 基座微内核 6 大核心模块
│   ├── kernel-bus.mjs           # SQLite 事务隔离引擎、AES-256-GCM 硬件加密与内核事件总线
│   ├── worker-pool.mjs          # 多线程并发 Worker 线程池（P0实时 / P1正常 / P2后台优先级队列）
│   ├── dag-scheduler.mjs        # 拓扑任务调度引擎（Fork & Join 并行分支、Cron / 事件驱动）
│   ├── hotplug-loader.mjs       # 业务插件热插拔状态机（Kahn 算法拓扑排序、文件防抖热重载）
│   ├── gui-gateway.mjs          # 本地微前端 HTTP API 网关与 SSE 实时事件遥测中继
│   └── gui-shell.html           # 响应式暗黑极客风 Web GUI 控制台面板（Slot 1~4 微前端容器）
└── plugins/                     # 🔌 业务插件生态（5 个标准业务插件）
    ├── plg-memory-vfs.mjs       # [L0] 虚拟文件系统、工作区锚定与加密保险箱 (Lease 会话占位符)
    ├── plg-memory-engine.mjs    # [L1/L2] 64维向量混合检索、Token 预算熔断器、冲突嗅探与图谱
    ├── plg-memory-hooks.mjs     # Agent 寻址铁律协议常驻注入、命令行密码内存替换与 Drawer 0 短期缓冲
    ├── plg-cold-timemachine.mjs # 节点滑动窗口多版本时光机（红绿 Diff）与冷归档流式打捞复活
    └── plg-auto-distiller.mjs   # 短期成链/每日健康巡检 DAG 流水线与 .dsh-capsule.json 知识胶囊便携包
```

---

## 二、 Web GUI 控制台访问与插槽体系

基座启动后，本地 HTTP / SSE 网关将自动监听在 **18765** 端口（遇到端口占用时自动顺延递增）：

- **GUI 控制台访问地址**：[`http://127.0.0.1:18765`](http://127.0.0.1:18765)
- **快捷唤起 Tool**：调用 `pedestal_open_gui` 即可自动使用系统默认浏览器打开控制台。
- **微前端插槽布局（Slot 1~4）**：
  - **Slot-1（顶栏）**：Pedestal 状态脉冲、多线程算力水位负载条、SQLite 活跃节点计数、全局快捷命令面板（`Ctrl+K`）。
  - **Slot-2（左侧导航条）**：常驻基座内置面板（插件管控、算力大盘、DAG 画布）及业务插件注册的动态图标按钮（`🔐 目录与保险箱`、`⏳ 版本时光机`、`💊 知识胶囊`）。
  - **Slot-3（主舞台）**：微前端主画布容器，无缝挂载业务插件渲染脚本（支持多维卡片网格、Canvas 力导向拓扑图等）。
  - **Slot-4（右侧抽屉 Inspector）**：全局属性与版本查看器（可展开查看 Markdown 源码、行级红绿 Diff 对比、编辑配置）。
  - **底部控制台（Footer）**：SSE 实时单向推送的内核 EventBus 事件流与后台算力遥测日志（支持折叠/清空）。

---

## 三、 PedestalContext (`ctx.*`) 插件二次开发接口速查

编写任何标准业务插件时，只需在 `plugins/plg-xxx.mjs` 中导出 `manifest` 与 `activate(ctx)`。基座在加载插件时会自动注入沙箱化的上下文对象 `ctx`：

| 命名空间 | 方法 / 属性 | 功能与参数说明 |
| :--- | :--- | :--- |
| `ctx.pluginId` | `string` | 当前插件唯一标识 ID |
| `ctx.db` | `.query(sql, params)` | 查询多条记录（只读/聚合） |
| | `.get(sql, params)` | 查询单条记录 |
| | `.run(sql, params)` | 执行插入、更新、删除操作 |
| | `.backup()` | 触发 SQLite WAL 数据库热快照备份，返回备份文件路径 |
| `ctx.crypto` | `.encrypt(plainText)` | 硬件级 AES-256-GCM 加密，返回 `{ cipherText, iv, authTag }` |
| | `.decrypt(cipher, iv, tag)` | 解密密文，返回原始明文字符串 |
| | `.sanitize(text)` | 自动识别并脱敏 API Key、Token、私钥等敏感凭据 |
| | `.createLease(key, secret, ttl)`| 生成 5 分钟用后即焚会话令牌，返回占位符 `{{VAULT_SECRET:<key>}}` |
| | `.resolveLeasesInText(cmd)` | 在内存执行期自动将占位符置换为真实明文 |
| `ctx.bus` | `.on(event, handler)` | 监听内核总线事件（插件卸载时由基座沙箱自动回收） |
| | `.emit(event, payload)` | 向全系统广播事件（自动同步广播至 Web GUI SSE 控制台） |
| `ctx.tools` | `.register(toolDef)` | 向 DSH 注册 AI 可调用的工具（含 name, description, parameters, handler） |
| | `.addSystemPromptHook(fn)` | 向 Agent 对话上下文常驻注入行为准则与动态工作区信息 |
| | `.addCommandInterceptor(fn)` | 挂载底层命令行执行拦截器 |
| `ctx.workers` | `.registerWorkerTask(name, fn)`| 向多线程池注册无状态高密度算力函数（支持独立 SQLite 读取） |
| | `.run(name, data, prio, timeout)`| 调度 Worker 执行计算任务，优先级可选 `'P0' | 'P1' | 'P2'` |
| `ctx.workflow`| `.registerAction(name, fn)` | 向 DAG 引擎注册原子动作，供工作流编排复用 |
| | `.registerTemplate(def, def)` | 注册 Fork & Join DAG 工作流模板（支持 Event 触发器与 Cron 触发器） |
| | `.run(templateId, payload)` | 立即异步调度运行指定 DAG 工作流 |
| `ctx.gui` | `.registerApi(method, route, fn)`| 注册插件专属 REST API，访问路径自动路由至 `/api/ext/<pluginId>/...` |
| | `.registerView(path, viewConfig)`| 向 Slot-2/3 注入微前端视图（配置 id, title, icon, slot, renderScript） |
| | `.pushNotification(lvl, msg)` | 向 GUI 广播系统通知（level: `'info' | 'warn' | 'error'`） |

---

## 四、 5 大标准业务插件与 14 个核心 DSH Tools 清单

### 1. `plg-memory-vfs`（L0 虚拟目录与高安全保险箱）
- **`memory_dir_tree`**：L0 级树形大纲导航，统计活跃知识节点数及 Vault 密钥数，自动高亮匹配当前工作区 `process.cwd()`。
- **`memory_dir_manage`**：新建/修改目录元数据（支持绑定本地代码仓库路径）或批量移动节点。
- **`vault_store_core`**：将机密凭据经 AES-256-GCM 硬件加密存入 `core_vault` 表（永不随抽屉衰减遗忘）。
- **`vault_fetch_core`**：按需提取机密。默认以 `lease` 模式返回 `{{VAULT_SECRET:key}}` 占位符，实现会话零明文保护；支持强制 `plaintext` 并触发安全审计通知。

### 2. `plg-memory-engine`（L1/L2 混合检索引擎与知识图谱）
- **`memory_search_index`**：L1 级轻量混合检索（向量余弦 + 关键词 + RRF 重排）。**铁律保护：严禁返回 full_content 全文**，仅提供轻量卡片防止撑爆上下文。
- **`memory_load_nodes`**：L2 级按需拉取完整正文。内置 **Token 预算熔断器**（默认 2000 Tokens），超限自动折叠截断并提示；自动提升抽屉等级，附带 Top-5 关联图谱卡片。
- **`memory_commit_chain`**：知识沉淀归档。包含自动脱敏、**历史版本快照自动压栈**（保留 5 个快照）、**写入冲突嗅探警告**（相似度 $>75%$ 但结论不同）及图谱连线维护。
- **`memory_feedback`**：提交反馈（helpful 升权 / outdated 降权 / misleading 标为过时）。

### 3. `plg-memory-hooks`（寻址铁律协议与短期记忆缓冲）
- **协议注入与工作区自动锚定**：注入 L0 $ightarrow$ L1 $ightarrow$ L2 渐进式寻址行为规范，自动锚定当前本地目录所属工程。
- **`memory_log_short_term`**：将临时排查痕迹快速存入 Drawer 0 短期缓冲（`/Inbox`），统计堆积碎片数。
- **`memory_consolidate_inbox`**：查看待提炼的短期碎片卡片，或在提炼完成后批量清理。

### 4. `plg-cold-timemachine`（冷库打捞与版本时光机）
- **`memory_node_rollback`**：查询指定节点的历史版本快照，支持红绿行级 Diff 对比与误改一键回滚。
- **`memory_revive_cold`**：对 `dropped_archive.jsonl` 实施流式低内存关键词扫描，支持将自然遗忘的冷数据一键复活至 Lv.2 重新激活。

### 5. `plg-auto-distiller`（自动化工作流与知识胶囊包）
- **`memory_capsule_export`**：将指定目录下的知识与拓扑连线打包导出为标准 `.dsh-capsule.json` 便携文件（**铁律隔离：严禁导出 /Vault 机密**）。
- **`memory_capsule_import`**：一键挂载外部知识胶囊，幂等导入合并并自动重算向量。
- **DAG 自动化流水线**：
  - `dag-inbox-distill`：短期记忆碎片满 10 条自动并行清洗成链。
  - `dag-daily-patrol`：每日零点自动三路并行执行「指数衰减与冷库归档」、「图谱共现巡检」与「SQLite 数据库快照热备」。

---

## 五、 DSH 开机自启配置说明

插件已在 `~/.dsh/profiles/desktop/package.json` 与 `~/.dsh/profiles/desktop/cordis.patch.yml` 中完成平滑声明与自动加载注册：

```yaml
# cordis.patch.yml 自动装载片段
- id: dsh-system-pedestal
  name: "dsh-system-pedestal"
  disabled: false
```

DSH 每次冷启动时将自动激活基座 `index.mjs`，拉起微内核子系统、初始化 18765 端口 Web 控制台，并按 DAG 依赖拓扑顺序自动激活 `plugins/` 下的所有业务插件。
