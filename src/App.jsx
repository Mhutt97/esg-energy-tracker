import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Plus,
  UploadCloud,
  Lock,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';
import DashboardView from './components/DashboardView.jsx';
import InvoiceTable from './components/InvoiceTable.jsx';
import InvoiceModal from './components/InvoiceModal.jsx';
import BackendConfigModal from './components/BackendConfigModal.jsx';
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

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSite, setSelectedSite] = useState('All Sites');
  const [selectedYear, setSelectedYear] = useState('2026');

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const syncQueueRef = useRef(Promise.resolve());
  const toastTimerRef = useRef(null);

  const showToast = (text, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  };

  // On startup: Fetch shared repository database for all visitors, and verify if the current browser
  // holds an authenticated Owner token for Mhutt97/esg-energy-tracker.
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

  const handleRequestOwnerUnlock = () => {
    showToast(
      `Data input & edits are locked to repository owner (${AUTHORIZED_GITHUB_OWNER}). Authenticate to unlock.`,
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
        showToast('Published invoice update to shared GitHub repository');
      })
      .catch((err) => {
        setHasUnsyncedLocal(true);
        showToast(`Shared cloud sync failed: ${err.message}`, 'error');
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
      showToast(`Amended invoice ${invoiceRecord.invoiceNumber}`);
    } else {
      nextInvoices = [invoiceRecord, ...invoices];
      showToast(`Committed invoice ${invoiceRecord.invoiceNumber} to ledger`);
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
    showToast(`Removed invoice ${target?.invoiceNumber || ''}`);
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
    showToast(
      `CSV Import complete: ${addedCount} added, ${updatedCount} updated`
    );
    triggerAutoSyncIfEnabled(nextInvoices, orgProfile);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F0] text-[#121211] selection:bg-[#D9381E] selection:text-white">
      {/* Anti-Gravity Floating Glass Capsule Navigation */}
      <div className="sticky top-5 z-40 px-4 sm:px-8 lg:px-12 no-print pointer-events-none">
        <header className="max-w-[1440px] mx-auto ag-glass-pill rounded-full px-5 sm:px-7 h-[64px] flex items-center justify-between gap-4 pointer-events-auto transition-all">
          {/* Editorial Brand Lockup */}
          <div className="flex items-center gap-3.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D9381E] shrink-0" />
            <div className="flex items-baseline gap-2.5">
              <span className="font-editorial text-lg sm:text-xl uppercase tracking-[-0.04em] text-[#121211] leading-none">
                AETHER<span className="text-[#D9381E]">.</span>ESG
              </span>
              <span className="hidden md:inline-block text-[10px] font-medium uppercase tracking-[0.18em] text-[#8C8982] border-l border-[#121211]/15 pl-2.5">
                UK Energy Monograph · GBP (£)
              </span>
            </div>
          </div>

          {/* Center Weightless Pill Switcher */}
          <nav className="flex items-center gap-1 bg-[#EFECE6]/90 p-1 rounded-full border border-[#121211]/[0.06]">
            {[
              {
                id: 'dashboard',
                index: '01',
                label: 'Editorial & Site Telemetry',
                icon: LayoutDashboard,
              },
              {
                id: 'invoices',
                index: '02',
                label: 'Utility Ledger',
                badge: invoices.length,
                icon: Receipt,
              },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                    active
                      ? 'bg-[#121211] text-[#F6F5F0] shadow-sm'
                      : 'text-[#575550] hover:text-[#121211]'
                  }`}
                >
                  <span
                    className={`text-[10px] tracking-widest uppercase ${
                      active ? 'text-[#D9381E]' : 'text-[#8C8982]'
                    }`}
                  >
                    {tab.index}
                  </span>
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'bg-[#121211]/[0.07] text-[#575550]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Owner Access Status & Floating Action */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsBackendModalOpen(true)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium border transition-all ${
                isOwnerUnlocked && hasUnsyncedLocal
                  ? 'bg-amber-500/10 text-amber-900 border-amber-500/30 hover:bg-amber-500/20'
                  : isOwnerUnlocked
                  ? 'bg-[#1B4332]/[0.08] text-[#1B4332] border-[#1B4332]/25 hover:bg-[#1B4332]/15'
                  : 'bg-white/80 hover:bg-white text-[#575550] border-[#121211]/10'
              }`}
              title={
                isOwnerUnlocked
                  ? `Owner Unlocked (${
                      verifiedOwnerLogin || AUTHORIZED_GITHUB_OWNER
                    }) — Click to manage GitHub Sync or Lock Session`
                  : `Read-Only Mode — Click to authenticate as ${AUTHORIZED_GITHUB_OWNER}`
              }
            >
              {isOwnerUnlocked && hasUnsyncedLocal ? (
                <UploadCloud className="w-3.5 h-3.5 text-amber-700" />
              ) : isOwnerUnlocked ? (
                <ShieldCheck className="w-3.5 h-3.5 text-[#1B4332]" />
              ) : (
                <Lock className="w-3 h-3 text-[#D9381E]" />
              )}
              <span className="hidden sm:inline">
                {isOwnerUnlocked && hasUnsyncedLocal
                  ? 'Publish Changes'
                  : isOwnerUnlocked
                  ? `Owner · ${verifiedOwnerLogin || AUTHORIZED_GITHUB_OWNER}`
                  : 'Read-Only · Owner Login'}
              </span>
            </button>

            {isOwnerUnlocked ? (
              <button
                type="button"
                onClick={() => {
                  setEditingInvoice(null);
                  setIsInvoiceModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-white bg-[#121211] hover:bg-[#D9381E] transition-colors duration-300 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Invoice</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestOwnerUnlock}
                className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-medium bg-[#EFECE6] text-[#575550] hover:text-[#121211] transition-colors"
                title={`Data input and edits are locked to ${AUTHORIZED_GITHUB_OWNER}`}
              >
                <span>Unlock Input</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </header>
      </div>

      {/* Unsynced Local Owner Changes Floating Banner */}
      {isOwnerUnlocked && hasUnsyncedLocal && (
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 lg:px-12 mt-4 no-print">
          <div className="ag-glass rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 border border-amber-500/30">
            <div className="text-xs text-[#121211]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#D9381E] mr-2" />
              <strong>Unpublished Owner Edits:</strong> You have logged or
              amended invoices in this browser that haven&apos;t been committed
              to <code>data/esg-invoices.json</code> yet.
            </div>
            <button
              type="button"
              onClick={() => setIsBackendModalOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-[#121211] hover:bg-[#D9381E] text-white font-medium text-xs transition-colors shrink-0"
            >
              Commit to GitHub Repository →
            </button>
          </div>
        </div>
      )}

      {/* Floating Editorial Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 no-print animate-fade-in">
          <div
            className={`px-5 py-3 rounded-full shadow-2xl border text-xs font-medium flex items-center gap-2.5 backdrop-blur-xl ${
              toast.type === 'error'
                ? 'bg-[#D9381E] text-white border-[#D9381E]'
                : toast.type === 'info'
                ? 'bg-[#121211]/95 text-[#F6F5F0] border-white/15'
                : 'bg-[#121211] text-[#F6F5F0] border-white/15'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#D9381E] shrink-0" />
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Main Asymmetric Editorial Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 lg:px-12 pt-8 pb-20">
        {activeTab === 'dashboard' && (
          <DashboardView
            invoices={invoices}
            orgProfile={orgProfile}
            selectedSite={selectedSite}
            onSelectSite={setSelectedSite}
            selectedYear={selectedYear}
            onSelectYear={setSelectedYear}
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
          />
        )}

        {activeTab === 'invoices' && (
          <InvoiceTable
            invoices={invoices}
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
          />
        )}
      </main>

      {/* Minimalist Editorial Colophon Footer */}
      <footer className="border-t border-[#121211]/[0.08] py-10 px-4 sm:px-8 lg:px-12 text-xs text-[#8C8982] no-print bg-[#F6F5F0]">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-editorial text-base uppercase text-[#121211]">
              AETHER<span className="text-[#D9381E]">.</span>ESG
            </span>
            <span className="text-[11px] uppercase tracking-[0.16em]">
              UK Commercial Energy & Carbon Ledger · London · Sheffield · Leeds · Bristol
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-[0.14em]">
            <span>Suppliers: EDF · SSE · EON · Octopus</span>
            <span>·</span>
            <span>Currency: GBP (£)</span>
            <span>·</span>
            <span className="text-[#121211] font-medium">
              {isOwnerUnlocked
                ? `Owner Unlocked (${
                    verifiedOwnerLogin || AUTHORIZED_GITHUB_OWNER
                  })`
                : `Read-Only Edition (${AUTHORIZED_GITHUB_OWNER})`}
            </span>
          </div>
        </div>
      </footer>

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
