import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Github,
  FileSpreadsheet,
  HardDrive,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  pullFromGitHub,
  pushToGitHub,
  testGitHubConnection,
  pullFromGoogleSheets,
  pushToGoogleSheets,
  parseJsonBackup,
  getStorageDiagnostics,
  GOOGLE_APPS_SCRIPT_SNIPPET,
} from '../services/storageService.js';

export default function BackendConfigModal({
  isOpen,
  onClose,
  backendConfig,
  onSaveConfig,
  invoices,
  orgProfile,
  onRestoreRemoteData,
}) {
  const [config, setConfig] = useState(backendConfig);
  const [activeTab, setActiveTab] = useState(
    backendConfig.activeMode === 'gsheets' ? 'gsheets' : 'github'
  );
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const jsonInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(backendConfig);
      setStatusMsg(null);
    }
  }, [isOpen, backendConfig]);

  const diagnostics = useMemo(
    () => getStorageDiagnostics(invoices),
    [invoices]
  );

  if (!isOpen) return null;

  const updateGithub = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      github: { ...prev.github, [field]: value },
    }));
  };

  const updateGsheets = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      gsheets: { ...prev.gsheets, [field]: value },
    }));
  };

  const handlePersistConfig = (nextConfig) => {
    setConfig(nextConfig);
    onSaveConfig(nextConfig);
  };

  const handleGitHubTest = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const info = await testGitHubConnection(config.github);
      setStatusMsg({
        type: 'success',
        text: `Connected to ${info.fullName} (default branch: ${
          info.defaultBranch
        }). Write permission: ${info.canPush ? 'Verified' : 'Read-Only'}.`,
      });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubPush = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await pushToGitHub(config.github, { invoices, orgProfile });
      const updated = {
        ...config,
        activeMode: 'github',
        lastSyncedAt: new Date().toISOString(),
      };
      handlePersistConfig(updated);
      setStatusMsg({
        type: 'success',
        text: `Committed ${invoices.length} invoices (${diagnostics.pdfCount} PDFs) to ${config.github.owner}/${config.github.repo} (${config.github.filePath}).`,
        url: res.htmlUrl,
      });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubPull = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await pullFromGitHub(config.github);
      onRestoreRemoteData(res.invoices, res.orgProfile);
      const updated = {
        ...config,
        activeMode: 'github',
        lastSyncedAt: new Date().toISOString(),
      };
      handlePersistConfig(updated);
      setStatusMsg({
        type: 'success',
        text: `Loaded ${res.invoices.length} sanitized invoices from GitHub repository.`,
      });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSheetsPush = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      await pushToGoogleSheets(config.gsheets, { invoices, orgProfile });
      const updated = {
        ...config,
        activeMode: 'gsheets',
        lastSyncedAt: new Date().toISOString(),
      };
      handlePersistConfig(updated);
      setStatusMsg({
        type: 'success',
        text: `Synced ${invoices.length} invoices to Google Sheets ('ESG_Invoices' tab).`,
      });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSheetsPull = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await pullFromGoogleSheets(config.gsheets);
      onRestoreRemoteData(res.invoices, res.orgProfile);
      const updated = {
        ...config,
        activeMode: 'gsheets',
        lastSyncedAt: new Date().toISOString(),
      };
      handlePersistConfig(updated);
      setStatusMsg({
        type: 'success',
        text: `Pulled ${res.invoices.length} invoices from Google Sheets.`,
      });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAppsScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_SNIPPET);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleExportJson = () => {
    const json = JSON.stringify(
      {
        schemaVersion: '2.2',
        exportedAt: new Date().toISOString(),
        orgProfile,
        invoices,
      },
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uk-esg-ledger-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = (e) => {
    setStatusMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result || '');
        const restored = parseJsonBackup(text);
        onRestoreRemoteData(restored.invoices, restored.orgProfile);
        setStatusMsg({
          type: 'success',
          text: `Restored ${restored.invoices.length} invoices from JSON snapshot.`,
        });
      } catch (err) {
        setStatusMsg({
          type: 'error',
          text: err.message || 'Failed to parse JSON snapshot.',
        });
      } finally {
        if (jsonInputRef.current) jsonInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8">
        {/* Header */}
        <div
          className="px-6 py-4 text-white flex items-center justify-between"
          style={{
            background: 'rgba(7, 13, 25, 0.96)',
            borderBottom: '1px solid rgba(56, 189, 248, 0.16)',
          }}
        >
          <div>
            <h2 className="text-base font-extrabold tracking-tight">
              Database & Cloud Backend Configuration
            </h2>
            <p className="text-xs text-slate-300">
              IndexedDB + GitHub REST API + Google Sheets persistence
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Diagnostics Strip */}
        <div className="px-6 py-2.5 bg-slate-900 text-slate-200 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
          <span className="font-semibold">
            Ledger Records: <strong>{diagnostics.invoiceCount}</strong> · Stored
            PDFs: <strong>{diagnostics.pdfCount}</strong>
          </span>
          <span className="text-sky-300 font-bold">
            Database Size: {diagnostics.totalKb} KB (IndexedDB + LocalStorage
            Active)
          </span>
        </div>

        {/* Provider Tabs */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 pt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('github');
              setStatusMsg(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition ${
              activeTab === 'github'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Github className="w-4 h-4" />
            GitHub Repository API
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('gsheets');
              setStatusMsg(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition ${
              activeTab === 'gsheets'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Google Sheets Webhook
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('local');
              setStatusMsg(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition ${
              activeTab === 'local'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDrive className="w-4 h-4 text-slate-600" />
            JSON Snapshot & Auto-Sync
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold">{statusMsg.text}</div>
                {statusMsg.url && (
                  <a
                    href={statusMsg.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-emerald-700 mt-1 inline-block font-semibold"
                  >
                    View committed file on GitHub →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: GitHub API */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                <strong>GitHub Repository Persistence:</strong> Commits{' '}
                <code className="px-1.5 py-0.5 bg-slate-200/80 rounded font-bold text-slate-800">
                  data/esg-invoices.json
                </code>{' '}
                (including attached PDF documents up to 100 MB via Git Blob API
                fallback and automatic SHA conflict resolution) directly to your
                GitHub repository.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    GitHub Owner (User or Org) *
                  </label>
                  <input
                    type="text"
                    value={config.github.owner}
                    onChange={(e) => updateGithub('owner', e.target.value)}
                    placeholder="Mhutt97"
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Repository Name *
                  </label>
                  <input
                    type="text"
                    value={config.github.repo}
                    onChange={(e) => updateGithub('repo', e.target.value)}
                    placeholder="esg-energy-tracker"
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={config.github.branch}
                    onChange={(e) => updateGithub('branch', e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    JSON File Path in Repo
                  </label>
                  <input
                    type="text"
                    value={config.github.filePath}
                    onChange={(e) => updateGithub('filePath', e.target.value)}
                    placeholder="data/esg-invoices.json"
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GitHub Fine-Grained Personal Access Token (PAT) *
                </label>
                <input
                  type="password"
                  value={config.github.token}
                  onChange={(e) => updateGithub('token', e.target.value)}
                  placeholder="github_pat_..."
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Stored locally in your browser. Requires{' '}
                  <strong>Contents: Read and Write</strong> permission on{' '}
                  <code>
                    {config.github.owner}/{config.github.repo}
                  </code>
                  .
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGitHubTest}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Test Connection
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGitHubPush}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                  Commit & Push to GitHub
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGitHubPull}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 disabled:opacity-50"
                >
                  <DownloadCloud className="w-4 h-4" />
                  Pull from GitHub
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Google Sheets */}
          {activeTab === 'gsheets' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Google Apps Script Web App URL *
                </label>
                <input
                  type="url"
                  value={config.gsheets.webAppUrl}
                  onChange={(e) => updateGsheets('webAppUrl', e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Uses multi-row 40k-character chunking so large datasets never
                  exceed Google Sheets&apos; 50,000-character cell limit.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleSheetsPush}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                  Push Invoices to Google Sheet
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleSheetsPull}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 disabled:opacity-50"
                >
                  <DownloadCloud className="w-4 h-4" />
                  Pull from Google Sheet
                </button>
              </div>

              {/* Copyable Google Apps Script Snippet */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700">
                    Google Sheet Setup (Extensions → Apps Script)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAppsScript}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {copiedScript ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Apps Script
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 text-slate-200 text-[11px] overflow-x-auto max-h-48 leading-relaxed">
                  {GOOGLE_APPS_SCRIPT_SNIPPET}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: JSON Backup & Auto-Sync */}
          {activeTab === 'local' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Auto-Sync to Active Cloud Provider on Save
                  </div>
                  <div className="text-xs text-slate-500">
                    Automatically pushes to{' '}
                    {config.activeMode === 'github'
                      ? 'GitHub Repository'
                      : config.activeMode === 'gsheets'
                      ? 'Google Sheets'
                      : 'your selected cloud backend'}{' '}
                    whenever you add, edit, or delete an invoice
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(config.autoSync)}
                  onChange={(e) =>
                    handlePersistConfig({
                      ...config,
                      autoSync: e.target.checked,
                    })
                  }
                  className="w-5 h-5 accent-blue-600 rounded"
                />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Full JSON Database Snapshot (Including PDFs)
                  </div>
                  <div className="text-xs text-slate-500">
                    Download or restore a complete offline backup of all
                    invoices and embedded PDF files
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={jsonInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportJsonFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => jsonInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Restore JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    Download JSON
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Active Backend:{' '}
            <strong className="text-slate-800 uppercase">
              {config.activeMode}
            </strong>
            {config.lastSyncedAt &&
              ` · Last Synced: ${new Date(
                config.lastSyncedAt
              ).toLocaleTimeString()}`}
          </div>
          <button
            type="button"
            onClick={() => {
              onSaveConfig(config);
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save Settings & Close
          </button>
        </div>
      </div>
    </div>
  );
}
