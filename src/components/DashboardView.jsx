import React, { useMemo } from 'react';
import {
  Building2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowUpRight,
} from 'lucide-react';
import { calculateInvoiceEsgMetrics, SITES } from '../data/emissionFactors.js';
import { AnimatedNumber, RevealText } from './AnimatedText.jsx';

export default function DashboardView({
  invoices,
  orgProfile,
  selectedSite,
  onSelectSite,
  selectedYear,
  onSelectYear,
  onOpenNewInvoice,
  onSwitchTab,
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
    let pdfAttachedCount = 0;

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
      if (inv.pdfAttachment?.dataUrl) {
        pdfAttachedCount++;
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
      pdfAttachedCount,
      monthlySeries,
      siteSeries,
    };
  }, [filteredInvoices]);

  const maxMonthTonnes = Math.max(
    1,
    ...summary.monthlySeries.map((m) => m.scope1 + m.scope2 + m.waterTonnes)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Editorial Page Header & Filter Bar */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-slate-400">
            UK Commercial Utility & Emissions Overview
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mt-0.5">
            <RevealText text="Energy & ESG Performance Ledger" />
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Site:
            </span>
            <select
              value={selectedSite}
              onChange={(e) => onSelectSite(e.target.value)}
              className="text-xs font-semibold bg-transparent text-slate-800 focus:outline-none"
            >
              {siteOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Period:
            </span>
            <select
              value={selectedYear}
              onChange={(e) => onSelectYear(e.target.value)}
              className="text-xs font-semibold bg-transparent text-slate-800 focus:outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-400 text-xs font-medium px-3 py-2 rounded-lg cursor-not-allowed select-none"
            title="Legacy Excel (.xlsx) workbook ingestion is locked during the testing phase"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Upload Excel (.xlsx)</span>
            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
              Testing
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenNewInvoice}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Utility Invoice
          </button>
        </div>
      </div>

      {/* Architectural Hairline Metric Grid */}
      <div className="bg-slate-200/90 border border-slate-200/90 rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] shadow-2xs">
        {/* Metric 1: Total GHG Footprint */}
        <div className="bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-slate-500">
              01 / Total Carbon Footprint
            </span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              UK DEFRA
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <AnimatedNumber
              value={summary.totalGhgTonnes}
              decimals={2}
              className="text-3xl font-mono font-semibold tracking-tight text-slate-900"
            />
            <span className="text-xs font-mono text-slate-500">tCO₂e</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Combined Scope 1, Scope 2 & Water</span>
            <span className="font-mono text-slate-700">
              {filteredInvoices.length} records
            </span>
          </div>
        </div>

        {/* Metric 2: Scope 2 Electricity */}
        <div className="bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-slate-500">
              02 / Scope 2 · Electricity
            </span>
            <span className="w-2 h-2 rounded-full bg-slate-900" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <AnimatedNumber
              value={summary.scope2Tonnes}
              decimals={2}
              className="text-3xl font-mono font-semibold tracking-tight text-slate-900"
            />
            <span className="text-xs font-mono text-slate-500">tCO₂e</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>
              <AnimatedNumber
                value={summary.electricityKwh}
                decimals={0}
                suffix=" kWh"
              />
            </span>
            <span>{(summary.electricityKwh / 1000).toFixed(2)} MWh</span>
          </div>
        </div>

        {/* Metric 3: Scope 1 Natural Gas */}
        <div className="bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-slate-500">
              03 / Scope 1 · Natural Gas & Fuels
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-600" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <AnimatedNumber
              value={summary.scope1Tonnes}
              decimals={2}
              className="text-3xl font-mono font-semibold tracking-tight text-slate-900"
            />
            <span className="text-xs font-mono text-slate-500">tCO₂e</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>
              <AnimatedNumber
                value={summary.fuelKwhEq}
                decimals={0}
                suffix=" kWh-eq"
              />
            </span>
            <span>{(summary.fuelKwhEq / 1000).toFixed(2)} MWh</span>
          </div>
        </div>

        {/* Metric 4: Total Energy Consumption */}
        <div className="bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-slate-500">
              04 / Total Energy Input
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              MWh Equivalent
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <AnimatedNumber
              value={summary.totalEnergyMwh}
              decimals={2}
              className="text-2xl font-mono font-semibold tracking-tight text-slate-900"
            />
            <span className="text-xs font-mono text-slate-500">MWh</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Normalized across Electricity & Stationary Fuels
          </div>
        </div>

        {/* Metric 5: Water & Wastewater */}
        <div className="bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-slate-500">
              05 / Water & Wastewater
            </span>
            <span className="w-2 h-2 rounded-full bg-cyan-600" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <AnimatedNumber
              value={summary.waterM3}
              decimals={1}
              className="text-2xl font-mono font-semibold tracking-tight text-slate-900"
            />
            <span className="text-xs font-mono text-slate-500">m³</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>Embodied Emissions:</span>
            <span>{summary.waterTonnes.toFixed(3)} tCO₂e</span>
          </div>
        </div>

        {/* Metric 6: Financial Settlement (£ GBP Net, VAT & Gross) */}
        <div className="bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-slate-500">
              06 / Financial Expenditure (£ GBP)
            </span>
            {filteredInvoices.length > 0 &&
            summary.actualReadingCount === filteredInvoices.length ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3" />
                100% Actual
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500">
                {summary.actualReadingCount}/{filteredInvoices.length} Actual
              </span>
            )}
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <AnimatedNumber
              value={summary.totalGross}
              decimals={2}
              prefix="£"
              className="text-2xl font-mono font-semibold tracking-tight text-slate-900"
            />
            <span className="text-[11px] font-mono text-slate-400">Gross</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>
              Net: £
              {summary.totalNet.toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span>
              VAT: £
              {summary.totalVat.toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Charts & UK Site Allocation Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly GHG Emissions Stacked Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-slate-400">
                  Temporal Trajectory
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mt-0.5">
                  Monthly GHG Emissions Profile (tCO₂e)
                </h3>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                  Scope 1
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 inline-block" />
                  Scope 2
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-cyan-600 inline-block" />
                  Water
                </span>
              </div>
            </div>

            {summary.monthlySeries.length === 0 ? (
              <div className="h-60 mt-4 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg bg-slate-50/40">
                <p className="font-medium text-slate-600">
                  No utility invoices logged in the ledger
                </p>
                <p className="text-slate-400 mt-0.5">
                  Add an invoice for Head Office London, Sheffield, Leeds, or
                  Bristol to generate analytics.
                </p>
                <button
                  type="button"
                  onClick={onOpenNewInvoice}
                  className="mt-3 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                >
                  + Log Utility Invoice
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
                      <div className="text-[10px] font-mono font-semibold text-slate-600 mb-1.5 tabular-nums">
                        {total.toFixed(2)}t
                      </div>
                      <div className="w-full max-w-[48px] flex flex-col-reverse rounded-t overflow-hidden bg-slate-100 h-44 justify-start">
                        {s1 > 0 && (
                          <div
                            style={{ height: `${Math.max(4, s1Pct)}%` }}
                            className="bg-amber-600 transition-all duration-500"
                            title={`Scope 1: ${s1.toFixed(3)} tCO₂e`}
                          />
                        )}
                        {s2 > 0 && (
                          <div
                            style={{ height: `${Math.max(4, s2Pct)}%` }}
                            className="bg-slate-900 transition-all duration-500"
                            title={`Scope 2: ${s2.toFixed(3)} tCO₂e`}
                          />
                        )}
                        {w > 0 && (
                          <div
                            style={{ height: `${Math.max(2, wPct)}%` }}
                            className="bg-cyan-600 transition-all duration-500"
                            title={`Water: ${w.toFixed(3)} tCO₂e`}
                          />
                        )}
                      </div>
                      <span className="mt-2 text-[11px] font-mono text-slate-500">
                        {item.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-mono">
              Approved Providers: EDF · SSE · EON · Octopus
            </span>
            <button
              type="button"
              onClick={() => onSwitchTab && onSwitchTab('invoices')}
              className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline"
            >
              <span>Open Full Invoice Ledger</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* UK Site Breakdown Panel */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-100">
              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-slate-400">
                Regional Allocation
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mt-0.5">
                Emissions by Site Name
              </h3>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {summary.siteSeries.map((site) => {
                const siteTotal = site.scope1 + site.scope2 + site.waterTonnes;
                const sharePct =
                  summary.totalGhgTonnes > 0
                    ? (siteTotal / summary.totalGhgTonnes) * 100
                    : 0;

                return (
                  <div key={site.siteName} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">
                        {site.siteName}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {siteTotal.toFixed(2)} tCO₂e
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                      <span>
                        {site.energyMwh.toFixed(2)} MWh · £
                        {site.grossCost.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span>{site.invoiceCount} records</span>
                    </div>
                    <div className="mt-2 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, sharePct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>PDF Invoices Stored in DB:</span>
            <span className="text-slate-700 font-semibold">
              {summary.pdfAttachedCount} / {filteredInvoices.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
