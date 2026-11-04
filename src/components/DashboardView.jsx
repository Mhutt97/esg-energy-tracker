import React, { useMemo } from 'react';
import {
  Zap,
  Flame,
  Droplets,
  Building2,
  Leaf,
  PoundSterling,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { calculateInvoiceEsgMetrics, SITES } from '../data/emissionFactors.js';

export default function DashboardView({
  invoices,
  orgProfile,
  selectedSite,
  onSelectSite,
  selectedYear,
  onSelectYear,
  onOpenNewInvoice,
}) {
  const siteOptions = ['All Sites', ...SITES];

  const years = useMemo(() => {
    const set = new Set(
      invoices
        .map((i) => (i.billingPeriodStart || '').slice(0, 4))
        .filter((y) => y.length === 4)
    );
    set.add(orgProfile.reportingYear || '2026');
    return ['All Years', ...Array.from(set).sort().reverse()];
  }, [invoices, orgProfile.reportingYear]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const invSite = inv.siteName || inv.facility || SITES[0];
      const matchSite =
        selectedSite === 'All Sites' || invSite === selectedSite;
      const invYear = (inv.billingPeriodStart || '').slice(0, 4);
      const matchYear =
        selectedYear === 'All Years' || invYear === selectedYear;
      return matchSite && matchYear;
    });
  }, [invoices, selectedSite, selectedYear]);

  const summary = useMemo(() => {
    let scope1Tonnes = 0;
    let scope2Tonnes = 0;
    let waterTonnes = 0;

    let electricityKwh = 0;
    let fuelKwhEq = 0;
    let waterM3 = 0;

    let totalNet = 0;
    let totalVat = 0;
    let totalGross = 0;
    let actualReadingCount = 0;

    const monthlyMap = {};
    const siteMap = {};
    SITES.forEach((s) => {
      siteMap[s] = {
        siteName: s,
        scope1: 0,
        scope2: 0,
        waterTonnes: 0,
        waterM3: 0,
        energyMwh: 0,
        grossCost: 0,
        invoiceCount: 0,
      };
    });

    filteredInvoices.forEach((inv) => {
      const m = calculateInvoiceEsgMetrics(inv);
      const net = Number(inv.netCost ?? inv.cost) || 0;
      const vatRate = inv.vatRate !== undefined ? Number(inv.vatRate) : 20;
      const vat =
        inv.vatAmount !== undefined
          ? Number(inv.vatAmount)
          : net * (vatRate / 100);
      const gross =
        inv.grossCost !== undefined ? Number(inv.grossCost) : net + vat;

      totalNet += net;
      totalVat += vat;
      totalGross += gross;

      if ((inv.readingType || 'Actual') === 'Actual') {
        actualReadingCount++;
      }

      if (inv.category === 'electricity') {
        scope2Tonnes += m.co2eTonnes;
        electricityKwh += m.normalizedEnergyKwh;
      } else if (inv.category === 'natural_gas') {
        scope1Tonnes += m.co2eTonnes;
        fuelKwhEq += m.normalizedEnergyKwh;
      } else if (inv.category === 'water') {
        waterTonnes += m.co2eTonnes;
        waterM3 += m.normalizedWaterM3;
      }

      const monthKey = (inv.billingPeriodStart || '2026-01').slice(0, 7);
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          month: monthKey,
          scope1: 0,
          scope2: 0,
          waterTonnes: 0,
          energyKwh: 0,
          grossCost: 0,
        };
      }
      if (inv.category === 'natural_gas') {
        monthlyMap[monthKey].scope1 += m.co2eTonnes;
      } else if (inv.category === 'electricity') {
        monthlyMap[monthKey].scope2 += m.co2eTonnes;
      } else {
        monthlyMap[monthKey].waterTonnes += m.co2eTonnes;
      }
      monthlyMap[monthKey].energyKwh += m.normalizedEnergyKwh;
      monthlyMap[monthKey].grossCost += gross;

      const site = inv.siteName || inv.facility || SITES[0];
      if (!siteMap[site]) {
        siteMap[site] = {
          siteName: site,
          scope1: 0,
          scope2: 0,
          waterTonnes: 0,
          waterM3: 0,
          energyMwh: 0,
          grossCost: 0,
          invoiceCount: 0,
        };
      }
      siteMap[site].invoiceCount += 1;
      siteMap[site].grossCost += gross;
      siteMap[site].energyMwh += m.normalizedEnergyKwh / 1000;
      siteMap[site].waterM3 += m.normalizedWaterM3;
      if (inv.category === 'natural_gas') {
        siteMap[site].scope1 += m.co2eTonnes;
      } else if (inv.category === 'electricity') {
        siteMap[site].scope2 += m.co2eTonnes;
      } else {
        siteMap[site].waterTonnes += m.co2eTonnes;
      }
    });

    const totalGhgTonnes = scope1Tonnes + scope2Tonnes + waterTonnes;
    const totalEnergyMwh = (electricityKwh + fuelKwhEq) / 1000;

    const monthlySeries = Object.values(monthlyMap).sort((a, b) =>
      a.month.localeCompare(b.month)
    );
    const siteSeries = Object.values(siteMap);

    return {
      scope1Tonnes,
      scope2Tonnes,
      waterTonnes,
      totalGhgTonnes,
      electricityKwh,
      fuelKwhEq,
      totalEnergyMwh,
      waterM3,
      totalNet,
      totalVat,
      totalGross,
      actualReadingCount,
      monthlySeries,
      siteSeries,
    };
  }, [filteredInvoices]);

  const maxMonthTonnes = Math.max(
    1,
    ...summary.monthlySeries.map((m) => m.scope1 + m.scope2 + m.waterTonnes)
  );

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Site Name:
            </label>
            <select
              value={selectedSite}
              onChange={(e) => onSelectSite(e.target.value)}
              className="text-sm font-medium bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {siteOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reporting Year:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => onSelectYear(e.target.value)}
              className="text-sm font-medium bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenNewInvoice}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Log Utility Invoice
        </button>
      </div>

      {/* Primary ESG KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Total GHG Footprint */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                Total Carbon Footprint
              </span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">
                  {summary.totalGhgTonnes.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-slate-500">
                  tCO₂e
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Calculated using UK DEFRA emission factors
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Leaf className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Card 2: Scope 2 Electricity */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                Scope 2 · Electricity
              </span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">
                  {summary.scope2Tonnes.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-slate-500">
                  tCO₂e
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {summary.electricityKwh.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{' '}
                kWh ({(summary.electricityKwh / 1000).toFixed(2)} MWh)
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Zap className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Card 3: Scope 1 Natural Gas & Fuels */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
                Scope 1 · Natural Gas & Fuels
              </span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">
                  {summary.scope1Tonnes.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-slate-500">
                  tCO₂e
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {summary.fuelKwhEq.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{' '}
                kWh-eq ({(summary.fuelKwhEq / 1000).toFixed(2)} MWh)
              </p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <Flame className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Card 4: Total Energy Consumption */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Energy Consumption
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {summary.totalEnergyMwh.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-slate-500">MWh</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Combined Electricity + Natural Gas usage
              </p>
            </div>
          </div>
        </div>

        {/* Card 5: Water & Wastewater */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-700">
                Water & Wastewater
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {summary.waterM3.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-slate-500">m³</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {summary.waterTonnes.toFixed(3)} tCO₂e embodied emissions
              </p>
            </div>
            <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
              <Droplets className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 6: Total Utility Spend (£ GBP Net, VAT & Gross) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Utility Spend (£ GBP)
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  £
                  {summary.totalGross.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Gross ({filteredInvoices.length} invoices)
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Net: £
                {summary.totalNet.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                · VAT: £
                {summary.totalVat.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                {filteredInvoices.length > 0 &&
                summary.actualReadingCount === filteredInvoices.length ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>100% Actual Meter Readings</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {summary.actualReadingCount} of {filteredInvoices.length}{' '}
                      Actual readings
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
              <PoundSterling className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts & Site Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly GHG Emissions Stacked Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Monthly GHG Emissions Profile (tCO₂e)
                </h3>
                <p className="text-xs text-slate-500">
                  Stacked Scope 1 (Natural Gas) + Scope 2 (Electricity) + Water
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                  Scope 1 (Gas)
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
                  Scope 2 (Electricity)
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-3 h-3 rounded-sm bg-cyan-500 inline-block" />
                  Water
                </span>
              </div>
            </div>

            {summary.monthlySeries.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                <p>No utility invoices logged yet.</p>
                <button
                  type="button"
                  onClick={onOpenNewInvoice}
                  className="mt-2 text-emerald-600 font-semibold hover:underline"
                >
                  + Log your first utility invoice
                </button>
              </div>
            ) : (
              <div className="h-60 pt-6 pb-2 px-2 flex items-end gap-4 border-b border-slate-200">
                {summary.monthlySeries.map((item) => {
                  const s1 = item.scope1;
                  const s2 = item.scope2;
                  const w = item.waterTonnes;
                  const total = s1 + s2 + w;

                  const s1Pct = (s1 / maxMonthTonnes) * 100;
                  const s2Pct = (s2 / maxMonthTonnes) * 100;
                  const wPct = (w / maxMonthTonnes) * 100;

                  return (
                    <div
                      key={item.month}
                      className="flex-1 flex flex-col items-center h-full justify-end group"
                    >
                      <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                        {total.toFixed(2)}t
                      </div>
                      <div className="w-full max-w-[54px] flex flex-col-reverse rounded-t-md overflow-hidden bg-slate-100 h-44 justify-start">
                        {s1 > 0 && (
                          <div
                            style={{ height: `${Math.max(4, s1Pct)}%` }}
                            className="bg-amber-500 transition-all"
                            title={`Scope 1: ${s1.toFixed(2)} tCO₂e`}
                          />
                        )}
                        {s2 > 0 && (
                          <div
                            style={{ height: `${Math.max(4, s2Pct)}%` }}
                            className="bg-blue-600 transition-all"
                            title={`Scope 2: ${s2.toFixed(2)} tCO₂e`}
                          />
                        )}
                        {w > 0 && (
                          <div
                            style={{ height: `${Math.max(2, wPct)}%` }}
                            className="bg-cyan-500 transition-all"
                            title={`Water: ${w.toFixed(3)} tCO₂e`}
                          />
                        )}
                      </div>
                      <span className="mt-2 text-xs font-medium text-slate-600">
                        {item.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Suppliers supported: EDF, SSE, EON, Octopus</span>
            <span>Currency: £ GBP (Net, VAT & Gross)</span>
          </div>
        </div>

        {/* Site Breakdown Panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Emissions by Site Name
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              UK office energy & GHG breakdown
            </p>

            <div className="space-y-3">
              {summary.siteSeries.map((site) => {
                const siteTotal = site.scope1 + site.scope2 + site.waterTonnes;
                const sharePct =
                  summary.totalGhgTonnes > 0
                    ? (siteTotal / summary.totalGhgTonnes) * 100
                    : 0;

                return (
                  <div
                    key={site.siteName}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/80"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                      <span className="truncate">{site.siteName}</span>
                      <span className="text-emerald-700">
                        {siteTotal.toFixed(2)} tCO₂e
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {site.energyMwh.toFixed(2)} MWh · £
                        {site.grossCost.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span>{site.invoiceCount} invoices</span>
                    </div>
                    <div className="mt-2 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${Math.min(100, sharePct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Click <strong>Utility Invoices</strong> above to view, edit, or
            bulk-import bills.
          </div>
        </div>
      </div>
    </div>
  );
}
