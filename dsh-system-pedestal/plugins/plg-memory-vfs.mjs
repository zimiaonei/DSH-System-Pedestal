// ~/.dsh/plugins/dsh-system-pedestal/plugins/plg-memory-vfs.mjs
// L0 虚拟目录与加密保险箱插件 (v4.0.0)

export const manifest = {
  id: 'memory-vfs',
  name: 'L0 虚拟目录与加密保险箱',
  version: '4.0.0',
  dependencies: []
};

/**
 * 递归构建目录树
 */
function buildTree(dirs, rootPath, maxDepth, currentDepth = 1) {
  if (currentDepth > maxDepth) return [];
  const children = dirs.filter(d => {
    if (rootPath === '/') {
      return d.parent_path === '/' || d.parent_path === '' || !d.parent_path;
    }
    return d.parent_path === rootPath;
  });

  return children.map(dir => {
    const subTree = buildTree(dirs, dir.path, maxDepth, currentDepth + 1);
    return {
      ...dir,
      children: subTree
    };
  });
}

/**
 * 检查当前目录是否匹配或包含于 workspace_path
 */
function isCurrentWorkspaceMatch(workspacePath, currentCwd) {
  if (!workspacePath || !currentCwd) return false;
  const normWp = workspacePath.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
  const normCwd = currentCwd.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
  return normCwd === normWp || normCwd.startsWith(normWp + '/');
}

/**
 * 格式化目录树文本输出（用于 tool 返回）
 */
function renderTreeText(nodes, indent = '') {
  let output = '';
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    const nextIndent = indent + (isLast ? '    ' : '│   ');

    const wpInfo = node.workspace_path ? ` [Workspace: ${node.workspace_path}]` : '';
    const stats = ` (Active知识节点: ${node.active_node_count || 0}, Vault密钥: ${node.vault_count || 0})`;
    output += `${indent}${branch}📁 ${node.path} (${node.name})${stats}${wpInfo}\n`;

    if (node.children && node.children.length > 0) {
      output += renderTreeText(node.children, nextIndent);
    }
  }
  return output;
}

