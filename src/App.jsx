import React, { useState, useEffect, useMemo } from 'react';
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
  const [selectedYear, setSelectedYear] = useState('All Years');

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

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
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const triggerAutoSyncIfEnabled = async (nextInvoices, nextProfile) => {
    if (!backendConfig.autoSync) return;
    try {
      if (
        backendConfig.activeMode === 'github' &&
        backendConfig.github?.token
      ) {
        await pushToGitHub(backendConfig.github, {
          invoices: nextInvoices,
          orgProfile: nextProfile,
        });
        showToast('Auto-synced invoices to GitHub repository');
      } else if (
        backendConfig.activeMode === 'gsheets' &&
        backendConfig.gsheets?.webAppUrl
      ) {
        await pushToGoogleSheets(backendConfig.gsheets, {
          invoices: nextInvoices,
          orgProfile: nextProfile,
        });
        showToast('Auto-synced invoices to Google Sheets');
      }
    } catch (err) {
      showToast(`Cloud auto-sync failed: ${err.message}`, 'error');
    }
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
    const nextInvoices = [...importedList, ...invoices];
    setInvoices(nextInvoices);
    showToast(`Imported ${importedList.length} utility invoices from CSV`);
    triggerAutoSyncIfEnabled(nextInvoices, orgProfile);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-slate-900">
      {/* Top Institutional Navigation Bar */}
      <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-white text-slate-950 flex items-center justify-center font-mono font-bold text-xs tracking-tighter">
              ESG
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-semibold text-sm tracking-tight text-white">
                UK Energy & Emissions Ledger
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-[0.14em] text-slate-400">
                DEFRA · GBP (£)
              </span>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center gap-1">
            {[
              {
                id: 'dashboard',
                label: 'Overview',
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
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                        active
                          ? 'bg-slate-700 text-slate-200'
                          : 'bg-slate-900 text-slate-400'
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBackendModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              title="Configure GitHub API or Google Sheets Sync"
            >
              {backendConfig.activeMode === 'github' ? (
                <Github className="w-3.5 h-3.5 text-teal-400" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-teal-400" />
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
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-950 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Invoice</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 no-print animate-fade-in">
          <div
            className={`px-4 py-2.5 rounded-lg shadow-xl border text-xs font-mono flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-red-950 text-red-200 border-red-800'
                : 'bg-slate-950 text-teal-300 border-slate-800'
            }`}
          >
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-7">
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
      <footer className="bg-white border-t border-slate-200/90 py-3.5 px-6 text-[11px] text-slate-400 font-mono no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            UK BUSINESS ENERGY & ESG LEDGER · HEAD OFFICE LONDON · SHEFFIELD ·
            LEEDS · BRISTOL
          </div>
          <div>CURRENCY: GBP (£) · DEFRA CONVERSION STANDARD</div>
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
