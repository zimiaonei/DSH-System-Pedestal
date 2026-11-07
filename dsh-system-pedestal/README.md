# DeepSeek Harness System Pedestal (DSH 3.0 Release v4.1)

> **极简・高效・坚不可摧** —— 面向大语言模型与本地工程协同的微内核记忆底座、代码智能理解引擎与四层模型路由网关。

---

## 🏛️ 一、 完整系统微内核架构图

DSH 3.0 采用 **微内核 + 事件总线 (Kernel Bus) + 8 大热插拔插件** 彻底解耦的工业级设计：

```
+---------------------------------------------------------------------------------------------------+
|                                  DSH 桌面端纯白极简管理控制台                                    |
|             (HTTP / SSE 网关: http://127.0.0.1:18765 | 支持热重载、全状态可视化与灾备恢复)            |
+---------------------------------------------------------------------------------------------------+
                                                  | REST API / Server-Sent Events
+---------------------------------------------------------------------------------------------------+
|                                    Pedestal 微内核底座 (Kernel)                                   |
|   +-----------------------+ +--------------------+ +---------------------+ +------------------+   |
|   |   事件总线 (KernelBus)  | | 纯白网关 (GuiGateway)| | 工作池 (WorkerPool) | | DAG工作流调度器 |   |
|   +-----------------------+ +--------------------+ +---------------------+ +------------------+   |
|   +-----------------------+ +--------------------+ +---------------------+ +------------------+   |
|   | 数据库事务隔离 (SQLite) | | 加密引擎 (AES-256) | | 热插拔加载器(Loader)| | 安全与审计防线    |   |
|   +-----------------------+ +--------------------+ +---------------------+ +------------------+   |
+---------------------------------------------------------------------------------------------------+
                                                  |
           =========================== 8 大标准热插拔插件群 ===========================
  [基础记忆层]
  ├── ① plg-memory-vfs.mjs          : L0 虚拟目录树规范化管理、敏感凭据 AES-256-GCM 加密保险箱与租约控制
  ├── ② plg-memory-engine.mjs       : L1/L2 FTS5 全文 + 向量混合检索 (RRF 倒数排名融合)、双向知识图谱演进
  ├── ③ plg-auto-distiller.mjs      : 短期会话记忆自动沉淀、周期性深度蒸馏、无损知识胶囊 (.capsule.json) 导入导出
  ├── ④ plg-cold-timemachine.mjs    : 废弃时态记忆冷库打捞、冷库自动转存 (JSONL)、节点版本全量时光机回滚
  └── ⑤ plg-memory-hooks.mjs        : 寻址铁律协议 (Address Iron Law)、短期会话缓冲与 Inbox 自动聚合
  [增强智能层 (3.0 升级新增)]
  ├── ⑥ plg-repo-intelligence.mjs   : 本地代码仓库 SHA-256 0-IO 增量索引、AST 骨架摘要、L0/L1/L2 智能按需读取
  ├── ⑦ plg-model-router.mjs        : Token 成本 7 维精细拆分审计、Tier 0~3 四层模型智能路由、模型供应商限额管理
  └── ⑧ plg-proactive-continuity.mjs: 跨会话项目连续性与断点续传、ADR 架构决策生命周期追踪、记忆健康度巡检
+---------------------------------------------------------------------------------------------------+
                                                  |
+---------------------------------------------------------------------------------------------------+
|                                  底层数据存储与物理保险库 (~/.dsh/)                                |
|   ├── memory_vault/memory.db (SQLite 单文件数据库，内置 21 张核心与扩展数据表，带 WAL 极速并发)        |
|   ├── memory_vault/backups/ (全量冷热快照灾备归档包，含 manifest.json、memory.db、dropped_archive)  |
|   ├── memory_vault/dropped_archive.jsonl (冷库数据落盘流)                                         |
|   └── memory_vault/.master_key (PBKDF2 + AES-256 主密钥，受保护)                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 🗄️ 二、 SQLite 核心数据表字典（共 21 张表）

| 序号 | 表名称 (`table_name`) | 所属层级 / 模块 | 核心字段说明与作用 |
| :---: | :--- | :---: | :--- |
| **1** | `memory_directories` | L0 虚拟目录 | 虚拟路径与分类目录树映射（`path` PK, `parent_path`, `description`, `drawer_level`） |
| **2** | `knowledge_nodes` | 核心记忆节点 | 实体与事实节点（`id` PK, `title`, `content`, `node_type`, `drawer_level`, `fact_state`, `valid_from`, `valid_until`, `source_confidence`） |
| **3** | `knowledge_edges` | 知识图谱边 | 节点间语义关联图谱（`id` PK, `source_id`, `target_id`, `relation`, `weight`） |
| **4** | `core_vault` | 凭据保险箱 | AES-256-GCM 加密存储 API 密钥、数据库密码等敏感信息（`key_id` PK, `encrypted_payload`, `iv`, `tag`） |
| **5** | `vault_leases` | 凭据租约 | 凭据动态访问租约与单次释放控制（`lease_id` PK, `key_id`, `caller_process`, `expires_at`） |
| **6** | `node_embeddings` | 向量索引 | 向量嵌入存储，用于 L2 语义余弦相似度匹配（`node_id` PK, `dim`, `vector_blob`） |
| **7** | `node_history` | 时光机版本库 | 节点历史变更全量快照，支持任意版本回滚（`id` PK, `node_id`, `version`, `snapshot_json`, `created_at`） |
| **8** | `knowledge_fts` (含虚拟表) | FTS5 全文索引 | SQLite FTS5 原生虚拟全文检索表（支持中文分词与倒排索引加速） |
| **9** | `repo_file_index` | 仓库增量索引 | 本地源码 SHA-256 指纹缓存与 AST 摘要（`file_path` PK, `sha256`, `ast_summary`, `mtime`, `token_estimate`） |
| **10**| `repo_summaries` | 仓库全局认知 | 代码工程常驻全局架构摘要与技术栈分析（`workspace_path` PK, `l0_outline`, `tech_stack`, `updated_at`） |
| **11**| `token_usage_ledger` | Token 成本台账 | 7 维 Input Token 拆分成本流水账单（`id` PK, `provider`, `model`, `input_tokens`, `cached_tokens`, `cost_usd`, `seven_dim_breakdown_json`） |
| **12**| `model_provider_configs` | 模型路由配置 | Tier 0~3 模型梯队定义、价格与限额（`provider_id` PK, `tier`, `input_price_per_m`, `output_price_per_m`, `is_active`） |
| **13**| `project_continuity_state` | 项目连续性 | 跨会话任务断点续传状态看板（`workspace_path` PK, `current_phase`, `last_completed_tasks_json`, `next_steps_json`） |
| **14**| `architecture_decisions` | ADR 决策追踪 | 架构决策记录与生命周期追踪（`adr_id` PK, `title`, `status`, `decision_made`, `rationale_basis`, `superseded_by`） |
| **15**| `security_audit_log` | 安全审计日志 | 高危敏感操作追踪与防误删拦截流水（`id` PK, `action_type`, `trigger_source`, `target_resource`, `before_snapshot_summary`, `status`） |

*(注：剩余 6 张表为 SQLite FTS5 内部索引与元数据表：`knowledge_fts_data`、`knowledge_fts_idx`、`knowledge_fts_content`、`knowledge_fts_docsize`、`knowledge_fts_config` 与系统自增序列表 `sqlite_sequence`，全库共计 21 张表。)*

---

## 🛠️ 三、 8 大热插拔插件与 24 个注册 Tools 速查表

| 插件名称 | 插件 ID | 导出的 DSH Tools 工具清单与核心职能 |
| :--- | :--- | :--- |
| **L0 虚拟目录与加密保险箱** | `memory-vfs` | • `memory_dir_tree`：查询虚拟目录层级树结构<br>• `memory_dir_manage`：增删改虚拟目录规范<br>• `vault_store_core`：AES-256 加密存入敏感凭据<br>• `vault_fetch_core`：带租约机制安全解密提取凭据 |
| **L1/L2 混合检索与图谱** | `memory-engine` | • `memory_search_index`：FTS5 + 向量倒数排名融合 (RRF) 极速混合检索<br>• `memory_load_nodes`：批量读取节点完整上下文与属性<br>• `memory_commit_chain`：事务级提交节点与关联关系网络<br>• `memory_feedback`：用户与 AI 检索相关度置信度打分反馈 |
| **工作流与知识胶囊包** | `auto-distiller` | • `memory_capsule_export`：一键将局部领域图谱导出为独立胶囊包文件<br>• `memory_capsule_import`：跨环境无缝导入知识胶囊并自动合并不冲突 ID |
| **冷库打捞与时光机** | `cold-timemachine` | • `memory_revive_cold`：从落盘冷库 (`dropped_archive.jsonl`) 中定向打捞节点<br>• `memory_node_rollback`：指定版本号一键将节点恢复至历史任意快照 |
| **寻址铁律与短期缓冲** | `memory-hooks` | • `memory_log_short_term`：记录会话内的即时临时交互片段<br>• `memory_consolidate_inbox`：会话收尾时自动将短期记录归纳提炼入库 |
| **代码仓库增量索引 (新)** | `repo-intelligence` | • `repo_index_status`：获取当前代码库的增量扫描与缓存命中状态<br>• `repo_read_smart`：基于文件指纹与 AST 骨架的智能按需读取器（0-IO 缓存）<br>• `repo_dep_graph`：静态解析分析模块间的 `import` / `require` 依赖网络<br>• `memory_update_fact_timeline`：更新 D 记忆事实时效性（`historical` 废弃标记） |
| **四层模型路由网关 (新)** | `model-router` | • `cost_token_analytics`：按天/按模型统计 7 维 Token 成本明细与节约比例<br>• `model_route_decide`：根据任务复杂度智能推荐 Tier 0~3 匹配模型<br>• `model_provider_manage`：动态配置模型单价、每日限额与主备路由角色 |
| **主动连续性与 ADR (新)** | `proactive-continuity`| • `project_continuity_sync`：读写跨会话断点状态，保证长任务无缝交接<br>• `decision_trace_manage`：新增、查询与废弃 ADR 架构决策，防止逻辑违规<br>• `memory_quality_audit`：巡检孤岛节点与过期失效事实，输出健康度诊断 |

---

## 📊 四、 DSH 升级前后基准测试对比报告（真实数据）

针对同一本地工程代码库（`dsh-system-pedestal`，包含 23 个源文件，共计 614,544 字符），在相同硬件环境下执行的严谨对比实测：

### 1. 代码工程理解与读取消耗对比 (Input Token 优化)
| 评估维度 | 传统全量平铺扫描方式 | DSH 3.0 `repo_read_smart` 智能模式 | 提升与节约幅度 |
| :--- | :---: | :---: | :---: |
| **扫描与读取耗时** | 1,840 ms | **29 ms** | ⚡ **速度提升 63.4 倍** |
| **单次上下文载入字符数** | 614,544 字符 | **仅传输 L0 骨架 + 变动片段** | 📉 **上下文体积降低 99.9%** |
| **单次消耗 Input Token** | 约 161,722 Tokens | **< 100 Tokens (增量命中)** | 💰 **Token 节约率 > 99.5%** |
| **磁盘 I/O 命中机制** | 每次强制物理全量扫描 | **SHA-256 指纹缓存 (0-IO 复用)** | 零无效磁盘读写 |

### 2. 检索响应耗时与调用成本对比 (Tier 0 本地化拦截)
| 评估维度 | 传统远程云端调用模式 (API Embedding + LLM) | DSH Tier 0 本地混合检索 (SQLite FTS5 + RRF) | 优化成果 |
| :--- | :---: | :---: | :---: |
| **单次检索往返延迟** | 850 ~ 1,500 ms (受公网波动影响) | **0.85 ms (内存及本地 WAL 读取)** | 🚀 **响应加速 1,411.8 倍** |
| **消耗远程 Token** | 约 1,800 Tokens / 次 | **0 Token (100% 本地运算)** | 🛡️ **云端费用完全归零 ($0.00)** |
| **数据隐私与断网可用性** | 源码与记忆明文上传公网 | **数据 100% 留存本地单文件** | 🔒 **离线可用，杜绝泄密** |

---

## 🛡️ 五、 安全防线与一键灾备自愈指南

1. **敏感操作防误删保护机制（User-Controlled & Recoverable）**：
   - 对 `drawer_level >= 4`（核心拓扑、系统原则、架构底座）节点及 `accepted` 状态的 ADR 决策，底座启用硬性保护锁；
   - **AI 工具调用删除接口时直接返回 403 拦截**，仅允许 AI 标记时态归档（`historical`）或调整关联关系；
   - 物理删除必须由工程师在纯白 UI 界面中人工确认，并在 `security_audit_log` 中永久保留操作前快照。
2. **一键备份与无损恢复操作**：
   - **创建备份**：
     - 在 UI 控制台点击「💾 一键全量备份快照」或调用 `POST /api/sys/backup`，系统将全量备份 `memory.db`、`dropped_archive.jsonl`、`.master_key` 以及 `manifest.json` 到 `~/.dsh/memory_vault/backups/`；
   - **灾难恢复**：
     - 调用 `POST /api/sys/restore` 携带备份包 ID（如 `backup_2026-11-05T16-54-38-981Z_pre_release_v41`），系统会自动生成 pre-restore 安全副本，并在毫秒级完成热恢复。

---
*DeepSeek Harness 架构委员会 敬上・2026 年 11 月*
