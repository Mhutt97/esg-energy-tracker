import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Cloud,
  Plus,
  Github,
} from 'lucide-react';
import DashboardView from './components/DashboardView.jsx';
import InvoiceTable from './components/InvoiceTable.jsx';
import InvoiceModal from './components/InvoiceModal.jsx';
import BackendConfigModal from './components/BackendConfigModal.jsx';
import {
  loadLocalState,
  loadInvoicesFromIndexedDb,
  saveLocalInvoices,
  saveLocalOrgProfile,
  saveBackendConfig,
  pushToGitHub,
  pushToGoogleSheets,
} from './services/storageService.js';

export default function App() {
  const initialState = useMemo(() => loadLocalState(), []);

  const [invoices, setInvoices] = useState(initialState.invoices);
  const [orgProfile, setOrgProfile] = useState(initialState.orgProfile);
  const [backendConfig, setBackendConfig] = useState(
    initialState.backendConfig
  );

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSite, setSelectedSite] = useState('All Sites');
  const [selectedYear, setSelectedYear] = useState('2026');

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const syncQueueRef = useRef(Promise.resolve());
  const toastTimerRef = useRef(null);

  // Hydrate full records (including large PDF attachments) from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;
    loadInvoicesFromIndexedDb().then((idbInvoices) => {
      if (isMounted && Array.isArray(idbInvoices) && idbInvoices.length > 0) {
        setInvoices(idbInvoices);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    saveLocalInvoices(invoices);
  }, [invoices]);

  useEffect(() => {
    saveLocalOrgProfile(orgProfile);
  }, [orgProfile]);

  useEffect(() => {
    saveBackendConfig(backendConfig);
  }, [backendConfig]);

  const showToast = (text, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  // Serialized cloud sync queue to prevent concurrent SHA race conditions on GitHub API
  const triggerAutoSyncIfEnabled = (nextInvoices, nextProfile) => {
    if (!backendConfig.autoSync) return;

    syncQueueRef.current = syncQueueRef.current
      .then(async () => {
        if (
          backendConfig.activeMode === 'github' &&
          backendConfig.github?.token
        ) {
          await pushToGitHub(backendConfig.github, {
            invoices: nextInvoices,
            orgProfile: nextProfile,
          });
          setBackendConfig((prev) => ({
            ...prev,
            lastSyncedAt: new Date().toISOString(),
          }));
          showToast('Auto-synced invoices to GitHub repository');
        } else if (
          backendConfig.activeMode === 'gsheets' &&
          backendConfig.gsheets?.webAppUrl
        ) {
          await pushToGoogleSheets(backendConfig.gsheets, {
            invoices: nextInvoices,
            orgProfile: nextProfile,
          });
          setBackendConfig((prev) => ({
            ...prev,
            lastSyncedAt: new Date().toISOString(),
          }));
          showToast('Auto-synced invoices to Google Sheets');
        }
      })
      .catch((err) => {
        showToast(`Cloud auto-sync failed: ${err.message}`, 'error');
      });
  };

  const handleSaveInvoice = (invoiceRecord) => {
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
    const target = invoices.find((i) => i.id === id);
    const nextInvoices = invoices.filter((i) => i.id !== id);
    setInvoices(nextInvoices);
    showToast(`Removed invoice ${target?.invoiceNumber || ''}`);
    triggerAutoSyncIfEnabled(nextInvoices, orgProfile);
  };

  const handleDuplicateInvoice = (inv) => {
    const copy = {
      ...inv,
      id: `inv-${Date.now()}`,
      invoiceNumber: `${inv.invoiceNumber}-COPY`,
    };
    setEditingInvoice(copy);
    setIsInvoiceModalOpen(true);
  };

  const handleBulkImport = (importedList) => {
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

          {/* Right Cloud Sync & Quick Add Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsBackendModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-colors"
              title="Configure GitHub API or Google Sheets Sync"
            >
              {backendConfig.activeMode === 'github' ? (
                <Github className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span className="hidden sm:inline">
                {backendConfig.activeMode === 'github'
                  ? 'GitHub Sync'
                  : backendConfig.activeMode === 'gsheets'
                  ? 'Sheets Sync'
                  : 'Database Sync'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingInvoice(null);
                setIsInvoiceModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              }}
            >
              <Plus className="w-4 h-4" />
              <span>Log Invoice</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 no-print animate-fade-in">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-rose-950 text-rose-200 border-rose-800'
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
              setEditingInvoice(null);
              setIsInvoiceModalOpen(true);
            }}
            onSwitchTab={setActiveTab}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoiceTable
            invoices={invoices}
            onAddInvoice={() => {
              setEditingInvoice(null);
              setIsInvoiceModalOpen(true);
            }}
            onEditInvoice={(inv) => {
              setEditingInvoice(inv);
              setIsInvoiceModalOpen(true);
            }}
            onDuplicateInvoice={handleDuplicateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onBulkImport={handleBulkImport}
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
          <div>CURRENCY: GBP (£) · SUPPLIERS: EDF, SSE, EON, OCTOPUS</div>
        </div>
      </footer>

      {/* Modals */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
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
        onSaveConfig={setBackendConfig}
        invoices={invoices}
        orgProfile={orgProfile}
        onRestoreRemoteData={(remoteInvoices, remoteProfile) => {
          setInvoices(remoteInvoices);
          if (remoteProfile) {
            setOrgProfile((prev) => ({ ...prev, ...remoteProfile }));
          }
        }}
      />
    </div>
  );
}
