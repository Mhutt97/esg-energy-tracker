import React, { useMemo } from 'react';
import {
  Printer,
  Download,
  ShieldCheck,
  Building,
  Users,
  Maximize2,
  Calendar,
} from 'lucide-react';
import { calculateInvoiceEsgMetrics } from '../data/emissionFactors.js';
import { exportInvoicesToCsv } from '../services/storageService.js';

export default function EsgReportView({
  invoices,
  orgProfile,
  onUpdateOrgProfile,
}) {
  const report = useMemo(() => {
    let scope1Tonnes = 0;
    let scope2LocationTonnes = 0;
    let scope2MarketTonnes = 0;
    let waterTonnes = 0;

    let totalElectricityKwh = 0;
    let renewableElectricityKwh = 0;
    let gridElectricityKwh = 0;
    let naturalGasKwhEq = 0;
    let waterWithdrawalM3 = 0;
    let wastewaterM3 = 0;
    let verifiedInvoices = 0;

    invoices.forEach((inv) => {
      const m = calculateInvoiceEsgMetrics(inv);
      if (inv.status === 'Verified') verifiedInvoices++;

      if (inv.category === 'electricity') {
        scope2LocationTonnes += m.locationBasedCo2eTonnes;
        scope2MarketTonnes += m.marketBasedCo2eTonnes;
        totalElectricityKwh += m.normalizedEnergyKwh;
        renewableElectricityKwh += m.renewableKwh;
        gridElectricityKwh += m.normalizedEnergyKwh - m.renewableKwh;
      } else if (inv.category === 'natural_gas') {
        scope1Tonnes += m.locationBasedCo2eTonnes;
        naturalGasKwhEq += m.normalizedEnergyKwh;
      } else if (inv.category === 'water') {
        waterTonnes += m.locationBasedCo2eTonnes;
        if (inv.subtype === 'wastewater') {
          wastewaterM3 += m.normalizedWaterM3;
        } else {
          waterWithdrawalM3 += m.normalizedWaterM3;
        }
      }
    });

    const totalEnergyKwh = totalElectricityKwh + naturalGasKwhEq;
    const totalEnergyGj = (totalEnergyKwh / 1000) * 3.6;
    const renewableEnergyShare =
      totalEnergyKwh > 0 ? (renewableElectricityKwh / totalEnergyKwh) * 100 : 0;
    const renewableElecShare =
      totalElectricityKwh > 0
        ? (renewableElectricityKwh / totalElectricityKwh) * 100
        : 0;

    const totalLocationGhg = scope1Tonnes + scope2LocationTonnes + waterTonnes;
    const totalMarketGhg = scope1Tonnes + scope2MarketTonnes + waterTonnes;

    const floorArea = Math.max(1, Number(orgProfile.floorAreaM2) || 1);
    const fte = Math.max(1, Number(orgProfile.headcountFte) || 1);

    return {
      scope1Tonnes,
      scope2LocationTonnes,
      scope2MarketTonnes,
      waterTonnes,
      totalLocationGhg,
      totalMarketGhg,
      totalElectricityMwh: totalElectricityKwh / 1000,
      renewableElectricityMwh: renewableElectricityKwh / 1000,
      gridElectricityMwh: gridElectricityKwh / 1000,
      naturalGasMwhEq: naturalGasKwhEq / 1000,
      totalEnergyMwh: totalEnergyKwh / 1000,
      totalEnergyGj,
      renewableEnergyShare,
      renewableElecShare,
      waterWithdrawalM3,
      wastewaterM3,
      energyIntensityKwhPerM2: totalEnergyKwh / floorArea,
      ghgIntensityTonnesPerFte: totalMarketGhg / fte,
      ghgIntensityKgPerM2: (totalMarketGhg * 1000) / floorArea,
      verifiedPct:
        invoices.length > 0 ? (verifiedInvoices / invoices.length) * 100 : 100,
    };
  }, [invoices, orgProfile]);

  const handleDownloadAuditCsv = () => {
    const csv = exportInvoicesToCsv(invoices);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(orgProfile.companyName || 'Organization')
      .toLowerCase()
      .replace(/\s+/g, '-')}-esg-audit-trail-${orgProfile.reportingYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Organization Normalization & Intensity Inputs */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm no-print">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Organization ESG Reporting Parameters
            </h3>
            <p className="text-xs text-slate-500">
              Used to compute GRI 302-3 Energy Intensity and GRI 305-4 GHG
              Emissions Intensity ratios
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadAuditCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              <Download className="w-4 h-4" />
              Export Audit CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF Disclosure
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
              <Building className="w-3.5 h-3.5" />
              Reporting Entity Name
            </label>
            <input
              type="text"
              value={orgProfile.companyName}
              onChange={(e) =>
                onUpdateOrgProfile({
                  ...orgProfile,
                  companyName: e.target.value,
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              Reporting Year
            </label>
            <input
              type="text"
              value={orgProfile.reportingYear}
              onChange={(e) =>
                onUpdateOrgProfile({
                  ...orgProfile,
                  reportingYear: e.target.value,
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
              <Maximize2 className="w-3.5 h-3.5" />
              Total Floor Area (m²)
            </label>
            <input
              type="number"
              min="1"
              value={orgProfile.floorAreaM2}
              onChange={(e) =>
                onUpdateOrgProfile({
                  ...orgProfile,
                  floorAreaM2: Number(e.target.value) || 1,
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
              <Users className="w-3.5 h-3.5" />
              Employee Headcount (FTE)
            </label>
            <input
              type="number"
              min="1"
              value={orgProfile.headcountFte}
              onChange={(e) =>
                onUpdateOrgProfile({
                  ...orgProfile,
                  headcountFte: Number(e.target.value) || 1,
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Formal ESG Disclosure Statement */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
              <ShieldCheck className="w-4 h-4" />
              GHG Protocol · GRI 302 / 303 / 305 · CSRD ESRS E1
            </div>
            <h2 className="text-xl font-bold">
              {orgProfile.companyName} — FY{orgProfile.reportingYear} ESG Energy
              & Emissions Disclosure
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Compiled from {invoices.length} utility invoices (
              {report.verifiedPct.toFixed(0)}% verified audit status)
            </p>
          </div>
          <div className="text-right text-xs text-slate-300">
            <div>Organizational Boundary: Operational Control</div>
            <div>Generated: {new Date().toISOString().slice(0, 10)}</div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Section 1: GHG Emissions (GRI 305) */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
              1. Greenhouse Gas (GHG) Emissions Disclosure (GRI 305 / ESRS E1-6)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Standard Reference</th>
                    <th className="py-2.5 px-4">Disclosure Metric</th>
                    <th className="py-2.5 px-4 text-right">Value</th>
                    <th className="py-2.5 px-4">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 305-1
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      Direct (Scope 1) GHG Emissions — Natural Gas & Stationary
                      Fuels
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                      {report.scope1Tonnes.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      tCO₂e
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 305-2 (a)
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      Energy Indirect (Scope 2) GHG Emissions — Location-Based
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                      {report.scope2LocationTonnes.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      tCO₂e
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 305-2 (b)
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      Energy Indirect (Scope 2) GHG Emissions — Market-Based
                      (net of RECs/PPAs)
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                      {report.scope2MarketTonnes.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      tCO₂e
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 305-3
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      Other Indirect (Scope 3) — Municipal Water Supply &
                      Treatment
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-800">
                      {report.waterTonnes.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      tCO₂e
                    </td>
                  </tr>
                  <tr className="bg-emerald-50/60">
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-emerald-800">
                      ESRS E1-6
                    </td>
                    <td className="py-2.5 px-4 font-bold text-emerald-950">
                      Total GHG Emissions (Scope 1 + Market-Based Scope 2 +
                      Water)
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-800">
                      {report.totalMarketGhg.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-semibold text-emerald-800">
                      tCO₂e
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 305-4
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      GHG Emissions Intensity per Employee (
                      {orgProfile.headcountFte} FTE)
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                      {report.ghgIntensityTonnesPerFte.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      tCO₂e / FTE
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 305-4
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      GHG Emissions Intensity per Floor Area (
                      {orgProfile.floorAreaM2.toLocaleString()} m²)
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                      {report.ghgIntensityKgPerM2.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      kgCO₂e / m²
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Energy Consumption (GRI 302) */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
              2. Energy Consumption & Renewable Share (GRI 302-1 & 302-3)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Standard Reference</th>
                    <th className="py-2.5 px-4">Energy Metric</th>
                    <th className="py-2.5 px-4 text-right">Value</th>
                    <th className="py-2.5 px-4">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 302-1 (a)
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      Non-Renewable Fuel Consumption (Natural Gas & Stationary
                      Fuels)
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                      {report.naturalGasMwhEq.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      MWh-eq
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 302-1 (c)
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      Total Electricity Consumption (Grid + Renewable)
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                      {report.totalElectricityMwh.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">MWh</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      RE100 / ESRS E1-5
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      Renewable Electricity Consumption (RECs, GO, Green Tariff,
                      Solar)
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                      {report.renewableElectricityMwh.toFixed(2)} (
                      {report.renewableElecShare.toFixed(1)}%)
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">MWh</td>
                  </tr>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-600">
                      GRI 302-1 (e)
                    </td>
                    <td className="py-2.5 px-4 text-slate-900">
                      Total Energy Consumption Within the Organization
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-900">
                      {report.totalEnergyMwh.toFixed(2)} MWh (
                      {report.totalEnergyGj.toFixed(1)} GJ)
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      MWh / GJ
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 302-3
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      Building Energy Intensity per Floor Area
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                      {report.energyIntensityKwhPerM2.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      kWh / m²
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Water Stewardship (GRI 303) */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
              3. Water Withdrawal & Discharge (GRI 303-3 & 303-4)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Standard Reference</th>
                    <th className="py-2.5 px-4">Water Metric</th>
                    <th className="py-2.5 px-4 text-right">Value</th>
                    <th className="py-2.5 px-4">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 303-3
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      Third-Party Municipal Water Withdrawal
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                      {report.waterWithdrawalM3.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      m³ (Kiloliters)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      GRI 303-4
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      Metered Wastewater & Sewage Treatment
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                      {report.wastewaterM3.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      m³ (Kiloliters)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
