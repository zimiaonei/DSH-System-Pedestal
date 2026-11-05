// ~/.dsh/plugins/dsh-system-pedestal/plugins/plg-memory-hooks.mjs
// Agent 寻址铁律协议与短期记忆缓冲插件 (v4.0.0)

export const manifest = {
  id: 'memory-hooks',
  name: '寻址铁律协议与短期记忆缓冲',
  version: '4.0.0',
  dependencies: ['memory-engine']
};

export const CORE_ADDRESSING_PROTOCOL = `
【DSH Memory Pedestal v4.0 按需寻址铁律（严禁一次性塞满上下文）】
1. L0 查目录：位置不明时先调 memory_dir_tree 查看目录树大纲与当前工作区锚点。
2. L1 查摘要：调 memory_search_index（支持关键词+语义混合检索）获取 tldr 卡片与 token_estimate。
3. L2 按预算读正文：仅挑选最关键的 1~3 个节点 ID 调 memory_load_nodes（默认受 2000 Token 预算熔断保护）拉取完整正文与 Top-5 关联图谱。
4. 沉淀与冲突消解：解决重要问题后调 memory_commit_chain 归档（若提示存在潜在冲突旧节点，请及时核实并标记 supersedes_node_id）；发现历史方案有用或过时请调 memory_feedback。
5. 机密零明文原则：密码/Token/私钥必须用 vault_store_core 存入保险箱；读取时默认使用 vault_fetch_core 的 lease 占位符模式（{{VAULT_SECRET:key}}），严禁在对话中直接输出明文密钥。
`.trim();

/**
 * 粗略估算 Token
 */
function estimateTokens(text) {
  if (!text) return 0;
  let zhCount = 0;
  let enCount = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x4e00 && code <= 0x9fa5) zhCount++;
    else enCount++;
  }
  return Math.ceil(zhCount * 1.5 + enCount * 0.3);
}

