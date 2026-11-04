import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Plus,
  UploadCloud,
  Lock,
  ShieldCheck,
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

      // Check if this browser has a stored Owner GitHub Token for Mhutt97
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
        // Owner browser: merge remote repository data with any local unsynced owner records
        const merged = mergeRemoteAndLocalInvoices(remoteInvoices, localIdb);
        setInvoices(merged);
        if (localIdb.length > remoteInvoices.length) {
          setHasUnsyncedLocal(true);
        }
      } else {
        // Public Read-Only Visitor: display authoritative shared repository invoices
        // (or fallback to localIdb only if the shared repo hasn't been initialized yet)
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
      `Data input & edits are locked to repository owner (${AUTHORIZED_GITHUB_OWNER}). Enter your GitHub PAT to unlock.`,
      'info'
    );
    setIsBackendModalOpen(true);
  };

  // Serialized cloud sync queue to publish owner changes for all website visitors
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
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-[#0f172a]">
      {/* Top Sticky Midnight Navy Glass Command Bar */}
      <header
        className="sticky top-0 z-30 no-print text-white"
        style={{
          background: 'rgba(7, 13, 25, 0.90)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.14)',
        }}
      >
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 h-[66px] flex items-center justify-between gap-4">
          {/* Brand Lockup */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center font-black text-sm tracking-tight text-white shrink-0"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
                boxShadow:
                  '0 4px 14px rgba(37, 99, 235, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
              }}
            >
              ESG
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[18.5px] font-extrabold tracking-[-0.035em] text-white leading-none">
                UK Energy & ESG Intelligence
              </span>
              <span
                className="hidden sm:inline-flex items-center text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(37, 99, 235, 0.18)',
                  border: '1px solid rgba(96, 165, 250, 0.28)',
                  color: '#bfdbfe',
                }}
              >
                UK DEFRA · GBP (£)
              </span>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            {[
              {
                id: 'dashboard',
                label: 'Site & Monthly Summaries',
                icon: LayoutDashboard,
              },
              {
                id: 'invoices',
                label: 'Utility Invoices',
                badge: invoices.length,
                icon: Receipt,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        active
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Owner Lock Status & Quick Add Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsBackendModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                isOwnerUnlocked && hasUnsyncedLocal
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/50'
                  : isOwnerUnlocked
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80'
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
                <UploadCloud className="w-3.5 h-3.5 text-amber-300" />
              ) : isOwnerUnlocked ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="hidden sm:inline">
                {isOwnerUnlocked && hasUnsyncedLocal
                  ? 'Publish for All Users'
                  : isOwnerUnlocked
                  ? `Owner Unlocked (${
                      verifiedOwnerLogin || AUTHORIZED_GITHUB_OWNER
                    })`
                  : `Read-Only · Owner Login`}
              </span>
            </button>

            {isOwnerUnlocked ? (
              <button
                type="button"
                onClick={() => {
                  setEditingInvoice(null);
                  setIsInvoiceModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
                style={{
                  background:
                    'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Log Invoice</span>
              </button>
            ) : (
              <span
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900/60 text-slate-400 border border-slate-800 select-none"
                title={`Data input and edits are locked to ${AUTHORIZED_GITHUB_OWNER}`}
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Edits Locked</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Unsynced Local Changes Banner (only shown when Owner is unlocked and has unsynced local changes) */}
      {isOwnerUnlocked && hasUnsyncedLocal && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 text-xs text-amber-950 no-print">
          <div className="max-w-[1340px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">
              <strong>Local Owner Changes Detected:</strong> You have logged
              invoices in this browser that haven&apos;t been committed to{' '}
              <code>data/esg-invoices.json</code> yet.
            </div>
            <button
              type="button"
              onClick={() => setIsBackendModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-amber-900 hover:bg-amber-800 text-white font-bold text-xs shrink-0"
            >
              Commit & Publish to GitHub →
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 no-print animate-fade-in">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-rose-950 text-rose-200 border-rose-800'
                : toast.type === 'info'
                ? 'bg-amber-950 text-amber-200 border-amber-800'
                : 'bg-slate-950 text-sky-300 border-slate-800'
            }`}
          >
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1340px] w-full mx-auto px-4 sm:px-6 py-7">
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/90 py-4 px-6 text-xs font-semibold text-slate-400 no-print">
        <div className="max-w-[1340px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            UK BUSINESS ENERGY & ESG LEDGER · HEAD OFFICE LONDON · OFFICE
            SHEFFIELD · OFFICE LEEDS · OFFICE BRISTOL
          </div>
          <div>
            CURRENCY: GBP (£) · SUPPLIERS: EDF, SSE, EON, OCTOPUS ·{' '}
            {isOwnerUnlocked
              ? `OWNER UNLOCKED (${
                  verifiedOwnerLogin || AUTHORIZED_GITHUB_OWNER
                })`
              : `PUBLIC READ-ONLY MODE (LOCKED TO ${AUTHORIZED_GITHUB_OWNER})`}
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
          // Merge any local owner invoices from IndexedDB once unlocked
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
