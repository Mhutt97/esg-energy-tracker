import React, { useMemo } from 'react';
import {
  Zap,
  Flame,
  Droplets,
  TrendingDown,
  Building2,
  Leaf,
  DollarSign,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { calculateInvoiceEsgMetrics } from '../data/emissionFactors.js';

export default function DashboardView({
  invoices,
  orgProfile,
  onUpdateOrgProfile,
  selectedFacility,
  onSelectFacility,
  selectedYear,
  onSelectYear,
  onOpenNewInvoice,
  onSwitchTab,
}) {
  const facilities = useMemo(() => {
    const set = new Set(invoices.map((i) => i.facility).filter(Boolean));
    return ['All Facilities', ...Array.from(set)];
  }, [invoices]);

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
      const matchFacility =
        selectedFacility === 'All Facilities' ||
        inv.facility === selectedFacility;
      const invYear = (inv.billingPeriodStart || '').slice(0, 4);
      const matchYear =
        selectedYear === 'All Years' || invYear === selectedYear;
      return matchFacility && matchYear;
    });
  }, [invoices, selectedFacility, selectedYear]);

  const summary = useMemo(() => {
    let scope1Tonnes = 0;
    let scope2LocationTonnes = 0;
    let scope2MarketTonnes = 0;
    let waterTonnes = 0;

    let electricityKwh = 0;
    let renewableElectricityKwh = 0;
    let fuelKwhEq = 0;
    let waterM3 = 0;
    let totalCost = 0;
    let verifiedCount = 0;

    const monthlyMap = {};
    const facilityMap = {};

    filteredInvoices.forEach((inv) => {
      const m = calculateInvoiceEsgMetrics(inv);
      const cost = Number(inv.cost) || 0;
      totalCost += cost;
      if (inv.status === 'Verified') verifiedCount++;

      if (inv.category === 'electricity') {
        scope2LocationTonnes += m.locationBasedCo2eTonnes;
        scope2MarketTonnes += m.marketBasedCo2eTonnes;
        electricityKwh += m.normalizedEnergyKwh;
        renewableElectricityKwh += m.renewableKwh;
      } else if (inv.category === 'natural_gas') {
        scope1Tonnes += m.locationBasedCo2eTonnes;
        fuelKwhEq += m.normalizedEnergyKwh;
      } else if (inv.category === 'water') {
        waterTonnes += m.locationBasedCo2eTonnes;
        waterM3 += m.normalizedWaterM3;
      }

      // Monthly bucket (YYYY-MM)
      const monthKey = (inv.billingPeriodStart || '2026-01').slice(0, 7);
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          month: monthKey,
          scope1: 0,
          scope2Location: 0,
          scope2Market: 0,
          waterTonnes: 0,
          energyKwh: 0,
          cost: 0,
        };
      }
      if (inv.category === 'natural_gas') {
        monthlyMap[monthKey].scope1 += m.locationBasedCo2eTonnes;
      } else if (inv.category === 'electricity') {
        monthlyMap[monthKey].scope2Location += m.locationBasedCo2eTonnes;
        monthlyMap[monthKey].scope2Market += m.marketBasedCo2eTonnes;
      } else {
        monthlyMap[monthKey].waterTonnes += m.locationBasedCo2eTonnes;
      }
      monthlyMap[monthKey].energyKwh += m.normalizedEnergyKwh;
      monthlyMap[monthKey].cost += cost;

      // Facility bucket
      const fac = inv.facility || 'Unassigned Facility';
      if (!facilityMap[fac]) {
        facilityMap[fac] = {
          facility: fac,
          scope1: 0,
          scope2Market: 0,
          scope2Location: 0,
          waterM3: 0,
          energyMwh: 0,
          cost: 0,
          invoiceCount: 0,
        };
      }
      facilityMap[fac].invoiceCount += 1;
      facilityMap[fac].cost += cost;
      facilityMap[fac].energyMwh += m.normalizedEnergyKwh / 1000;
      facilityMap[fac].waterM3 += m.normalizedWaterM3;
      if (inv.category === 'natural_gas') {
        facilityMap[fac].scope1 += m.locationBasedCo2eTonnes;
      } else if (inv.category === 'electricity') {
        facilityMap[fac].scope2Market += m.marketBasedCo2eTonnes;
        facilityMap[fac].scope2Location += m.locationBasedCo2eTonnes;
      }
    });

    const isMarket = orgProfile.scope2AccountingMethod !== 'location';
    const activeScope2 = isMarket ? scope2MarketTonnes : scope2LocationTonnes;
    const totalGhgTonnes = scope1Tonnes + activeScope2 + waterTonnes;
    const totalEnergyMwh = (electricityKwh + fuelKwhEq) / 1000;
    const renewableSharePct =
      electricityKwh > 0 ? (renewableElectricityKwh / electricityKwh) * 100 : 0;
    const avoidedByRenewablesTonnes = Math.max(
      0,
      scope2LocationTonnes - scope2MarketTonnes
    );

    const monthlySeries = Object.values(monthlyMap).sort((a, b) =>
      a.month.localeCompare(b.month)
    );
    const facilitySeries = Object.values(facilityMap).sort(
      (a, b) =>
        b.scope1 +
        (isMarket ? b.scope2Market : b.scope2Location) -
        (a.scope1 + (isMarket ? a.scope2Market : a.scope2Location))
    );

    return {
      scope1Tonnes,
      scope2LocationTonnes,
      scope2MarketTonnes,
      activeScope2,
      waterTonnes,
      totalGhgTonnes,
      electricityKwh,
      renewableElectricityKwh,
      renewableSharePct,
      avoidedByRenewablesTonnes,
      fuelKwhEq,
      totalEnergyMwh,
      waterM3,
      totalCost,
      verifiedCount,
      monthlySeries,
      facilitySeries,
    };
  }, [filteredInvoices, orgProfile.scope2AccountingMethod]);

  const isMarket = orgProfile.scope2AccountingMethod !== 'location';
  const maxMonthTonnes = Math.max(
    1,
    ...summary.monthlySeries.map(
      (m) =>
        m.scope1 +
        (isMarket ? m.scope2Market : m.scope2Location) +
        m.waterTonnes
    )
  );

  const carbonPerFte =
    orgProfile.headcountFte > 0
      ? summary.totalGhgTonnes / orgProfile.headcountFte
      : 0;
  const kgPerM2 =
    orgProfile.floorAreaM2 > 0
      ? (summary.totalGhgTonnes * 1000) / orgProfile.floorAreaM2
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Filter & Scope 2 Accounting Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Facility:
            </label>
            <select
              value={selectedFacility}
              onChange={(e) => onSelectFacility(e.target.value)}
              className="text-sm font-medium bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {facilities.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reporting Period:
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

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() =>
                onUpdateOrgProfile({
                  ...orgProfile,
                  scope2AccountingMethod: 'market',
                })
              }
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                isMarket
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Market-Based Scope 2
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateOrgProfile({
                  ...orgProfile,
                  scope2AccountingMethod: 'location',
                })
              }
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                !isMarket
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Location-Based Scope 2
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenNewInvoice}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Add Utility Invoice
          </button>
        </div>
      </div>

      {/* Primary ESG KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Total GHG Footprint */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                Total Carbon Footprint ({isMarket ? 'Market' : 'Location'})
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
                Intensity:{' '}
                <strong className="text-slate-700">
                  {carbonPerFte.toFixed(2)} tCO₂e/FTE
                </strong>{' '}
                ·{' '}
                <strong className="text-slate-700">
                  {kgPerM2.toFixed(1)} kgCO₂e/m²
                </strong>
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Leaf className="w-6 h-6" />
            </div>
          </div>
          {summary.avoidedByRenewablesTonnes > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Avoided via Renewable Instruments:
              </span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />-
                {summary.avoidedByRenewablesTonnes.toFixed(2)} tCO₂e
              </span>
            </div>
          )}
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
                  {summary.activeScope2.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-slate-500">
                  tCO₂e
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {(summary.electricityKwh / 1000).toFixed(2)} MWh consumed (
                {summary.renewableSharePct.toFixed(1)}% Renewable)
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Zap className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Location: {summary.scope2LocationTonnes.toFixed(2)} tCO₂e
            </span>
            <span>Market: {summary.scope2MarketTonnes.toFixed(2)} tCO₂e</span>
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
                {(summary.fuelKwhEq / 1000).toFixed(2)} MWh-eq thermal energy
              </p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <Flame className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Direct Stationary Combustion</span>
            <span className="font-medium text-slate-700">GRI 305-1</span>
          </div>
        </div>

        {/* Card 4: Total Energy Consumption (GRI 302-1) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Energy Consumption (GRI 302-1)
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {summary.totalEnergyMwh.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-slate-500">MWh</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {(summary.totalEnergyMwh * 3.6).toFixed(1)} GJ total energy
                input
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                {summary.renewableSharePct.toFixed(0)}% Green Elec
              </span>
            </div>
          </div>
          {/* Progress bar of Renewable Electricity */}
          <div className="mt-3">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, summary.renewableSharePct)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 5: Water & Wastewater (GRI 303) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-700">
                Water & Wastewater (GRI 303-3)
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {summary.waterM3.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-slate-500">m³</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {(summary.waterM3 * 264.172).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{' '}
                US Gallons · {summary.waterTonnes.toFixed(3)} tCO₂e
              </p>
            </div>
            <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
              <Droplets className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 6: Total Utility Spend & Audit Readiness */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Utility Invoice Spend & Audit Status
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  $
                  {summary.totalCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  ({filteredInvoices.length} invoices)
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                {summary.verifiedCount === filteredInvoices.length ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>100% Verified for ESG Audit</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {summary.verifiedCount} of {filteredInvoices.length}{' '}
                      invoices verified
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts & Facility Breakdown Row */}
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
                  Stacked Scope 1 (Stationary Fuels) + Scope 2 (Electricity —{' '}
                  {isMarket ? 'Market-Based' : 'Location-Based'}) + Water
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                  Scope 1 (Gas/Fuel)
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
              <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                <p>No utility invoices match the current filter.</p>
                <button
                  type="button"
                  onClick={onOpenNewInvoice}
                  className="mt-2 text-emerald-600 font-semibold hover:underline"
                >
                  + Add your first invoice
                </button>
              </div>
            ) : (
              <div className="h-60 pt-6 pb-2 px-2 flex items-end gap-4 border-b border-slate-200">
                {summary.monthlySeries.map((item) => {
                  const s1 = item.scope1;
                  const s2 = isMarket
                    ? item.scope2Market
                    : item.scope2Location;
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
                        {total.toFixed(1)}t
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
            <span>
              Reporting Standard: GHG Protocol Corporate Standard (Scope 1 & 2)
            </span>
            <button
              type="button"
              onClick={() => onSwitchTab('esg-report')}
              className="text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              View Full GRI / CSRD Disclosure Table →
            </button>
          </div>
        </div>

        {/* Facility Breakdown Panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Emissions by Facility / Site
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Site-level energy & GHG distribution
            </p>

            <div className="space-y-4">
              {summary.facilitySeries.map((fac) => {
                const facScope2 = isMarket
                  ? fac.scope2Market
                  : fac.scope2Location;
                const facTotal = fac.scope1 + facScope2;
                const sharePct =
                  summary.totalGhgTonnes > 0
                    ? (facTotal / summary.totalGhgTonnes) * 100
                    : 0;

                return (
                  <div
                    key={fac.facility}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/80"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                      <span className="truncate">{fac.facility}</span>
                      <span className="text-emerald-700">
                        {facTotal.toFixed(2)} tCO₂e
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {fac.energyMwh.toFixed(1)} MWh ·{' '}
                        {fac.waterM3.toFixed(0)} m³ water
                      </span>
                      <span>{sharePct.toFixed(0)}% of footprint</span>
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
            Click <strong>Utility Invoices</strong> above to filter, edit, or
            bulk-import facility bills.
          </div>
        </div>
      </div>
    </div>
  );
}
