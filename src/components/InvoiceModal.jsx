import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Zap,
  Flame,
  Droplets,
  FileText,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  UTILITY_CATEGORIES,
  SUPPLIERS,
  SITES,
  READING_TYPES,
  VAT_RATES,
  calculateInvoiceEsgMetrics,
  validateInvoiceForm,
} from '../data/emissionFactors.js';
import { createPdfBlobUrl } from '../services/storageService.js';
import { AnimatedNumber } from './AnimatedText.jsx';

const EMPTY_FORM = {
  invoiceNumber: '',
  invoiceDate: '2026-05-02',
  supplier: SUPPLIERS[0],
  siteName: SITES[0],
  category: 'electricity',
  billingPeriodStart: '2026-04-01',
  billingPeriodEnd: '2026-04-30',
  readingType: 'Actual',
  usage: '',
  unit: 'kWh',
  netCost: '',
  vatRate: 20,
  vatAmount: '0.00',
  grossCost: '0.00',
  currency: 'GBP',
  notes: '',
  pdfAttachment: null,
};

export default function InvoiceModal({
  isOpen,
  onClose,
  onSave,
  editingInvoice,
  existingInvoices = [],
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const pdfInputRef = useRef(null);

  useEffect(() => {
    setTouched({});
    setSubmitAttempted(false);
    setPdfError('');

    if (editingInvoice) {
      const net = Number(editingInvoice.netCost ?? editingInvoice.cost) || 0;
      const rate =
        editingInvoice.vatRate !== undefined
          ? Number(editingInvoice.vatRate)
          : 20;
      const vat =
        editingInvoice.vatAmount !== undefined
          ? Number(editingInvoice.vatAmount)
          : Number((net * (rate / 100)).toFixed(2));
      const gross =
        editingInvoice.grossCost !== undefined
          ? Number(editingInvoice.grossCost)
          : Number((net + vat).toFixed(2));

      setForm({
        ...EMPTY_FORM,
        ...editingInvoice,
        invoiceDate:
          editingInvoice.invoiceDate ||
          editingInvoice.billingPeriodEnd ||
          '2026-05-02',
        siteName: editingInvoice.siteName || editingInvoice.facility || SITES[0],
        supplier: SUPPLIERS.includes(editingInvoice.supplier)
          ? editingInvoice.supplier
          : SUPPLIERS[0],
        readingType: READING_TYPES.includes(editingInvoice.readingType)
          ? editingInvoice.readingType
          : 'Actual',
        usage: editingInvoice.usage ?? editingInvoice.quantity ?? '',
        netCost: net > 0 ? String(net) : '',
        vatRate: rate,
        vatAmount: vat.toFixed(2),
        grossCost: gross.toFixed(2),
        currency: 'GBP',
        pdfAttachment: editingInvoice.pdfAttachment || null,
      });
    } else {
      const todayIso = new Date().toISOString().slice(0, 10);
      setForm({
        ...EMPTY_FORM,
        invoiceDate: todayIso,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(
          Math.floor(1000 + Math.random() * 9000)
        )}`,
      });
    }
  }, [editingInvoice, isOpen]);

  const validation = useMemo(() => {
    return validateInvoiceForm(form, existingInvoices, editingInvoice?.id);
  }, [form, existingInvoices, editingInvoice]);

  const liveMetrics = useMemo(() => {
    return calculateInvoiceEsgMetrics(form);
  }, [form]);

  if (!isOpen) return null;

  const currentCat =
    UTILITY_CATEGORIES[form.category] || UTILITY_CATEGORIES.electricity;

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const showError = (field) =>
    (touched[field] || submitAttempted) && validation.errors[field];

  const handleCategoryChange = (newCategory) => {
    const catObj = UTILITY_CATEGORIES[newCategory];
    setForm((prev) => ({
      ...prev,
      category: newCategory,
      unit: catObj.units[0].id,
    }));
  };

  const handleNetOrVatChange = (newNetRaw, newVatRateRaw) => {
    const netNum = Math.max(0, Number(newNetRaw) || 0);
    const rateNum = Number(newVatRateRaw);
    const vatNum = netNum * (rateNum / 100);
    const grossNum = netNum + vatNum;

    setForm((prev) => ({
      ...prev,
      netCost: newNetRaw,
      vatRate: rateNum,
      vatAmount: vatNum.toFixed(2),
      grossCost: grossNum.toFixed(2),
    }));
  };

  const handlePdfUpload = (e) => {
    setPdfError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setPdfError('Only PDF documents (.pdf) are permitted for invoice records.');
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      return;
    }

    // 5 MB limit for database/JSON storage
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setPdfError('PDF file size must be under 5.0 MB for database storage.');
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || '');
      setForm((prev) => ({
        ...prev,
        pdfAttachment: {
          name: file.name,
          size: file.size,
          type: 'application/pdf',
          uploadedAt: new Date().toISOString(),
          dataUrl,
        },
      }));
    };
    reader.onerror = () => {
      setPdfError('Failed to read PDF file.');
    };
    reader.readAsDataURL(file);
  };

  const handlePreviewPdf = () => {
    if (!form.pdfAttachment?.dataUrl) return;
    const blobUrl = createPdfBlobUrl(form.pdfAttachment.dataUrl);
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!validation.isValid || pdfError) {
      return;
    }

    const netNum = Number(form.netCost) || 0;
    const rateNum = Number(form.vatRate);
    const vatNum = Number((netNum * (rateNum / 100)).toFixed(2));
    const grossNum = Number((netNum + vatNum).toFixed(2));

    onSave({
      ...form,
      id: editingInvoice?.id || `inv-${Date.now()}`,
      invoiceNumber: String(form.invoiceNumber).trim(),
      usage: Number(form.usage),
      netCost: netNum,
      vatRate: rateNum,
      vatAmount: vatNum,
      grossCost: grossNum,
      currency: 'GBP',
    });
  };

  const errorList = Object.values(validation.errors);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xl max-w-2xl w-full overflow-hidden my-6">
        {/* Editorial Header */}
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                Ledger Entry Form
              </span>
              <span className="text-slate-700">•</span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-teal-400">
                UK DEFRA Verified
              </span>
            </div>
            <h2 className="text-base font-semibold tracking-tight mt-0.5">
              {editingInvoice
                ? 'Amend Utility Invoice Record'
                : 'Log Utility Invoice'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
        >
          {/* Validation Error Banner (shown if submit attempted with errors) */}
          {submitAttempted && errorList.length > 0 && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 space-y-1 animate-fade-in">
              <div className="font-semibold flex items-center gap-1.5 text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  Please resolve {errorList.length} verification{' '}
                  {errorList.length === 1 ? 'issue' : 'issues'} before saving:
                </span>
              </div>
              <ul className="list-disc list-inside pl-5 text-red-700 space-y-0.5">
                {errorList.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 1. Utility Category Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">
              01 · Utility Stream
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'electricity',
                  title: 'Electricity',
                  sub: 'Scope 2 · kWh / MWh',
                  icon: Zap,
                },
                {
                  id: 'natural_gas',
                  title: 'Natural Gas & Fuels',
                  sub: 'Scope 1 · kWh / m³',
                  icon: Flame,
                },
                {
                  id: 'water',
                  title: 'Water & Wastewater',
                  sub: 'Water · m³ / kL',
                  icon: Droplets,
                },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = form.category === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleCategoryChange(item.id)}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isSelected ? 'text-teal-400' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-semibold">{item.title}</div>
                      <div
                        className={`text-[11px] ${
                          isSelected ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {item.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Invoice Reference, Utilities Provider, Site Name */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">
              02 · Account & Site Allocation
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Invoice Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.invoiceNumber}
                  onBlur={() => markTouched('invoiceNumber')}
                  onChange={(e) =>
                    setForm({ ...form, invoiceNumber: e.target.value })
                  }
                  placeholder="e.g. INV-2026-001"
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none transition-colors ${
                    showError('invoiceNumber')
                      ? 'border-red-400 bg-red-50/40 focus:border-red-600'
                      : 'border-slate-300 bg-white focus:border-slate-900'
                  }`}
                />
                {showError('invoiceNumber') && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {validation.errors.invoiceNumber}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Utilities Provider <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.supplier}
                  onBlur={() => markTouched('supplier')}
                  onChange={(e) =>
                    setForm({ ...form, supplier: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                >
                  {SUPPLIERS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Site Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.siteName}
                  onBlur={() => markTouched('siteName')}
                  onChange={(e) =>
                    setForm({ ...form, siteName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                >
                  {SITES.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. Dates & Reading Type (Invoice Date, Billing Start, Billing End, Reading Type) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">
              03 · Tax Point & Meter Period
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Invoice Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.invoiceDate}
                  onBlur={() => markTouched('invoiceDate')}
                  onChange={(e) =>
                    setForm({ ...form, invoiceDate: e.target.value })
                  }
                  className={`w-full px-2.5 py-2 text-xs border rounded-lg focus:outline-none ${
                    showError('invoiceDate')
                      ? 'border-red-400 bg-red-50/40'
                      : 'border-slate-300 bg-white focus:border-slate-900'
                  }`}
                />
                {showError('invoiceDate') && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {validation.errors.invoiceDate}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Billing Start <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.billingPeriodStart}
                  onBlur={() => markTouched('billingPeriodStart')}
                  onChange={(e) =>
                    setForm({ ...form, billingPeriodStart: e.target.value })
                  }
                  className={`w-full px-2.5 py-2 text-xs border rounded-lg focus:outline-none ${
                    showError('billingPeriodStart')
                      ? 'border-red-400 bg-red-50/40'
                      : 'border-slate-300 bg-white focus:border-slate-900'
                  }`}
                />
                {showError('billingPeriodStart') && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {validation.errors.billingPeriodStart}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Billing End <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.billingPeriodEnd}
                  onBlur={() => markTouched('billingPeriodEnd')}
                  onChange={(e) =>
                    setForm({ ...form, billingPeriodEnd: e.target.value })
                  }
                  className={`w-full px-2.5 py-2 text-xs border rounded-lg focus:outline-none ${
                    showError('billingPeriodEnd')
                      ? 'border-red-400 bg-red-50/40'
                      : 'border-slate-300 bg-white focus:border-slate-900'
                  }`}
                />
                {showError('billingPeriodEnd') && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {validation.errors.billingPeriodEnd}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reading Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.readingType}
                  onBlur={() => markTouched('readingType')}
                  onChange={(e) =>
                    setForm({ ...form, readingType: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                >
                  {READING_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4. Usage & Financial Breakdown (£ GBP Net, VAT, Gross) */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              04 · Metered Usage & Financial Settlement (£ GBP)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Usage <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={form.usage}
                  onBlur={() => markTouched('usage')}
                  onChange={(e) => setForm({ ...form, usage: e.target.value })}
                  placeholder="0.00"
                  className={`w-full px-3 py-2 text-xs font-semibold border rounded-lg focus:outline-none ${
                    showError('usage')
                      ? 'border-red-400 bg-red-50/50'
                      : 'border-slate-300 bg-white focus:border-slate-900'
                  }`}
                />
                {showError('usage') && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {validation.errors.usage}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Unit of Measure <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                >
                  {currentCat.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Net, VAT Rate (20%, 5%, 0%), VAT (£), Gross (£ GBP) */}
            <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Net (£) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={form.netCost}
                  onBlur={() => markTouched('netCost')}
                  onChange={(e) =>
                    handleNetOrVatChange(e.target.value, form.vatRate)
                  }
                  placeholder="0.00"
                  className={`w-full px-3 py-2 text-xs font-semibold border rounded-lg focus:outline-none ${
                    showError('netCost')
                      ? 'border-red-400 bg-red-50/50'
                      : 'border-slate-300 bg-white focus:border-slate-900'
                  }`}
                />
                {showError('netCost') && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {validation.errors.netCost}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Energy VAT Rate <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.vatRate}
                  onChange={(e) =>
                    handleNetOrVatChange(form.netCost, Number(e.target.value))
                  }
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                >
                  {VAT_RATES.map((vr) => (
                    <option key={vr.value} value={vr.value}>
                      {vr.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  VAT (£)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`£${form.vatAmount}`}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-100 text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Gross (£ GBP)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`£${form.grossCost}`}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-900 text-white"
                />
              </div>
            </div>
          </div>

          {/* 5. Invoice PDF Attachment (Stored in Database) & Audit Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Source Invoice PDF (Stored in Database)
              </label>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />
              {!form.pdfAttachment ? (
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="w-full px-3 py-2.5 border border-dashed border-slate-300 hover:border-slate-500 rounded-lg bg-slate-50/60 hover:bg-slate-100/70 text-xs text-slate-600 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Attach Invoice PDF (max 5 MB)</span>
                </button>
              ) : (
                <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-slate-700 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-medium text-slate-900 truncate">
                        {form.pdfAttachment.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {((form.pdfAttachment.size || 0) / 1024).toFixed(1)} KB ·
                        Stored in DB
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handlePreviewPdf}
                      className="p-1 text-slate-600 hover:text-slate-900 rounded"
                      title="Open PDF in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, pdfAttachment: null }));
                        if (pdfInputRef.current) pdfInputRef.current.value = '';
                      }}
                      className="p-1 text-slate-500 hover:text-red-600 rounded"
                      title="Remove PDF"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              {pdfError && (
                <p className="mt-1 text-[11px] text-red-600">{pdfError}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Audit Notes / Meter Reference
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional MPAN / MPRN or reference note..."
                className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          {/* Live Calculated ESG Summary Bar */}
          <div className="p-4 rounded-xl bg-slate-950 text-white flex flex-wrap items-center justify-between gap-4 border border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-teal-400">
                  {liveMetrics.scope} Calculation
                </span>
                {validation.isValid ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    Data Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded">
                    Awaiting Required Fields
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 ">
                {liveMetrics.effectiveFactorLabel}
              </div>
            </div>

            <div className="flex items-center gap-6 text-right ">
              {form.category !== 'water' ? (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Normalized Energy
                  </div>
                  <div className="text-sm font-semibold text-white">
                    <AnimatedNumber
                      value={liveMetrics.normalizedEnergyKwh}
                      decimals={1}
                      suffix=" kWh"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Normalized Volume
                  </div>
                  <div className="text-sm font-semibold text-white">
                    <AnimatedNumber
                      value={liveMetrics.normalizedWaterM3}
                      decimals={2}
                      suffix=" m³"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  GHG Footprint
                </div>
                <div className="text-base font-bold text-teal-400">
                  <AnimatedNumber
                    value={liveMetrics.co2eTonnes}
                    decimals={3}
                    suffix=" tCO₂e"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">
              All fields marked with <span className="text-red-500">*</span> are
              mandatory for ESG audit integrity.
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
              >
                {editingInvoice ? 'Save Amended Record' : 'Commit Invoice Entry'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
