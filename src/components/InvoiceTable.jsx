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
  REPORTING_FRAMEWORKS,
} from '../data/emissionFactors.js';
import {
  exportInvoicesToCsv,
  parseCsvToInvoices,
  createPdfBlobUrl,
} from '../services/storageService.js';

export default function InvoiceTable({
  invoices,
  onAddInvoice,
  onEditInvoice,
  onDuplicateInvoice,
  onDeleteInvoice,
  onBulkImport,
  isOwnerUnlocked = false,
  onRequestOwnerUnlock,
  selectedFramework = REPORTING_FRAMEWORKS.CSRD,
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
      return <Zap className="w-3 h-3 text-emerald-600 shrink-0" />;
    if (cat === 'natural_gas')
      return <Flame className="w-3 h-3 text-teal-600 shrink-0" />;
    return <Droplets className="w-3 h-3 text-blue-600 shrink-0" />;
  };

  return (
    <div className="space-y-3">
      {/* Compact Header & Controls Bar */}
      <div className="b2b-panel rounded p-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Utility Invoice Audit Ledger
            </h2>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono-num text-[10px] font-semibold text-slate-700">
              {filtered.length} Records
            </span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-mono-num text-[10px] font-semibold text-indigo-700">
              {selectedFramework.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Primary source invoice ledger with UK DEFRA conversion factors, GBP
            (£) VAT breakdown, and embedded PDF documentation.
          </p>
        </div>

        {/* Action Buttons + Disabled Excel Testing Notice */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-400 select-none">
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Upload Legacy Excel (.xlsx)</span>
            <span className="px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono-num text-[9px] uppercase">
              Testing
            </span>
          </div>

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
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200"
              >
                <FileDown className="w-3.5 h-3.5" />
                Template
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded"
              >
                <Upload className="w-3.5 h-3.5" />
                Import CSV
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV ({filtered.length})
          </button>

          {isOwnerUnlocked ? (
            <button
              type="button"
              onClick={onAddInvoice}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Utility Invoice
            </button>
          ) : (
            <button
              type="button"
              onClick={onRequestOwnerUnlock}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded"
            >
              <Lock className="w-3 h-3 text-amber-600" />
              Unlock Edits
            </button>
          )}
        </div>
      </div>

      {/* Inline Filter Bar */}
      <div className="b2b-panel rounded p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Streams' },
            { id: 'electricity', label: 'Electricity (Scope 2)' },
            { id: 'natural_gas', label: 'Natural Gas (Scope 1)' },
            { id: 'water', label: 'Water (Scope 3)' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                categoryFilter === c.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter invoice ref, date, PDF..."
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:bg-white focus:border-slate-900"
            />
          </div>

          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium"
          >
            <option value="all">All Facilities</option>
            {SITES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium"
          >
            <option value="all">All Suppliers</option>
            {SUPPLIERS.map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>

          <select
            value={readingFilter}
            onChange={(e) => setReadingFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium"
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
        <div className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
          {importError}
        </div>
      )}

      {/* High-Density Interactive Data Table */}
      <div className="b2b-panel rounded overflow-hidden">
        <div className="overflow-x-auto max-h-[68vh]">
          <table className="w-full text-left border-collapse b2b-table">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Invoice Ref</th>
                <th className="py-2.5 px-2.5">Issue Date</th>
                <th className="py-2.5 px-2.5">Billing Period</th>
                <th className="py-2.5 px-3">Facility Name</th>
                <th className="py-2.5 px-2.5">Supplier</th>
                <th className="py-2.5 px-2.5">Stream &amp; Scope</th>
                <th className="py-2.5 px-2.5 text-right">Metered Usage</th>
                <th className="py-2.5 px-2.5 text-right">MT CO₂e</th>
                <th className="py-2.5 px-2.5 text-right">Net (£)</th>
                <th className="py-2.5 px-2.5 text-right">VAT (£)</th>
                <th className="py-2.5 px-3 text-right">Gross (£ GBP)</th>
                <th className="py-2.5 px-2.5">Reading</th>
                <th className="py-2.5 px-2.5">PDF</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className="py-12 text-center text-slate-500 text-xs"
                  >
                    <div className="font-semibold text-slate-800">
                      No utility invoice records in current filter view
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Log a utility invoice or import a verified CSV file to
                      populate the ledger.
                    </p>
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
                    <tr key={inv.id}>
                      <td className="py-2 px-3 font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2 px-2.5 font-mono-num text-[11px] text-slate-600 whitespace-nowrap">
                        {inv.invoiceDate || inv.billingPeriodEnd}
                      </td>
                      <td className="py-2 px-2.5 font-mono-num text-[11px] text-slate-500 whitespace-nowrap">
                        {inv.billingPeriodStart} → {inv.billingPeriodEnd}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">
                        {siteName}
                      </td>
                      <td className="py-2 px-2.5 font-medium text-slate-700 whitespace-nowrap">
                        {inv.supplier}
                      </td>
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {getCategoryIcon(inv.category)}
                          <span className="font-medium text-slate-800">
                            {catName}
                          </span>
                          <span className="font-mono-num text-[10px] px-1 rounded bg-slate-100 text-slate-600">
                            {m.scope}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                        {usageVal.toLocaleString('en-GB')} {inv.unit}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num font-semibold text-emerald-700 whitespace-nowrap">
                        {m.co2eTonnes.toFixed(3)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num text-slate-700 whitespace-nowrap">
                        £
                        {netVal.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num text-slate-500 whitespace-nowrap">
                        £{vatAmtVal.toFixed(2)}{' '}
                        <span className="text-[10px]">({vatRateVal}%)</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono-num font-bold text-slate-900 whitespace-nowrap">
                        £
                        {grossVal.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        {readingType === 'Actual' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono-num text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            ACTUAL
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono-num text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-2.5 h-2.5" />
                            ESTIMATED
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        {inv.pdfAttachment?.dataUrl ? (
                          <button
                            type="button"
                            onClick={() => setViewingPdfInvoice(inv)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 font-mono-num text-[10px] font-semibold text-slate-800"
                            title={inv.pdfAttachment.name}
                          >
                            <FileText className="w-2.5 h-2.5 text-indigo-600" />
                            PDF
                          </button>
                        ) : (
                          <span className="font-mono-num text-[10px] text-slate-300">
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {isOwnerUnlocked ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditInvoice(inv)}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                              title="Amend record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicateInvoice(inv)}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                              title="Duplicate invoice"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteInvoice(inv.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-mono-num text-[10px] uppercase select-none">
                            <Lock className="w-2.5 h-2.5" />
                            LOCKED
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="bg-white rounded border border-slate-300 max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-mono-num font-semibold truncate">
                    {viewingPdfInvoice.pdfAttachment.name}
                  </div>
                  <div className="text-[10px] font-mono-num text-slate-400">
                    {viewingPdfInvoice.invoiceNumber} ·{' '}
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white"
                >
                  <ExternalLink className="w-3 h-3" />
                  Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => setViewingPdfInvoice(null)}
                  className="p-1 text-slate-400 hover:text-white rounded"
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
