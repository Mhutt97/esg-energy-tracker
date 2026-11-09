import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Plus,
  UploadCloud,
  Lock,
  ShieldCheck,
  Search,
  Download,
  Building2,
  Layers,
  Filter,
  X,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import DashboardView from './components/DashboardView.jsx';
import InvoiceTable from './components/InvoiceTable.jsx';
import InvoiceModal from './components/InvoiceModal.jsx';
import BackendConfigModal from './components/BackendConfigModal.jsx';
import {
  SITES,
  TENANT_ENTITIES,
  REPORTING_FRAMEWORKS,
  UTILITY_CATEGORIES,
  calculateInvoiceEsgMetrics,
} from './data/emissionFactors.js';
import {
  loadLocalState,
  loadInvoicesFromIndexedDb,
  fetchSharedRepositoryDatabase,
  mergeRemoteAndLocalInvoices,
  verifyOwnerGitHubAccess,
  saveLocalInvoices,
  saveLocalOrgProfile,
  saveBackendConfig,
  pushToGitHub,
  pushToGoogleSheets,
  exportInvoicesToCsv,
  exportAuditXbrlReport,
  createPdfBlobUrl,
  AUTHORIZED_GITHUB_OWNER,
} from './services/storageService.js';

export default function App() {
  const initialState = useMemo(() => loadLocalState(), []);

  const [invoices, setInvoices] = useState(initialState.invoices);
  const [orgProfile, setOrgProfile] = useState(initialState.orgProfile);
  const [backendConfig, setBackendConfig] = useState(
    initialState.backendConfig
  );
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState(false);
  const [verifiedOwnerLogin, setVerifiedOwnerLogin] = useState(null);
  const [hasUnsyncedLocal, setHasUnsyncedLocal] = useState(false);

  // Enterprise Layout & Contextual Command Bar State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTenantId, setSelectedTenantId] = useState(
    TENANT_ENTITIES[0].id
  );
  const [selectedFramework, setSelectedFramework] = useState('CSRD');
  const [selectedScopeFilter, setSelectedScopeFilter] = useState('all'); // 'all' | 'scope1' | 'scope2' | 'scope3'
  const [selectedSite, setSelectedSite] = useState('All Sites');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [globalSearch, setGlobalSearch] = useState('');

  // KPI Audit Drill-Down Drawer State
  const [drilldownKpi, setDrilldownKpi] = useState(null);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const syncQueueRef = useRef(Promise.resolve());
  const toastTimerRef = useRef(null);
  const searchInputRef = useRef(null);

  const showToast = (text, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  // Keyboard shortcut '/' or 'Ctrl+K' to focus quick search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && drilldownKpi) {
        setDrilldownKpi(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drilldownKpi]);

  // Hydrate shared repository database & verify owner status on startup
  useEffect(() => {
    let isMounted = true;

    async function bootstrapMultiUserDatabase() {
      const localIdb =
        (await loadInvoicesFromIndexedDb()) || initialState.invoices || [];

      const remoteRepoData = await fetchSharedRepositoryDatabase(
        initialState.backendConfig.github
      );
      const remoteInvoices = remoteRepoData?.invoices || [];

      let ownerVerified = false;
      let ownerLogin = null;
      const storedToken = initialState.backendConfig.github?.token?.trim();
      if (storedToken) {
        try {
          const check = await verifyOwnerGitHubAccess(storedToken);
          ownerVerified = Boolean(check.verified);
          ownerLogin = check.ownerLogin;
        } catch (err) {
          console.warn('Stored token verification skipped:', err);
        }
      }

      if (!isMounted) return;

      setIsOwnerUnlocked(ownerVerified);
      setVerifiedOwnerLogin(ownerLogin);

      if (ownerVerified) {
        const merged = mergeRemoteAndLocalInvoices(remoteInvoices, localIdb);
        setInvoices(merged);
        if (localIdb.length > remoteInvoices.length) {
          setHasUnsyncedLocal(true);
        }
      } else {
        if (remoteInvoices.length > 0) {
          setInvoices(remoteInvoices);
        } else if (localIdb.length > 0) {
          setInvoices(localIdb);
        }
        setHasUnsyncedLocal(false);
      }

      if (remoteRepoData?.orgProfile) {
        setOrgProfile((prev) => ({ ...prev, ...remoteRepoData.orgProfile }));
      }
    }

    bootstrapMultiUserDatabase();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isOwnerUnlocked) {
      saveLocalInvoices(invoices);
    }
  }, [invoices, isOwnerUnlocked]);

  useEffect(() => {
    if (isOwnerUnlocked) {
      saveLocalOrgProfile(orgProfile);
    }
  }, [orgProfile, isOwnerUnlocked]);

  useEffect(() => {
    saveBackendConfig(backendConfig);
  }, [backendConfig]);

  const currentTenant = useMemo(
    () =>
      TENANT_ENTITIES.find((t) => t.id === selectedTenantId) ||
      TENANT_ENTITIES[0],
    [selectedTenantId]
  );

  const currentFrameworkObj = useMemo(
    () =>
      REPORTING_FRAMEWORKS[selectedFramework] || REPORTING_FRAMEWORKS.CSRD,
    [selectedFramework]
  );

  const availableYears = useMemo(() => {
    const set = new Set(
      invoices
        .map((i) => (i.billingPeriodStart || '').slice(0, 4))
        .filter((y) => y.length === 4)
    );
    set.add(orgProfile.reportingYear || '2026');
    return ['All Years', ...Array.from(set).sort().reverse()];
  }, [invoices, orgProfile.reportingYear]);

  // Tenant + Scope + Quick Search filtered invoices passed to active views
  const contextFilteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const site = inv.siteName || inv.facility || SITES[0];
      if (!currentTenant.sites.includes(site)) return false;

      if (selectedScopeFilter === 'scope1' && inv.category !== 'natural_gas') {
        return false;
      }
      if (selectedScopeFilter === 'scope2' && inv.category !== 'electricity') {
        return false;
      }
      if (selectedScopeFilter === 'scope3' && inv.category !== 'water') {
        return false;
      }

      if (globalSearch.trim()) {
        const q = globalSearch.toLowerCase();
        const hay = [
          inv.invoiceNumber,
          inv.invoiceDate,
          inv.supplier,
          site,
          inv.category,
          inv.readingType,
          inv.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [invoices, currentTenant, selectedScopeFilter, globalSearch]);

  // Per-site invoice counts for sidebar badges
  const siteCounts = useMemo(() => {
    const counts = { 'All Sites': contextFilteredInvoices.length };
    SITES.forEach((s) => {
      counts[s] = contextFilteredInvoices.filter(
        (i) => (i.siteName || i.facility) === s
      ).length;
    });
    return counts;
  }, [contextFilteredInvoices]);

  const handleRequestOwnerUnlock = () => {
    showToast(
      `Write access locked to ${AUTHORIZED_GITHUB_OWNER}. Authenticate via GitHub PAT.`,
      'info'
    );
    setIsBackendModalOpen(true);
  };

  const triggerAutoSyncIfEnabled = (nextInvoices, nextProfile) => {
    if (!isOwnerUnlocked) return;

    const hasGithubToken = Boolean(backendConfig.github?.token?.trim());
    const hasSheetsUrl = Boolean(backendConfig.gsheets?.webAppUrl?.trim());

    if (!hasGithubToken && !hasSheetsUrl) {
      setHasUnsyncedLocal(true);
      return;
    }

    if (!backendConfig.autoSync) {
      setHasUnsyncedLocal(true);
      return;
    }

    syncQueueRef.current = syncQueueRef.current
      .then(async () => {
        if (hasGithubToken) {
          await pushToGitHub(backendConfig.github, {
            invoices: nextInvoices,
            orgProfile: nextProfile,
            sharedGsheetsUrl: backendConfig.gsheets?.webAppUrl || '',
          });
        }
        if (hasSheetsUrl) {
          await pushToGoogleSheets(backendConfig.gsheets, {
            invoices: nextInvoices,
            orgProfile: nextProfile,
          });
        }
        setHasUnsyncedLocal(false);
        setBackendConfig((prev) => ({
          ...prev,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast('Synced ledger state to GitHub repository');
      })
      .catch((err) => {
        setHasUnsyncedLocal(true);
        showToast(`Cloud sync error: ${err.message}`, 'error');
      });
  };

  const handleSaveInvoice = (invoiceRecord) => {
    if (!isOwnerUnlocked) {
      handleRequestOwnerUnlock();
      return;
    }
    let nextInvoices;
    const exists = invoices.some((i) => i.id === invoiceRecord.id);
    if (exists) {
      nextInvoices = invoices.map((i) =>
        i.id === invoiceRecord.id ? invoiceRecord : i
      );
      showToast(`Updated record ${invoiceRecord.invoiceNumber}`);
    } else {
      nextInvoices = [invoiceRecord, ...invoices];
      showToast(`Committed record ${invoiceRecord.invoiceNumber}`);
    }
    setInvoices(nextInvoices);
    setIsInvoiceModalOpen(false);
    setEditingInvoice(null);
    triggerAutoSyncIfEnabled(nextInvoices, orgProfile);
  };

  const handleDeleteInvoice = (id) => {
    if (!isOwnerUnlocked) {
      handleRequestOwnerUnlock();
      return;
    }
    const target = invoices.find((i) => i.id === id);
    const nextInvoices = invoices.filter((i) => i.id !== id);
    setInvoices(nextInvoices);
    showToast(`Deleted record ${target?.invoiceNumber || ''}`);
    triggerAutoSyncIfEnabled(nextInvoices, orgProfile);
  };

  const handleDuplicateInvoice = (inv) => {
    if (!isOwnerUnlocked) {
      handleRequestOwnerUnlock();
      return;
    }
    const copy = {
      ...inv,
      id: `inv-${Date.now()}`,
      invoiceNumber: `${inv.invoiceNumber}-COPY`,
    };
    setEditingInvoice(copy);
    setIsInvoiceModalOpen(true);
  };

  const handleBulkImport = (importedList) => {
    if (!isOwnerUnlocked) {
      handleRequestOwnerUnlock();
      return;
    }
    const existingByNumber = new Map(
      invoices.map((inv) => [
        String(inv.invoiceNumber || '')
          .trim()
          .toLowerCase(),
        inv,
      ])
    );
    let addedCount = 0;
    let updatedCount = 0;

    importedList.forEach((imp) => {
      const key = String(imp.invoiceNumber || '')
        .trim()
        .toLowerCase();
      if (existingByNumber.has(key)) {
        const prev = existingByNumber.get(key);
        existingByNumber.set(key, { ...prev, ...imp, id: prev.id });
        updatedCount++;
      } else {
        existingByNumber.set(key, imp);
        addedCount++;
      }
    });

    const nextInvoices = Array.from(existingByNumber.values());
    setInvoices(nextInvoices);
    showToast(`CSV Import: +${addedCount} new, ${updatedCount} updated`);
    triggerAutoSyncIfEnabled(nextInvoices, orgProfile);
  };

  const handleExportAuditCsv = () => {
    const csv = exportInvoicesToCsv(contextFilteredInvoices);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esg-audit-export-${selectedFramework.toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${contextFilteredInvoices.length} records to CSV`);
  };

  const handleExportAuditXbrl = () => {
    const xml = exportAuditXbrlReport(
      contextFilteredInvoices,
      selectedFramework,
      selectedYear,
      currentTenant.name
    );
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esg-xbrl-instance-${selectedFramework.toLowerCase()}-${selectedYear}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${selectedFramework} XBRL Audit Instance (.xml)`);
  };

  const handleOpenPdfInNewTab = (inv) => {
    if (!inv?.pdfAttachment?.dataUrl) return;
    const blobUrl = createPdfBlobUrl(inv.pdfAttachment.dataUrl);
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900 antialiased selection:bg-slate-900 selection:text-white">
      {/* =====================================================================
          FIXED 240px COLLAPSIBLE LEFT NAVIGATION SIDEBAR
      ===================================================================== */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-[56px]' : 'w-[240px]'
        } shrink-0 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between transition-all duration-150 select-none no-print sticky top-0 h-screen z-40`}
      >
        {/* Top Brand & Collapse Toggle */}
        <div>
          <div className="h-12 px-3 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded bg-emerald-600 text-white font-mono-num font-bold text-[11px] flex items-center justify-center shrink-0">
                E1
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <div className="text-xs font-semibold text-white tracking-tight truncate">
                    ESG Core Ledger
                  </div>
                  <div className="text-[10px] font-mono-num text-slate-400 truncate">
                    DEFRA 2026 · GBP (£)
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 text-[11px] font-mono-num"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? '»' : '«'}
            </button>
          </div>

          {/* Primary Views Navigation */}
          <div className="p-2 space-y-0.5 border-b border-slate-800">
            {!sidebarCollapsed && (
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Platform Modules
              </div>
            )}
            {[
              {
                id: 'dashboard',
                label: 'Telemetry & Matrix',
                icon: LayoutDashboard,
              },
              {
                id: 'invoices',
                label: 'Utility Invoice Ledger',
                icon: Receipt,
                badge: contextFilteredInvoices.length,
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  title={item.label}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-medium transition-colors ${
                    active
                      ? 'bg-slate-800 text-white border-l-2 border-emerald-500'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0 text-slate-300" />
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </div>
                  {!sidebarCollapsed && item.badge !== undefined && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 font-mono-num text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Facility / Site Filter Tree */}
          {!sidebarCollapsed && (
            <div className="p-2 space-y-0.5 border-b border-slate-800">
              <div className="px-2 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <span>Facilities (UK)</span>
                <Building2 className="w-3 h-3" />
              </div>
              {['All Sites', ...SITES].map((site) => {
                const isSelected = selectedSite === site;
                const enabledInTenant =
                  site === 'All Sites' || currentTenant.sites.includes(site);
                return (
                  <button
                    key={site}
                    type="button"
                    disabled={!enabledInTenant}
                    onClick={() => setSelectedSite(site)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                      !enabledInTenant
                        ? 'opacity-35 cursor-not-allowed text-slate-600'
                        : isSelected
                        ? 'bg-slate-800 text-white font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="truncate">{site}</span>
                    <span className="font-mono-num text-[10px] text-slate-400">
                      {siteCounts[site] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* GHG Scope Filter Controls */}
          {!sidebarCollapsed && (
            <div className="p-2 space-y-0.5">
              <div className="px-2 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <span>GHG Protocol Scopes</span>
                <Layers className="w-3 h-3" />
              </div>
              {[
                {
                  id: 'all',
                  label: 'All Scopes (1, 2 & Water)',
                  dot: 'bg-slate-400',
                },
                {
                  id: 'scope1',
                  label: 'Scope 1 · Natural Gas',
                  dot: 'bg-emerald-500',
                },
                {
                  id: 'scope2',
                  label: 'Scope 2 · Electricity',
                  dot: 'bg-emerald-400',
                },
                {
                  id: 'scope3',
                  label: 'Scope 3 · Water & Treatment',
                  dot: 'bg-blue-500',
                },
              ].map((sc) => {
                const active = selectedScopeFilter === sc.id;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSelectedScopeFilter(sc.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors ${
                      active
                        ? 'bg-slate-800 text-white font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                    <span className="truncate">{sc.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer: Legacy Excel Lock + Owner Auth Status */}
        <div className="p-2 border-t border-slate-800 space-y-1.5">
          {!sidebarCollapsed && (
            <button
              type="button"
              disabled
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-950/70 border border-slate-800 text-[11px] text-slate-500 cursor-not-allowed"
              title="Legacy Excel (.xlsx) ingestion is disabled during current testing phase"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Lock className="w-3 h-3 shrink-0 text-amber-500" />
                <span className="truncate">Upload Excel (.xlsx)</span>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 font-mono-num text-[9px] uppercase">
                Testing
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsBackendModalOpen(true)}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-medium border transition-colors ${
              isOwnerUnlocked
                ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-200 hover:bg-indigo-900/60'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
            title="Database Sync & Owner Authentication"
          >
            <div className="flex items-center gap-2 min-w-0">
              {isOwnerUnlocked ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              {!sidebarCollapsed && (
                <span className="truncate">
                  {isOwnerUnlocked
                    ? `Owner: ${verifiedOwnerLogin || AUTHORIZED_GITHUB_OWNER}`
                    : 'Read-Only · Unlock'}
                </span>
              )}
            </div>
            {!sidebarCollapsed && (
              <span className="font-mono-num text-[10px] text-slate-400">
                SYNC
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MAIN WORKSPACE COLUMN (TOP CONTEXTUAL COMMAND BAR + DENSE CONTENT)
      ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Contextual Command Bar */}
        <header className="h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 sticky top-0 z-30 no-print">
          {/* Left: Tenant Switcher, Reporting Framework Switcher, Year Dropdown */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {/* Tenant Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Tenant
              </span>
              <select
                value={selectedTenantId}
                onChange={(e) => {
                  setSelectedTenantId(e.target.value);
                  setSelectedSite('All Sites');
                }}
                className="text-xs font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {TENANT_ENTITIES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reporting Framework Switcher (CSRD, GRI, SEC, SECR) */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                Framework
              </span>
              <select
                value={selectedFramework}
                onChange={(e) => setSelectedFramework(e.target.value)}
                className="text-xs font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {Object.values(REPORTING_FRAMEWORKS).map((fw) => (
                  <option key={fw.id} value={fw.id}>
                    {fw.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reporting Year Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                FY
              </span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="text-xs font-mono-num font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Inline Scope Segmented Control */}
            <div className="hidden xl:flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-[11px]">
              {[
                { id: 'all', label: 'All Scopes' },
                { id: 'scope1', label: 'Scope 1' },
                { id: 'scope2', label: 'Scope 2' },
                { id: 'scope3', label: 'Scope 3 (Water)' },
              ].map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setSelectedScopeFilter(sc.id)}
                  className={`px-2 py-0.5 rounded-xs font-medium transition-colors ${
                    selectedScopeFilter === sc.id
                      ? 'bg-white text-slate-900 border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Quick Search + Export Audit (CSV/XBRL) + Log Invoice */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Search Input */}
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Quick search... (/)"
                className="w-full pl-8 pr-6 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:bg-white focus:border-slate-900"
              />
              {globalSearch ? (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-block absolute right-2 top-1/2 -translate-y-1/2 px-1 text-[10px] font-mono-num text-slate-400 bg-slate-100 border border-slate-200 rounded">
                  /
                </kbd>
              )}
            </div>

            {/* Export Audit Report Buttons (CSV & XBRL) */}
            <div className="hidden md:flex items-center border border-slate-200 rounded overflow-hidden bg-white">
              <button
                type="button"
                onClick={handleExportAuditCsv}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 border-r border-slate-200"
                title="Export filtered ledger as Audit CSV"
              >
                <Download className="w-3 h-3 text-slate-500" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportAuditXbrl}
                className="px-2.5 py-1 text-[11px] font-mono-num font-medium text-indigo-700 hover:bg-indigo-50 flex items-center gap-1"
                title={`Export ${selectedFramework} XBRL XML Instance`}
              >
                <span>XBRL</span>
              </button>
            </div>

            {/* Primary Write Action (Owner Guarded) */}
            {isOwnerUnlocked ? (
              <button
                type="button"
                onClick={() => {
                  setEditingInvoice(null);
                  setIsInvoiceModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Invoice</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestOwnerUnlock}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-medium transition-colors"
                title={`Data input & edits are restricted to ${AUTHORIZED_GITHUB_OWNER}`}
              >
                <Lock className="w-3 h-3 text-amber-600" />
                <span>Unlock Edits</span>
              </button>
            )}
          </div>
        </header>

        {/* Unsynced Local Owner Changes Banner */}
        {isOwnerUnlocked && hasUnsyncedLocal && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center justify-between text-xs text-amber-900 no-print">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                <strong>Unpublished Local Commits:</strong> Local changes have
                not yet been pushed to{' '}
                <code className="font-mono-num">data/esg-invoices.json</code>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsBackendModalOpen(true)}
              className="px-2.5 py-0.5 rounded bg-amber-900 hover:bg-amber-800 text-white font-medium text-[11px]"
            >
              Commit to Repo →
            </button>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 no-print">
            <div
              className={`px-3.5 py-2 rounded border text-xs font-medium flex items-center gap-2 ${
                toast.type === 'error'
                  ? 'bg-red-950 text-red-100 border-red-800'
                  : toast.type === 'info'
                  ? 'bg-slate-900 text-amber-200 border-slate-700'
                  : 'bg-slate-900 text-emerald-300 border-slate-700'
              }`}
            >
              <span className="font-mono-num text-[10px] uppercase px-1 py-0.5 rounded bg-white/10">
                SYS
              </span>
              <span>{toast.text}</span>
            </div>
          </div>
        )}

        {/* Main High-Density Application Canvas */}
        <main className="flex-1 p-4 max-w-[1680px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              invoices={contextFilteredInvoices}
              orgProfile={orgProfile}
              selectedSite={selectedSite}
              onSelectSite={setSelectedSite}
              selectedYear={selectedYear}
              onSelectYear={setSelectedYear}
              selectedFramework={currentFrameworkObj}
              selectedScopeFilter={selectedScopeFilter}
              onSelectScopeFilter={setSelectedScopeFilter}
              onOpenNewInvoice={() => {
                if (!isOwnerUnlocked) {
                  handleRequestOwnerUnlock();
                  return;
                }
                setEditingInvoice(null);
                setIsInvoiceModalOpen(true);
              }}
              onSwitchTab={setActiveTab}
              isOwnerUnlocked={isOwnerUnlocked}
              onRequestOwnerUnlock={handleRequestOwnerUnlock}
              onOpenDrilldown={(kpiPayload) => setDrilldownKpi(kpiPayload)}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoiceTable
              invoices={contextFilteredInvoices}
              onAddInvoice={() => {
                if (!isOwnerUnlocked) {
                  handleRequestOwnerUnlock();
                  return;
                }
                setEditingInvoice(null);
                setIsInvoiceModalOpen(true);
              }}
              onEditInvoice={(inv) => {
                if (!isOwnerUnlocked) {
                  handleRequestOwnerUnlock();
                  return;
                }
                setEditingInvoice(inv);
                setIsInvoiceModalOpen(true);
              }}
              onDuplicateInvoice={handleDuplicateInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onBulkImport={handleBulkImport}
              isOwnerUnlocked={isOwnerUnlocked}
              onRequestOwnerUnlock={handleRequestOwnerUnlock}
              selectedFramework={currentFrameworkObj}
            />
          )}
        </main>

        {/* Compact Status Bar Footer */}
        <footer className="h-8 bg-white border-t border-slate-200 px-4 flex items-center justify-between text-[11px] text-slate-500 no-print">
          <div className="flex items-center gap-3 truncate">
            <span className="font-semibold text-slate-700">
              {currentTenant.name}
            </span>
            <span>·</span>
            <span className="font-mono-num">
              Framework: {currentFrameworkObj.label}
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline font-mono-num">
              Sites: London, Sheffield, Leeds, Bristol
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono-num">
            <span>Suppliers: EDF, SSE, EON, Octopus</span>
            <span>·</span>
            <span>GBP (£)</span>
            <span>·</span>
            <span
              className={
                isOwnerUnlocked
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-600'
              }
            >
              {isOwnerUnlocked
                ? `WRITE UNLOCKED (${
                    verifiedOwnerLogin || AUTHORIZED_GITHUB_OWNER
                  })`
                : `READ-ONLY (${AUTHORIZED_GITHUB_OWNER})`}
            </span>
          </div>
        </footer>
      </div>

      {/* =====================================================================
          SLIDE-OVER KPI AUDIT DRILL-DOWN DRAWER
      ===================================================================== */}
      {drilldownKpi && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 no-print">
          <div className="bg-white w-full max-w-2xl h-full border-l border-slate-200 flex flex-col justify-between overflow-hidden">
            {/* Drawer Header */}
            <div className="px-4 py-3 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-mono-num text-[10px] uppercase">
                    Audit Drill-Down
                  </span>
                  <span className="font-mono-num text-[11px] text-slate-400">
                    {drilldownKpi.disclosureCode}
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-white mt-1">
                  {drilldownKpi.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrilldownKpi(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Aggregate Value & Methodology Summary Box */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Verified Aggregate
                  </div>
                  <div className="font-mono-num text-lg font-bold text-slate-900 mt-0.5">
                    {drilldownKpi.formattedValue}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {drilldownKpi.subtitle}
                  </div>
                </div>

                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Conversion Factor
                  </div>
                  <div className="font-mono-num text-xs font-semibold text-emerald-700 mt-1">
                    {drilldownKpi.factorLabel}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Source: UK DESNZ / DEFRA 2026
                  </div>
                </div>

                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Assurance Quality
                  </div>
                  <div className="font-mono-num text-xs font-semibold text-indigo-700 mt-1">
                    {drilldownKpi.records?.length || 0} Source Invoices
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {
                      (drilldownKpi.records || []).filter(
                        (r) => (r.readingType || 'Actual') === 'Actual'
                      ).length
                    }{' '}
                    Actual /{' '}
                    {
                      (drilldownKpi.records || []).filter(
                        (r) => r.readingType === 'Estimated'
                      ).length
                    }{' '}
                    Estimated
                  </div>
                </div>
              </div>

              {/* Formula & Standard Reference */}
              <div className="p-3 rounded bg-slate-900 text-slate-200 text-xs space-y-1 font-mono-num">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Calculation Formula &amp; Regulatory Mapping
                </div>
                <div>{drilldownKpi.formula}</div>
              </div>

              {/* Underlying Raw Invoice Records Table */}
              <div className="border border-slate-200 rounded overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Underlying Source Invoices ({drilldownKpi.records?.length || 0})
                  </span>
                  <span className="font-mono-num text-[11px] text-slate-500">
                    Click row to inspect
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left border-collapse b2b-table">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Invoice Ref</th>
                        <th className="py-2 px-3">Period</th>
                        <th className="py-2 px-3">Facility &amp; Supplier</th>
                        <th className="py-2 px-3 text-right">Usage</th>
                        <th className="py-2 px-3 text-right">tCO₂e</th>
                        <th className="py-2 px-3 text-right">Gross (£)</th>
                        <th className="py-2 px-3">Reading</th>
                        <th className="py-2 px-3 text-right">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {(drilldownKpi.records || []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-8 text-center text-slate-400"
                          >
                            No matching records in current filter context.
                          </td>
                        </tr>
                      ) : (
                        (drilldownKpi.records || []).map((inv) => {
                          const m = calculateInvoiceEsgMetrics(inv);
                          return (
                            <tr key={inv.id}>
                              <td className="py-2 px-3 font-mono-num font-semibold text-slate-900">
                                {inv.invoiceNumber}
                              </td>
                              <td className="py-2 px-3 font-mono-num text-[11px] text-slate-600 whitespace-nowrap">
                                {inv.billingPeriodStart}
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-medium text-slate-900">
                                  {inv.siteName}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {inv.supplier} ·{' '}
                                  {UTILITY_CATEGORIES[inv.category]?.name}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono-num text-slate-800 whitespace-nowrap">
                                {Number(inv.usage).toLocaleString('en-GB')}{' '}
                                {inv.unit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono-num font-semibold text-emerald-700">
                                {m.co2eTonnes.toFixed(3)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono-num font-semibold text-slate-900">
                                £{Number(inv.grossCost).toFixed(2)}
                              </td>
                              <td className="py-2 px-3">
                                {inv.readingType === 'Actual' ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono-num text-[10px]">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    ACT
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono-num text-[10px]">
                                    <Clock className="w-2.5 h-2.5" />
                                    EST
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {inv.pdfAttachment?.dataUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPdfInNewTab(inv)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[10px] font-mono-num text-slate-700"
                                  >
                                    <FileText className="w-2.5 h-2.5" />
                                    PDF
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-mono-num text-slate-400">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] font-mono-num text-slate-500">
                Framework: {currentFrameworkObj.label}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDrilldownKpi(null);
                    setActiveTab('invoices');
                  }}
                  className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
                >
                  Open Full Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setDrilldownKpi(null)}
                  className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-xs font-medium text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <InvoiceModal
        isOpen={isOwnerUnlocked && isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setEditingInvoice(null);
        }}
        onSave={handleSaveInvoice}
        editingInvoice={editingInvoice}
        existingInvoices={invoices}
      />

      <BackendConfigModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        backendConfig={backendConfig}
        onSaveConfig={(nextCfg) => {
          setBackendConfig(nextCfg);
          if (nextCfg.lastSyncedAt) {
            setHasUnsyncedLocal(false);
          }
        }}
        invoices={invoices}
        orgProfile={orgProfile}
        onRestoreRemoteData={(remoteInvoices, remoteProfile) => {
          setInvoices(remoteInvoices);
          setHasUnsyncedLocal(false);
          if (remoteProfile) {
            setOrgProfile((prev) => ({ ...prev, ...remoteProfile }));
          }
        }}
        isOwnerUnlocked={isOwnerUnlocked}
        verifiedOwnerLogin={verifiedOwnerLogin}
        onOwnerVerified={async (token, ownerLogin) => {
          setIsOwnerUnlocked(true);
          setVerifiedOwnerLogin(ownerLogin);
          const localIdb = await loadInvoicesFromIndexedDb();
          if (Array.isArray(localIdb) && localIdb.length > 0) {
            setInvoices((prev) => {
              const merged = mergeRemoteAndLocalInvoices(prev, localIdb);
              if (merged.length > prev.length) {
                setHasUnsyncedLocal(true);
              }
              return merged;
            });
          }
          showToast(
            `Authenticated as ${ownerLogin} — Data input & edits unlocked`
          );
        }}
        onLockOwnerSession={() => {
          setIsOwnerUnlocked(false);
          setVerifiedOwnerLogin(null);
          setBackendConfig((prev) => ({
            ...prev,
            github: { ...prev.github, token: '' },
          }));
          showToast('Locked session to Public Read-Only Mode', 'info');
        }}
      />
    </div>
  );
}
