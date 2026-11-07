// ~/.dsh/plugins/dsh-system-pedestal/plugins/plg-proactive-continuity.mjs
// DSH 4.0 Plugin 8: 主动智能、项目连续性与架构决策追踪中枢

export const manifest = {
  id: 'proactive-continuity',
  name: '主动智能与项目连续性中枢',
  version: '4.0.0',
  dependencies: ['memory-engine', 'repo-intelligence', 'model-router']
};

export async function activate(ctx) {
  ctx.logger.info('激活主动智能与项目连续性中枢插件...');

  // =========================================================================
  // 1. 注册 3 个核心 DSH Tools
  // =========================================================================

  // Tool 1: project_continuity_sync (项目断点续传状态读写)
  ctx.tools.register({
    name: 'project_continuity_sync',
    description: '项目跨会话连续性读写：支持在新会话开始时一键读取或增量同步当前项目的「当前阶段、上次完成事项、未解决问题、下一步计划、核心架构约束」',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['read', 'update'],
          description: '操作模式：read (读取项目最新连续性状态) | update (更新阶段完成事项与后续计划)',
          default: 'read'
        },
        workspace_path: {
          type: 'string',
          description: '工作区根路径，缺省时自动使用当前工作区'
        },
        current_phase: {
          type: 'string',
          description: '当前任务/项目阶段名称，如 "Phase 3: Model Router"'
        },
        completed_tasks: {
          type: 'array',
          items: { type: 'string' },
          description: '本次新完成的任务事项列表'
        },
        unresolved_issues: {
          type: 'array',
          items: { type: 'string' },
          description: '当前遗留未解决的阻塞问题或 TODO'
        },
        next_steps: {
          type: 'array',
          items: { type: 'string' },
          description: '建议下一步执行的计划事项'
        },
        active_constraints: {
          type: 'array',
          items: { type: 'string' },
          description: '核心架构或业务约束（如"严禁修改已有5个插件"）'
        },
        session_id: {
          type: 'string',
          description: '关联的会话标识'
        }
      }
    },
    handler: async (args = {}) => {
      const wsPath = args.workspace_path || process.cwd();
      const action = args.action || 'read';

      if (action === 'read') {
        const row = ctx.db.query('SELECT * FROM project_continuity_state WHERE workspace_path = ?', [wsPath])[0];
        if (!row) {
          return {
            exists: false,
            workspace_path: wsPath,
            message: '该工作区尚未建立跨会话连续性快照。'
          };
        }
        return {
          exists: true,
          workspace_path: wsPath,
          current_phase: row.current_phase,
          last_completed_tasks: JSON.parse(row.last_completed_tasks_json || '[]'),
          unresolved_issues: JSON.parse(row.unresolved_issues_json || '[]'),
          next_steps: JSON.parse(row.next_steps_json || '[]'),
          active_constraints: JSON.parse(row.active_constraints_json || '[]'),
          last_session_id: row.last_session_id,
          updated_at: row.updated_at
        };
      }

      if (action === 'update') {
        const nowIso = new Date().toISOString();
        const existing = ctx.db.query('SELECT * FROM project_continuity_state WHERE workspace_path = ?', [wsPath])[0] || {};
        
        const existingCompleted = JSON.parse(existing.last_completed_tasks_json || '[]');
        const newCompleted = args.completed_tasks ? [...existingCompleted, ...args.completed_tasks] : existingCompleted;
        // 数组去重并保留最近 20 项
        const deduplicatedCompleted = Array.from(new Set(newCompleted)).slice(-20);

        const activeConstraints = args.active_constraints || JSON.parse(existing.active_constraints_json || '[]');
        const unresolvedIssues = args.unresolved_issues || JSON.parse(existing.unresolved_issues_json || '[]');
        const nextSteps = args.next_steps || JSON.parse(existing.next_steps_json || '[]');

        ctx.db.run(`
          INSERT INTO project_continuity_state (
            workspace_path, current_phase, last_completed_tasks_json,
            unresolved_issues_json, next_steps_json, active_constraints_json,
            last_session_id, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(workspace_path) DO UPDATE SET
            current_phase = excluded.current_phase,
            last_completed_tasks_json = excluded.last_completed_tasks_json,
            unresolved_issues_json = excluded.unresolved_issues_json,
            next_steps_json = excluded.next_steps_json,
            active_constraints_json = excluded.active_constraints_json,
            last_session_id = excluded.last_session_id,
            updated_at = excluded.updated_at
        `, [
          wsPath,
          args.current_phase || existing.current_phase || 'General Phase',
          JSON.stringify(deduplicatedCompleted),
          JSON.stringify(unresolvedIssues),
          JSON.stringify(nextSteps),
          JSON.stringify(activeConstraints),
          args.session_id || existing.last_session_id || 'default_session',
          nowIso
        ]);

        return {
          success: true,
          workspace_path: wsPath,
          current_phase: args.current_phase || existing.current_phase,
          completed_tasks_count: deduplicatedCompleted.length,
          unresolved_count: unresolvedIssues.length,
          next_steps_count: nextSteps.length,
          updated_at: nowIso
        };
      }

      return { error: `Unsupported action: ${action}` };
    }
  });

  // Tool 2: decision_trace_manage (ADR 架构决策追踪记录与演进)
  ctx.tools.register({
    name: 'decision_trace_manage',
    description: 'ADR 架构决策记录与追溯：记录技术选型与架构决策的上下文问题、决议内容、权衡依据及潜在后果，支持变更作废或被新决策取代，防止后续会话中 AI 违反既定原则',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['record', 'query', 'supersede'],
          description: '操作类型：record (记录新决策) | query (查询有效决策) | supersede (标记被新决策取代)',
          default: 'query'
        },
        adr_id: { type: 'string', description: '决策标识，如 "ADR-001"' },
        workspace_path: { type: 'string', description: '工作区路径' },
        title: { type: 'string', description: '决策简短标题，如 "采用微内核底座与插件架构"' },
        context_problem: { type: 'string', description: '决策面对的问题与挑战背景' },
        decision_made: { type: 'string', description: '最终确定的技术方案与规则' },
        rationale_basis: { type: 'string', description: '选择该方案的原因与权衡理由' },
        consequences: { type: 'string', description: '方案带来的影响（优缺点及限制）' },
        superseded_by: { type: 'string', description: '新决策 ID（仅用于 supersede 操作）' },
        session_id: { type: 'string', description: '发起会话 ID' }
      }
    },
    handler: async (args = {}) => {
      const wsPath = args.workspace_path || process.cwd();
      const action = args.action || 'query';

      if (action === 'query') {
        let sql = 'SELECT * FROM architecture_decisions WHERE workspace_path = ?';
        const params = [wsPath];
        if (args.adr_id) {
          sql += ' AND adr_id = ?';
          params.push(args.adr_id);
        } else {
          sql += " AND status = 'accepted' ORDER BY adr_id ASC";
        }
        const decisions = ctx.db.query(sql, params);
        return { count: decisions.length, decisions };
      }

      if (action === 'record') {
        const adrId = args.adr_id || `ADR-${String(Date.now()).slice(-4)}`;
        const nowIso = new Date().toISOString();

        ctx.db.run(`
          INSERT INTO architecture_decisions (
            adr_id, workspace_path, title, status, context_problem,
            decision_made, rationale_basis, consequences, superseded_by,
            source_session_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(adr_id) DO UPDATE SET
            title = excluded.title,
            status = excluded.status,
            context_problem = excluded.context_problem,
            decision_made = excluded.decision_made,
            rationale_basis = excluded.rationale_basis,
            consequences = excluded.consequences,
            superseded_by = excluded.superseded_by
        `, [
          adrId,
          wsPath,
          args.title || 'Untitled Architecture Decision',
          'accepted',
          args.context_problem || '',
          args.decision_made || '',
          args.rationale_basis || '',
          args.consequences || '',
          null,
          args.session_id || 'default_session',
          nowIso
        ]);

        return {
          success: true,
          adr_id: adrId,
          title: args.title,
          status: 'accepted',
          message: '架构决策 (ADR) 已持久化归档。'
        };
      }

      if (action === 'supersede') {
        if (!args.adr_id || !args.superseded_by) {
          return { error: 'adr_id and superseded_by are required for supersede action' };
        }
        ctx.db.run(
          "UPDATE architecture_decisions SET status = 'superseded', superseded_by = ? WHERE adr_id = ? AND workspace_path = ?",
          [args.superseded_by, args.adr_id, wsPath]
        );
        return {
          success: true,
          adr_id: args.adr_id,
          status: 'superseded',
          superseded_by: args.superseded_by
        };
      }

      return { error: `Unsupported action: ${action}` };
    }
  });

  // Tool 3: memory_quality_audit (记忆健康度主动巡检)
  ctx.tools.register({
    name: 'memory_quality_audit',
    description: '记忆健康度主动巡检：扫描库中孤立无来源、长期未访问的低频记忆、文本重复度高或时效过期的陈旧事实节点，输出治理与瘦身建议',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '单次返回问题节点数量上限',
          default: 30
        }
      }
    },
    handler: async (args = {}) => {
      const limit = args.limit || 30;

      // 1. 查找孤立节点（无关联边连接）
      const isolatedNodes = ctx.db.query(`
        SELECT n.id, n.title, n.node_type, n.created_at
        FROM knowledge_nodes n
        LEFT JOIN knowledge_edges e ON (n.id = e.source_id OR n.id = e.target_id)
        WHERE e.id IS NULL AND n.status = 'active'
        LIMIT ?
      `, [limit]);

      // 2. 查找过期的陈旧事实节点 (valid_until < NOW 或 fact_state = 'deprecated')
      const nowIso = new Date().toISOString();
      const deprecatedFacts = ctx.db.query(`
        SELECT id, title, node_type, fact_state, valid_until
        FROM knowledge_nodes
        WHERE (fact_state = 'deprecated' OR (valid_until IS NOT NULL AND valid_until < ?))
          AND status = 'active'
        LIMIT ?
      `, [nowIso, limit]);

      // 3. 统计健康度得分
      const totalNodes = ctx.db.query("SELECT COUNT(*) as c FROM knowledge_nodes WHERE status = 'active'")[0]?.c || 0;
      const issueCount = isolatedNodes.length + deprecatedFacts.length;
      const healthScore = totalNodes > 0 ? Math.max(0, Math.min(100, Math.round(100 - (issueCount / totalNodes) * 40))) : 100;

      return {
        health_score: healthScore,
        total_active_nodes: totalNodes,
        issues_detected: {
          isolated_nodes_count: isolatedNodes.length,
          deprecated_facts_count: deprecatedFacts.length
        },
        actionable_recommendations: [
          isolatedNodes.length > 0 ? {
            type: 'link_or_clean_isolated',
            count: isolatedNodes.length,
            message: `发现 ${isolatedNodes.length} 个无关联边节点，建议通过 memory_commit_chain 补全知识关联或归档。`
          } : null,
          deprecatedFacts.length > 0 ? {
            type: 'archive_deprecated_facts',
            count: deprecatedFacts.length,
            message: `发现 ${deprecatedFacts.length} 个已过期的事实记忆节点，建议使用 memory_update_fact_timeline 标记或转移至冷库。`
          } : null
        ].filter(Boolean),
        sample_issues: {
          isolated_nodes: isolatedNodes.slice(0, 5),
          deprecated_facts: deprecatedFacts.slice(0, 5)
        }
      };
    }
  });

  // =========================================================================
  // 2. 系统提示词智能增强 Hook (主动智能：<250 Tokens 精准上下文注入)
  // =========================================================================
  const systemPromptEnhancer = async (args = {}) => {
    const wsPath = (typeof args === 'string' ? args : (args.workspacePath || args.workspace_path)) || process.cwd();
    try {
      const cont = ctx.db.query('SELECT * FROM project_continuity_state WHERE workspace_path = ?', [wsPath])[0];
      const adrs = ctx.db.query("SELECT adr_id, title, decision_made FROM architecture_decisions WHERE workspace_path = ? AND status = 'accepted' LIMIT 3", [wsPath]);

      if (!cont && adrs.length === 0) return null;

      let promptLines = ['[DSH Project Continuity & ADR Directives]'];
      if (cont) {
        promptLines.push(`Phase: ${cont.current_phase || 'Active'}`);
        const completed = JSON.parse(cont.last_completed_tasks_json || '[]').slice(-3);
        if (completed.length > 0) promptLines.push(`Recent Progress: ${completed.join('; ')}`);
        const nextSteps = JSON.parse(cont.next_steps_json || '[]').slice(0, 3);
        if (nextSteps.length > 0) promptLines.push(`Next Tasks: ${nextSteps.join('; ')}`);
        const constraints = JSON.parse(cont.active_constraints_json || '[]');
        if (constraints.length > 0) promptLines.push(`Constraints: ${constraints.join(' | ')}`);
      }
      if (adrs.length > 0) {
        promptLines.push('Active ADRs: ' + adrs.map(a => `[${a.adr_id}] ${a.title}: ${a.decision_made}`).join('; '));
      }
      return promptLines.join('\n');
    } catch {
      return null;
    }
  };

  if (ctx.hooks && typeof ctx.hooks.registerSystemPromptEnhancer === 'function') {
    ctx.hooks.registerSystemPromptEnhancer(systemPromptEnhancer);
  } else if (typeof ctx.addSystemPromptHook === 'function') {
    ctx.addSystemPromptHook(systemPromptEnhancer);
  } else if (typeof ctx.tools?.addSystemPromptHook === 'function') {
    ctx.tools.addSystemPromptHook(systemPromptEnhancer);
  }

  // =========================================================================
  // 3. 挂载 GUI 扩展 API
  // =========================================================================

  // API 1: GET /api/ext/continuity/state & /api/ext/proactive-continuity/state
  const handleContinuityState = async (req, res, { query, sendJson }) => {
    try {
      const wsPath = query.workspace_path || process.cwd();
      const cont = ctx.db.query('SELECT * FROM project_continuity_state WHERE workspace_path = ?', [wsPath])[0];
      const adrs = ctx.db.query('SELECT * FROM architecture_decisions WHERE workspace_path = ? ORDER BY adr_id ASC', [wsPath]);

      return sendJson(200, {
        continuity: cont ? {
          workspace_path: cont.workspace_path,
          current_phase: cont.current_phase,
          last_completed_tasks: JSON.parse(cont.last_completed_tasks_json || '[]'),
          unresolved_issues: JSON.parse(cont.unresolved_issues_json || '[]'),
          next_steps: JSON.parse(cont.next_steps_json || '[]'),
          active_constraints: JSON.parse(cont.active_constraints_json || '[]'),
          last_session_id: cont.last_session_id,
          updated_at: cont.updated_at
        } : null,
        adrs: adrs || []
      });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  };

  ctx.gui.registerApi('GET', '/api/ext/continuity/state', handleContinuityState);
  ctx.gui.registerApi('GET', '/api/ext/proactive-continuity/state', handleContinuityState);

  // API 2: POST /api/ext/continuity/sync
  ctx.gui.registerApi('POST', '/api/ext/continuity/sync', async (req, res, { body, sendJson }) => {
    try {
      const tool = ctx.tools; // 复用内部工具实现
      // 直接触发写入
      const wsPath = body.workspace_path || process.cwd();
      const nowIso = new Date().toISOString();
      const existing = ctx.db.query('SELECT * FROM project_continuity_state WHERE workspace_path = ?', [wsPath])[0] || {};
      
      const completed = body.completed_tasks ? body.completed_tasks : JSON.parse(existing.last_completed_tasks_json || '[]');
      const unresolved = body.unresolved_issues ? body.unresolved_issues : JSON.parse(existing.unresolved_issues_json || '[]');
      const nextSteps = body.next_steps ? body.next_steps : JSON.parse(existing.next_steps_json || '[]');
      const constraints = body.active_constraints ? body.active_constraints : JSON.parse(existing.active_constraints_json || '[]');

      ctx.db.run(`
        INSERT INTO project_continuity_state (
          workspace_path, current_phase, last_completed_tasks_json,
          unresolved_issues_json, next_steps_json, active_constraints_json,
          last_session_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workspace_path) DO UPDATE SET
          current_phase = excluded.current_phase,
          last_completed_tasks_json = excluded.last_completed_tasks_json,
          unresolved_issues_json = excluded.unresolved_issues_json,
          next_steps_json = excluded.next_steps_json,
          active_constraints_json = excluded.active_constraints_json,
          last_session_id = excluded.last_session_id,
          updated_at = excluded.updated_at
      `, [
        wsPath,
        body.current_phase || existing.current_phase || 'Active',
        JSON.stringify(completed),
        JSON.stringify(unresolved),
        JSON.stringify(nextSteps),
        JSON.stringify(constraints),
        body.session_id || existing.last_session_id || 'default_session',
        nowIso
      ]);

      return sendJson(200, { success: true, updated_at: nowIso });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // API 3: GET /api/ext/continuity/health
  ctx.gui.registerApi('GET', '/api/ext/continuity/health', async (req, res, { query, sendJson }) => {
    try {
      // 直接执行健康度巡检逻辑
      const limit = 30;
      const isolatedNodes = ctx.db.query(`
        SELECT n.id, n.title, n.node_type, n.created_at
        FROM knowledge_nodes n
        LEFT JOIN knowledge_edges e ON (n.id = e.source_id OR n.id = e.target_id)
        WHERE e.id IS NULL AND n.status = 'active'
        LIMIT ?
      `, [limit]);

      const nowIso = new Date().toISOString();
      const deprecatedFacts = ctx.db.query(`
        SELECT id, title, node_type, fact_state, valid_until
        FROM knowledge_nodes
        WHERE (fact_state = 'deprecated' OR (valid_until IS NOT NULL AND valid_until < ?))
          AND status = 'active'
        LIMIT ?
      `, [nowIso, limit]);

      const totalNodes = ctx.db.query("SELECT COUNT(*) as c FROM knowledge_nodes WHERE status = 'active'")[0]?.c || 0;
      const issueCount = isolatedNodes.length + deprecatedFacts.length;
      const healthScore = totalNodes > 0 ? Math.max(0, Math.min(100, Math.round(100 - (issueCount / totalNodes) * 40))) : 100;

      return sendJson(200, {
        health_score: healthScore,
        total_active_nodes: totalNodes,
        issues_detected: {
          isolated_nodes_count: isolatedNodes.length,
          deprecated_facts_count: deprecatedFacts.length
        },
        actionable_recommendations: [
          isolatedNodes.length > 0 ? {
            type: 'link_or_clean_isolated',
            count: isolatedNodes.length,
            message: `发现 ${isolatedNodes.length} 个无关联边节点，建议补全关联或归档。`
          } : null,
          deprecatedFacts.length > 0 ? {
            type: 'archive_deprecated_facts',
            count: deprecatedFacts.length,
            message: `发现 ${deprecatedFacts.length} 个过期事实记忆节点，建议更新时效或转移至冷库。`
          } : null
        ].filter(Boolean)
      });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  ctx.logger.info('主动智能与项目连续性中枢插件激活成功。');

  return {
    syncContinuity: (data) => ctx.tools.registered['project_continuity_sync'].handler(data),
    recordDecision: (data) => ctx.tools.registered['decision_trace_manage'].handler(data)
  };
}

export async function deactivate(ctx) {
  ctx?.logger?.info?.('卸载主动智能与项目连续性中枢插件...');
}

export default {
  manifest,
  activate,
  deactivate
};
