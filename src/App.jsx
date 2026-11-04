import React, { useState, useEffect, useMemo } from 'react';
import {
  Leaf,
  LayoutDashboard,
  Receipt,
  FileSpreadsheet,
  Cloud,
  Plus,
  RotateCcw,
  Github,
} from 'lucide-react';
import DashboardView from './components/DashboardView.jsx';
import InvoiceTable from './components/InvoiceTable.jsx';
import EsgReportView from './components/EsgReportView.jsx';
import InvoiceModal from './components/InvoiceModal.jsx';
import BackendConfigModal from './components/BackendConfigModal.jsx';
import { INITIAL_SAMPLE_INVOICES } from './data/emissionFactors.js';
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
  const [selectedFacility, setSelectedFacility] = useState('All Facilities');
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
      showToast(`Updated invoice ${invoiceRecord.invoiceNumber}`);
    } else {
      nextInvoices = [invoiceRecord, ...invoices];
      showToast(`Added invoice ${invoiceRecord.invoiceNumber} to ESG ledger`);
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
    showToast(`Deleted invoice ${target?.invoiceNumber || ''}`);
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

  const handleResetDemoData = () => {
    setInvoices(INITIAL_SAMPLE_INVOICES);
    showToast('Restored sample FY2026 ESG invoice dataset');
  };

  const existingFacilities = useMemo(() => {
    const set = new Set(invoices.map((i) => i.facility).filter(Boolean));
    return Array.from(set);
  }, [invoices]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navigation Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight">
                  EcoLedger ESG
                </span>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Scope 1 · 2 · Water
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Business Utility Invoice & GHG Disclosure Tracker
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            {[
              {
                id: 'dashboard',
                label: 'ESG Dashboard',
                icon: LayoutDashboard,
              },
              {
                id: 'invoices',
                label: `Utility Invoices (${invoices.length})`,
                icon: Receipt,
              },
              {
                id: 'esg-report',
                label: 'GRI / CSRD Disclosure',
                icon: FileSpreadsheet,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right Cloud Sync & Quick Add Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsBackendModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Configure GitHub API or Google Sheets Sync"
            >
              {backendConfig.activeMode === 'github' ? (
                <Github className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>
                {backendConfig.activeMode === 'github'
                  ? 'GitHub Sync'
                  : backendConfig.activeMode === 'gsheets'
                  ? 'Sheets Sync'
                  : 'Cloud Backend'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingInvoice(null);
                setIsInvoiceModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              New Invoice
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 no-print">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-red-900 text-white border-red-700'
                : 'bg-slate-900 text-emerald-300 border-slate-700'
            }`}
          >
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            invoices={invoices}
            orgProfile={orgProfile}
            onUpdateOrgProfile={setOrgProfile}
            selectedFacility={selectedFacility}
            onSelectFacility={setSelectedFacility}
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

        {activeTab === 'esg-report' && (
          <EsgReportView
            invoices={invoices}
            orgProfile={orgProfile}
            onUpdateOrgProfile={setOrgProfile}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong>EcoLedger ESG</strong> · Built for static hosting on GitHub
            Pages with GitHub REST API & Google Sheets persistence.
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleResetDemoData}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Sample Dataset
            </button>
          </div>
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
        existingFacilities={existingFacilities}
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
