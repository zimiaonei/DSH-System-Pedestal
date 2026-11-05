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
      tabLogs: 'Processes & Logs',
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
      tabLogs: '进程与日志',
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
      '.pds-galaxy-canvas{width:100%;height:520px;background:#fafbfc;border:1px solid #eaecf0;border-radius:10px;display:block;cursor:grab;}',
      '.pds-galaxy-canvas:active{cursor:grabbing;}',
      '.pds-floating-capsule{position:absolute;bottom:14px;right:14px;display:inline-flex;align-items:center;gap:4px;background:#ffffff;padding:4px 6px;border-radius:30px;box-shadow:0 4px 12px rgba(0,0,0,0.08);border:1px solid #e2e8f0;z-index:15;}',
      '.pds-capsule-btn{padding:4px 10px;border-radius:20px;border:none;background:transparent;color:#334155;font-size:12px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:all 100ms ease;}',
      '.pds-capsule-btn:hover{background:#f1f5f9;color:#0f172a;}',
      '.pds-source-tag{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:6px;font-size:11px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;margin-top:6px;}',
      '.pds-source-link{color:#0284c7;text-decoration:none;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:2px;}',
      '.pds-source-link:hover{text-decoration:underline;color:#0369a1;}',
      '.pds-toast-error{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#fef2f2;border:1px solid #f87171;color:#b91c1c;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);z-index:100000;display:flex;align-items:center;gap:8px;}',
      '.pds-log-console{border:1px solid #eaecf0;border-radius:10px;background:#ffffff;overflow:hidden;}',
      '.pds-log-toolbar{padding:10px 14px;background:#fafafa;border-bottom:1px solid #eaecf0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}',
      '.pds-log-item{padding:8px 14px;border-bottom:1px solid #f8fafc;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.5;display:flex;flex-direction:column;gap:3px;}',
      '.pds-log-item:hover{background:#f8fafc;}',
      '.pds-log-row{display:flex;align-items:baseline;gap:8px;}',
      '.pds-log-time{color:#94a3b8;font-size:11px;flex-shrink:0;}',
      '.pds-log-mod{color:#64748b;font-weight:600;padding:1px 6px;border-radius:4px;background:#f1f5f9;font-size:10px;flex-shrink:0;}',
      '.pds-log-msg{color:#1e293b;flex:1 1 auto;word-break:break-all;}',
      '.pds-log-stack{background:#f1f5f9;padding:8px 12px;border-radius:6px;font-size:11px;color:#dc2626;white-space:pre-wrap;overflow-x:auto;margin-top:4px;}',
      '.pds-badge-danger{background:#fee2e2;color:#dc2626;border-color:#fca5a5;padding:1px 5px;border-radius:10px;font-size:10px;margin-left:5px;}',
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
      const galaxyContainerRef = React.useRef(null);

      // Upgrade 1: Galaxy Pan & Zoom & Drag State
      const [galaxyZoom, setGalaxyZoom] = React.useState(1.0);
      const [galaxyPan, setGalaxyPan] = React.useState({ x: 0, y: 0 });
      const [layoutVersion, setLayoutVersion] = React.useState(0);
      const simNodesRef = React.useRef([]);
      const isPanningRef = React.useRef(false);
      const panStartRef = React.useRef({ x: 0, y: 0 });
      const draggedNodeRef = React.useRef(null);

      // Upgrade 2: Selected Node Detail & Red Toast Error Interceptor
      const [selectedNode, setSelectedNode] = React.useState(null);
      const [toastError, setToastError] = React.useState('');

      // Upgrade 3: Process & Logs Center State
      const [logsList, setLogsList] = React.useState([]);
      const [logFilterLevel, setLogFilterLevel] = React.useState('ALL');
      const [logFilterModule, setLogFilterModule] = React.useState('ALL');
      const [logSearchQuery, setLogSearchQuery] = React.useState('');
      const [expandedLogIds, setExpandedLogIds] = React.useState({});
      const [isDarkConsole, setIsDarkConsole] = React.useState(false);

      // Upgrade 4: 按需测试台 State
      const [testResults, setTestResults] = React.useState(null);
      const [testingRunning, setTestingRunning] = React.useState(false);
      const [expandedFailIds, setExpandedFailIds] = React.useState({});

      const showErrorToast = (msg) => {
        setToastError(msg);
        window.setTimeout(() => setToastError(''), 5000);
      };

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
        } else if (tab === 'logs') {
          const q = `/api/sys/logs?level=${logFilterLevel}&module=${logFilterModule}${logSearchQuery ? '&q=' + encodeURIComponent(logSearchQuery) : ''}&limit=200`;
          apiFetch(q).then((res) => setLogsList(res?.logs || []));
        }
      }, [tab, online, searchQuery, nodeTypeFilter, logFilterLevel, logFilterModule, logSearchQuery]);

      React.useEffect(() => {
        reloadData();
      }, [reloadData]);

      // =========================================================================
      // Upgrade 1: Canvas 知识星系物理分辨率自适应、无级缩放平移、单节点拖拽与力导向排斥
      // =========================================================================

      // 初始化与更新力导向节点坐标（斥力半径扩大至 160px ~ 180px，彻底避免挤在一起文字重叠）
      React.useEffect(() => {
        const rawNodes = graphData.nodes && graphData.nodes.length > 0 ? graphData.nodes : nodes;
        if (!rawNodes || rawNodes.length === 0) {
          simNodesRef.current = [];
          return;
        }

        const existingMap = new Map();
        simNodesRef.current.forEach(n => existingMap.set(n.id, n));

        const count = rawNodes.length;
        const idealRadius = Math.max(160, Math.min(260, count * 28));

        const newSimNodes = rawNodes.map((n, i) => {
          const old = existingMap.get(n.id);
          if (old && typeof old.x === 'number') {
            return { ...n, x: old.x, y: old.y, vx: 0, vy: 0, r: 9 + (n.drawer_level || 1) * 2 };
          }
          const angle = (i / Math.max(1, count)) * Math.PI * 2;
          const dist = idealRadius + ((i % 3) - 1) * 35;
          return {
            ...n,
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            vx: 0,
            vy: 0,
            r: 9 + (n.drawer_level || 1) * 2
          };
        });

        // 运行 60 轮迭代预先分散节点，排斥间距 160px
        for (let iter = 0; iter < 60; iter++) {
          for (let i = 0; i < newSimNodes.length; i++) {
            for (let j = i + 1; j < newSimNodes.length; j++) {
              const a = newSimNodes[i];
              const b = newSimNodes[j];
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const d = Math.sqrt(dx * dx + dy * dy) || 1;
              const minDist = 160;
              if (d < minDist) {
                const force = ((minDist - d) / minDist) * 4;
                const fx = (dx / d) * force;
                const fy = (dy / d) * force;
                a.x -= fx;
                a.y -= fy;
                b.x += fx;
                b.y += fy;
              }
            }
          }
        }

        simNodesRef.current = newSimNodes;
      }, [graphData.nodes, nodes, layoutVersion]);

      // 核心渲染循环：自适应 DPR、ResizeObserver、Zoom (0.4x~3.0x) 与 Pan 平移
      React.useEffect(() => {
        if (memoryView !== 'galaxy' || !galaxyCanvasRef.current) return;
        const canvas = galaxyCanvasRef.current;
        const container = galaxyContainerRef.current || canvas.parentElement;
        if (!container) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId = null;

        const renderCanvas = () => {
          const rect = container.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          const displayWidth = Math.max(300, rect.width || 750);
          const displayHeight = Math.max(300, rect.height || 520);

          if (canvas.width !== Math.round(displayWidth * dpr) || canvas.height !== Math.round(displayHeight * dpr)) {
            canvas.width = Math.round(displayWidth * dpr);
            canvas.height = Math.round(displayHeight * dpr);
          }

          // 保持坐标系统与 CSS 像素一致，文字保持 100% 锐利正圆
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          // 清除画布底色
          ctx.fillStyle = '#fafbfc';
          ctx.fillRect(0, 0, displayWidth, displayHeight);

          const centerX = displayWidth / 2 + galaxyPan.x;
          const centerY = displayHeight / 2 + galaxyPan.y;

          // 绘制网格线底纹（随 Pan 与 Zoom 优雅联动）
          ctx.save();
          ctx.strokeStyle = '#f1f5f9';
          ctx.lineWidth = 1;
          const gridSize = 32 * galaxyZoom;
          const startX = ((galaxyPan.x % gridSize) + displayWidth / 2) % gridSize;
          for (let x = startX; x < displayWidth; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, displayHeight); ctx.stroke();
          }
          const startY = ((galaxyPan.y % gridSize) + displayHeight / 2) % gridSize;
          for (let y = startY; y < displayHeight; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(displayWidth, y); ctx.stroke();
          }
          ctx.restore();

          // 节点与边映射
          const simNodes = simNodesRef.current || [];
          const nodePosMap = new Map();
          simNodes.forEach(n => {
            nodePosMap.set(n.id, {
              ...n,
              screenX: centerX + n.x * galaxyZoom,
              screenY: centerY + n.y * galaxyZoom,
              screenR: Math.max(4, n.r * galaxyZoom)
            });
          });

          // 绘制边 (Edges)
          const edges = graphData.edges || [];
          edges.forEach((e) => {
            const src = nodePosMap.get(e.source_id);
            const tgt = nodePosMap.get(e.target_id);
            if (src && tgt) {
              ctx.save();
              ctx.strokeStyle = '#94a3b8';
              ctx.lineWidth = Math.max(1, Math.min(3, (e.weight || 1) * galaxyZoom));
              ctx.beginPath();
              ctx.moveTo(src.screenX, src.screenY);
              ctx.lineTo(tgt.screenX, tgt.screenY);
              ctx.stroke();

              // 边关系名称
              if (e.relation && galaxyZoom >= 0.6) {
                const midX = (src.screenX + tgt.screenX) / 2;
                const midY = (src.screenY + tgt.screenY) / 2;
                ctx.font = `${Math.round(10 * Math.min(1.2, galaxyZoom))}px sans-serif`;
                ctx.fillStyle = '#64748b';
                ctx.textAlign = 'center';
                ctx.fillText(e.relation, midX, midY - 4);
              }
              ctx.restore();
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

          // 绘制节点 (Nodes)
          simNodes.forEach((n) => {
            const pos = nodePosMap.get(n.id);
            if (!pos) return;
            const baseColor = colorMap[n.node_type] || '#475569';
            const isHoveredOrDragged = draggedNodeRef.current?.id === n.id;

            ctx.save();

            // 外层光晕
            ctx.beginPath();
            ctx.arc(pos.screenX, pos.screenY, pos.screenR + (isHoveredOrDragged ? 8 : 4) * galaxyZoom, 0, Math.PI * 2);
            ctx.fillStyle = baseColor + '22';
            ctx.fill();

            // 核心正圆
            ctx.beginPath();
            ctx.arc(pos.screenX, pos.screenY, pos.screenR, 0, Math.PI * 2);
            ctx.fillStyle = baseColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1.5, 2 * galaxyZoom);
            ctx.stroke();

            // 节点标题文本（高清不发虚，防止重叠截断）
            if (galaxyZoom >= 0.5) {
              const fontSize = Math.max(10, Math.round(11 * Math.min(1.4, galaxyZoom)));
              ctx.font = `600 ${fontSize}px -apple-system, "Segoe UI", sans-serif`;
              ctx.fillStyle = '#0f172a';
              ctx.textAlign = 'center';
              const label = n.title && n.title.length > 18 ? n.title.slice(0, 18) + '...' : n.title || n.id;
              ctx.fillText(label, pos.screenX, pos.screenY + pos.screenR + fontSize + 4);

              // 类型与等级角标
              const subFontSize = Math.max(9, Math.round(9 * Math.min(1.3, galaxyZoom)));
              ctx.font = `${subFontSize}px monospace`;
              ctx.fillStyle = '#64748b';
              ctx.fillText(`${(n.node_type || 'tech').toUpperCase()} · Lv.${n.drawer_level || 1}`, pos.screenX, pos.screenY + pos.screenR + fontSize + subFontSize + 8);
            }

            ctx.restore();
          });
        };

        renderCanvas();

        // 挂载 ResizeObserver 响应窗口拉伸变形
        let ro = null;
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(() => {
            renderCanvas();
          });
          ro.observe(container);
        }

        // 交互逻辑：鼠标滚轮以光标为中心无级缩放 (0.4x ~ 3.0x)
        const handleWheel = (e) => {
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const currentZoom = galaxyZoom;
          const delta = e.deltaY < 0 ? 1.15 : 0.87;
          const newZoom = Math.max(0.4, Math.min(3.0, currentZoom * delta));

          // 以鼠标所在世界坐标为中心放大/缩小
          const centerX = rect.width / 2 + galaxyPan.x;
          const centerY = rect.height / 2 + galaxyPan.y;
          const worldX = (mouseX - centerX) / currentZoom;
          const worldY = (mouseY - centerY) / currentZoom;

          const newCenterX = mouseX - worldX * newZoom;
          const newCenterY = mouseY - worldY * newZoom;

          setGalaxyZoom(newZoom);
          setGalaxyPan({
            x: newCenterX - rect.width / 2,
            y: newCenterY - rect.height / 2
          });
        };

        // 交互逻辑：按住鼠标拖拽平移画布 / 拖拽单个节点
        const handleMouseDown = (e) => {
          if (e.button !== 0) return;
          const rect = canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const centerX = rect.width / 2 + galaxyPan.x;
          const centerY = rect.height / 2 + galaxyPan.y;

          // 检查是否命中某个节点
          let hitNode = null;
          const simNodes = simNodesRef.current || [];
          for (let i = simNodes.length - 1; i >= 0; i--) {
            const n = simNodes[i];
            const sx = centerX + n.x * galaxyZoom;
            const sy = centerY + n.y * galaxyZoom;
            const sr = (n.r + 8) * galaxyZoom;
            const dist = Math.sqrt((mouseX - sx) ** 2 + (mouseY - sy) ** 2);
            if (dist <= sr) {
              hitNode = n;
              break;
            }
          }

          if (hitNode) {
            draggedNodeRef.current = hitNode;
            panStartRef.current = { x: mouseX, y: mouseY, isNode: true, hasMoved: false };
          } else {
            isPanningRef.current = true;
            panStartRef.current = { x: mouseX - galaxyPan.x, y: mouseY - galaxyPan.y, isNode: false, hasMoved: false };
          }
        };

        const handleMouseMove = (e) => {
          const rect = canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          if (draggedNodeRef.current) {
            panStartRef.current.hasMoved = true;
            const centerX = rect.width / 2 + galaxyPan.x;
            const centerY = rect.height / 2 + galaxyPan.y;
            draggedNodeRef.current.x = (mouseX - centerX) / galaxyZoom;
            draggedNodeRef.current.y = (mouseY - centerY) / galaxyZoom;
            renderCanvas();
          } else if (isPanningRef.current) {
            panStartRef.current.hasMoved = true;
            setGalaxyPan({
              x: mouseX - panStartRef.current.x,
              y: mouseY - panStartRef.current.y
            });
          }
        };

        const handleMouseUp = (e) => {
          if (draggedNodeRef.current && !panStartRef.current?.hasMoved) {
            // 点击节点弹出详情抽屉/卡片
            setSelectedNode(draggedNodeRef.current);
          }
          draggedNodeRef.current = null;
          isPanningRef.current = false;
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
          if (ro) ro.disconnect();
          canvas.removeEventListener('wheel', handleWheel);
          canvas.removeEventListener('mousedown', handleMouseDown);
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
        };
      }, [memoryView, galaxyZoom, galaxyPan, layoutVersion]);

      // --- Actions ---

      // Upgrade 1: Galaxy 缩放、平移与力导向排斥控制
      const handleZoomIn = () => setGalaxyZoom(z => Math.min(3.0, +(z * 1.25).toFixed(2)));
      const handleZoomOut = () => setGalaxyZoom(z => Math.max(0.4, +(z * 0.8).toFixed(2)));
      const handleFitGalaxy = () => {
        setGalaxyZoom(1.0);
        setGalaxyPan({ x: 0, y: 0 });
      };
      const handleRelayoutGalaxy = () => {
        simNodesRef.current = [];
        setLayoutVersion(v => v + 1);
        handleFitGalaxy();
      };

      // Upgrade 2: 原对话溯源跳转 & 已删除对话报错拦截
      const handleJumpToSession = async (node) => {
        const targetSessionId = node?.source_session_id;
        const targetTitle = node?.source_session_title || node?.title || '未命名对话';

        // 1. 若早期未记录 source_session_id 的历史节点，尝试按关键词匹配
        if (!targetSessionId) {
          showErrorToast(`❌ 跳转失败：知识节点「${node?.title || node?.id}」未绑定来源对话 ID！`);
          return;
        }

        // 2. 先请求 /api/sys/verify-session 校验该对话是否存活
        try {
          const res = await apiFetch(`/api/sys/verify-session?sessionId=${encodeURIComponent(targetSessionId)}`);
          if (!res || !res.exists) {
            // 原对话已被删除或不存在：弹出醒目红色错误 Toast
            const reason = res?.reason || `原对话「${targetTitle} (ID: ${targetSessionId})」已被删除或归档移除，无法定位到原始上下文！`;
            showErrorToast(`❌ 跳转失败：${reason}`);
            return;
          }

          // 3. 原对话存在：激活左侧工作区或触发 DSH 内部路由
          showNotice(`🚀 正在跳转定位至原对话「${res.sessionTitle || targetTitle}」...`);

          // 尝试通过 DOM 触发左侧会话选择
          let activated = false;
          try {
            const cleanId = String(targetSessionId).replace(/^session-/, '');
            const candidates = document.querySelectorAll('[data-session-id], [data-id], .session-item, a[href*="session"]');
            for (const el of candidates) {
              const elId = el.getAttribute('data-session-id') || el.getAttribute('data-id') || el.getAttribute('href') || '';
              if (elId.includes(cleanId)) {
                el.click();
                activated = true;
                break;
              }
            }
          } catch {}

          // 触发系统通用会话切换事件
          try {
            window.dispatchEvent(new CustomEvent('dsh:switch-session', {
              detail: { sessionId: res.sessionId, sessionTitle: res.sessionTitle }
            }));
          } catch {}

          if (!activated) {
            showNotice(`✅ 原对话「${res.sessionTitle || targetTitle}」已校验在线 (ID: ${res.sessionId})`);
          }
        } catch (err) {
          showErrorToast(`❌ 校验会话失败: ${err.message}`);
        }
      };

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
        if (online) {
          showNotice('微内核守护进程正在平滑重启，正在优雅关闭数据库并重新建立连接...');
          try {
            await apiFetch('/api/sys/restart', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ version: '4.0.0' }),
            });
          } catch {}
        } else {
          showNotice('微内核守护进程处于待机状态，正在由主进程后台守护器（Watchdog）自动拉起并重联...');
        }

        let attempts = 0;
        const interval = window.setInterval(async () => {
          attempts++;
          try {
            const res = await window.fetch(`${API_BASE}/api/sys/overview`);
            if (res.ok) {
              window.clearInterval(interval);
              setRestarting(false);
              showNotice('✅ 微内核守护进程已成功激活 (v4.0.0)，系统状态已重联！');
              checkHealth();
              reloadData();
            }
          } catch {}
          if (attempts >= 30) {
            window.clearInterval(interval);
            setRestarting(false);
            checkHealth();
          }
        }, 500);
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
          // 4. 醒目红色错误提示 Toast / 拦截警告框 (Upgrade 2)
          toastError
            ? h(
                'div',
                { className: 'pds-toast-error' },
                [
                  h('span', { key: 'msg' }, toastError),
                  h('button', { key: 'close', className: 'pds-btn', style: { padding: '2px 6px', border: 'none', background: 'transparent', color: '#b91c1c' }, onClick: () => setToastError('') }, '✕')
                ]
              )
            : null,
          // 5. 知识节点详情抽屉 / 溯源卡片 Modal (Upgrade 2)
          selectedNode
            ? h(
                'div',
                { className: 'pds-modal-mask', onClick: () => setSelectedNode(null) },
                h(
                  'div',
                  { className: 'pds-modal', style: { maxWidth: '640px' }, onClick: (e) => e.stopPropagation() },
                  h('div', { className: 'pds-modal-title' }, [
                    h('div', { key: 't', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                      h('span', { className: 'pds-badge sky' }, (selectedNode.node_type || 'tech').toUpperCase()),
                      h('span', { className: 'pds-badge emerald' }, 'Lv.' + (selectedNode.drawer_level || 1)),
                      h('span', { style: { fontSize: '15px', fontWeight: 600 } }, selectedNode.title),
                    ]),
                    h('button', { key: 'c', className: 'pds-btn', style: { padding: '2px 8px' }, onClick: () => setSelectedNode(null) }, '✕'),
                  ]),
                  // 来源对话绑定展示区 (Upgrade 2)
                  h('div', {
                    style: {
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }
                  }, [
                    h('div', { key: 'info', style: { fontSize: '12px', color: '#475569' } }, [
                      h('span', { style: { fontWeight: 600 } }, '💬 来源对话：'),
                      h('span', { style: { color: selectedNode.source_session_title ? '#0f172a' : '#94a3b8' } },
                        selectedNode.source_session_title || (selectedNode.source_session_id ? '对话 ' + selectedNode.source_session_id.slice(0, 8) : '未绑定对话')
                      ),
                      selectedNode.source_session_id
                        ? h('span', { style: { marginLeft: '6px', fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' } }, `(${selectedNode.source_session_id})`)
                        : null
                    ]),
                    h('button', {
                      key: 'jump-btn',
                      className: 'pds-btn pds-btn-primary',
                      style: { fontSize: '11px', padding: '4px 10px' },
                      onClick: () => handleJumpToSession(selectedNode),
                      title: '校验来源对话存活状态并跳转'
                    }, '↗ 跳转到原对话')
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '核心摘要 (TL;DR)'),
                    h('div', { style: { fontSize: '13px', color: '#334155', lineHeight: 1.6 } }, selectedNode.tldr || '暂无摘要'),
                  ]),
                  h('div', { className: 'pds-form-group' }, [
                    h('label', { className: 'pds-form-label' }, '完整正文内容'),
                    h('div', {
                      style: {
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '12px',
                        fontFamily: 'ui-monospace,SFMono-Regular,Consolas,monospace',
                        color: '#1e293b',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6
                      }
                    }, selectedNode.full_content || selectedNode.tldr || '暂无正文'),
                  ]),
                  h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '14px' } }, [
                    h('span', { style: { fontSize: '11px', color: '#94a3b8' } }, `目录: ${selectedNode.dir_path || '/'} · 置信度: ${Math.round((selectedNode.confidence || 0.8) * 100)}%`),
                    h('button', { className: 'pds-btn', onClick: () => setSelectedNode(null) }, '关闭详情'),
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
                  { ref: galaxyContainerRef, style: { position: 'relative', marginTop: '10px', width: '100%', minHeight: '520px' } },
                  h('canvas', { ref: galaxyCanvasRef, className: 'pds-galaxy-canvas' }),
                  // 底部图例
                  h(
                    'div',
                    {
                      style: {
                        position: 'absolute',
                        bottom: '14px',
                        left: '14px',
                        background: 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(4px)',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        border: '1px solid #e2e8f0',
                        color: '#64748b',
                        display: 'flex',
                        gap: '12px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        zIndex: 10,
                      },
                    },
                    [
                      h('span', { key: 'p', style: { color: '#0284c7', fontWeight: 600 } }, '● Project'),
                      h('span', { key: 't', style: { color: '#7c3aed', fontWeight: 600 } }, '● Tech'),
                      h('span', { key: 'i', style: { color: '#e11d48', fontWeight: 600 } }, '● Issue'),
                      h('span', { key: 's', style: { color: '#059669', fontWeight: 600 } }, '● Solution'),
                      h('span', { key: 'a', style: { color: '#4f46e5', fontWeight: 600 } }, '● Pattern'),
                    ],
                  ),
                  // 右下角极简纯白悬浮控制胶囊 (Upgrade 1)
                  h(
                    'div',
                    { className: 'pds-floating-capsule' },
                    [
                      h('button', { key: 'in', className: 'pds-capsule-btn', onClick: handleZoomIn, title: '放大画布' }, '➕ 放大'),
                      h('button', { key: 'out', className: 'pds-capsule-btn', onClick: handleZoomOut, title: '缩小画布' }, '➖ 缩小'),
                      h('button', { key: 'fit', className: 'pds-capsule-btn', onClick: handleFitGalaxy, title: '居中并自适应' }, '🎯 居中自适应 Fit'),
                      h('button', { key: 're', className: 'pds-capsule-btn', onClick: handleRelayoutGalaxy, title: '重新运行力导向排斥布局' }, '🔄 重新布局'),
                    ],
                  ),
                )
              : h(
                  'div',
                  { className: 'pds-node-grid' },
                  nodes.map((n) =>
                    h(
                      'div',
                      { key: n.id, className: 'pds-node-card', style: { cursor: 'pointer' }, onClick: () => setSelectedNode(n) },
                      h('div', null, [
                        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' } }, [
                          h('span', { className: 'pds-badge sky' }, (n.node_type || 'tech').toUpperCase()),
                          h('span', { className: 'pds-badge emerald' }, 'Lv.' + (n.drawer_level || 1)),
                        ]),
                        h('div', { style: { fontWeight: 600, fontSize: '13px', color: '#0f172a', marginBottom: '4px' } }, n.title),
                        h('div', { style: { fontSize: '12px', color: '#64748b', lineHeight: 1.5, maxHeight: '42px', overflow: 'hidden' } }, n.tldr || '暂无摘要'),
                        // 来源对话展示与跳转 (Upgrade 2)
                        h('div', {
                          className: 'pds-source-tag',
                          onClick: (e) => { e.stopPropagation(); },
                          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }
                        }, [
                          h('span', {
                            key: 'txt',
                            style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' },
                            title: n.source_session_title || n.source_session_id || '未绑定对话'
                          }, '💬 来源：' + (n.source_session_title || (n.source_session_id ? '对话 ' + n.source_session_id.slice(0, 8) : '未绑定对话'))),
                          h('span', {
                            key: 'link',
                            className: 'pds-source-link',
                            onClick: () => handleJumpToSession(n),
                            title: '校验并跳转到原对话'
                          }, '↗ 跳转')
                        ]),
                      ]),
                      h('div', { style: { borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
                        h('span', { style: { fontSize: '11px', color: '#94a3b8' } }, '置信度: ' + Math.round((n.confidence || 0.8) * 100) + '%'),
                        h('div', { style: { display: 'flex', gap: '4px' }, onClick: (e) => e.stopPropagation() }, [
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

      // =========================================================================
      // Upgrade 3: 进程与日志中心独立标签页 (可视化监控与错误诊断)
      // =========================================================================
      const renderLogs = () => {
        const workers = overview?.workerTelemetry || {};
        const mem = overview?.memoryUsage || {};
        const sqlite = overview?.sqliteFiles || {};
        const plugins = overview?.plugins || [];

        // 运行按需测试执行器
        const handleRunOnDemandTests = async (suite = 'all') => {
          if (testingRunning) return;
          setTestingRunning(true);
          const suiteNames = {
            all: '全部 15 项测试',
            whitebox: '白盒测试',
            blackbox: '黑盒测试',
            greybox: '灰盒测试',
            regression: '专项回归'
          };
          showNotice(`🚀 正在按需启动「${suiteNames[suite] || suite}」自动化测试...`);
          try {
            const res = await apiFetch('/api/sys/tests/run', {
              method: 'POST',
              body: { suites: [suite] }
            });
            if (res && res.results) {
              setTestResults(res);
              if (res.failed > 0) {
                showErrorToast(`⚠️ 测试完成: ${res.passed} 项通过，${res.failed} 项失败！请在下方展开排查。`);
                // 联动下方日志控制台切换至 ERROR 并检索 TestRunner
                setLogFilterLevel('ERROR');
                setLogFilterModule('ALL');
              } else {
                showNotice(`🎉 恭喜！${res.passed}/${res.total} 项测试全部 PASS！总耗时 ${res.durationMs}ms`);
              }
            } else {
              showErrorToast('测试运行失败: ' + (res?.error || '未知网关错误'));
            }
          } catch (err) {
            showErrorToast('测试请求异常: ' + err.message);
          } finally {
            setTestingRunning(false);
            reloadData();
          }
        };

        // 复制错误诊断报告
        const handleCopyDiagnosticReport = () => {
          const report = {
            generatedAt: new Date().toISOString(),
            overview: {
              pid: overview?.pid,
              uptime: overview?.uptime,
              port: overview?.port || 18765,
              watchdogHeartbeat: overview?.watchdogHeartbeat,
              memoryUsage: overview?.memoryUsage,
              sqliteFiles: overview?.sqliteFiles,
              workerTelemetry: overview?.workerTelemetry,
            },
            plugins: plugins.map(p => ({
              id: p.id,
              state: p.state,
              version: p.version,
              toolsCount: p.toolsCount,
              apisCount: p.apisCount,
              error: p.errorMsg
            })),
            recentErrors: logsList.filter(l => l.level === 'ERROR').slice(-20)
          };

          const text = JSON.stringify(report, null, 2);
          if (window.navigator?.clipboard) {
            window.navigator.clipboard.writeText(text);
            showNotice('📋 系统诊断与错误全量报告已成功复制到剪贴板！');
          } else {
            showNotice('已生成诊断报告 (剪贴板不可用)');
          }
        };

        const handleClearLogs = async () => {
          const res = await apiFetch('/api/sys/logs/clear', { method: 'POST' });
          if (res?.success) {
            showNotice('🧹 系统运行日志与诊断流已清空！');
            reloadData();
            checkHealth();
          } else {
            showNotice('清空日志失败: ' + (res?.error || '未知错误'));
          }
        };

        return h(
          'div',
          null,
          // 上半区：【进程与子系统健康可视化面板】
          h(
            'div',
            { className: 'pds-grid-3', style: { marginBottom: '16px' } },
            // 卡片 1: 守护进程状态
            h(
              'div',
              { className: 'pds-metric', style: { background: '#ffffff', border: '1px solid #eaecf0', borderRadius: '12px', padding: '16px' } },
              h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
                h('div', { className: 'pds-metric-label' }, '守护进程 (Daemon)'),
                h('span', { className: `pds-badge ${online ? 'emerald' : 'amber'}` }, online ? '● 运行中' : '● 待机'),
              ]),
              h('div', { className: 'pds-metric-value', style: { fontSize: '18px', marginTop: '8px', fontFamily: 'monospace' } }, `PID: ${overview?.pid || '-'}`),
              h('div', { style: { fontSize: '12px', color: '#64748b', marginTop: '6px' } }, [
                h('div', null, `网络端口: 127.0.0.1:${overview?.port || 18765}`),
                h('div', null, `运行时长: ${Math.floor((overview?.uptime || 0) / 60)} 分钟 (${Math.round(overview?.uptime || 0)}s)`),
                h('div', null, `保活心跳: ${overview?.watchdogHeartbeat || 'NORMAL'}`),
              ]),
            ),
            // 卡片 2: 内存与 SQLite 存储
            h(
              'div',
              { className: 'pds-metric', style: { background: '#ffffff', border: '1px solid #eaecf0', borderRadius: '12px', padding: '16px' } },
              h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
                h('div', { className: 'pds-metric-label' }, '内存与数据库引擎'),
                h('span', { className: 'pds-badge sky' }, 'SQLite WAL'),
              ]),
              h('div', { className: 'pds-metric-value', style: { fontSize: '18px', marginTop: '8px' } }, `RSS: ${Math.round((mem.rss || 0) / 1024 / 1024)} MB`),
              h('div', { style: { fontSize: '12px', color: '#64748b', marginTop: '6px' } }, [
                h('div', null, `堆内存: ${Math.round((mem.heapUsed || 0) / 1024 / 1024)} MB / ${Math.round((mem.heapTotal || 0) / 1024 / 1024)} MB`),
                h('div', null, `主库文件: ${sqlite.dbFormatted || '0 KB'}`),
                h('div', null, `WAL 日志: ${sqlite.walFormatted || '0 KB'} (读写无锁并发)`),
              ]),
            ),
            // 卡片 3: Worker 算力池
            h(
              'div',
              { className: 'pds-metric', style: { background: '#ffffff', border: '1px solid #eaecf0', borderRadius: '12px', padding: '16px' } },
              h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
                h('div', { className: 'pds-metric-label' }, 'Worker 多线程算力池'),
                h('span', { className: 'pds-badge purple' }, `${workers.poolSize || 4} 线程`),
              ]),
              h('div', { className: 'pds-metric-value', style: { fontSize: '18px', marginTop: '8px' } }, `${workers.busyWorkers || 0} 忙碌 / ${workers.idleWorkers || 4} 空闲`),
              h('div', { style: { fontSize: '12px', color: '#64748b', marginTop: '6px' } }, [
                h('div', null, `三级队列: P0(${workers.queueLengths?.P0 || 0}) · P1(${workers.queueLengths?.P1 || 0}) · P2(${workers.queueLengths?.P2 || 0})`),
                h('div', null, `任务累计: 完成 ${workers.totalCompleted || 0} / 失败 ${workers.totalFailed || 0}`),
                h('div', null, `平均耗时: ${workers.averageExecutionTimeMs || 0} ms`),
              ]),
            ),
          ),
          // 插件状态矩阵卡片
          h(
            'div',
            { className: 'pds-card', style: { marginBottom: '16px' } },
            h('div', { className: 'pds-card-title', style: { marginBottom: '12px' } }, '🧩 5 大热插拔插件运行状态矩阵'),
            h(
              'table',
              { className: 'pds-table' },
              h('thead', null, h('tr', null, [
                h('th', null, '插件 ID / 标识'),
                h('th', null, '插件名称'),
                h('th', null, '版本'),
                h('th', null, '运行状态'),
                h('th', null, '挂载能力 (Tools / APIs)'),
                h('th', null, '故障自检 / 异常堆栈'),
              ])),
              h('tbody', null, plugins.map((p) => {
                const isError = p.state === 'ERROR' || !!p.errorMsg;
                return h('tr', { key: p.id }, [
                  h('td', { style: { fontWeight: 600, fontFamily: 'monospace' } }, p.id),
                  h('td', null, p.name),
                  h('td', null, h('span', { className: 'pds-badge' }, 'v' + (p.version || '4.0.0'))),
                  h('td', null, h('span', { className: `pds-badge ${isError ? 'rose' : 'emerald'}` }, p.state || 'ACTIVE')),
                  h('td', { style: { color: '#64748b' } }, `${p.toolsCount || 0} Tools · ${p.apisCount || 0} APIs`),
                  h('td', { style: { color: isError ? '#e11d48' : '#10b981', fontSize: '11px', fontFamily: isError ? 'monospace' : 'inherit' } },
                    p.errorMsg || '正常无异常'
                  ),
                ]);
              })),
            ),
          ),
          // 中区：【🧪 按需黑白盒与专项回归测试台】
          h(
            'div',
            { className: 'pds-card', style: { marginBottom: '16px' } },
            // 头部标题与统计
            h(
              'div',
              { className: 'pds-card-header', style: { paddingBottom: '12px', borderBottom: '1px solid #eaecf0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
              h('div', null, [
                h('div', { className: 'pds-card-title', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                  h('span', null, '🧪 按需黑白盒测试台'),
                  h('span', { className: 'pds-badge', style: { background: '#f1f5f9', color: '#475569', fontSize: '11px' } }, '15项全自动化用例'),
                  testResults ? h('span', { className: `pds-badge ${testResults.failed > 0 ? 'rose' : 'emerald'}`, style: { fontSize: '11px' } }, `${testResults.passed}/${testResults.total} 通过 (${testResults.durationMs}ms)`) : null,
                ]),
                h('div', { style: { fontSize: '12px', color: '#64748b', marginTop: '4px' } }, '支持一键独立运行白盒机制、黑盒契约安全红线、灰盒并发时空与专项回归测试，测试数据 100% 自动回滚。'),
              ]),
              h('div', { style: { display: 'flex', gap: '8px' } }, [
                testResults ? h('button', { className: 'pds-btn', style: { fontSize: '11px', padding: '4px 8px' }, onClick: () => setTestResults(null) }, '重置面板') : null,
              ]),
            ),
            // 5 大快捷按需执行按钮工具条
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' } },
              [
                h('button', {
                  className: 'pds-btn pds-btn-primary',
                  disabled: testingRunning,
                  style: { padding: '6px 14px', fontSize: '12px', fontWeight: 600 },
                  onClick: () => handleRunOnDemandTests('all')
                }, testingRunning ? '⏳ 测试执行中...' : '▶️ 运行全部测试 (15项)'),

                h('button', {
                  className: 'pds-btn',
                  disabled: testingRunning,
                  style: { padding: '6px 12px', fontSize: '12px', background: '#ffffff', color: '#334155' },
                  onClick: () => handleRunOnDemandTests('whitebox')
                }, '⚪ 仅跑白盒测试 (内部算法/内存回收)'),

                h('button', {
                  className: 'pds-btn',
                  disabled: testingRunning,
                  style: { padding: '6px 12px', fontSize: '12px', background: '#ffffff', color: '#334155' },
                  onClick: () => handleRunOnDemandTests('blackbox')
                }, '⚫ 仅跑黑盒测试 (API边界/安全红线)'),

                h('button', {
                  className: 'pds-btn',
                  disabled: testingRunning,
                  style: { padding: '6px 12px', fontSize: '12px', background: '#ffffff', color: '#334155' },
                  onClick: () => handleRunOnDemandTests('greybox')
                }, '🔘 仅跑灰盒测试 (多线程/跨进程/时光机)'),

                h('button', {
                  className: 'pds-btn',
                  disabled: testingRunning,
                  style: { padding: '6px 12px', fontSize: '12px', background: '#ffffff', color: '#334155' },
                  onClick: () => handleRunOnDemandTests('regression')
                }, '🎯 仅跑专项回归 (原对话跳转/已删会话报错)'),
              ]
            ),
            // 测试结果展示区（未运行前展示优雅引导，运行后展示详细报告表格）
            !testResults
              ? h(
                  'div',
                  { style: { textAlign: 'center', color: '#94a3b8', padding: '32px 0', fontSize: '12px' } },
                  '点击上方任意按需按钮即可实时调度并可视化运行测试用例。'
                )
              : h(
                  'div',
                  { style: { marginTop: '12px' } },
                  h(
                    'table',
                    { className: 'pds-table' },
                    h('thead', null, h('tr', null, [
                      h('th', { style: { width: '90px' } }, '测试编号'),
                      h('th', { style: { width: '110px' } }, '分类标签'),
                      h('th', null, '测试名称 / 契约指标'),
                      h('th', { style: { width: '90px', textAlign: 'right' } }, '耗时 ms'),
                      h('th', { style: { width: '100px', textAlign: 'center' } }, '状态徽章'),
                    ])),
                    h(
                      'tbody',
                      null,
                      testResults.results.map((r) => {
                        const isPass = r.status === 'PASS';
                        const isExpanded = !!expandedFailIds[r.id];
                        const suiteTagMap = {
                          whitebox: { label: '⚪ 白盒机制', cls: 'amber' },
                          blackbox: { label: '⚫ 黑盒边界', cls: 'sky' },
                          greybox: { label: '🔘 灰盒并发', cls: 'emerald' },
                          regression: { label: '🎯 专项回归', cls: 'rose' }
                        };
                        const tag = suiteTagMap[r.suite] || { label: r.suite, cls: 'sky' };

                        return [
                          h(
                            'tr',
                            {
                              key: r.id,
                              style: { cursor: !isPass ? 'pointer' : 'default', background: !isPass ? '#fff1f2' : 'transparent' },
                              onClick: () => {
                                if (!isPass) {
                                  setExpandedFailIds(prev => ({ ...prev, [r.id]: !prev[r.id] }));
                                  // 联动下方日志控制台聚焦错误
                                  setLogFilterLevel('ERROR');
                                  setLogSearchQuery(r.id);
                                }
                              }
                            },
                            [
                              h('td', { style: { fontWeight: 600, fontFamily: 'monospace' } }, r.id),
                              h('td', null, h('span', { className: `pds-badge ${tag.cls}`, style: { fontSize: '10px' } }, tag.label)),
                              h('td', null, [
                                h('div', { style: { fontWeight: 500, fontSize: '12px', color: '#0f172a' } }, r.name),
                                h('div', { style: { fontSize: '11px', color: '#64748b', marginTop: '2px' } }, r.assertionDetail),
                              ]),
                              h('td', { style: { textAlign: 'right', fontFamily: 'monospace', fontSize: '12px', color: '#64748b' } }, `${r.durationMs} ms`),
                              h('td', { style: { textAlign: 'center' } }, [
                                h('span', { className: `pds-badge ${isPass ? 'emerald' : 'rose'}`, style: { fontWeight: 700 } }, isPass ? '🟢 PASS' : '🔴 FAIL'),
                                !isPass ? h('span', { style: { fontSize: '10px', color: '#e11d48', display: 'block', marginTop: '2px' } }, isExpanded ? '收起 ▴' : '展开排查 ▾') : null,
                              ]),
                            ]
                          ),
                          // 失败断言展开抽屉及代码堆栈联动
                          !isPass && isExpanded
                            ? h(
                                'tr',
                                { key: r.id + '_detail' },
                                h(
                                  'td',
                                  { colSpan: 5, style: { background: '#fff5f5', borderBottom: '1px solid #fecdd3', padding: '12px 16px' } },
                                  [
                                    h('div', { style: { fontWeight: 600, color: '#e11d48', fontSize: '12px', marginBottom: '4px' } }, '💥 断言失败详情:'),
                                    h('div', { style: { fontFamily: 'monospace', fontSize: '11px', color: '#9f1239', whiteSpace: 'pre-wrap', background: '#ffe4e6', padding: '8px', borderRadius: '6px' } }, r.assertionDetail),
                                    r.errorStack
                                      ? h('div', { style: { marginTop: '8px' } }, [
                                          h('div', { style: { fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px' } }, '调用栈排查追踪:'),
                                          h('pre', { style: { fontFamily: 'monospace', fontSize: '10px', color: '#881337', background: '#ffffff', border: '1px solid #fecdd3', padding: '8px', borderRadius: '6px', maxHeight: '160px', overflowY: 'auto' } }, r.errorStack),
                                        ])
                                      : null,
                                  ]
                                )
                              )
                            : null,
                        ];
                      })
                    )
                  )
                ),
          ),
          // 下半区：【全量日志与错误诊断流控制台】
          h(
            'div',
            { className: 'pds-log-console', style: { background: isDarkConsole ? '#0f172a' : '#ffffff' } },
            h('div', { className: 'pds-log-toolbar', style: { background: isDarkConsole ? '#1e293b' : '#fafafa', borderBottom: isDarkConsole ? '1px solid #334155' : '1px solid #eaecf0' } }, [
              // 左侧：过滤胶囊
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } }, [
                h('span', { style: { fontSize: '12px', fontWeight: 600, color: isDarkConsole ? '#cbd5e1' : '#475569' } }, '日志级别:'),
                [
                  { id: 'ALL', label: '全部' },
                  { id: 'INFO', label: '🟢 INFO' },
                  { id: 'WARN', label: '🟡 WARN' },
                  { id: 'ERROR', label: '🔴 ERROR / 异常故障' },
                ].map((lvl) =>
                  h('button', {
                    key: lvl.id,
                    className: 'pds-btn',
                    style: {
                      padding: '3px 9px',
                      fontSize: '11px',
                      background: logFilterLevel === lvl.id ? (lvl.id === 'ERROR' ? '#ef4444' : '#0f172a') : (isDarkConsole ? '#0f172a' : '#ffffff'),
                      color: logFilterLevel === lvl.id ? '#ffffff' : (isDarkConsole ? '#cbd5e1' : '#334155'),
                      borderColor: logFilterLevel === lvl.id ? 'transparent' : (isDarkConsole ? '#334155' : '#e2e8f0'),
                    },
                    onClick: () => setLogFilterLevel(lvl.id),
                  }, lvl.label),
                ),
                h('select', {
                  className: 'pds-select',
                  style: {
                    padding: '3px 8px',
                    fontSize: '11px',
                    background: isDarkConsole ? '#0f172a' : '#ffffff',
                    color: isDarkConsole ? '#cbd5e1' : '#0f172a',
                    borderColor: isDarkConsole ? '#334155' : '#d0d5dd'
                  },
                  value: logFilterModule,
                  onChange: (e) => setLogFilterModule(e.target.value),
                }, [
                  h('option', { value: 'ALL' }, '全部模块'),
                  h('option', { value: 'Kernel' }, 'Kernel 内核'),
                  h('option', { value: 'Daemon' }, 'Daemon 守护'),
                  h('option', { value: 'SQLite' }, 'SQLite 存储'),
                  h('option', { value: 'Worker' }, 'Worker 线程池'),
                  h('option', { value: 'GUI-API' }, 'GUI 网关 API'),
                  h('option', { value: 'EventBus' }, 'EventBus 总线'),
                  h('option', { value: 'memory-engine' }, 'memory-engine 插件'),
                  h('option', { value: 'memory-vfs' }, 'memory-vfs 插件'),
                ]),
                h('input', {
                  className: 'pds-input',
                  style: {
                    padding: '3px 8px',
                    fontSize: '11px',
                    width: '160px',
                    background: isDarkConsole ? '#0f172a' : '#ffffff',
                    color: isDarkConsole ? '#cbd5e1' : '#0f172a',
                    borderColor: isDarkConsole ? '#334155' : '#d0d5dd'
                  },
                  placeholder: '关键词检索日志...',
                  value: logSearchQuery,
                  onChange: (e) => setLogSearchQuery(e.target.value),
                }),
              ]),
              // 右侧：诊断自愈操作组
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
                h('button', {
                  className: 'pds-btn',
                  style: { padding: '4px 10px', fontSize: '11px', background: isDarkConsole ? '#0f172a' : '#ffffff', color: isDarkConsole ? '#cbd5e1' : '#334155' },
                  onClick: () => setIsDarkConsole(!isDarkConsole),
                }, isDarkConsole ? '☀️ 浅色' : '🌙 深灰'),
                h('button', {
                  className: 'pds-btn',
                  style: { padding: '4px 10px', fontSize: '11px' },
                  onClick: handleCopyDiagnosticReport,
                  title: '汇总当前系统、各子模块与最新报错为格式化报告',
                }, '📋 一键复制错误诊断报告'),
                h('button', {
                  className: 'pds-btn',
                  style: { padding: '4px 10px', fontSize: '11px' },
                  onClick: handleClearLogs,
                  title: '清空内存缓冲区与 pedestal-runtime.log 文件',
                }, '🧹 清空日志'),
                h('button', {
                  className: 'pds-btn pds-btn-primary',
                  style: { padding: '4px 10px', fontSize: '11px' },
                  onClick: handleRestartDaemon,
                  disabled: restarting,
                  title: '优雅释放端口与数据库锁后重启 daemon.mjs',
                }, restarting ? '重启中...' : '🔄 强制重启守护进程'),
              ]),
            ]),
            // 日志流列表区
            h(
              'div',
              {
                style: {
                  maxHeight: '420px',
                  overflowY: 'auto',
                  padding: '4px 0',
                  color: isDarkConsole ? '#cbd5e1' : '#0f172a',
                  background: isDarkConsole ? '#090d16' : '#ffffff',
                }
              },
              logsList.length === 0
                ? h('div', { style: { textAlign: 'center', color: '#94a3b8', padding: '36px 0', fontSize: '13px' } }, '暂无符合条件的系统日志条目')
                : logsList.map((log) => {
                    const isErr = log.level === 'ERROR';
                    const isWarn = log.level === 'WARN';
                    const isExpanded = !!expandedLogIds[log.id];

                    return h(
                      'div',
                      {
                        key: log.id,
                        className: 'pds-log-item',
                        style: {
                          background: isExpanded ? (isDarkConsole ? '#1e293b' : '#f8fafc') : 'transparent',
                          borderBottom: isDarkConsole ? '1px solid #1e293b' : '1px solid #f8fafc'
                        }
                      },
                      [
                        h('div', { className: 'pds-log-row' }, [
                          h('span', { className: 'pds-log-time' }, (log.timestamp || '').slice(11, 23)),
                          h('span', {
                            className: `pds-badge ${isErr ? 'rose' : isWarn ? 'amber' : 'emerald'}`,
                            style: { fontSize: '9px', padding: '1px 5px' }
                          }, log.level),
                          h('span', { className: 'pds-log-mod', style: { background: isDarkConsole ? '#1e293b' : '#f1f5f9', color: isDarkConsole ? '#94a3b8' : '#64748b' } }, log.module),
                          h('span', {
                            className: 'pds-log-msg',
                            style: { color: isErr ? '#ef4444' : isWarn ? '#f59e0b' : (isDarkConsole ? '#e2e8f0' : '#1e293b'), cursor: isErr ? 'pointer' : 'default' },
                            onClick: () => {
                              if (isErr || log.stack || log.context) {
                                setExpandedLogIds(prev => ({ ...prev, [log.id]: !prev[log.id] }));
                              }
                            }
                          }, log.message),
                          (isErr || log.stack || log.context)
                            ? h('button', {
                                className: 'pds-btn',
                                style: { padding: '1px 6px', fontSize: '10px', height: '18px' },
                                onClick: () => setExpandedLogIds(prev => ({ ...prev, [log.id]: !prev[log.id] }))
                              }, isExpanded ? '收起 ▴' : '详情 ▾')
                            : null,
                        ]),
                        // 展开的 Stack Trace 与 Context 详细信息
                        isExpanded
                          ? h('div', { className: 'pds-log-stack', style: { background: isDarkConsole ? '#1e293b' : '#fef2f2' } }, [
                              log.stack ? h('div', { key: 'stack', style: { color: '#ef4444' } }, log.stack) : null,
                              log.context ? h('div', { key: 'ctx', style: { color: '#64748b', marginTop: '4px' } }, 'Context: ' + JSON.stringify(log.context, null, 2)) : null,
                            ])
                          : null,
                      ]
                    );
                  })
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
        // Tab Nav (Upgrade 3: 新增第 6 个标签页「进程与日志」，带实时错误角标提醒)
        h(
          'nav',
          { className: 'pds-nav' },
          [
            { id: 'overview', label: format(t, 'tabOverview'), badge: null },
            { id: 'vfs', label: format(t, 'tabVfs'), badge: null },
            { id: 'memory', label: format(t, 'tabMemory'), badge: null },
            { id: 'workflow', label: format(t, 'tabWorkflow'), badge: null },
            { id: 'timemachine', label: format(t, 'tabTimemachine'), badge: null },
            {
              id: 'logs',
              label: format(t, 'tabLogs'),
              badge: overview?.errorCount > 0 ? overview.errorCount : null
            },
          ].map((item) =>
            h(
              'button',
              {
                key: item.id,
                className: `pds-nav-item ${tab === item.id ? 'active' : ''}`,
                onClick: () => setTab(item.id),
              },
              [
                h('span', { key: 'lbl' }, item.label),
                item.badge
                  ? h('span', { key: 'bdg', className: 'pds-badge-danger' }, item.badge)
                  : null
              ]
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
          tab === 'logs' && renderLogs(),
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