export async function activate(ctx) {
  console.log('[plg-memory-vfs] Activating L0 虚拟目录与加密保险箱 v4.0.0...');

  // 1. 注册 Tool: memory_dir_tree
  ctx.tools.register({
    name: 'memory_dir_tree',
    description: '查看记忆目录树大纲与当前工作区绑定',
    parameters: {
      type: 'object',
      properties: {
        root_path: {
          type: 'string',
          description: '目录树根路径，默认为 \'/\'',
          default: '/'
        },
        depth: {
          type: 'number',
          description: '遍历深度限制，默认 3',
          default: 3
        }
      }
    },
    handler: async (args = {}) => {
      const rootPath = args.root_path || '/';
      const depth = Number.isInteger(args.depth) && args.depth > 0 ? args.depth : 3;

      // 查询所有目录
      const dirs = ctx.db.query('SELECT * FROM memory_directories ORDER BY path ASC');

      // 统计各目录下的 active 知识节点数
      const nodeCounts = ctx.db.query(
        "SELECT dir_path, COUNT(*) as count FROM knowledge_nodes WHERE status = 'active' GROUP BY dir_path"
      );
      const nodeCountMap = new Map();
      for (const r of nodeCounts) {
        nodeCountMap.set(r.dir_path, r.count);
      }

      // 统计各目录下的 Vault 密钥数
      const vaultCounts = ctx.db.query(
        'SELECT dir_path, COUNT(*) as count FROM core_vault GROUP BY dir_path'
      );
      const vaultCountMap = new Map();
      for (const r of vaultCounts) {
        vaultCountMap.set(r.dir_path, r.count);
      }

      // 组装目录对象
      const currentCwd = process.cwd();
      let matchedWorkspaceDir = null;

      const enrichedDirs = dirs.map(d => {
        const activeCount = nodeCountMap.get(d.path) || 0;
        const vCount = vaultCountMap.get(d.path) || 0;
        const isMatched = isCurrentWorkspaceMatch(d.workspace_path, currentCwd);
        if (isMatched && !matchedWorkspaceDir) {
          matchedWorkspaceDir = d;
        }
        return {
          path: d.path,
          parent_path: d.parent_path,
          name: d.name,
          dir_summary: d.dir_summary,
          workspace_path: d.workspace_path,
          updated_at: d.updated_at,
          active_node_count: activeCount,
          vault_count: vCount,
          is_current_workspace_match: isMatched
        };
      });

      // 递归构建树形结构
      const tree = buildTree(enrichedDirs, rootPath, depth);

      let textSummary = '';
      if (matchedWorkspaceDir) {
        textSummary += `【当前工作区匹配目录】: ${matchedWorkspaceDir.path} (${matchedWorkspaceDir.name}) -> ${matchedWorkspaceDir.workspace_path}\n\n`;
      }

      textSummary += `=== 虚拟文件系统目录树 (Root: ${rootPath}, Depth: ${depth}) ===\n`;
      textSummary += renderTreeText(tree);

      return {
        matched_workspace: matchedWorkspaceDir ? {
          path: matchedWorkspaceDir.path,
          name: matchedWorkspaceDir.name,
          workspace_path: matchedWorkspaceDir.workspace_path
        } : null,
        root_path: rootPath,
        depth,
        total_directories: enrichedDirs.length,
        tree,
        text_summary: textSummary.trim()
      };
    }
  });

  // 2. 注册 Tool: memory_dir_manage
  ctx.tools.register({
    name: 'memory_dir_manage',
    description: '管理记忆虚拟目录(新建/更新绑定/移动节点)',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['upsert_dir', 'create', 'update', 'move_nodes', 'delete_dir'],
          description: '操作类型: upsert_dir / create (新建/更新), move_nodes (移动节点), delete_dir (删除目录)'
        },
        path: {
          type: 'string',
          description: '目录路径，如 /Projects/Backend'
        },
        name: {
          type: 'string',
          description: '目录显示名称'
        },
        dir_summary: {
          type: 'string',
          description: '目录摘要及用途说明'
        },
        workspace_path: {
          type: 'string',
          description: '绑定的本地代码仓库/工作区绝对路径'
        },
        node_ids: {
          type: 'array',
          items: { type: 'string' },
          description: '批量操作的知识节点 ID 列表'
        }
      },
      required: ['action']
    },
    handler: async (args = {}) => {
      const { action, path: dirPath, name, dir_summary, workspace_path, node_ids } = args;
      const now = new Date().toISOString();

      if (action === 'upsert_dir' || action === 'create' || action === 'update') {
        if (!dirPath || typeof dirPath !== 'string') {
          return { error: 'upsert_dir requires a valid "path" argument' };
        }
        const normPath = dirPath.startsWith('/') ? dirPath : '/' + dirPath;
        const parts = normPath.split('/').filter(Boolean);
        const dirName = name || (parts.length > 0 ? parts[parts.length - 1] : 'root');
        let parentPath = '/';
        if (parts.length > 1) {
          parentPath = '/' + parts.slice(0, -1).join('/');
        }

        const existing = ctx.db.get('SELECT * FROM memory_directories WHERE path = ?', [normPath]);
        if (existing) {
          ctx.db.run(
            `UPDATE memory_directories
             SET name = COALESCE(?, name),
                 dir_summary = COALESCE(?, dir_summary),
                 workspace_path = COALESCE(?, workspace_path),
                 parent_path = COALESCE(?, parent_path),
                 updated_at = ?
             WHERE path = ?`,
            [name || null, dir_summary || null, workspace_path || null, parentPath, now, normPath]
          );
        } else {
          ctx.db.run(
            `INSERT INTO memory_directories (path, parent_path, name, dir_summary, workspace_path, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [normPath, parentPath, dirName, dir_summary || '', workspace_path || null, now]
          );
        }

        ctx.bus.emit('vfs:dir_updated', { path: normPath, action: existing ? 'update' : 'create' });
        return {
          success: true,
          path: normPath,
          action: existing ? 'updated' : 'created',
          dir: { path: normPath, parent_path: parentPath, name: dirName, dir_summary, workspace_path, updated_at: now }
        };
      }

      if (action === 'move_nodes') {
        if (!dirPath || !Array.isArray(node_ids) || node_ids.length === 0) {
          return { error: 'move_nodes requires "path" and non-empty "node_ids"' };
        }
        const normPath = dirPath.startsWith('/') ? dirPath : '/' + dirPath;

        let movedCount = 0;
        for (const nid of node_ids) {
          const res = ctx.db.run('UPDATE knowledge_nodes SET dir_path = ? WHERE id = ?', [normPath, nid]);
          if (res?.changes) movedCount += res.changes;
        }

        ctx.bus.emit('vfs:nodes_moved', { target_dir: normPath, node_ids, movedCount });
        return { success: true, moved_count: movedCount, target_dir: normPath };
      }

      if (action === 'delete_dir') {
        if (!dirPath) return { error: 'delete_dir requires "path"' };
        const normPath = dirPath.startsWith('/') ? dirPath : '/' + dirPath;
        if (normPath === '/' || ['/Projects', '/Tech', '/Issues', '/Inbox', '/Vault'].includes(normPath)) {
          return { error: `Cannot delete system root directory: ${normPath}` };
        }

        // 级联检查是否有子节点或子目录
        const childNodes = ctx.db.get('SELECT COUNT(*) as c FROM knowledge_nodes WHERE dir_path = ?', [normPath]);
        if (childNodes?.c > 0) {
          return { error: `Directory ${normPath} contains ${childNodes.c} knowledge nodes. Move them before deleting.` };
        }

        ctx.db.run('DELETE FROM memory_directories WHERE path = ?', [normPath]);
        ctx.bus.emit('vfs:dir_deleted', { path: normPath });
        return { success: true, deleted_path: normPath };
      }

      return { error: `Unknown action: ${action}` };
    }
  });

  // 3. 注册 Tool: vault_store_core
  ctx.tools.register({
    name: 'vault_store_core',
    description: '加密保存API Key/凭据(AES-256-GCM隔离)',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: '机密分类，如 LLM_API_KEY, SSH_KEY, DB_PASS, CLOUD_CREDENTIAL'
        },
        key_name: {
          type: 'string',
          description: '机密唯一标识键名，如 OPENAI_API_KEY, AWS_PROD_ACCESS'
        },
        tldr: {
          type: 'string',
          description: '脱敏后的用途说明，如 \'生产环境 OpenAI API 接口密钥\''
        },
        secret_value: {
          type: 'string',
          description: '原始机密明文值，将被 AES-256-GCM 硬件级加密'
        },
        tags: {
          type: 'string',
          description: '检索标签（JSON数组字符串或逗号分隔），如 "llm,prod"'
        }
      },
      required: ['key_name', 'secret_value']
    },
    handler: async (args = {}) => {
      const { category = 'GENERAL', key_name, tldr = '', secret_value, tags = '' } = args;
      if (!key_name || !secret_value) {
        return { error: 'Both "key_name" and "secret_value" are required' };
      }

      // AES-256-GCM 加密
      const encrypted = ctx.crypto.encrypt(secret_value);
      const now = new Date().toISOString();
      const id = 'vlt_' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));

      const existing = ctx.db.get('SELECT id FROM core_vault WHERE key_name = ?', [key_name]);
      if (existing) {
        ctx.db.run(
          `UPDATE core_vault
           SET category = ?,
               tldr = ?,
               cipher_text = ?,
               iv = ?,
               auth_tag = ?,
               tags = ?,
               updated_at = ?
           WHERE key_name = ?`,
          [category, tldr, encrypted.cipherText, encrypted.iv, encrypted.authTag, tags, now, key_name]
        );
      } else {
        ctx.db.run(
          `INSERT INTO core_vault (id, dir_path, category, key_name, tldr, cipher_text, iv, auth_tag, tags, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, '/Vault', category, key_name, tldr, encrypted.cipherText, encrypted.iv, encrypted.authTag, tags, now]
        );
      }

      // 触发事件通知
      ctx.bus.emit('vault:secret_stored', { key_name, category });

      return {
        success: true,
        key_name,
        category,
        tldr,
        tags,
        cipher_length: encrypted.cipherText.length,
        status: 'encrypted_stored'
      };
    }
  });

  // 4. 注册 Tool: vault_fetch_core
  ctx.tools.register({
    name: 'vault_fetch_core',
    description: '获取凭据(默认lease占位符安全模式)',
    parameters: {
      type: 'object',
      properties: {
        key_name: {
          type: 'string',
          description: '机密键名，如 OPENAI_API_KEY'
        },
        keyword: {
          type: 'string',
          description: '模糊匹配键名或脱敏说明关键字'
        },
        mode: {
          type: 'string',
          enum: ['lease', 'plaintext'],
          description: '获取模式: lease (默认占位符用后即焚模式) | plaintext (强制明文模式，记录安全审计)',
          default: 'lease'
        }
      }
    },
    handler: async (args = {}) => {
      const { key_name, keyword, mode = 'lease' } = args;

      let row = null;
      if (key_name) {
        row = ctx.db.get('SELECT * FROM core_vault WHERE key_name = ?', [key_name]);
      } else if (keyword) {
        row = ctx.db.get(
          'SELECT * FROM core_vault WHERE key_name LIKE ? OR tldr LIKE ? OR tags LIKE ? LIMIT 1',
          [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
        );
      }

      if (!row) {
        return { error: `Secret not found for key_name: "${key_name || keyword}"` };
      }

      // 解密
      let plainSecret = '';
      try {
        plainSecret = ctx.crypto.decrypt(row.cipher_text, row.iv, row.auth_tag);
      } catch (err) {
        return { error: `Decryption failed for "${row.key_name}": ${err.message}` };
      }

      if (mode === 'lease') {
        // 安全模式：生成 5 分钟 (300000ms) 有效的会话令牌
        const token = ctx.crypto.createLease(row.key_name, plainSecret, 300000);
        return {
          key_name: row.key_name,
          category: row.category,
          tldr: row.tldr,
          mode: 'lease',
          token,
          instruction: `已生成 5 分钟用后即焚临时会话令牌。在命令行工具调用或下发脚本时，直接使用占位符 "${token}"，微内核拦截器将在内存执行期无感置换为真实明文，防止聊天记录中泄露任何明文密码！`
        };
      } else if (mode === 'plaintext') {
        // 强制明文模式：推送安全审计通知
        if (ctx.gui?.pushNotification) {
          ctx.gui.pushNotification(
            'warn',
            `[Security Audit] 保险箱机密 "${row.key_name}" 已被强制读取为明文！`
          );
        }

        return {
          key_name: row.key_name,
          category: row.category,
          tldr: row.tldr,
          mode: 'plaintext',
          secret_value: plainSecret,
          warning: '⚠️ 注意：已通过明文模式导出机密，请注意保护上下文与日志安全！'
        };
      }

      return { error: `Unsupported mode: ${mode}` };
    }
  });

  // 5. 挂载 GUI REST APIs
  // 5.1 GET /api/ext/memory-vfs/tree
  ctx.gui.registerApi('GET', '/api/ext/memory-vfs/tree', async (req, res, { query, sendJson }) => {
    try {
      const dirs = ctx.db.query('SELECT * FROM memory_directories ORDER BY path ASC');
      const nodeCounts = ctx.db.query(
        "SELECT dir_path, COUNT(*) as count FROM knowledge_nodes WHERE status = 'active' GROUP BY dir_path"
      );
      const nodeCountMap = new Map();
      for (const r of nodeCounts) nodeCountMap.set(r.dir_path, r.count);

      const vaultCounts = ctx.db.query(
        'SELECT dir_path, COUNT(*) as count FROM core_vault GROUP BY dir_path'
      );
      const vaultCountMap = new Map();
      for (const r of vaultCounts) vaultCountMap.set(r.dir_path, r.count);

      const currentCwd = process.cwd();
      const enrichedDirs = dirs.map(d => ({
        ...d,
        active_node_count: nodeCountMap.get(d.path) || 0,
        vault_count: vaultCountMap.get(d.path) || 0,
        is_current_workspace_match: isCurrentWorkspaceMatch(d.workspace_path, currentCwd)
      }));

      const tree = buildTree(enrichedDirs, '/', 10);
      return sendJson(200, {
        success: true,
        current_cwd: currentCwd,
        directories: enrichedDirs,
        tree
      });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 5.2 POST /api/ext/memory-vfs/tree (新建/编辑/删除目录)
  ctx.gui.registerApi('POST', '/api/ext/memory-vfs/tree', async (req, res, { body, sendJson }) => {
    try {
      const { action = 'upsert', path: dirPath, name, dir_summary, workspace_path } = body;
      const now = new Date().toISOString();

      if (action === 'delete') {
        if (!dirPath || ['/', '/Projects', '/Tech', '/Issues', '/Inbox', '/Vault'].includes(dirPath)) {
          return sendJson(400, { error: 'Cannot delete root or protected system directory' });
        }
        ctx.db.run('DELETE FROM memory_directories WHERE path = ?', [dirPath]);
        ctx.bus.emit('vfs:dir_deleted', { path: dirPath });
        return sendJson(200, { success: true, deleted: dirPath });
      }

      if (!dirPath) return sendJson(400, { error: 'path is required' });
      const normPath = dirPath.startsWith('/') ? dirPath : '/' + dirPath;
      const parts = normPath.split('/').filter(Boolean);
      const dirName = name || (parts.length > 0 ? parts[parts.length - 1] : 'root');
      let parentPath = '/';
      if (parts.length > 1) {
        parentPath = '/' + parts.slice(0, -1).join('/');
      }

      const existing = ctx.db.get('SELECT * FROM memory_directories WHERE path = ?', [normPath]);
      if (existing) {
        ctx.db.run(
          `UPDATE memory_directories
           SET name = COALESCE(?, name),
               dir_summary = COALESCE(?, dir_summary),
               workspace_path = COALESCE(?, workspace_path),
               parent_path = COALESCE(?, parent_path),
               updated_at = ?
           WHERE path = ?`,
          [name || null, dir_summary || null, workspace_path !== undefined ? workspace_path : null, parentPath, now, normPath]
        );
      } else {
        ctx.db.run(
          `INSERT INTO memory_directories (path, parent_path, name, dir_summary, workspace_path, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [normPath, parentPath, dirName, dir_summary || '', workspace_path || null, now]
        );
      }

      ctx.bus.emit('vfs:dir_updated', { path: normPath, action: existing ? 'update' : 'create' });
      return sendJson(200, { success: true, path: normPath });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 5.3 GET /api/ext/memory-vfs/vault (列表掩码及按需解密)
  ctx.gui.registerApi('GET', '/api/ext/memory-vfs/vault', async (req, res, { query, sendJson }) => {
    try {
      const decryptKey = query?.decrypt_key;
      const asLease = query?.as_lease === 'true';

      if (decryptKey) {
        const row = ctx.db.get('SELECT * FROM core_vault WHERE key_name = ?', [decryptKey]);
        if (!row) return sendJson(404, { error: 'Key not found' });

        const plainSecret = ctx.crypto.decrypt(row.cipher_text, row.iv, row.auth_tag);

        if (asLease) {
          const token = ctx.crypto.createLease(row.key_name, plainSecret, 300000);
          return sendJson(200, {
            success: true,
            key_name: row.key_name,
            lease_token: token,
            ttl_seconds: 300
          });
        }

        if (ctx.gui?.pushNotification) {
          ctx.gui.pushNotification('warn', `[Web GUI] 机密 "${row.key_name}" 已解密查看`);
        }

        return sendJson(200, {
          success: true,
          key_name: row.key_name,
          plain_secret: plainSecret
        });
      }

      // 默认掩码列表
      const rows = ctx.db.query('SELECT id, dir_path, category, key_name, tldr, tags, updated_at FROM core_vault ORDER BY updated_at DESC');
      const list = rows.map(r => ({
        ...r,
        masked_value: '••••••••••••••••'
      }));

      return sendJson(200, { success: true, items: list });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 5.4 POST /api/ext/memory-vfs/vault (增/改/删密钥)
  ctx.gui.registerApi('POST', '/api/ext/memory-vfs/vault', async (req, res, { body, sendJson }) => {
    try {
      const { action = 'upsert', category = 'GENERAL', key_name, tldr = '', secret_value, tags = '' } = body;
      const now = new Date().toISOString();

      if (action === 'delete') {
        if (!key_name) return sendJson(400, { error: 'key_name is required for delete' });
        ctx.db.run('DELETE FROM core_vault WHERE key_name = ?', [key_name]);
        ctx.bus.emit('vault:secret_deleted', { key_name });
        return sendJson(200, { success: true, deleted: key_name });
      }

      if (!key_name || !secret_value) {
        return sendJson(400, { error: 'key_name and secret_value are required' });
      }

      const encrypted = ctx.crypto.encrypt(secret_value);
      const id = 'vlt_' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));

      const existing = ctx.db.get('SELECT id FROM core_vault WHERE key_name = ?', [key_name]);
      if (existing) {
        ctx.db.run(
          `UPDATE core_vault
           SET category = ?,
               tldr = ?,
               cipher_text = ?,
               iv = ?,
               auth_tag = ?,
               tags = ?,
               updated_at = ?
           WHERE key_name = ?`,
          [category, tldr, encrypted.cipherText, encrypted.iv, encrypted.authTag, tags, now, key_name]
        );
      } else {
        ctx.db.run(
          `INSERT INTO core_vault (id, dir_path, category, key_name, tldr, cipher_text, iv, auth_tag, tags, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, '/Vault', category, key_name, tldr, encrypted.cipherText, encrypted.iv, encrypted.authTag, tags, now]
        );
      }

      ctx.bus.emit('vault:secret_stored', { key_name, category });
      return sendJson(200, { success: true, key_name });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  });

  // 6. 注册微前端视图 (slot-2 / slot-3)
  const renderScript = `
    const root = container;
    root.innerHTML = \`
      <div class="h-full flex flex-col space-y-4">
        <!-- 头部 -->
        <div class="flex items-center justify-between pb-2 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 class="text-base font-semibold text-cyan-400 flex items-center space-x-2">
              <span>🔐</span>
              <span>L0 虚拟目录树与高安全保险箱</span>
            </h2>
            <p class="text-xs text-slate-400">虚拟多维文件系统 · AES-256-GCM 硬件级加密 · 5分钟用后即焚授权令牌</p>
          </div>
          <div class="flex items-center space-x-2">
            <button id="vfs-btn-refresh" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded border border-slate-700">刷新数据</button>
            <button id="vfs-btn-new-dir" class="px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-xs text-slate-100 rounded">新建目录</button>
            <button id="vfs-btn-new-secret" class="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-xs text-slate-100 rounded">新增机密</button>
          </div>
        </div>

        <!-- 主左右分栏 -->
        <div class="flex-1 grid grid-cols-12 gap-4 min-h-0">
          <!-- 左侧：目录树管理 (5 列) -->
          <div class="col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-0 overflow-hidden">
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
              <span class="font-semibold text-slate-300">虚拟目录拓扑</span>
              <span id="vfs-match-badge" class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">加载中...</span>
            </div>
            <div id="vfs-tree-container" class="flex-1 overflow-y-auto space-y-1 font-mono text-xs pr-1"></div>
          </div>

          <!-- 右侧：高安全保险箱专区 (7 列) -->
          <div class="col-span-7 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-0 overflow-hidden">
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
              <div class="flex items-center space-x-2">
                <span class="font-semibold text-slate-300">高安全加密保险箱专区</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">AES-256-GCM</span>
              </div>
              <span class="text-[11px] text-slate-400" id="vfs-vault-count">0 项机密</span>
            </div>
            <div id="vfs-vault-table" class="flex-1 overflow-y-auto space-y-2 pr-1"></div>
          </div>
        </div>
      </div>
    \`;

    async function loadTreeData() {
      try {
        const data = await shell.apiFetch('/api/ext/memory-vfs/tree');
        const badge = root.querySelector('#vfs-match-badge');
        const treeBox = root.querySelector('#vfs-tree-container');
        treeBox.innerHTML = '';

        if (data.current_cwd) {
          const matched = (data.directories || []).find(d => d.is_current_workspace_match);
          if (matched) {
            badge.className = 'text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono';
            badge.textContent = '匹配工作区: ' + matched.path;
          } else {
            badge.className = 'text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono';
            badge.textContent = '工作区: ' + data.current_cwd.split(/\\|\\//).pop();
          }
        }

        function renderBranch(nodes, pad = 0) {
          nodes.forEach(n => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between p-1.5 rounded hover:bg-slate-800/60 cursor-pointer group transition';
            row.style.paddingLeft = (pad * 14 + 6) + 'px';

            const isMatch = n.is_current_workspace_match;
            const matchHighlight = isMatch ? 'text-emerald-400 font-semibold' : 'text-slate-200';

            row.innerHTML = \`
              <div class="flex items-center space-x-2 truncate">
                <span class="text-cyan-400">📁</span>
                <span class="\${matchHighlight} text-xs truncate">\${n.path}</span>
                \${isMatch ? '<span class="text-[9px] bg-emerald-900/60 text-emerald-300 px-1 rounded">MATCH</span>' : ''}
              </div>
              <div class="flex items-center space-x-2 text-[10px] text-slate-400">
                <span title="Active知识节点" class="px-1 bg-slate-800 rounded">📄 \${n.active_node_count || 0}</span>
                <span title="Vault密钥" class="px-1 bg-slate-800 rounded">🔐 \${n.vault_count || 0}</span>
                <button class="edit-dir-btn hidden group-hover:inline px-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200">编辑</button>
              </div>
            \`;

            row.querySelector('.edit-dir-btn')?.addEventListener('click', (e) => {
              e.stopPropagation();
              openDirModal(n);
            });

            row.addEventListener('click', () => {
              shell.openInspector('目录详情: ' + n.path, \`
                <div class="space-y-3">
                  <div><span class="text-slate-400">路径:</span> <span class="font-mono text-cyan-400">\${n.path}</span></div>
                  <div><span class="text-slate-400">名称:</span> <span>\${n.name}</span></div>
                  <div><span class="text-slate-400">摘要:</span> <p class="text-slate-300 mt-1">\${n.dir_summary || '无'}</p></div>
                  <div><span class="text-slate-400">绑定本地仓库:</span> <p class="font-mono text-emerald-400 mt-1">\${n.workspace_path || '未绑定'}</p></div>
                  <div class="pt-2 border-t border-slate-800 flex space-x-2">
                    <button id="insp-edit-dir" class="px-3 py-1 bg-cyan-700 text-xs rounded text-slate-100">修改配置</button>
                  </div>
                </div>
              \`);
              setTimeout(() => {
                document.getElementById('insp-edit-dir')?.addEventListener('click', () => openDirModal(n));
              }, 50);
            });

            treeBox.appendChild(row);
            if (n.children && n.children.length > 0) {
              renderBranch(n.children, pad + 1);
            }
          });
        }

        renderBranch(data.tree || []);
      } catch (err) {
        console.error('Load tree error:', err);
      }
    }

    async function loadVaultData() {
      try {
        const res = await shell.apiFetch('/api/ext/memory-vfs/vault');
        const box = root.querySelector('#vfs-vault-table');
        const countBadge = root.querySelector('#vfs-vault-count');
        box.innerHTML = '';
        const items = res.items || [];
        countBadge.textContent = items.length + ' 项机密';

        if (items.length === 0) {
          box.innerHTML = '<div class="text-xs text-slate-500 py-6 text-center">保险箱为空，点击右上角「新增机密」添加凭据</div>';
          return;
        }

        items.forEach(item => {
          const card = document.createElement('div');
          card.className = 'p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2 hover:border-slate-700 transition';
          card.innerHTML = \`
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">\${item.category || 'SECRET'}</span>
                <span class="text-xs font-bold text-slate-100 font-mono">\${item.key_name}</span>
              </div>
              <div class="flex items-center space-x-1.5">
                <button class="btn-copy-lease px-2 py-0.5 bg-cyan-900/60 hover:bg-cyan-800 text-cyan-300 rounded text-[11px] border border-cyan-700 transition" title="生成并复制5分钟有效用后即焚令牌">复制令牌</button>
                <button class="btn-decrypt px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] border border-slate-700 transition">解密查看</button>
                <button class="btn-delete px-1.5 py-0.5 bg-rose-950/60 hover:bg-rose-900 text-rose-400 rounded text-[11px] border border-rose-800 transition">删除</button>
              </div>
            </div>
            <div class="text-[11px] text-slate-400">\${item.tldr || '未填写用途说明'}</div>
            <div class="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
              <span class="secret-val-display text-slate-400 font-mono tracking-widest">\${item.masked_value}</span>
              <span>\${item.updated_at ? item.updated_at.slice(0, 19).replace('T', ' ') : ''}</span>
            </div>
          \`;

          // 复制 Lease 令牌
          card.querySelector('.btn-copy-lease')?.addEventListener('click', async () => {
            const tokenRes = await shell.apiFetch('/api/ext/memory-vfs/vault?decrypt_key=' + encodeURIComponent(item.key_name) + '&as_lease=true');
            if (tokenRes.lease_token) {
              navigator.clipboard?.writeText(tokenRes.lease_token);
              shell.notify('info', '已复制 5 分钟用后即焚令牌: ' + tokenRes.lease_token);
            }
          });

          // 解密明文
          card.querySelector('.btn-decrypt')?.addEventListener('click', async () => {
            const plainRes = await shell.apiFetch('/api/ext/memory-vfs/vault?decrypt_key=' + encodeURIComponent(item.key_name));
            if (plainRes.plain_secret) {
              const display = card.querySelector('.secret-val-display');
              display.textContent = plainRes.plain_secret;
              display.className = 'secret-val-display text-emerald-400 font-mono select-text';
              shell.notify('warn', '已解密机密: ' + item.key_name);
            }
          });

          // 删除机密
          card.querySelector('.btn-delete')?.addEventListener('click', async () => {
            if (confirm('确认彻底删除保险箱机密 "' + item.key_name + '"？')) {
              await shell.apiFetch('/api/ext/memory-vfs/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', key_name: item.key_name })
              });
              loadVaultData();
            }
          });

          box.appendChild(card);
        });
      } catch (err) {
        console.error('Load vault error:', err);
      }
    }

    function openDirModal(dir = null) {
      shell.openInspector(dir ? '编辑目录: ' + dir.path : '新建虚拟目录', \`
        <div class="space-y-3">
          <div>
            <label class="block text-slate-400 mb-1">目录路径 (如 /Projects/MyRepo)</label>
            <input id="modal-dir-path" \${dir ? 'readonly' : ''} value="\${dir ? dir.path : '/Projects/'}" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs outline-none">
          </div>
          <div>
            <label class="block text-slate-400 mb-1">显示名称</label>
            <input id="modal-dir-name" value="\${dir ? dir.name : ''}" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs outline-none">
          </div>
          <div>
            <label class="block text-slate-400 mb-1">本地工作区路径 (绑定本地代码仓库)</label>
            <input id="modal-dir-workspace" value="\${dir?.workspace_path || ''}" placeholder="D:\\\\MyWorkspace\\\\Project" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs outline-none">
          </div>
          <div>
            <label class="block text-slate-400 mb-1">目录摘要</label>
            <textarea id="modal-dir-summary" rows="3" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs outline-none">\${dir?.dir_summary || ''}</textarea>
          </div>
          <div class="pt-2 border-t border-slate-800 flex justify-end space-x-2">
            \${dir ? '<button id="modal-dir-del" class="px-3 py-1 bg-rose-900 text-xs rounded text-slate-200">删除目录</button>' : ''}
            <button id="modal-dir-save" class="px-3 py-1 bg-cyan-700 hover:bg-cyan-600 text-xs rounded text-slate-100">保存目录</button>
          </div>
        </div>
      \`);

      setTimeout(() => {
        document.getElementById('modal-dir-save')?.addEventListener('click', async () => {
          const path = document.getElementById('modal-dir-path').value.trim();
          const name = document.getElementById('modal-dir-name').value.trim();
          const workspace_path = document.getElementById('modal-dir-workspace').value.trim();
          const dir_summary = document.getElementById('modal-dir-summary').value.trim();

          await shell.apiFetch('/api/ext/memory-vfs/tree', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'upsert', path, name, workspace_path, dir_summary })
          });
          shell.closeInspector();
          loadTreeData();
        });

        document.getElementById('modal-dir-del')?.addEventListener('click', async () => {
          if (confirm('确认删除该目录？')) {
            await shell.apiFetch('/api/ext/memory-vfs/tree', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', path: dir.path })
            });
            shell.closeInspector();
            loadTreeData();
          }
        });
      }, 50);
    }

    function openSecretModal() {
      shell.openInspector('新增保险箱加密机密', \`
        <div class="space-y-3">
          <div>
            <label class="block text-slate-400 mb-1">机密分类</label>
            <select id="modal-sec-cat" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs outline-none">
              <option value="LLM_API_KEY">LLM API Key (大模型接口密钥)</option>
              <option value="SSH_KEY">SSH Key / 服务器证书</option>
              <option value="DB_PASS">Database Password 数据库凭据</option>
              <option value="CLOUD_CREDENTIAL">Cloud Credential 云凭证</option>
              <option value="OTHER">其他敏感凭据</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 mb-1">键名 (唯一标识)</label>
            <input id="modal-sec-key" placeholder="如 DEEPSEEK_API_KEY" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs outline-none">
          </div>
          <div>
            <label class="block text-slate-400 mb-1">脱敏用途说明 (TL;DR)</label>
            <input id="modal-sec-tldr" placeholder="如 用于生产环境 DeepSeek R1 接口调用" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs outline-none">
          </div>
          <div>
            <label class="block text-slate-400 mb-1">机密明文 (将被硬件级 AES-256-GCM 加密)</label>
            <textarea id="modal-sec-val" rows="3" placeholder="sk-..." class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs outline-none"></textarea>
          </div>
          <div class="pt-2 border-t border-slate-800 flex justify-end">
            <button id="modal-sec-save" class="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-xs rounded text-slate-100">加密入库</button>
          </div>
        </div>
      \`);

      setTimeout(() => {
        document.getElementById('modal-sec-save')?.addEventListener('click', async () => {
          const category = document.getElementById('modal-sec-cat').value;
          const key_name = document.getElementById('modal-sec-key').value.trim();
          const tldr = document.getElementById('modal-sec-tldr').value.trim();
          const secret_value = document.getElementById('modal-sec-val').value.trim();

          if (!key_name || !secret_value) {
            alert('键名与机密明文不能为空');
            return;
          }

          await shell.apiFetch('/api/ext/memory-vfs/vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, key_name, tldr, secret_value })
          });
          shell.closeInspector();
          loadVaultData();
        });
      }, 50);
    }

    // 事件绑定
    root.querySelector('#vfs-btn-refresh')?.addEventListener('click', () => {
      loadTreeData();
      loadVaultData();
    });
    root.querySelector('#vfs-btn-new-dir')?.addEventListener('click', () => openDirModal());
    root.querySelector('#vfs-btn-new-secret')?.addEventListener('click', () => openSecretModal());

    // 初始加载
    loadTreeData();
    loadVaultData();
  `;

  ctx.gui.registerView('/view-memory-vfs', {
    id: 'view-memory-vfs',
    title: '目录树与保险箱',
    icon: '🔐',
    slot: 'slot-2',
    renderScript
  });

  console.log('[plg-memory-vfs] L0 虚拟目录与加密保险箱插件已就绪。');

  return {
    manifest,
    deactivate: async () => {
      console.log('[plg-memory-vfs] Deactivating memory-vfs plugin...');
    }
  };
}

export default {
  manifest,
  activate
};