export async function activate(ctx) {
  console.log('[plg-memory-hooks] Activating Agent 寻址铁律协议与短期记忆缓冲 v4.0.0...');

  // =========================================================================
  // 1. 上下文协议注入与工作区自动锚定 (addSystemPromptHook)
  // =========================================================================
  const getDynamicPrompt = () => {
    let workspacePrompt = '';
    const currentCwd = process.cwd();

    try {
      const dirs = ctx.db.query("SELECT * FROM memory_directories WHERE workspace_path IS NOT NULL AND workspace_path != ''");
      const normCwd = currentCwd.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');

      let matchedDir = null;
      for (const d of dirs) {
        const normWp = (d.workspace_path || '').replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
        if (normCwd === normWp || normCwd.startsWith(normWp + '/')) {
          matchedDir = d;
          break;
        }
      }

      if (matchedDir) {
        // 查询该目录下的活跃节点概览
        const nodes = ctx.db.query(
          "SELECT id, title, node_type, drawer_level FROM knowledge_nodes WHERE dir_path = ? AND status = 'active' ORDER BY drawer_level DESC LIMIT 5",
          [matchedDir.path]
        );
        const nodeSummary = nodes.length > 0
          ? nodes.map(n => `[#${n.id}] ${n.title} (Lv.${n.drawer_level})`).join(', ')
          : '暂无活跃节点';

        workspacePrompt = `\n\n【当前工作区自动锚定】\n- 本地路径: ${currentCwd}\n- 虚拟目录: ${matchedDir.path} (${matchedDir.name})\n- 目录用途: ${matchedDir.dir_summary || '未填写'}\n- 活跃知识节点: ${nodeSummary}`;
      }
    } catch (err) {
      console.warn('[plg-memory-hooks] Workspace anchoring scan error:', err.message);
    }

    return CORE_ADDRESSING_PROTOCOL + workspacePrompt;
  };

  // 注入 Prompt Hook
  if (typeof ctx.tools?.addSystemPromptHook === 'function') {
    ctx.tools.addSystemPromptHook(getDynamicPrompt);
  } else if (typeof ctx.addSystemPromptHook === 'function') {
    ctx.addSystemPromptHook(getDynamicPrompt);
  }

  // =========================================================================
  // 2. 命令拦截器 (addCommandInterceptor: resolveLeasesInText)
  // =========================================================================
  const resolveLeaseInterceptor = (cmd) => {
    if (!cmd || typeof cmd !== 'string') return cmd;
    if (ctx.crypto?.resolveLeasesInText) {
      return ctx.crypto.resolveLeasesInText(cmd);
    }
    return cmd;
  };

  if (typeof ctx.tools?.addCommandInterceptor === 'function') {
    ctx.tools.addCommandInterceptor(resolveLeaseInterceptor);
  } else if (typeof ctx.addCommandInterceptor === 'function') {
    ctx.addCommandInterceptor(resolveLeaseInterceptor);
  }

  // =========================================================================
  // 3. 注册短期记忆抽屉 (Drawer 0) 核心工具
  // =========================================================================

  // 3.1 memory_log_short_term
  ctx.tools.register({
    name: 'memory_log_short_term',
    description: '快速将当次会话的临时发现、Debug排查痕迹或临时备忘存入 Drawer 0 短期记忆区（/Inbox 目录），待后续总结提炼',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: '短期日志或备忘内容（将自动脱敏）'
        },
        title: {
          type: 'string',
          description: '可选的简要标题，缺省时自动截取'
        },
        tags: {
          type: 'string',
          description: '可选检索标签，如 "debug,auth"'
        }
      },
      required: ['content']
    },
    handler: async (args = {}) => {
      const { content, title, tags = '' } = args;
      if (!content || typeof content !== 'string') {
        return { error: 'content is required' };
      }

      // 强制脱敏
      const sanitizeRes = ctx.crypto?.sanitize ? ctx.crypto.sanitize(content) : { cleanText: content, matchedCount: 0 };
      const safeContent = sanitizeRes.cleanText;

      const now = new Date().toISOString();
      const nodeTitle = title || (safeContent.slice(0, 30).replace(/\n/g, ' ').trim() + (safeContent.length > 30 ? '...' : ''));
      const tldr = safeContent.slice(0, 100).replace(/\n/g, ' ').trim();
      const tokens = estimateTokens(safeContent);
      const nodeId = 'inbox_' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      const activeSessionId = args.source_session_id || process.env.DSH_SESSION_ID || process.env.SESSION_ID || ctx.dshContext?.sessionId || null;
      const activeSessionTitle = args.source_session_title || process.env.DSH_SESSION_TITLE || ctx.dshContext?.sessionTitle || (activeSessionId ? `对话 ${activeSessionId.slice(0, 8)}` : null);
      const activeWorkspace = args.source_workspace || process.env.DSH_WORKSPACE || process.cwd();

      // 写入 knowledge_nodes (/Inbox 目录，drawer_level = 0, node_type = 'short_term_log'，记录来源对话)
      ctx.db.run(
        `INSERT INTO knowledge_nodes (id, dir_path, node_type, title, tldr, keywords, full_content, token_estimate, status, confidence, drawer_level, access_count, last_accessed_at, created_at, source_session_id, source_session_title, source_workspace)
         VALUES (?, '/Inbox', 'short_term_log', ?, ?, ?, ?, ?, 'active', 0.5, 0, 1, ?, ?, ?, ?, ?)`,
        [nodeId, nodeTitle, tldr, tags, safeContent, tokens, now, now, activeSessionId, activeSessionTitle, activeWorkspace]
      );

      // 统计当前 /Inbox 下 drawer_level = 0 的未处理碎片总数
      const row = ctx.db.get("SELECT COUNT(*) as count FROM knowledge_nodes WHERE dir_path = '/Inbox' AND drawer_level = 0 AND status = 'active'");
      const inboxCount = row ? (row.count || 0) : 1;

      // 触发内核总线事件（当达到 10 条时可由 DAG 流水线自动监听触发提炼）
      ctx.bus?.emit?.('memory:inbox_added', {
        id: nodeId,
        title: nodeTitle,
        inboxCount,
        thresholdReached: inboxCount >= 10
      });

      return {
        success: true,
        id: nodeId,
        node_id: nodeId,
        dir_path: '/Inbox',
        drawer_level: 0,
        title: nodeTitle,
        token_estimate: tokens,
        sanitized_count: sanitizeRes.matchedCount || 0,
        inbox_count: inboxCount,
        prompt: inboxCount >= 10
          ? `📢 Inbox 累积未提炼碎片已达 ${inboxCount} 条，建议调用 memory_consolidate_inbox 查看并提炼正式知识链！`
          : `已存入短期记忆抽屉，当前 /Inbox 碎片数: ${inboxCount}`
      };
    }
  });

  // 3.2 memory_consolidate_inbox
  ctx.tools.register({
    name: 'memory_consolidate_inbox',
    description: '查看 /Inbox 下未处理的短期记忆碎片，或批量清理已完成提炼归档的临时条目',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'clear_ids'],
          description: '操作: list (列出全部待提炼条目) | clear_ids (清理指定条目)'
        },
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: '当 action = \'clear_ids\' 时，指定清理删除的短期记忆 ID 列表'
        }
      },
      required: ['action']
    },
    handler: async (args = {}) => {
      const { action = 'list', ids = [] } = args;

      if (action === 'clear_ids') {
        if (!Array.isArray(ids) || ids.length === 0) {
          return { error: 'clear_ids action requires a non-empty ids array' };
        }

        let clearedCount = 0;
        for (const id of ids) {
          const res = ctx.db.run(
            "DELETE FROM knowledge_nodes WHERE id = ? AND dir_path = '/Inbox' AND drawer_level = 0",
            [id]
          );
          if (res?.changes) clearedCount += res.changes;
        }

        ctx.bus?.emit?.('memory:inbox_cleared', { clearedCount, remaining: ids.length - clearedCount });
        return {
          success: true,
          action: 'clear_ids',
          cleared_count: clearedCount
        };
      }

      // 默认: list
      const rows = ctx.db.query(
        "SELECT id, title, tldr, full_content, keywords, token_estimate, created_at FROM knowledge_nodes WHERE dir_path = '/Inbox' AND drawer_level = 0 AND status = 'active' ORDER BY created_at ASC LIMIT 50"
      );

      return {
        action: 'list',
        total_inbox: rows.length,
        items: rows.map(r => ({
          id: r.id,
          title: r.title,
          tldr: r.tldr,
          content_snippet: (r.full_content || '').slice(0, 150),
          token_estimate: r.token_estimate || 0,
          created_at: r.created_at
        })),
        instruction: rows.length > 0
          ? '请对以上短期记忆碎片进行分析归纳，调用 memory_commit_chain 归档至 /Projects 或 /Tech 等正式目录，提炼完成后调用 memory_consolidate_inbox(action="clear_ids", ids=[...]) 清理已处理的临时条目。'
          : '/Inbox 短期记忆区为空。'
      };
    }
  });

  console.log('[plg-memory-hooks] 寻址铁律协议与短期记忆缓冲插件已就绪。');

  return {
    manifest,
    getDynamicPrompt,
    resolveLeaseInterceptor,
    deactivate: async () => {
      console.log('[plg-memory-hooks] Deactivating memory-hooks plugin...');
    }
  };
}

export default {
  manifest,
  activate,
  CORE_ADDRESSING_PROTOCOL
};
