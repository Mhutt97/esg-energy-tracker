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
      return <Zap className="w-3.5 h-3.5 text-[#121211] shrink-0" />;
    if (cat === 'natural_gas')
      return <Flame className="w-3.5 h-3.5 text-[#D9381E] shrink-0" />;
    return <Droplets className="w-3.5 h-3.5 text-[#1B4332] shrink-0" />;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Editorial Section Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#121211]/10 pb-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D9381E]">
            02 / Primary Audit Archive
          </div>
          <h1 className="font-editorial text-4xl sm:text-5xl text-[#121211] mt-1">
            <RevealText text="Utility Invoices & Verified Meter Ledger" />
          </h1>
        </div>

        {/* Legacy Excel Spreadsheet Ingestion Notice (Disabled for Testing Phase) */}
        <div className="flex items-center gap-2.5 bg-[#EFECE6]/80 border border-[#121211]/[0.08] rounded-full px-4 py-2">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 text-xs font-medium text-[#8C8982] cursor-not-allowed select-none"
            title="Legacy Excel (.xlsx / .xls) workbook upload is disabled during the current testing phase"
          >
            <Lock className="w-3.5 h-3.5 text-[#8C8982]" />
            <span>Upload Legacy Excel Spreadsheets (.xlsx)</span>
          </button>
          <span className="text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white text-[#575550] border border-[#121211]/10">
            Testing Phase · Locked
          </span>
        </div>
      </div>

      {/* Floating Glass Filter & Actions Bar */}
      <div className="ag-glass rounded-[28px] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#8C8982] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by invoice reference, date, supplier, site name, or PDF filename..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-[#121211]/10 rounded-full focus:outline-none focus:border-[#121211] transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
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
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#575550] bg-[#EFECE6] hover:bg-[#121211] hover:text-white rounded-full transition-colors"
                  title="Download CSV template"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  CSV Template
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#121211] bg-white border border-[#121211]/15 hover:bg-[#EFECE6] rounded-full transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import CSV
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#121211] bg-white border border-[#121211]/15 hover:bg-[#EFECE6] rounded-full transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV ({filtered.length})
            </button>
            {isOwnerUnlocked ? (
              <button
                type="button"
                onClick={onAddInvoice}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium text-white bg-[#121211] hover:bg-[#D9381E] rounded-full shadow-sm transition-colors duration-300"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Utility Invoice
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequestOwnerUnlock}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium text-white bg-[#121211] hover:bg-[#D9381E] rounded-full shadow-sm transition-colors duration-300"
                title="Data input and edits are restricted to the repository owner (Mhutt97)"
              >
                <Lock className="w-3.5 h-3.5 text-[#D9381E]" />
                Read-Only · Owner Unlock
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#121211]/[0.07] text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-widest text-[#8C8982] mr-1">
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
                className={`px-3.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === c.id
                    ? 'bg-[#121211] text-white'
                    : 'bg-[#EFECE6] text-[#575550] hover:text-[#121211]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            <span className="text-[11px] uppercase tracking-widest text-[#8C8982]">
              Site:
            </span>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="bg-white border border-[#121211]/12 rounded-full px-3 py-1 text-xs font-medium"
            >
              <option value="all">All Sites</option>
              {SITES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <span className="text-[11px] uppercase tracking-widest text-[#8C8982] ml-1">
              Supplier:
            </span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-white border border-[#121211]/12 rounded-full px-3 py-1 text-xs font-medium"
            >
              <option value="all">All Suppliers</option>
              {SUPPLIERS.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>

            <span className="text-[11px] uppercase tracking-widest text-[#8C8982] ml-1">
              Reading:
            </span>
            <select
              value={readingFilter}
              onChange={(e) => setReadingFilter(e.target.value)}
              className="bg-white border border-[#121211]/12 rounded-full px-3 py-1 text-xs font-medium"
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
          <div className="p-3.5 rounded-2xl bg-[#D9381E]/10 border border-[#D9381E]/25 text-xs text-[#D9381E]">
            {importError}
          </div>
        )}
      </div>

      {/* Invoices Editorial Table */}
      <div className="ag-card rounded-[28px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#EFECE6]/60 border-b border-[#121211]/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#575550]">
                <th className="py-4 px-5">Invoice Ref &amp; Tax Date</th>
                <th className="py-4 px-4">Site Name &amp; Provider</th>
                <th className="py-4 px-4">Stream</th>
                <th className="py-4 px-4 text-right">Usage</th>
                <th className="py-4 px-4 text-right">GHG (tCO₂e)</th>
                <th className="py-4 px-4 text-right">Net (£)</th>
                <th className="py-4 px-4 text-right">VAT (£)</th>
                <th className="py-4 px-4 text-right">Gross (£ GBP)</th>
                <th className="py-4 px-4">Reading</th>
                <th className="py-4 px-4">PDF Dossier</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121211]/[0.06] text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="py-16 text-center text-[#8C8982] text-xs"
                  >
                    <div className="font-editorial text-2xl text-[#121211]">
                      No utility invoice records in the ledger
                    </div>
                    <p className="text-[#8C8982] mt-1">
                      Log a utility invoice or import a verified CSV file to
                      populate the ledger.
                    </p>
                    {isOwnerUnlocked ? (
                      <button
                        type="button"
                        onClick={onAddInvoice}
                        className="mt-4 px-5 py-2 rounded-full bg-[#121211] text-white font-medium hover:bg-[#D9381E] transition-colors"
                      >
                        + Log Utility Invoice
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onRequestOwnerUnlock}
                        className="mt-4 inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#121211] text-white font-medium hover:bg-[#D9381E] transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5 text-[#D9381E]" />
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
                      className="hover:bg-[#EFECE6]/40 transition-colors"
                    >
                      <td className="py-4 px-5">
                        <div className="font-semibold text-[#121211]">
                          {inv.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-[#575550]">
                          Issued: {inv.invoiceDate || inv.billingPeriodEnd}
                        </div>
                        <div className="text-[10px] text-[#8C8982]">
                          {inv.billingPeriodStart} → {inv.billingPeriodEnd}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-medium text-[#121211]">
                          {siteName}
                        </div>
                        <div className="text-[11px] text-[#8C8982]">
                          {inv.supplier}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(inv.category)}
                          <div>
                            <div className="font-medium text-[#121211]">
                              {catName}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-[#8C8982]">
                              {m.scope}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right tabular-nums">
                        <div className="font-semibold text-[#121211]">
                          {usageVal.toLocaleString('en-GB')} {inv.unit}
                        </div>
                        <div className="text-[10px] text-[#8C8982]">
                          {inv.category !== 'water'
                            ? `${(m.normalizedEnergyKwh / 1000).toFixed(2)} MWh`
                            : `${m.normalizedWaterM3.toFixed(1)} m³`}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right tabular-nums">
                        <span className="font-semibold text-[#121211]">
                          {m.co2eTonnes.toFixed(3)}
                        </span>{' '}
                        <span className="text-[10px] text-[#8C8982]">t</span>
                      </td>

                      <td className="py-4 px-4 text-right tabular-nums text-[#575550]">
                        £
                        {netVal.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-4 px-4 text-right tabular-nums">
                        <div className="text-[#575550]">
                          £
                          {vatAmtVal.toLocaleString('en-GB', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[10px] text-[#8C8982]">
                          {vatRateVal}% VAT
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right tabular-nums font-semibold text-[#121211]">
                        £
                        {grossVal.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-4 px-4">
                        {readingType === 'Actual' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#1B4332]/10 text-[#1B4332]">
                            <CheckCircle2 className="w-3 h-3" />
                            Actual
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#B45309]/10 text-[#B45309]">
                            <Clock className="w-3 h-3" />
                            Estimated
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        {inv.pdfAttachment?.dataUrl ? (
                          <button
                            type="button"
                            onClick={() => setViewingPdfInvoice(inv)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#121211]/15 bg-white hover:bg-[#121211] hover:text-white text-[11px] font-medium text-[#121211] transition-colors"
                            title={inv.pdfAttachment.name}
                          >
                            <FileText className="w-3 h-3" />
                            <span>View PDF</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#8C8982]/50">
                            —
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right">
                        {isOwnerUnlocked ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditInvoice(inv)}
                              className="p-1.5 text-[#575550] hover:text-[#121211] hover:bg-[#EFECE6] rounded-full transition-colors"
                              title="Amend record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicateInvoice(inv)}
                              className="p-1.5 text-[#575550] hover:text-[#121211] hover:bg-[#EFECE6] rounded-full transition-colors"
                              title="Duplicate invoice"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteInvoice(inv.id)}
                              className="p-1.5 text-[#8C8982] hover:text-[#D9381E] hover:bg-[#D9381E]/10 rounded-full transition-colors"
                              title="Delete invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFECE6] text-[#8C8982] text-[10px] font-medium uppercase tracking-wider select-none"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121211]/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[28px] border border-[#121211]/10 shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-[#121211] text-white flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-[#D9381E] shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold truncate">
                    {viewingPdfInvoice.pdfAttachment.name}
                  </div>
                  <div className="text-[10px] text-white/60">
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => setViewingPdfInvoice(null)}
                  className="p-1.5 text-white/60 hover:text-white rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#EFECE6]">
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
