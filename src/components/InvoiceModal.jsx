import React, { useState, useEffect, useMemo } from 'react';
import { X, Calculator, Zap, Flame, Droplets } from 'lucide-react';
import {
  UTILITY_CATEGORIES,
  SUPPLIERS,
  SITES,
  READING_TYPES,
  VAT_RATES,
  calculateInvoiceEsgMetrics,
} from '../data/emissionFactors.js';

const EMPTY_FORM = {
  invoiceNumber: '',
  supplier: SUPPLIERS[0], // EDF
  siteName: SITES[0], // Head Office London
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
};

export default function InvoiceModal({
  isOpen,
  onClose,
  onSave,
  editingInvoice,
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
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
        siteName: editingInvoice.siteName || editingInvoice.facility || SITES[0],
        supplier: SUPPLIERS.includes(editingInvoice.supplier)
          ? editingInvoice.supplier
          : SUPPLIERS[0],
        readingType: READING_TYPES.includes(editingInvoice.readingType)
          ? editingInvoice.readingType
          : 'Actual',
        usage: editingInvoice.usage ?? editingInvoice.quantity ?? '',
        netCost: net,
        vatRate: rate,
        vatAmount: vat.toFixed(2),
        grossCost: gross.toFixed(2),
        currency: 'GBP',
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(
          Math.floor(100 + Math.random() * 900)
        )}`,
      });
    }
  }, [editingInvoice, isOpen]);

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

  const liveMetrics = useMemo(() => {
    return calculateInvoiceEsgMetrics(form);
  }, [form]);

  if (!isOpen) return null;

  const currentCat =
    UTILITY_CATEGORIES[form.category] || UTILITY_CATEGORIES.electricity;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.invoiceNumber || !form.supplier || !form.siteName) {
      return;
    }
    const netNum = Number(form.netCost) || 0;
    const rateNum = Number(form.vatRate);
    const vatNum = Number((netNum * (rateNum / 100)).toFixed(2));
    const grossNum = Number((netNum + vatNum).toFixed(2));

    onSave({
      ...form,
      id: editingInvoice?.id || `inv-${Date.now()}`,
      usage: Number(form.usage) || 0,
      netCost: netNum,
      vatRate: rateNum,
      vatAmount: vatNum,
      grossCost: grossNum,
      currency: 'GBP',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {editingInvoice
                ? 'Edit Utility Invoice Record'
                : 'Log Utility Invoice'}
            </h2>
            <p className="text-xs text-slate-300">
              Input UK utility invoice usage and Net / VAT / Gross costs (£ GBP)
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

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
        >
          {/* Step 1: Utility Category Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              1. Utility Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'electricity',
                  title: 'Electricity',
                  sub: 'Scope 2 · kWh, MWh',
                  icon: Zap,
                  activeClass:
                    'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20',
                },
                {
                  id: 'natural_gas',
                  title: 'Natural Gas & Fuels',
                  sub: 'Scope 1 · kWh, m³, litres',
                  icon: Flame,
                  activeClass:
                    'border-amber-600 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20',
                },
                {
                  id: 'water',
                  title: 'Water & Wastewater',
                  sub: 'Water · m³, kL',
                  icon: Droplets,
                  activeClass:
                    'border-cyan-600 bg-cyan-50/70 text-cyan-900 ring-2 ring-cyan-500/20',
                },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = form.category === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleCategoryChange(item.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? item.activeClass
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-bold">{item.title}</div>
                      <div className="text-xs opacity-80">{item.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Invoice Number, Utilities Provider Dropdown, Site Name Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Number *
              </label>
              <input
                type="text"
                required
                value={form.invoiceNumber}
                onChange={(e) =>
                  setForm({ ...form, invoiceNumber: e.target.value })
                }
                placeholder="e.g. INV-2026-001"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Utilities Provider *
              </label>
              <select
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {SUPPLIERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Site Name *
              </label>
              <select
                value={form.siteName}
                onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {SITES.map((site) => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Billing Period & Reading Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Billing Start Date *
              </label>
              <input
                type="date"
                required
                value={form.billingPeriodStart}
                onChange={(e) =>
                  setForm({ ...form, billingPeriodStart: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Billing End Date *
              </label>
              <input
                type="date"
                required
                value={form.billingPeriodEnd}
                onChange={(e) =>
                  setForm({ ...form, billingPeriodEnd: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reading Type *
              </label>
              <select
                value={form.readingType}
                onChange={(e) =>
                  setForm({ ...form, readingType: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {READING_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3: Usage & Net / VAT / Gross (£ GBP) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Usage *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={form.usage}
                  onChange={(e) => setForm({ ...form, usage: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unit of Measure *
                </label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {currentCat.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Net, VAT Rate (20%, 5%, 0%), VAT (£), Gross (£), Currency (GBP) */}
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Net (£) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.netCost}
                  onChange={(e) =>
                    handleNetOrVatChange(e.target.value, form.vatRate)
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Energy VAT Rate *
                </label>
                <select
                  value={form.vatRate}
                  onChange={(e) =>
                    handleNetOrVatChange(form.netCost, Number(e.target.value))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {VAT_RATES.map((vr) => (
                    <option key={vr.value} value={vr.value}>
                      {vr.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  VAT (£)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`£${form.vatAmount}`}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gross (£ GBP)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`£${form.grossCost}`}
                  className="w-full px-3 py-2 text-sm border border-emerald-300 rounded-lg bg-emerald-50 text-emerald-900 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Invoice Notes / Meter Reference
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional meter reference or billing note..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Live Calculated ESG Preview Banner */}
          <div className="p-4 rounded-xl bg-emerald-950 text-white flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-800/80 text-emerald-300">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
                  Calculated ESG Emissions ({liveMetrics.scope})
                </div>
                <div className="text-xs text-slate-300">
                  {liveMetrics.effectiveFactorLabel}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-right">
              {form.category !== 'water' ? (
                <div>
                  <div className="text-[11px] text-slate-400">
                    Normalized Energy
                  </div>
                  <div className="text-sm font-bold text-white">
                    {liveMetrics.normalizedEnergyKwh.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{' '}
                    kWh
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[11px] text-slate-400">Water Volume</div>
                  <div className="text-sm font-bold text-white">
                    {liveMetrics.normalizedWaterM3.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{' '}
                    m³
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] text-slate-400">GHG Emissions</div>
                <div className="text-base font-bold text-emerald-400">
                  {liveMetrics.co2eTonnes.toFixed(3)} tCO₂e
                </div>
              </div>
            </div>
          </div>

          {/* Submit Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              {editingInvoice ? 'Save Changes' : 'Save Utility Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
