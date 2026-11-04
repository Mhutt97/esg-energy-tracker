import React, { useState, useMemo, useRef } from 'react';
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
} from '../services/storageService.js';

export default function InvoiceTable({
  invoices,
  onAddInvoice,
  onEditInvoice,
  onDuplicateInvoice,
  onDeleteInvoice,
  onBulkImport,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [readingFilter, setReadingFilter] = useState('all');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

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
          const hay = [inv.invoiceNumber, inv.supplier, invSite, inv.notes]
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
      'Invoice Number,Site Name,Supplier,Category,Billing Start,Billing End,Usage,Unit,Net Cost,VAT Rate,Reading Type,Notes',
      'INV-2026-001,Head Office London,Octopus,Electricity,2026-01-01,2026-01-31,14500,kWh,3190.00,20,Actual,January electricity bill',
      'INV-2026-002,Office Sheffield,EDF,Natural Gas,2026-01-01,2026-01-31,4200,kWh,336.00,5,Actual,De minimis 5% VAT rate',
      'INV-2026-003,Office Leeds,EON,Electricity,2026-01-01,2026-01-31,8900,kWh,1958.00,20,Estimated,Estimated meter reading',
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
      return <Zap className="w-4 h-4 text-blue-600 shrink-0" />;
    if (cat === 'natural_gas')
      return <Flame className="w-4 h-4 text-amber-600 shrink-0" />;
    return <Droplets className="w-4 h-4 text-cyan-600 shrink-0" />;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice #, supplier, site name, or notes..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
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
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              title="Download sample CSV template for bulk upload"
            >
              <FileDown className="w-3.5 h-3.5" />
              CSV Template
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition"
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV ({filtered.length})
            </button>
            <button
              type="button"
              onClick={onAddInvoice}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Log Utility Invoice
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Category:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'electricity', label: 'Electricity (Scope 2)' },
              { id: 'natural_gas', label: 'Natural Gas & Fuels (Scope 1)' },
              { id: 'water', label: 'Water' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
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
            <span className="font-semibold text-slate-500">Site Name:</span>
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

            <span className="font-semibold text-slate-500 ml-1">Supplier:</span>
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

            <span className="font-semibold text-slate-500 ml-1">
              Reading Type:
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Invoice & Period</th>
                <th className="py-3 px-4">Site Name & Supplier</th>
                <th className="py-3 px-4">Category & Scope</th>
                <th className="py-3 px-4 text-right">Usage</th>
                <th className="py-3 px-4 text-right">GHG Emissions</th>
                <th className="py-3 px-4 text-right">Net (£)</th>
                <th className="py-3 px-4 text-right">VAT (£)</th>
                <th className="py-3 px-4 text-right">Gross (£ GBP)</th>
                <th className="py-3 px-4">Reading Type</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-12 text-center text-slate-400 text-sm"
                  >
                    <div>No utility invoices logged yet.</div>
                    <button
                      type="button"
                      onClick={onAddInvoice}
                      className="mt-2 text-emerald-600 font-semibold hover:underline"
                    >
                      + Log your first utility invoice
                    </button>
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
                      className="hover:bg-slate-50/80 transition"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {inv.invoiceNumber}
                        </div>
                        <div className="text-xs text-slate-500">
                          {inv.billingPeriodStart} → {inv.billingPeriodEnd}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {siteName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {inv.supplier}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(inv.category)}
                          <div>
                            <div className="font-medium text-slate-800 text-xs">
                              {catName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {m.scope}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-semibold text-slate-900">
                          {usageVal.toLocaleString()} {inv.unit}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {inv.category !== 'water'
                            ? `${(m.normalizedEnergyKwh / 1000).toFixed(2)} MWh`
                            : `${m.normalizedWaterM3.toFixed(1)} m³`}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-emerald-700">
                          {m.co2eTonnes.toFixed(3)}
                        </span>{' '}
                        <span className="text-xs text-slate-400">tCO₂e</span>
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        £
                        {netVal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-medium text-slate-700">
                          £
                          {vatAmtVal.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {vatRateVal}% VAT
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        £
                        {grossVal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-3 px-4">
                        {readingType === 'Actual' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Actual
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Estimated
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditInvoice(inv)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                            title="Edit invoice"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateInvoice(inv)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                            title="Duplicate invoice for next billing cycle"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteInvoice(inv.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                            title="Delete invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
  );
}
