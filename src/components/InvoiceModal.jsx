import React, { useState, useEffect, useMemo } from 'react';
import { X, Calculator, Zap, Flame, Droplets } from 'lucide-react';
import {
  UTILITY_CATEGORIES,
  GRID_REGIONS,
  CURRENCIES,
  calculateInvoiceEsgMetrics,
} from '../data/emissionFactors.js';

const EMPTY_FORM = {
  invoiceNumber: '',
  supplier: '',
  facility: 'HQ - Austin Tech Campus',
  accountNumber: '',
  category: 'electricity',
  subtype: 'grid_electricity',
  billingPeriodStart: '2026-04-01',
  billingPeriodEnd: '2026-04-30',
  invoiceDate: '2026-05-05',
  quantity: '',
  unit: 'kWh',
  renewablePct: 0,
  renewableInstrument: 'None',
  gridRegion: 'US_EPA_AVG',
  customEmissionFactor: '',
  cost: '',
  currency: 'USD',
  status: 'Verified',
  notes: '',
};

export default function InvoiceModal({
  isOpen,
  onClose,
  onSave,
  editingInvoice,
  existingFacilities = [],
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (editingInvoice) {
      setForm({
        ...EMPTY_FORM,
        ...editingInvoice,
        customEmissionFactor:
          editingInvoice.customEmissionFactor !== undefined &&
          editingInvoice.customEmissionFactor !== null
            ? editingInvoice.customEmissionFactor
            : '',
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
      subtype: catObj.subtypes[0].id,
      unit: catObj.units[0].id,
      renewablePct: newCategory === 'electricity' ? prev.renewablePct : 0,
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
    if (!form.invoiceNumber || !form.supplier || !form.facility) {
      return;
    }
    onSave({
      ...form,
      id: editingInvoice?.id || `inv-${Date.now()}`,
      quantity: Number(form.quantity) || 0,
      cost: Number(form.cost) || 0,
      renewablePct:
        form.category === 'electricity' ? Number(form.renewablePct) || 0 : 0,
      customEmissionFactor:
        form.customEmissionFactor === ''
          ? undefined
          : Number(form.customEmissionFactor),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {editingInvoice
                ? 'Edit Utility Invoice Record'
                : 'Log Utility Invoice for ESG Reporting'}
            </h2>
            <p className="text-xs text-slate-300">
              Automatically converts billing units and calculates GHG Protocol
              Scope 1 & 2 emissions
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Step 1: Utility Category Pill Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              1. Utility & ESG Scope Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'electricity',
                  title: 'Electricity',
                  sub: 'Scope 2 · kWh, MWh, RECs',
                  icon: Zap,
                  activeClass:
                    'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20',
                },
                {
                  id: 'natural_gas',
                  title: 'Natural Gas & Fuels',
                  sub: 'Scope 1 · therms, m³, liters',
                  icon: Flame,
                  activeClass:
                    'border-amber-600 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20',
                },
                {
                  id: 'water',
                  title: 'Water & Wastewater',
                  sub: 'GRI 303 · m³, gallons',
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

          {/* Step 2: Invoice Metadata */}
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
                placeholder="e.g. AE-904812"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Utility Provider / Supplier *
              </label>
              <input
                type="text"
                required
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="e.g. Austin Energy, PG&E"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Facility / Site Name *
              </label>
              <input
                type="text"
                required
                list="facility-suggestions"
                value={form.facility}
                onChange={(e) => setForm({ ...form, facility: e.target.value })}
                placeholder="e.g. HQ - Austin Tech Campus"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <datalist id="facility-suggestions">
                {existingFacilities.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Billing Period & Subtype */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resource Subtype
              </label>
              <select
                value={form.subtype}
                onChange={(e) => setForm({ ...form, subtype: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {currentCat.subtypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

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
                Verification Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Verified">Verified (Invoice Audited)</option>
                <option value="Pending Audit">Pending Audit</option>
                <option value="Estimated">Estimated / Accrual</option>
              </select>
            </div>
          </div>

          {/* Step 3: Metered Consumption & Cost */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Billed Quantity *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Invoice Cost *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency
                </label>
                <select
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Electricity Specific Scope 2 Controls */}
            {form.category === 'electricity' && (
              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Grid Emission Factor Region
                  </label>
                  <select
                    value={form.gridRegion}
                    onChange={(e) =>
                      setForm({ ...form, gridRegion: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {Object.values(GRID_REGIONS).map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.label} ({reg.kgCo2ePerKwh} kg/kWh)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Renewable Energy % ({form.renewablePct}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={form.renewablePct}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        renewablePct: Number(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-600 mt-2"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>0% Grid</span>
                    <span>50%</span>
                    <span>100% Green</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contractual Instrument
                  </label>
                  <select
                    value={form.renewableInstrument || 'None'}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        renewableInstrument: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="None">None (Standard Grid Mix)</option>
                    <option value="RECs / Guarantees of Origin">
                      Unbundled RECs / Guarantees of Origin
                    </option>
                    <option value="Green Tariff / PPA">
                      Utility Green Tariff / PPA
                    </option>
                    <option value="On-Site Solar">
                      On-Site Behind-the-Meter Solar
                    </option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Notes & Optional Custom Factor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Audit Notes / Meter Reference
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Sub-meter #4, REC certificate serial #..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custom Factor Override (Optional)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.customEmissionFactor}
                onChange={(e) =>
                  setForm({ ...form, customEmissionFactor: e.target.value })
                }
                placeholder={`Default: ${liveMetrics.effectiveFactorLabel}`}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Live Calculated ESG Preview Banner */}
          <div className="p-4 rounded-xl bg-emerald-950 text-white flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-800/80 text-emerald-300">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
                  Real-Time ESG Calculation Preview ({liveMetrics.scope})
                </div>
                <div className="text-xs text-slate-300">
                  Factor applied: {liveMetrics.effectiveFactorLabel}
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
                  <div className="text-[11px] text-slate-400">
                    Normalized Water
                  </div>
                  <div className="text-sm font-bold text-white">
                    {liveMetrics.normalizedWaterM3.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{' '}
                    m³
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] text-slate-400">
                  Location-Based GHG
                </div>
                <div className="text-sm font-bold text-amber-300">
                  {liveMetrics.locationBasedCo2eTonnes.toFixed(3)} tCO₂e
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400">
                  Market-Based GHG
                </div>
                <div className="text-base font-bold text-emerald-400">
                  {liveMetrics.marketBasedCo2eTonnes.toFixed(3)} tCO₂e
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
              {editingInvoice ? 'Save Changes' : 'Save Invoice to ESG Ledger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
