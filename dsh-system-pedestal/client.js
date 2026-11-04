/**
 * DSH System Pedestal — Native Desktop Client Panel
 * Pure White Minimalist Style (纯白极简设计)
 * Runs directly inside DeepSeek Harness without opening a browser.
 */
window.__ModuleLoader__.load({
  id: 'dsh-system-pedestal',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const PANEL_ID = 'dsh-system-pedestal';
    const NS = 'sidebar.pedestal';
    const API_BASE = 'http://127.0.0.1:18765';

    const EN = {
      panel: 'System Pedestal',
      title: 'DSH System Pedestal',
      subtitle: 'Microkernel Platform · Hotplug Memory Fabric · Enterprise Vault',
      statusOnline: 'Operational',
      statusOffline: 'Service Standby',
      tabOverview: 'Overview',
      tabVfs: 'VFS & Vault',
      tabMemory: 'Memory Graph',
      tabWorkflow: 'Workflows & Capsules',
      tabTimemachine: 'Timemachine',
      refresh: 'Refresh',
      startService: 'Start Pedestal',
      restartService: '🔄 Restart Daemon',
      loadDemoSeed: '✨ Load Galaxy Demo',
      clearDemoSeed: '🧹 Clear Demo Data',
      loading: 'Loading data...',
      empty: 'No items found',
      emptyGalaxyTitle: 'Memory Knowledge Galaxy is Empty',
      emptyGalaxyDesc: 'No knowledge nodes in microkernel database yet. Click below to load 5 curated architectural nodes & graph edges to experience force graph, hybrid search & timemachine diff!',
    };

    const ZH = {
      panel: '系统基座',
      title: 'DSH 系统微内核基座',
      subtitle: '图形化微内核基座 · 热插拔多级记忆中枢 · 硬件级加密保险箱',
      statusOnline: '运行正常',
      statusOffline: '服务待机中',
      tabOverview: '微内核概览',
      tabVfs: '目录与保险箱',
      tabMemory: '知识图谱',
      tabWorkflow: '任务流水线',
      tabTimemachine: '版本时光机',
      refresh: '刷新状态',
      startService: '启动微内核守护服务',
      restartService: '🔄 重启微内核守护进程',
      loadDemoSeed: '✨ 载入示例知识星系',
      clearDemoSeed: '🧹 一键清空示例数据',
      loading: '加载中...',
      empty: '暂无数据',
      emptyGalaxyTitle: '知识星系库目前为空',
      emptyGalaxyDesc: '当前微内核尚未写入任何记忆知识节点。点击下方按钮即可一键填充围绕 dsh-system-pedestal 架构本身的 5 条精品知识节点与边关系，立即在 UI 中体验「知识星系力导向图」、「混合检索」与「版本时光机 Diff」效果！',
    };

    const CSS = [
      '.pds-root{display:flex;flex-direction:column;height:100%;min-height:0;background:#ffffff;color:#0f172a;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;box-sizing:border-box;}',
      '.pds-header{padding:18px 24px 14px;border-bottom:1px solid #f1f5f9;background:#ffffff;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}',
      '.pds-title-wrap{display:flex;align-items:center;gap:12px;}',
      '.pds-title-icon{width:36px;height:36px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;}',
      '.pds-title{margin:0;font-size:16px;font-weight:600;letter-spacing:-0.01em;color:#0f172a;}',
      '.pds-subtitle{margin:2px 0 0;font-size:12px;color:#64748b;}',
      '.pds-top-actions{display:flex;align-items:center;gap:8px;}',
      '.pds-status-pill{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:500;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;}',
      '.pds-status-pill.online{background:#f0fdf4;border-color:#bbf7d0;color:#166534;}',
      '.pds-status-dot{width:6px;height:6px;border-radius:50%;background:#94a3b8;}',
      '.pds-status-pill.online .pds-status-dot{background:#22c55e;}',
      '.pds-btn{padding:5px 12px;border-radius:7px;border:1px solid #e2e8f0;background:#ffffff;color:#334155;font-size:12px;font-weight:500;cursor:pointer;transition:all 120ms ease;display:inline-flex;align-items:center;gap:5px;}',
      '.pds-btn:hover{background:#f8fafc;border-color:#cbd5e1;color:#0f172a;}',
      '.pds-btn:active{background:#f1f5f9;}',
      '.pds-btn-primary{background:#0f172a;color:#ffffff;border-color:#0f172a;}',
      '.pds-btn-primary:hover{background:#1e293b;border-color:#1e293b;color:#ffffff;}',
      '.pds-nav{display:flex;align-items:center;gap:4px;padding:0 24px;border-bottom:1px solid #f1f5f9;background:#fafafa;flex-shrink:0;}',
      '.pds-nav-item{padding:10px 14px;border:none;background:transparent;color:#64748b;font-size:13px;font-weight:500;cursor:pointer;position:relative;transition:color 120ms ease;}',
      '.pds-nav-item:hover{color:#0f172a;}',
      '.pds-nav-item.active{color:#0f172a;font-weight:600;}',
      '.pds-nav-item.active::after{content:"";position:absolute;bottom:-1px;left:14px;right:14px;height:2px;background:#0f172a;border-radius:2px 2px 0 0;}',
      '.pds-content{flex:1 1 auto;min-height:0;overflow-y:auto;padding:20px 24px;background:#fcfcfd;}',
      '.pds-card{background:#ffffff;border:1px solid #eaecf0;border-radius:12px;padding:18px;box-shadow:0 1px 3px rgba(16,24,40,0.03);margin-bottom:16px;}',
      '.pds-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}',
      '.pds-card-title{font-size:14px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:8px;}',
      '.pds-grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;}',
      '.pds-metric{background:#f8fafc;border:1px solid #f1f5f9;border-radius:10px;padding:14px;}',
      '.pds-metric-label{font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:0.02em;}',
      '.pds-metric-value{font-size:22px;font-weight:700;color:#0f172a;margin-top:4px;letter-spacing:-0.02em;}',
      '.pds-metric-hint{font-size:11px;color:#94a3b8;margin-top:3px;}',
      '.pds-table{width:100%;border-collapse:collapse;font-size:12px;text-align:left;}',
      '.pds-table th{background:#f8fafc;color:#475569;font-weight:600;padding:8px 12px;border-bottom:1px solid #eaecf0;}',
      '.pds-table td{padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#334155;}',
      '.pds-table tr:hover td{background:#fafafa;}',
      '.pds-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;}',
      '.pds-badge.emerald{background:#ecfdf5;color:#059669;border-color:#a7f3d0;}',
      '.pds-badge.sky{background:#f0f9ff;color:#0284c7;border-color:#bae6fd;}',
      '.pds-badge.amber{background:#fffbeb;color:#d97706;border-color:#fde68a;}',
      '.pds-badge.purple{background:#faf5ff;color:#9333ea;border-color:#e9d5ff;}',
      '.pds-badge.rose{background:#fff1f2;color:#e11d48;border-color:#fecdd3;}',
      '.pds-input{padding:6px 12px;border-radius:7px;border:1px solid #d0d5dd;background:#ffffff;color:#0f172a;font-size:12px;outline:none;transition:border-color 120ms ease;}',
      '.pds-input:focus{border-color:#0f172a;}',
      '.pds-textarea{padding:8px 12px;border-radius:7px;border:1px solid #d0d5dd;background:#ffffff;color:#0f172a;font-size:12px;outline:none;font-family:inherit;resize:vertical;min-height:80px;}',
      '.pds-textarea:focus{border-color:#0f172a;}',
      '.pds-select{padding:6px 10px;border-radius:7px;border:1px solid #d0d5dd;background:#ffffff;color:#0f172a;font-size:12px;outline:none;}',
      '.pds-col-layout{display:grid;grid-template-columns:5fr 7fr;gap:16px;}',
      '.pds-tree-item{padding:8px 12px;border-radius:7px;display:flex;align-items:center;justify-content:space-between;border:1px solid transparent;cursor:pointer;transition:all 100ms ease;font-size:12px;}',
      '.pds-tree-item:hover{background:#f8fafc;border-color:#e2e8f0;}',
      '.pds-tree-item.match{background:#f0fdf4;border-color:#bbf7d0;}',
      '.pds-secret-item{padding:12px;border-radius:9px;border:1px solid #eaecf0;background:#ffffff;margin-bottom:8px;box-shadow:0 1px 2px rgba(16,24,40,0.02);}',
      '.pds-node-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;}',
      '.pds-node-card{background:#ffffff;border:1px solid #eaecf0;border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 2px rgba(16,24,40,0.02);transition:all 120ms ease;}',
      '.pds-node-card:hover{border-color:#cbd5e1;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);}',
      '.pds-banner-info{padding:12px 16px;border-radius:9px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;color:#475569;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}',
      '.pds-log-box{background:#f8fafc;border:1px solid #eaecf0;border-radius:8px;padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;color:#334155;max-height:220px;overflow-y:auto;line-height:1.6;}',
      '.pds-modal-mask{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.4);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:99999;}',
      '.pds-modal{background:#ffffff;border-radius:12px;border:1px solid #eaecf0;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1);width:100%;max-width:540px;padding:22px 24px;box-sizing:border-box;max-height:90vh;overflow-y:auto;}',
      '.pds-modal-title{font-size:15px;font-weight:600;color:#0f172a;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;}',
      '.pds-empty-card{padding:48px 24px;border:1.5px dashed #cbd5e1;border-radius:14px;background:#f8fafc;text-align:center;margin:16px 0;}',
      '.pds-empty-icon{font-size:36px;margin-bottom:12px;}',
      '.pds-empty-title{font-size:16px;font-weight:600;color:#0f172a;margin-bottom:8px;}',
      '.pds-empty-desc{font-size:13px;color:#64748b;max-width:520px;margin:0 auto 20px;line-height:1.6;}',
      '.pds-diff-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:8px 10px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:11px;max-height:180px;overflow-y:auto;margin-top:8px;line-height:1.5;}',
      '.pds-diff-added{color:#15803d;background:#ecfdf5;padding:1px 4px;border-radius:3px;display:block;}',
      '.pds-diff-removed{color:#b91c1c;background:#fef2f2;padding:1px 4px;border-radius:3px;display:block;}',
      '.pds-diff-unchanged{color:#64748b;padding:1px 4px;display:block;}',
      '.pds-galaxy-canvas{width:100%;height:420px;background:#ffffff;border:1px solid #eaecf0;border-radius:10px;display:block;cursor:crosshair;}',
      '.pds-form-group{margin-bottom:14px;}',
      '.pds-form-label{display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.02em;}',
    ].join('');

    function PanelIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 16;
      const active = props.active === true;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block' },
        },
        h('rect', {
          x: 2,
          y: 2,
          width: 12,
          height: 12,
          rx: 3,
          stroke: 'currentColor',
          strokeWidth: active ? 1.6 : 1.2,
          fill: active ? 'currentColor' : 'none',
          fillOpacity: active ? 0.12 : 0,
        }),
        h('circle', {
          cx: 8,
          cy: 8,
          r: 2,
          fill: 'currentColor',
        }),
        h('path', {
          d: 'M8 4V6M8 10V12M4 8H6M10 8H12',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
        }),
      );
    }

    async function apiFetch(path, options = {}) {
      try {
        const res = await fetch(`${API_BASE}${path}`, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        return { error: err.message };
      }
    }

    function PedestalPanel(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const [tab, setTab] = React.useState('overview');
      const [online, setOnline] = React.useState(false);
      const [overview, setOverview] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const [notice, setNotice] = React.useState('');

      // Modals State
      const [showNodeModal, setShowNodeModal] = React.useState(false);
      const [showVaultModal, setShowVaultModal] = React.useState(false);
      const [showDirModal, setShowDirModal] = React.useState(false);

      // Form Data
      const [nodeForm, setNodeForm] = React.useState({
        dir_path: '/Projects/DeepSeekHarness',
        node_type: 'tech',
        title: '',
        tldr: '',
        keywords: '',
        full_content: '',
        drawer_level: 3,
        confidence: 0.9,
      });

      const [vaultForm, setVaultForm] = React.useState({
        key_name: '',
        secret_value: '',
        category: 'API_KEY',
        tldr: '',
      });

      const [dirForm, setDirForm] = React.useState({
        path: '/Projects/Custom',
        name: 'Custom',
        dir_summary: '',
        workspace_path: '',
      });

      // VFS & Vault State
      const [vfsTree, setVfsTree] = React.useState(null);
      const [vaultItems, setVaultItems] = React.useState([]);
      const [decryptedKey, setDecryptedKey] = React.useState({});

      // Memory Nodes State
      const [nodes, setNodes] = React.useState([]);
      const [searchQuery, setSearchQuery] = React.useState('');
      const [nodeTypeFilter, setNodeTypeFilter] = React.useState('');

      // Workflows & Capsules
      const [capsules, setCapsules] = React.useState([]);
      const [dagLogs, setDagLogs] = React.useState([]);

      // Timemachine
      const [targetNodeId, setTargetNodeId] = React.useState('');
      const [historyData, setHistoryData] = React.useState(null);
      const [coldItems, setColdItems] = React.useState([]);
      const [expandedDiffs, setExpandedDiffs] = React.useState({});

      // Microkernel Restart & Galaxy State
      const [restarting, setRestarting] = React.useState(false);
      const [memoryView, setMemoryView] = React.useState('grid'); // 'grid' | 'galaxy'
      const [graphData, setGraphData] = React.useState({ nodes: [], edges: [] });
      const galaxyCanvasRef = React.useRef(null);

      const showNotice = (msg) => {
        setNotice(msg);
        window.setTimeout(() => setNotice(''), 3500);
      };

      const checkHealth = React.useCallback(async () => {
        setLoading(true);
        const data = await apiFetch('/api/sys/overview');
        if (data && !data.error && data.status === 'online') {
          setOnline(true);
          setOverview(data);
        } else {
          setOnline(false);
          setOverview(null);
        }
        setLoading(false);
      }, []);

      React.useEffect(() => {
        checkHealth();
        const timer = window.setInterval(checkHealth, 8000);
        return () => window.clearInterval(timer);
      }, [checkHealth]);

      // Tab data loaders
      const reloadData = React.useCallback(() => {
        if (!online) return;
        if (tab === 'vfs') {
          apiFetch('/api/ext/memory-vfs/tree').then((res) => setVfsTree(res));
          apiFetch('/api/ext/memory-vfs/vault').then((res) => setVaultItems(res?.items || []));
        } else if (tab === 'memory') {
          const url = `/api/ext/memory-engine/nodes?status=all${searchQuery ? '&q=' + encodeURIComponent(searchQuery) : ''}${nodeTypeFilter ? '&node_type=' + nodeTypeFilter : ''}`;
          apiFetch(url).then((res) => setNodes(res?.nodes || []));
          apiFetch('/api/ext/memory-engine/graph').then((res) => setGraphData(res || { nodes: [], edges: [] }));
        } else if (tab === 'workflow') {
          apiFetch('/api/ext/auto-distiller/capsules').then((res) => setCapsules(res?.items || []));
        } else if (tab === 'timemachine') {
          apiFetch('/api/ext/cold-timemachine/cold').then((res) => setColdItems(res?.items || []));
        }
      }, [tab, online, searchQuery, nodeTypeFilter]);

      React.useEffect(() => {
        reloadData();
      }, [reloadData]);

      // Canvas 知识星系力导向拓扑渲染
      React.useEffect(() => {
        if (memoryView !== 'galaxy' || !galaxyCanvasRef.current) return;
        const canvas = galaxyCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 750;
        canvas.width = parentWidth;
        canvas.height = 420;

        const gNodes = (graphData.nodes && graphData.nodes.length > 0 ? graphData.nodes : nodes).map((n, i, arr) => {
          const angle = (i / Math.max(1, arr.length)) * Math.PI * 2;
          const dist = 110 + (i % 2 === 0 ? 30 : -20);
          return {
            ...n,
            x: canvas.width / 2 + Math.cos(angle) * dist,
            y: canvas.height / 2 + Math.sin(angle) * (dist * 0.75),
            r: 7 + (n.drawer_level || 1) * 2,
          };
        });

        const nodeMap = new Map();
        gNodes.forEach((n) => nodeMap.set(n.id, n));

        // 清屏
        ctx.fillStyle = '#fafbfc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 网格底纹
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 30) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 30) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // 绘制关联连线
        (graphData.edges || []).forEach((e) => {
          const src = nodeMap.get(e.source_id);
          const tgt = nodeMap.get(e.target_id);
          if (src && tgt) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = Math.min(2.5, Math.max(1, e.weight || 1));
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(tgt.x, tgt.y);
            ctx.stroke();

            // 关系文字
            if (e.relation) {
              const midX = (src.x + tgt.x) / 2;
              const midY = (src.y + tgt.y) / 2;
              ctx.font = '9px sans-serif';
              ctx.fillStyle = '#64748b';
              ctx.fillText(e.relation, midX + 3, midY - 3);
            }
          }
        });

        // 节点配色方案
        const colorMap = {
          project: '#0284c7',
          issue: '#e11d48',
          solution: '#059669',
          tech: '#7c3aed',
          pattern: '#4f46e5',
        };

        // 绘制节点球与光晕
        gNodes.forEach((n) => {
          const baseColor = colorMap[n.node_type] || '#475569';
          // 外光晕
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2);
          ctx.fillStyle = baseColor + '22';
          ctx.fill();

          // 核心圆球
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.fillStyle = baseColor;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // 节点标题文本
          ctx.font = '11px -apple-system, sans-serif';
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          const label = n.title && n.title.length > 14 ? n.title.slice(0, 14) + '...' : n.title || n.id;
          ctx.fillText(label, n.x, n.y + n.r + 14);

          // 类型与等级角标
          ctx.font = '9px monospace';
          ctx.fillStyle = '#64748b';
          ctx.fillText(`${(n.node_type || 'tech').toUpperCase()} · Lv.${n.drawer_level || 1}`, n.x, n.y + n.r + 26);
        });
      }, [memoryView, graphData, nodes]);

      // --- Actions ---
      const handleCreateNodeSubmit = async () => {
        if (!nodeForm.title || !nodeForm.full_content) {
          showNotice('请填写节点标题与正文内容');
          return;
        }
        const res = await apiFetch('/api/ext/memory-engine/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'commit',
            ...nodeForm,
          }),
        });
        if (res?.success) {
          showNotice(`知识节点创建成功: ${res.node_id}`);
          setShowNodeModal(false);
          setNodeForm({
            dir_path: nodeForm.dir_path,
            node_type: 'tech',
            title: '',
            tldr: '',
            keywords: '',
            full_content: '',
            drawer_level: 3,
            confidence: 0.9,
          });
          reloadData();
          checkHealth();
        } else {
          showNotice(`创建失败: ${res?.error || '未知错误'}`);
        }
      };

      const handleCreateVaultSubmit = async () => {
        if (!vaultForm.key_name || !vaultForm.secret_value) {
          showNotice('请填写机密名称与密钥值');
          return;
        }
        const res = await apiFetch('/api/ext/memory-vfs/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vaultForm),
        });
        if (res?.success) {
          showNotice(`安全凭证已加密存入保险箱: ${vaultForm.key_name}`);
          setShowVaultModal(false);
          setVaultForm({ key_name: '', secret_value: '', category: 'API_KEY', tldr: '' });
          reloadData();
          checkHealth();
        } else {
          showNotice(`保存失败: ${res?.error || '未知错误'}`);
        }
      };

      const handleCreateDirSubmit = async () => {
        if (!dirForm.path) {
          showNotice('请填写目录路径');
          return;
        }
        const res = await apiFetch('/api/ext/memory-vfs/tree', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dirForm),
        });
        if (res?.success) {
          showNotice(`虚拟目录创建成功: ${dirForm.path}`);
          setShowDirModal(false);
          reloadData();
          checkHealth();
        } else {
          showNotice(`创建失败: ${res?.error || '未知错误'}`);
        }
      };

      const handleCopyLease = async (keyName) => {
        const res = await apiFetch(`/api/ext/memory-vfs/vault?decrypt_key=${encodeURIComponent(keyName)}&as_lease=true`);
        if (res?.lease_token && window.navigator?.clipboard) {
          window.navigator.clipboard.writeText(res.lease_token);
          showNotice(`已复制 5 分钟用后即焚令牌: ${res.lease_token}`);
        }
      };

      const handleDecrypt = async (keyName) => {
        const res = await apiFetch(`/api/ext/memory-vfs/vault?decrypt_key=${encodeURIComponent(keyName)}`);
        if (res?.plain_secret) {
          setDecryptedKey((prev) => ({ ...prev, [keyName]: res.plain_secret }));
          showNotice(`机密 ${keyName} 已解密显示`);
        }
      };

      const handleAdjustLevel = async (nodeId, delta) => {
        await apiFetch('/api/ext/memory-engine/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'adjust_level', node_id: nodeId, level_delta: delta }),
        });
        showNotice(`抽屉等级已更新 (${delta > 0 ? '+1' : '-1'})`);
        reloadData();
      };

      const handleTriggerWorkflow = async (templateId) => {
        setDagLogs((prev) => [`[${new Date().toLocaleTimeString()}] 触发工作流: ${templateId}...`, ...prev]);
        const res = await apiFetch('/api/sys/workflows/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId }),
        });
        const statusStr = res?.result?.status || 'COMPLETED';
        setDagLogs((prev) => [`[${new Date().toLocaleTimeString()}] 流水线执行成功: ${statusStr}`, ...prev]);
        showNotice(`工作流 ${templateId} 执行完成`);
        reloadData();
        checkHealth();
      };

      const handleExportCapsule = async () => {
        const res = await apiFetch('/api/ext/auto-distiller/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir_path: '/Projects', capsule_name: 'dsh_knowledge_bundle' }),
        });
        if (res?.success) {
          showNotice(`胶囊包已打包导出: ${res.fileName}`);
          reloadData();
        }
      };

      const handleImportCapsule = async (fileName) => {
        const res = await apiFetch('/api/ext/auto-distiller/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_name: fileName }),
        });
        if (res?.success) {
          showNotice(`全自动载入完成！已导入 ${res.imported_nodes || 0} 个知识节点`);
          reloadData();
          checkHealth();
        }
      };

      const handleLoadHistory = async (nodeId) => {
        if (!nodeId) return;
        const res = await apiFetch(`/api/ext/cold-timemachine/history?node_id=${encodeURIComponent(nodeId)}`);
        setHistoryData(res);
      };

      const handleRollback = async (nodeId, historyId, versionNum) => {
        await apiFetch('/api/ext/cold-timemachine/rollback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ node_id: nodeId, history_id: historyId }),
        });
        showNotice(`节点 ${nodeId} 已回滚至 v${versionNum}`);
        handleLoadHistory(nodeId);
        reloadData();
      };

      const handleReviveCold = async (nodeId) => {
        const res = await apiFetch('/api/ext/cold-timemachine/revive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ node_id: nodeId }),
        });
        if (res?.success) {
          showNotice(`已唤醒冷数据节点: ${res.title || nodeId}`);
          reloadData();
          checkHealth();
        }
      };

      const handleRestartDaemon = async () => {
        setRestarting(true);
        showNotice('微内核守护进程正在平滑重启，正在优雅关闭数据库并重新建立连接...');
        try {
          await apiFetch('/api/sys/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version: '4.0.0' }),
          });
        } catch {}

        let attempts = 0;
        const interval = window.setInterval(async () => {
          attempts++;
          try {
            const res = await window.fetch(`${API_BASE}/api/sys/overview`);
            if (res.ok) {
              window.clearInterval(interval);
              setRestarting(false);
              showNotice('✅ 微内核守护进程已成功平滑重启 (v4.0.0)，系统状态已重联！');
              checkHealth();
              reloadData();
            }
          } catch {}
          if (attempts >= 25) {
            window.clearInterval(interval);
            setRestarting(false);
            checkHealth();
          }
        }, 400);
      };

      const handleLoadDemoSeed = async () => {
        showNotice('正在载入微内核架构示例知识星系...');
        const res = await apiFetch('/api/ext/memory-engine/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'load_demo_seed' }),
        });
        if (res?.success) {
          showNotice(`✨ 成功载入 ${res.count || 5} 条精品知识节点与 ${res.edgesCount || 5} 条星系连线！`);
          reloadData();
          checkHealth();
        } else {
          showNotice(`载入示例失败: ${res?.error || '未知错误'}`);
        }
      };

      const handleClearDemoSeed = async () => {
        showNotice('正在清空示例数据...');
        const res = await apiFetch('/api/ext/memory-engine/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear_demo_seed' }),
        });
        if (res?.success) {
          showNotice('🧹 示例知识节点与关联拓扑连线已清理完毕！');
          reloadData();
          checkHealth();
        } else {
          showNotice(`清空失败: ${res?.error || '未知错误'}`);
        }
      };

      // --- Modals Render ---
      const renderModals = () => {
        return h(
          React.Fragment,
          null,
          // 1. 新增知识节点 Modal
          showNodeModal
            ? h(
                'div',
                { className: 'pds-modal-mask', onClick: () => setShowNodeModal(false) },
                h(
                  'div',
                  { className: 'pds-modal', onClick: (e) => e.stopPropagation() },
                  h('div', { className: 'pds-modal-title' }, [
                    h('span', { key: 't' }, '📝 手动录入知识节点'),
                    h('button', { key: 'c', className: 'pds-btn', style: { padding: '2px 8px' }, onClick: () => setShowNodeModal(false) }, '✕'),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '所属目录 (dir_path)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box' },
                      value: nodeForm.dir_path,
                      onChange: (e) => setNodeForm({ ...nodeForm, dir_path: e.target.value }),
                    }),
                  ]),
                  h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, [
                    h('div', { className: 'pds-form-group' }, [
                      h('label', { className: 'pds-form-label' }, '节点类型 (Type)'),
                      h(
                        'select',
                        {
                          className: 'pds-select',
                          style: { width: '100%' },
                          value: nodeForm.node_type,
                          onChange: (e) => setNodeForm({ ...nodeForm, node_type: e.target.value }),
                        },
                        h('option', { value: 'tech' }, 'tech 技术'),
                        h('option', { value: 'project' }, 'project 项目'),
                        h('option', { value: 'issue' }, 'issue 缺陷排查'),
                        h('option', { value: 'solution' }, 'solution 解决方案'),
                        h('option', { value: 'pattern' }, 'pattern 设计模式'),
                      ),
                    ]),
                    h('div', { className: 'pds-form-group' }, [
                      h('label', { className: 'pds-form-label' }, '抽屉权重等级 (1~5)'),
                      h('input', {
                        type: 'number',
                        min: 1,
                        max: 5,
                        className: 'pds-input',
                        style: { width: '100%', boxSizing: 'border-box' },
                        value: nodeForm.drawer_level,
                        onChange: (e) => setNodeForm({ ...nodeForm, drawer_level: Number(e.target.value) }),
                      }),
                    ]),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '标题 (Title)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box' },
                      placeholder: '如：DSH 微内核生命周期规范',
                      value: nodeForm.title,
                      onChange: (e) => setNodeForm({ ...nodeForm, title: e.target.value }),
                    }),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '一句话摘要 (TL;DR)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box' },
                      placeholder: '核心结论与关键特征（留空自动生成）',
                      value: nodeForm.tldr,
                      onChange: (e) => setNodeForm({ ...nodeForm, tldr: e.target.value }),
                    }),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '关键词 (Keywords，逗号分隔)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box' },
                      placeholder: 'dsh, plugin, microkernel',
                      value: nodeForm.keywords,
                      onChange: (e) => setNodeForm({ ...nodeForm, keywords: e.target.value }),
                    }),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '完整正文内容 (Markdown)'),
                    h('textarea', {
                      className: 'pds-textarea',
                      style: { width: '100%', boxSizing: 'border-box' },
                      placeholder: '# 架构详述\n\n写入完整方案细节...',
                      value: nodeForm.full_content,
                      onChange: (e) => setNodeForm({ ...nodeForm, full_content: e.target.value }),
                    }),
                  ]),
                  h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' } }, [
                    h('button', { className: 'pds-btn', onClick: () => setShowNodeModal(false) }, '取消'),
                    h('button', { className: 'pds-btn pds-btn-primary', onClick: handleCreateNodeSubmit }, '确认写入知识库'),
                  ]),
                ),
              )
            : null,
          // 2. 新增保险箱机密 Modal
          showVaultModal
            ? h(
                'div',
                { className: 'pds-modal-mask', onClick: () => setShowVaultModal(false) },
                h(
                  'div',
                  { className: 'pds-modal', onClick: (e) => e.stopPropagation() },
                  h('div', { className: 'pds-modal-title' }, [
                    h('span', { key: 't' }, '🔐 新增硬件级加密机密'),
                    h('button', { key: 'c', className: 'pds-btn', style: { padding: '2px 8px' }, onClick: () => setShowVaultModal(false) }, '✕'),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '机密键名 (Key Name)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' },
                      placeholder: '如 DEEPSEEK_API_KEY, DB_PASSWORD',
                      value: vaultForm.key_name,
                      onChange: (e) => setVaultForm({ ...vaultForm, key_name: e.target.value }),
                    }),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '明文密钥值 (Secret Value，将以 AES-256-GCM 加密存储)'),
                    h('input', {
                      type: 'password',
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' },
                      placeholder: '输入敏感凭据',
                      value: vaultForm.secret_value,
                      onChange: (e) => setVaultForm({ ...vaultForm, secret_value: e.target.value }),
                    }),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '类别 (Category)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box' },
                      placeholder: 'API_KEY / SSH_KEY / DB_AUTH',
                      value: vaultForm.category,
                      onChange: (e) => setVaultForm({ ...vaultForm, category: e.target.value }),
                    }),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '用途说明 (TL;DR)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box' },
                      placeholder: '如：用于调用外部智能体网关',
                      value: vaultForm.tldr,
                      onChange: (e) => setVaultForm({ ...vaultForm, tldr: e.target.value }),
                    }),
                  ]),
                  h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' } }, [
                    h('button', { className: 'pds-btn', onClick: () => setShowVaultModal(false) }, '取消'),
                    h('button', { className: 'pds-btn pds-btn-primary', onClick: handleCreateVaultSubmit }, '安全加密入库'),
                  ]),
                ),
              )
            : null,
          // 3. 新建虚拟目录 Modal
          showDirModal
            ? h(
                'div',
                { className: 'pds-modal-mask', onClick: () => setShowDirModal(false) },
                h(
                  'div',
                  { className: 'pds-modal', onClick: (e) => e.stopPropagation() },
                  h('div', { className: 'pds-modal-title' }, [
                    h('span', { key: 't' }, '📁 新建虚拟多维目录'),
                    h('button', { key: 'c', className: 'pds-btn', style: { padding: '2px 8px' }, onClick: () => setShowDirModal(false) }, '✕'),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '虚拟路径 (Path)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' },
                      placeholder: '如 /Projects/Frontend 或 /Tech/AI',
                      value: dirForm.path,
                      onChange: (e) => setDirForm({ ...dirForm, path: e.target.value }),
                    }),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '目录名称 (Name)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box' },
                      value: dirForm.name,
                      onChange: (e) => setDirForm({ ...dirForm, name: e.target.value }),
                    }),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '用途概述 (Summary)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box' },
                      placeholder: '该目录存储哪类知识规范',
                      value: dirForm.dir_summary,
                      onChange: (e) => setDirForm({ ...dirForm, dir_summary: e.target.value }),
                    }),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '绑定本地工作区绝对路径 (可选)'),
                    h('input', {
                      className: 'pds-input',
                      style: { width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' },
                      placeholder: '如 D:\\DSH work\\MyProject (匹配工作区将自动锚定)',
                      value: dirForm.workspace_path,
                      onChange: (e) => setDirForm({ ...dirForm, workspace_path: e.target.value }),
                    }),
                  ]),
                  h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' } }, [
                    h('button', { className: 'pds-btn', onClick: () => setShowDirModal(false) }, '取消'),
                    h('button', { className: 'pds-btn pds-btn-primary', onClick: handleCreateDirSubmit }, '创建目录'),
                  ]),
                ),
              )
            : null,
        );
      };

      // --- Tab Views ---
      const renderOverview = () => {
        const db = overview?.dbStats || {};
        const workers = overview?.workerTelemetry || {};
        return h(
          'div',
          null,
          h(
            'div',
            { className: 'pds-card' },
            h(
              'div',
              { className: 'pds-card-header' },
              h('div', { className: 'pds-card-title' }, '🖥️ 微内核核心遥测指标'),
              h('span', { className: 'pds-badge emerald' }, `Uptime: ${Math.round(overview?.uptime || 0)}s`),
            ),
            h(
              'div',
              { className: 'pds-grid-3' },
              h(
                'div',
                { className: 'pds-metric' },
                h('div', { className: 'pds-metric-label' }, '虚拟拓扑目录数'),
                h('div', { className: 'pds-metric-value' }, db.memory_directories || 0),
                h('div', { className: 'pds-metric-hint' }, 'L0 Virtual File System 树节点'),
              ),
              h(
                'div',
                { className: 'pds-metric' },
                h('div', { className: 'pds-metric-label' }, '活跃知识节点'),
                h('div', { className: 'pds-metric-value' }, db.knowledge_nodes || 0),
                h('div', { className: 'pds-metric-hint' }, 'L1 抽屉加权分层知识图谱'),
              ),
              h(
                'div',
                { className: 'pds-metric' },
                h('div', { className: 'pds-metric-label' }, '安全凭证机密数'),
                h('div', { className: 'pds-metric-value' }, db.core_vault || 0),
                h('div', { className: 'pds-metric-hint' }, 'AES-256-GCM 加密保险箱记录'),
              ),
            ),
          ),
          h(
            'div',
            { className: 'pds-card' },
            h(
              'div',
              { className: 'pds-card-header' },
              h('div', { className: 'pds-card-title' }, '⚡ 线程池与流水线吞吐'),
              h('span', { className: 'pds-badge sky' }, `Worker Pool: ${workers.poolSize || 4} 线程并发`),
            ),
            h(
              'div',
              { className: 'pds-grid-3' },
              h(
                'div',
                { className: 'pds-metric' },
                h('div', { className: 'pds-metric-label' }, '就绪 Worker 状态'),
                h('div', { className: 'pds-metric-value' }, `${workers.idleWorkers || 4} / ${workers.poolSize || 4}`),
                h('div', { className: 'pds-metric-hint' }, '空闲/总并发容量'),
              ),
              h(
                'div',
                { className: 'pds-metric' },
                h('div', { className: 'pds-metric-label' }, '调度队列待处理'),
                h('div', { className: 'pds-metric-value' }, workers.queueLengths?.total || 0),
                h('div', { className: 'pds-metric-hint' }, 'P0/P1/P2 优先级队列任务'),
              ),
              h(
                'div',
                { className: 'pds-metric' },
                h('div', { className: 'pds-metric-label' }, '内存占用 (RSS)'),
                h('div', { className: 'pds-metric-value' }, `${Math.round((overview?.memoryUsage?.rss || 0) / 1024 / 1024)} MB`),
                h('div', { className: 'pds-metric-hint' }, 'Node 引擎物理常驻内存'),
              ),
            ),
          ),
          h(
            'div',
            { className: 'pds-card' },
            h('div', { className: 'pds-card-title', style: { marginBottom: '12px' } }, '🧩 已装载的微内核模块与扩展'),
            h(
              'table',
              { className: 'pds-table' },
              h(
                'thead',
                null,
                h(
                  'tr',
                  null,
                  h('th', null, '模块名称'),
                  h('th', null, '分层定位'),
                  h('th', null, '运行状态'),
                  h('th', null, '职责描述'),
                ),
              ),
              h(
                'tbody',
                null,
                [
                  { name: 'kernelBus', level: 'Core', desc: '事件总线、事务隔离、IPC生命周期中枢' },
                  { name: 'workerPool', level: 'Engine', desc: '多进程并行工作池，支持任务优先级调度' },
                  { name: 'dagScheduler', level: 'Orchestrator', desc: 'DAG 任务调度器，支持 Fork-Join 复杂任务' },
                  { name: 'guiGateway', level: 'Gateway', desc: '微内核 REST API 网关与实时 SSE 通道' },
                  { name: 'hotplugLoader', level: 'Loader', desc: '拓扑排序热插拔插件加载器，支持动态扩展' },
                ].map((m) =>
                  h(
                    'tr',
                    { key: m.name },
                    h('td', { style: { fontWeight: 600, fontFamily: 'monospace' } }, m.name),
                    h('td', null, h('span', { className: 'pds-badge purple' }, m.level)),
                    h('td', null, h('span', { className: 'pds-badge emerald' }, 'Active')),
                    h('td', { style: { color: '#64748b' } }, m.desc),
                  ),
                ),
              ),
            ),
          ),
        );
      };

      const renderVfs = () => {
        const tree = vfsTree?.tree || [];
        return h(
          'div',
          { className: 'pds-col-layout' },
          // Left: Directory Tree
          h(
            'div',
            { className: 'pds-card' },
            h(
              'div',
              { className: 'pds-card-header' },
              h('div', { className: 'pds-card-title' }, '📁 虚拟多维目录拓扑'),
              h('button', { className: 'pds-btn pds-btn-primary', onClick: () => setShowDirModal(true) }, '+ 新建目录'),
            ),
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
              tree.map((dir) =>
                h(
                  'div',
                  {
                    key: dir.path,
                    className: `pds-tree-item ${dir.is_current_workspace_match ? 'match' : ''}`,
                  },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                    h('span', { key: 'icon' }, '📁'),
                    h('span', { key: 'name', style: { fontWeight: 600 } }, dir.path),
                    dir.is_current_workspace_match
                      ? h('span', { key: 'match', className: 'pds-badge emerald' }, '当前工作区')
                      : null,
                  ]),
                  h('div', { style: { display: 'flex', gap: '6px', fontSize: '11px', color: '#64748b' } }, [
                    h('span', { key: 'nodes' }, `${dir.active_node_count || 0} 节点`),
                    h('span', { key: 'vault' }, `${dir.vault_count || 0} 机密`),
                  ]),
                ),
              ),
            ),
          ),
          // Right: Vault
          h(
            'div',
            { className: 'pds-card' },
            h(
              'div',
              { className: 'pds-card-header' },
              h('div', { className: 'pds-card-title' }, '🔐 高安全硬件级保险箱 (AES-256)'),
              h('button', { className: 'pds-btn pds-btn-primary', onClick: () => setShowVaultModal(true) }, '+ 新增机密'),
            ),
            vaultItems.length === 0
              ? h('div', { style: { textAlign: 'center', color: '#94a3b8', padding: '36px 0', fontSize: '13px' } }, '保险箱为空，点击右上角「新增机密」添加密钥凭证')
              : h(
                  'div',
                  null,
                  vaultItems.map((v) =>
                    h(
                      'div',
                      { key: v.key_name, className: 'pds-secret-item' },
                      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' } }, [
                        h('div', { key: 'left', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                          h('span', { className: 'pds-badge purple' }, v.category || 'SECRET'),
                          h('span', { style: { fontWeight: 600, fontSize: '13px', fontFamily: 'monospace' } }, v.key_name),
                        ]),
                        h('div', { key: 'actions', style: { display: 'flex', gap: '6px' } }, [
                          h(
                            'button',
                            {
                              className: 'pds-btn',
                              onClick: () => handleCopyLease(v.key_name),
                              title: '生成并复制5分钟有效用后即焚临时令牌',
                            },
                            '复制令牌',
                          ),
                          h(
                            'button',
                            {
                              className: 'pds-btn',
                              onClick: () => handleDecrypt(v.key_name),
                            },
                            decryptedKey[v.key_name] ? '已解密' : '解密查看',
                          ),
                        ]),
                      ]),
                      h('div', { style: { fontSize: '12px', color: '#64748b', marginBottom: '8px' } }, v.tldr || '暂无说明'),
                      h(
                        'div',
                        {
                          style: {
                            padding: '6px 10px',
                            background: '#f8fafc',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            color: decryptedKey[v.key_name] ? '#059669' : '#94a3b8',
                            letterSpacing: decryptedKey[v.key_name] ? 'normal' : '0.15em',
                          },
                        },
                        decryptedKey[v.key_name] || v.masked_value || '••••••••••••••••',
                      ),
                    ),
                  ),
                ),
          ),
        );
      };

      const renderMemory = () => {
        const hasDemoNodes = nodes.some((n) => n.id && n.id.startsWith('kn_demo_'));

        return h(
          'div',
          null,
          h(
            'div',
            { className: 'pds-card' },
            h(
              'div',
              { className: 'pds-card-header', style: { flexWrap: 'wrap', gap: '10px' } },
              h('div', { className: 'pds-card-title' }, [
                h('span', { key: 't' }, '🧠 L1/L2 记忆网格与知识星系拓扑'),
                h(
                  'span',
                  { key: 'cnt', className: 'pds-badge sky', style: { marginLeft: '8px' } },
                  nodes.length + ' 节点 / ' + (graphData.edges ? graphData.edges.length : 0) + ' 边',
                ),
              ]),
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' } }, [
                // 视图切换按钮组
                h(
                  'div',
                  { key: 'view-mode', style: { display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: '7px', overflow: 'hidden' } },
                  [
                    h(
                      'button',
                      {
                        key: 'grid',
                        className: 'pds-btn',
                        style: {
                          border: 'none',
                          borderRadius: 0,
                          background: memoryView === 'grid' ? '#0f172a' : '#ffffff',
                          color: memoryView === 'grid' ? '#ffffff' : '#334155',
                          padding: '4px 10px',
                        },
                        onClick: () => setMemoryView('grid'),
                      },
                      '🗂️ 卡片网格',
                    ),
                    h(
                      'button',
                      {
                        key: 'galaxy',
                        className: 'pds-btn',
                        style: {
                          border: 'none',
                          borderRadius: 0,
                          background: memoryView === 'galaxy' ? '#0f172a' : '#ffffff',
                          color: memoryView === 'galaxy' ? '#ffffff' : '#334155',
                          padding: '4px 10px',
                        },
                        onClick: () => setMemoryView('galaxy'),
                      },
                      '🌌 知识星系',
                    ),
                  ],
                ),
                h('input', {
                  key: 'search',
                  className: 'pds-input',
                  placeholder: '搜索知识关键词或标题...',
                  value: searchQuery,
                  onChange: (e) => setSearchQuery(e.target.value),
                }),
                h(
                  'select',
                  {
                    key: 'filter',
                    className: 'pds-select',
                    value: nodeTypeFilter,
                    onChange: (e) => setNodeTypeFilter(e.target.value),
                  },
                  h('option', { value: '' }, '全部类型'),
                  h('option', { value: 'project' }, 'Project 项目'),
                  h('option', { value: 'issue' }, 'Issue 问题'),
                  h('option', { value: 'solution' }, 'Solution 方案'),
                  h('option', { value: 'tech' }, 'Tech 技术'),
                ),
                h(
                  'button',
                  {
                    key: 'seed-btn',
                    className: 'pds-btn',
                    onClick: handleLoadDemoSeed,
                    title: '一键写入5条架构精品知识节点与连线',
                  },
                  format(t, 'loadDemoSeed'),
                ),
                hasDemoNodes
                  ? h(
                      'button',
                      {
                        key: 'clear-btn',
                        className: 'pds-btn',
                        onClick: handleClearDemoSeed,
                        title: '清空测试与示例数据',
                      },
                      format(t, 'clearDemoSeed'),
                    )
                  : null,
                h('button', { key: 'add-btn', className: 'pds-btn pds-btn-primary', onClick: () => setShowNodeModal(true) }, '+ 新增知识节点'),
              ]),
            ),
            // 空状态引导 vs 知识星系 Canvas vs 卡片网格
            nodes.length === 0
              ? h(
                  'div',
                  { className: 'pds-empty-card' },
                  h('div', { className: 'pds-empty-icon' }, '🌌'),
                  h('div', { className: 'pds-empty-title' }, format(t, 'emptyGalaxyTitle')),
                  h('div', { className: 'pds-empty-desc' }, format(t, 'emptyGalaxyDesc')),
                  h(
                    'button',
                    {
                      className: 'pds-btn pds-btn-primary',
                      style: { padding: '8px 20px', fontSize: '13px' },
                      onClick: handleLoadDemoSeed,
                    },
                    format(t, 'loadDemoSeed'),
                  ),
                )
              : memoryView === 'galaxy'
              ? h(
                  'div',
                  { style: { position: 'relative', marginTop: '10px' } },
                  h('canvas', { ref: galaxyCanvasRef, className: 'pds-galaxy-canvas' }),
                  h(
                    'div',
                    {
                      style: {
                        position: 'absolute',
                        bottom: '12px',
                        left: '12px',
                        background: 'rgba(255,255,255,0.9)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        border: '1px solid #e2e8f0',
                        color: '#64748b',
                        display: 'flex',
                        gap: '12px',
                      },
                    },
                    [
                      h('span', { key: 'p', style: { color: '#0284c7' } }, '● Project'),
                      h('span', { key: 't', style: { color: '#7c3aed' } }, '● Tech'),
                      h('span', { key: 'i', style: { color: '#e11d48' } }, '● Issue'),
                      h('span', { key: 's', style: { color: '#059669' } }, '● Solution'),
                      h('span', { key: 'a', style: { color: '#4f46e5' } }, '● Pattern'),
                    ],
                  ),
                )
              : h(
                  'div',
                  { className: 'pds-node-grid' },
                  nodes.map((n) =>
                    h(
                      'div',
                      { key: n.id, className: 'pds-node-card' },
                      h('div', null, [
                        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' } }, [
                          h('span', { className: 'pds-badge sky' }, (n.node_type || 'tech').toUpperCase()),
                          h('span', { className: 'pds-badge emerald' }, 'Lv.' + (n.drawer_level || 1)),
                        ]),
                        h('div', { style: { fontWeight: 600, fontSize: '13px', color: '#0f172a', marginBottom: '4px' } }, n.title),
                        h('div', { style: { fontSize: '12px', color: '#64748b', lineHeight: 1.5, maxHeight: '42px', overflow: 'hidden' } }, n.tldr || '暂无摘要'),
                      ]),
                      h('div', { style: { borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
                        h('span', { style: { fontSize: '11px', color: '#94a3b8' } }, '置信度: ' + Math.round((n.confidence || 0.8) * 100) + '%'),
                        h('div', { style: { display: 'flex', gap: '4px' } }, [
                          h('button', { className: 'pds-btn', style: { padding: '2px 6px', fontSize: '10px' }, onClick: () => handleAdjustLevel(n.id, 1) }, '+1'),
                          h('button', { className: 'pds-btn', style: { padding: '2px 6px', fontSize: '10px' }, onClick: () => handleAdjustLevel(n.id, -1) }, '-1'),
                        ]),
                      ]),
                    ),
                  ),
                ),
          ),
        );
      };

      const renderWorkflow = () => {
        return h(
          'div',
          { className: 'pds-col-layout' },
          // Left: Workflows
          h(
            'div',
            { className: 'pds-card' },
            h('div', { className: 'pds-card-title', style: { marginBottom: '14px' } }, '⚡ 自动化 DAG 工作流流水线'),
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' } },
              h(
                'div',
                { style: { padding: '12px', borderRadius: '8px', border: '1px solid #eaecf0', background: '#f8fafc' } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' } }, [
                  h('span', { style: { fontWeight: 600, fontSize: '13px' } }, '🌿 流水线: dag-inbox-distill'),
                  h('button', { className: 'pds-btn pds-btn-primary', onClick: () => handleTriggerWorkflow('dag-inbox-distill') }, '全自动提炼成链'),
                ]),
                h('div', { style: { fontSize: '12px', color: '#64748b' } }, '扫描短期记忆 -> 并行脱敏清洗 -> 自动图谱连线与归纳'),
              ),
              h(
                'div',
                { style: { padding: '12px', borderRadius: '8px', border: '1px solid #eaecf0', background: '#f8fafc' } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' } }, [
                  h('span', { style: { fontWeight: 600, fontSize: '13px' } }, '🕒 流水线: dag-daily-patrol'),
                  h('button', { className: 'pds-btn', onClick: () => handleTriggerWorkflow('dag-daily-patrol') }, '运行巡检热备'),
                ]),
                h('div', { style: { fontSize: '12px', color: '#64748b' } }, '三路并发执行：指数衰减归档 || 图谱共现巡检 || 数据库快照热备'),
              ),
            ),
            h('div', { style: { fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' } }, '流水线调度实时日志:'),
            h(
              'div',
              { className: 'pds-log-box' },
              dagLogs.length === 0 ? '等待触发工作流...' : dagLogs.map((log, idx) => h('div', { key: idx }, log)),
            ),
          ),
          // Right: Capsules
          h(
            'div',
            { className: 'pds-card' },
            h(
              'div',
              { className: 'pds-card-header' },
              h('div', { className: 'pds-card-title' }, '📦 知识胶囊包 (全自动打包与挂载)'),
              h('button', { className: 'pds-btn pds-btn-primary', onClick: handleExportCapsule }, '一键导出胶囊'),
            ),
            h('div', { style: { fontSize: '12px', color: '#64748b', marginBottom: '12px' } }, '将已抽屉化知识节点脱敏打包为便携格式，支持跨机器一键热插拔挂载。'),
            capsules.length === 0
              ? h('div', { style: { textAlign: 'center', color: '#94a3b8', padding: '36px 0', fontSize: '13px' } }, '暂无已打包的知识胶囊文件')
              : h(
                  'div',
                  null,
                  capsules.map((c) =>
                    h(
                      'div',
                      {
                        key: c.file_name,
                        style: {
                          padding: '10px 12px',
                          border: '1px solid #eaecf0',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        },
                      },
                      h('div', null, [
                        h('div', { style: { fontWeight: 600, fontSize: '12px', fontFamily: 'monospace' } }, c.file_name),
                        h('div', { style: { fontSize: '11px', color: '#94a3b8', marginTop: '2px' } }, `${Math.round(c.size_bytes / 1024)} KB · ${c.mtime?.slice(0, 19).replace('T', ' ')}`),
                      ]),
                      h('button', { className: 'pds-btn', onClick: () => handleImportCapsule(c.file_name) }, '一键导入挂载'),
                    ),
                  ),
                ),
          ),
        );
      };

      const renderTimemachine = () => {
        return h(
          'div',
          { className: 'pds-col-layout' },
          // Left: Version snapshots
          h(
            'div',
            { className: 'pds-card' },
            h(
              'div',
              { className: 'pds-card-header' },
              h('div', { className: 'pds-card-title' }, '⏳ 知识版本快照时光机'),
            ),
            h('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } }, [
              h('input', {
                className: 'pds-input',
                style: { flex: 1 },
                placeholder: '输入节点 ID (如 kn_demo_solution_wal) 查看快照...',
                value: targetNodeId,
                onChange: (e) => setTargetNodeId(e.target.value),
              }),
              h('button', { className: 'pds-btn', onClick: () => handleLoadHistory(targetNodeId) }, '查看快照'),
            ]),
            h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '12px' } }, [
              h('span', { style: { fontSize: '11px', color: '#64748b' } }, '💡 快捷通道:'),
              h(
                'button',
                {
                  className: 'pds-btn',
                  style: { padding: '2px 8px', fontSize: '11px', background: '#f8fafc' },
                  onClick: () => {
                    setTargetNodeId('kn_demo_solution_wal');
                    handleLoadHistory('kn_demo_solution_wal');
                  },
                },
                'kn_demo_solution_wal (方案演进 Diff 与回滚)',
              ),
            ]),
            !historyData?.history || historyData.history.length === 0
              ? h('div', { style: { textAlign: 'center', color: '#94a3b8', padding: '36px 0', fontSize: '13px' } }, '输入节点 ID 即可按时间戳回溯并体验红绿 Diff 与一键回滚')
              : h(
                  'div',
                  null,
                  historyData.history.map((hItem) => {
                    const isDiffOpen = !!expandedDiffs[hItem.history_id];
                    return h(
                      'div',
                      {
                        key: hItem.history_id,
                        style: {
                          padding: '10px 12px',
                          border: '1px solid #eaecf0',
                          borderRadius: '8px',
                          marginBottom: '8px',
                        },
                      },
                      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                        h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [
                          h('span', { className: 'pds-badge purple' }, 'Snapshot v' + hItem.version_num),
                          h(
                            'button',
                            {
                              className: 'pds-btn',
                              style: { padding: '2px 6px', fontSize: '10px' },
                              onClick: () => setExpandedDiffs((prev) => ({ ...prev, [hItem.history_id]: !prev[hItem.history_id] })),
                            },
                            isDiffOpen ? '收起差异' : '🔍 对比差异',
                          ),
                        ]),
                        h('button', { className: 'pds-btn', onClick: () => handleRollback(targetNodeId, hItem.history_id, hItem.version_num) }, '回滚此快照'),
                      ]),
                      h('div', { style: { fontWeight: 600, fontSize: '12px', marginTop: '6px' } }, hItem.title),
                      h('div', { style: { fontSize: '11px', color: '#64748b', marginTop: '2px' } }, hItem.tldr || '无摘要'),
                      isDiffOpen && hItem.diff
                        ? h(
                            'div',
                            { className: 'pds-diff-box' },
                            hItem.diff.map((d, dIdx) =>
                              h(
                                'span',
                                {
                                  key: dIdx,
                                  className: d.type === 'added' ? 'pds-diff-added' : d.type === 'removed' ? 'pds-diff-removed' : 'pds-diff-unchanged',
                                },
                                (d.type === 'added' ? '+ ' : d.type === 'removed' ? '- ' : '  ') + d.line,
                              ),
                            ),
                          )
                        : null,
                    );
                  }),
                ),
          ),
          // Right: Cold Archive
          h(
            'div',
            { className: 'pds-card' },
            h(
              'div',
              { className: 'pds-card-header' },
              h('div', { className: 'pds-card-title' }, '🧊 冷归档流式打捞中心'),
              h('span', { className: 'pds-badge' }, `${coldItems.length} 条冷数据`),
            ),
            h('div', { style: { fontSize: '12px', color: '#64748b', marginBottom: '12px' } }, '经指数衰减策略归档的沉淀知识，低频且不占用即时检索内存。'),
            coldItems.length === 0
              ? h('div', { style: { textAlign: 'center', color: '#94a3b8', padding: '36px 0', fontSize: '13px' } }, '冷归档库目前没有待唤醒的沉淀数据')
              : h(
                  'div',
                  null,
                  coldItems.map((c) =>
                    h(
                      'div',
                      {
                        key: c.id,
                        style: {
                          padding: '10px 12px',
                          border: '1px solid #eaecf0',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        },
                      },
                      h('div', null, [
                        h('div', { style: { fontWeight: 600, fontSize: '12px' } }, c.title),
                        h('div', { style: { fontSize: '11px', color: '#94a3b8' } }, `归档原因: ${c.reason || '抽屉指数衰减'}`),
                      ]),
                      h('button', { className: 'pds-btn', onClick: () => handleReviveCold(c.id) }, '一键复活唤醒'),
                    ),
                  ),
                ),
          ),
        );
      };

      return h(
        'section',
        { className: 'pds-root', 'aria-label': format(t, 'title') },
        h('style', { key: 'pds-css' }, CSS),
        renderModals(),
        // Header
        h(
          'header',
          { className: 'pds-header' },
          h('div', { className: 'pds-title-wrap' }, [
            h('div', { className: 'pds-title-icon', key: 'icon' }, PanelIcon({ size: 20, active: true })),
            h('div', { key: 'text' }, [
              h('h1', { className: 'pds-title', key: 'title' }, format(t, 'title')),
              h('p', { className: 'pds-subtitle', key: 'sub' }, format(t, 'subtitle')),
            ]),
          ]),
          h('div', { className: 'pds-top-actions' }, [
            h(
              'div',
              { key: 'status', className: `pds-status-pill ${online ? 'online' : ''}` },
              h('span', { className: 'pds-status-dot' }),
              online ? format(t, 'statusOnline') : format(t, 'statusOffline'),
            ),
            h(
              'button',
              {
                key: 'btn-restart',
                className: 'pds-btn',
                onClick: handleRestartDaemon,
                disabled: restarting,
                title: '优雅关闭 SQLite 数据库后重新拉起后台守护进程，防止 Windows 端口占用',
              },
              restarting ? '重启中...' : format(t, 'restartService'),
            ),
            h(
              'button',
              {
                key: 'btn-demo-seed',
                className: 'pds-btn',
                onClick: handleLoadDemoSeed,
                title: '一键写入 5 条架构精品知识节点与图谱连线',
              },
              format(t, 'loadDemoSeed'),
            ),
            h(
              'button',
              { key: 'refresh', className: 'pds-btn', onClick: checkHealth },
              loading ? format(t, 'loading') : format(t, 'refresh'),
            ),
          ]),
        ),
        // Tab Nav
        h(
          'nav',
          { className: 'pds-nav' },
          [
            { id: 'overview', label: format(t, 'tabOverview') },
            { id: 'vfs', label: format(t, 'tabVfs') },
            { id: 'memory', label: format(t, 'tabMemory') },
            { id: 'workflow', label: format(t, 'tabWorkflow') },
            { id: 'timemachine', label: format(t, 'tabTimemachine') },
          ].map((item) =>
            h(
              'button',
              {
                key: item.id,
                className: `pds-nav-item ${tab === item.id ? 'active' : ''}`,
                onClick: () => setTab(item.id),
              },
              item.label,
            ),
          ),
        ),
        // Notice banner
        notice
          ? h('div', { className: 'pds-banner-info', style: { margin: '14px 24px 0' } }, [
              h('span', { key: 'msg' }, notice),
              h('button', { key: 'close', className: 'pds-btn', style: { padding: '2px 8px' }, onClick: () => setNotice('') }, '✕'),
            ])
          : null,
        // Content Area
        h(
          'main',
          { className: 'pds-content' },
          tab === 'overview' && renderOverview(),
          tab === 'vfs' && renderVfs(),
          tab === 'memory' && renderMemory(),
          tab === 'workflow' && renderWorkflow(),
          tab === 'timemachine' && renderTimemachine(),
        ),
      );
    }

    function format(t, key, vars) {
      let text = t(key);
      if (typeof text !== 'string') text = key;
      if (vars !== undefined) {
        for (const name of Object.keys(vars)) {
          text = text.split('{' + name + '}').join(String(vars[name]));
        }
      }
      return text;
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'dsh-system-pedestal: locale');
        const t = ctx.locale.bind(NS);

        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, PedestalPanel),
        );

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 25,
              locale: NS,
              label: () => t('panel'),
            },
            PanelIcon,
          ),
        );
      },
    };
  },
});
