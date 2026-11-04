import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Download,
  Upload,
  Edit3,
  Copy,
  Trash2,
  Zap,
  Flame,
  Droplets,
  CheckCircle2,
  Clock,
  FileDown,
  FileText,
  Lock,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  calculateInvoiceEsgMetrics,
  UTILITY_CATEGORIES,
  SITES,
  SUPPLIERS,
  READING_TYPES,
} from '../data/emissionFactors.js';
import {
  exportInvoicesToCsv,
  parseCsvToInvoices,
  createPdfBlobUrl,
} from '../services/storageService.js';
import { RevealText } from './AnimatedText.jsx';

export default function InvoiceTable({
  invoices,
  onAddInvoice,
  onEditInvoice,
  onDuplicateInvoice,
  onDeleteInvoice,
  onBulkImport,
  isOwnerUnlocked = false,
  onRequestOwnerUnlock,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [readingFilter, setReadingFilter] = useState('all');
  const [importError, setImportError] = useState('');
  const [viewingPdfInvoice, setViewingPdfInvoice] = useState(null);
  const [activePdfBlobUrl, setActivePdfBlobUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!viewingPdfInvoice?.pdfAttachment?.dataUrl) {
      setActivePdfBlobUrl(null);
      return;
    }
    const url = createPdfBlobUrl(viewingPdfInvoice.pdfAttachment.dataUrl);
    setActivePdfBlobUrl(url);
    return () => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [viewingPdfInvoice]);

  const filtered = useMemo(() => {
    return invoices
      .filter((inv) => {
        const invSite = inv.siteName || inv.facility || '';
        const invReading = inv.readingType || 'Actual';

        if (categoryFilter !== 'all' && inv.category !== categoryFilter) {
          return false;
        }
        if (siteFilter !== 'all' && invSite !== siteFilter) {
          return false;
        }
        if (supplierFilter !== 'all' && inv.supplier !== supplierFilter) {
          return false;
        }
        if (readingFilter !== 'all' && invReading !== readingFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const hay = [
            inv.invoiceNumber,
            inv.invoiceDate,
            inv.supplier,
            invSite,
            inv.notes,
            inv.pdfAttachment?.name,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        (b.billingPeriodStart || '').localeCompare(a.billingPeriodStart || '')
      );
  }, [
    invoices,
    categoryFilter,
    siteFilter,
    supplierFilter,
    readingFilter,
    searchQuery,
  ]);

  const handleDownloadCsv = () => {
    const csvContent = exportInvoicesToCsv(filtered);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uk-esg-utility-invoices-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const sampleTemplate = [
      'Invoice Number,Invoice Date,Site Name,Supplier,Category,Billing Start,Billing End,Usage,Unit,Net Cost,VAT Rate,Reading Type,Notes',
      'INV-2026-001,2026-02-03,Head Office London,Octopus,Electricity,2026-01-01,2026-01-31,14500,kWh,3190.00,20,Actual,January electricity bill',
      'INV-2026-002,2026-02-04,Office Sheffield,EDF,Natural Gas,2026-01-01,2026-01-31,4200,kWh,336.00,5,Actual,De minimis 5% VAT rate',
      'INV-2026-003,2026-02-05,Office Leeds,EON,Electricity,2026-01-01,2026-01-31,8900,kWh,1958.00,20,Estimated,Estimated meter reading',
    ].join('\n');

    const blob = new Blob([sampleTemplate], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uk-esg-invoice-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const parsed = parseCsvToInvoices(text);
        if (parsed.length === 0) {
          setImportError('No valid invoice rows found in CSV.');
          return;
        }
        onBulkImport(parsed);
      } catch (err) {
        setImportError(err.message || 'Failed to parse CSV file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const getCategoryIcon = (cat) => {
    if (cat === 'electricity')
      return <Zap className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
    if (cat === 'natural_gas')
      return <Flame className="w-3.5 h-3.5 text-amber-700 shrink-0" />;
    return <Droplets className="w-3.5 h-3.5 text-cyan-700 shrink-0" />;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Section Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
            Audit Ledger & Document Archive
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 mt-0.5">
            <RevealText text="Utility Invoices & Meter Records" />
          </h1>
        </div>

        {/* Legacy Excel Spreadsheet Ingestion Notice (Disabled for Testing Phase) */}
        <div className="flex items-center gap-2.5 bg-slate-100/90 border border-slate-200/90 rounded-lg px-3 py-2">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
            title="Legacy Excel (.xlsx / .xls) workbook upload is disabled during the current testing phase"
          >
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Upload Legacy Excel Spreadsheets (.xlsx)</span>
          </button>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-300/60">
            Testing Phase · Locked
          </span>
        </div>
      </div>

      {/* Filter & Actions Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by invoice ref, date, supplier, site name, or PDF filename..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isOwnerUnlocked && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Download CSV template"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  CSV Template
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import CSV
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV ({filtered.length})
            </button>
            {isOwnerUnlocked ? (
              <button
                type="button"
                onClick={onAddInvoice}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Utility Invoice
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequestOwnerUnlock}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors"
                title="Data input and edits are restricted to the repository owner (Mhutt97)"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Read-Only · Owner Unlock
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Stream:
            </span>
            {[
              { id: 'all', label: 'All' },
              { id: 'electricity', label: 'Electricity (Scope 2)' },
              { id: 'natural_gas', label: 'Natural Gas (Scope 1)' },
              { id: 'water', label: 'Water' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  categoryFilter === c.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Site:
            </span>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs font-medium"
            >
              <option value="all">All Sites</option>
              {SITES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <span className="text-[11px] uppercase tracking-wider text-slate-400 ml-1">
              Supplier:
            </span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs font-medium"
            >
              <option value="all">All Suppliers</option>
              {SUPPLIERS.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>

            <span className="text-[11px] uppercase tracking-wider text-slate-400 ml-1">
              Reading:
            </span>
            <select
              value={readingFilter}
              onChange={(e) => setReadingFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs font-medium"
            >
              <option value="all">All Readings</option>
              {READING_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {importError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {importError}
          </div>
        )}
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase tracking-[0.1em] text-slate-500">
                <th className="py-3 px-4">Invoice Ref & Tax Date</th>
                <th className="py-3 px-4">Site Name & Provider</th>
                <th className="py-3 px-4">Stream</th>
                <th className="py-3 px-4 text-right">Usage</th>
                <th className="py-3 px-4 text-right">GHG (tCO₂e)</th>
                <th className="py-3 px-4 text-right">Net (£)</th>
                <th className="py-3 px-4 text-right">VAT (£)</th>
                <th className="py-3 px-4 text-right">Gross (£ GBP)</th>
                <th className="py-3 px-4">Reading</th>
                <th className="py-3 px-4">PDF Invoice</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="py-14 text-center text-slate-400 text-xs"
                  >
                    <div className="font-medium text-slate-600">
                      No utility invoice records in the ledger
                    </div>
                    <p className="text-slate-400 mt-1">
                      Log a utility invoice or import a verified CSV file to
                      populate the ledger.
                    </p>
                    {isOwnerUnlocked ? (
                      <button
                        type="button"
                        onClick={onAddInvoice}
                        className="mt-3 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                      >
                        + Log Utility Invoice
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onRequestOwnerUnlock}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-slate-200 font-semibold hover:bg-slate-800 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        Owner Unlock to Add Data
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const m = calculateInvoiceEsgMetrics(inv);
                  const catName =
                    UTILITY_CATEGORIES[inv.category]?.name || inv.category;
                  const siteName = inv.siteName || inv.facility || SITES[0];
                  const usageVal = Number(inv.usage ?? inv.quantity) || 0;
                  const netVal = Number(inv.netCost ?? inv.cost) || 0;
                  const vatRateVal =
                    inv.vatRate !== undefined ? Number(inv.vatRate) : 20;
                  const vatAmtVal =
                    inv.vatAmount !== undefined
                      ? Number(inv.vatAmount)
                      : netVal * (vatRateVal / 100);
                  const grossVal =
                    inv.grossCost !== undefined
                      ? Number(inv.grossCost)
                      : netVal + vatAmtVal;
                  const readingType = inv.readingType || 'Actual';

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {inv.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Issued: {inv.invoiceDate || inv.billingPeriodEnd}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {inv.billingPeriodStart} → {inv.billingPeriodEnd}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {siteName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {inv.supplier}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(inv.category)}
                          <div>
                            <div className="font-medium text-slate-800">
                              {catName}
                            </div>
                            <div className="text-[10px] uppercase text-slate-400">
                              {m.scope}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right tabular-nums">
                        <div className="font-semibold text-slate-900">
                          {usageVal.toLocaleString('en-GB')} {inv.unit}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {inv.category !== 'water'
                            ? `${(m.normalizedEnergyKwh / 1000).toFixed(2)} MWh`
                            : `${m.normalizedWaterM3.toFixed(1)} m³`}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right tabular-nums">
                        <span className="font-semibold text-slate-900">
                          {m.co2eTonnes.toFixed(3)}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400">t</span>
                      </td>

                      <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                        £
                        {netVal.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-3 px-4 text-right tabular-nums">
                        <div className="text-slate-700">
                          £
                          {vatAmtVal.toLocaleString('en-GB', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {vatRateVal}% VAT
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900">
                        £
                        {grossVal.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-3 px-4">
                        {readingType === 'Actual' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-800 border border-teal-200">
                            <CheckCircle2 className="w-3 h-3 text-teal-600" />
                            Actual
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Estimated
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {inv.pdfAttachment?.dataUrl ? (
                          <button
                            type="button"
                            onClick={() => setViewingPdfInvoice(inv)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-800 transition-colors"
                            title={inv.pdfAttachment.name}
                          >
                            <FileText className="w-3 h-3 text-slate-600" />
                            <span>View PDF</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-300">
                            —
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isOwnerUnlocked ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditInvoice(inv)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                              title="Amend record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicateInvoice(inv)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                              title="Duplicate invoice"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteInvoice(inv.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider select-none"
                            title="Edits are locked to repository owner (Mhutt97)"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            Locked
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

      {/* Stored PDF Document Viewer Modal */}
      {viewingPdfInvoice && viewingPdfInvoice.pdfAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-teal-400 shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold truncate">
                    {viewingPdfInvoice.pdfAttachment.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Invoice {viewingPdfInvoice.invoiceNumber} ·{' '}
                    {viewingPdfInvoice.siteName} ·{' '}
                    {viewingPdfInvoice.supplier}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={
                    activePdfBlobUrl || viewingPdfInvoice.pdfAttachment.dataUrl
                  }
                  download={viewingPdfInvoice.pdfAttachment.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => setViewingPdfInvoice(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100">
              {activePdfBlobUrl && (
                <iframe
                  title={viewingPdfInvoice.pdfAttachment.name}
                  src={activePdfBlobUrl}
                  className="w-full h-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
