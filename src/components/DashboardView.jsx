import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  BarChart3,
  Table2,
  Layers,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import {
  calculateInvoiceEsgMetrics,
  SITES,
  SUPPLIERS,
  SITE_BASELINE_TARGETS,
  REPORTING_FRAMEWORKS,
} from '../data/emissionFactors.js';
import { AnimatedNumber } from './AnimatedText.jsx';

const SITE_SEMANTIC_META = {
  'Head Office London': {
    code: 'LON-01',
    barClass: 'bg-emerald-600',
    dotClass: 'bg-emerald-600',
  },
  'Office Sheffield': {
    code: 'SHF-02',
    barClass: 'bg-blue-600',
    dotClass: 'bg-blue-600',
  },
  'Office Leeds': {
    code: 'LDS-03',
    barClass: 'bg-indigo-600',
    dotClass: 'bg-indigo-600',
  },
  'Office Bristol': {
    code: 'BRS-04',
    barClass: 'bg-teal-600',
    dotClass: 'bg-teal-600',
  },
};

const MONTH_LABELS = [
  { num: '01', short: 'Jan', full: 'January' },
  { num: '02', short: 'Feb', full: 'February' },
  { num: '03', short: 'Mar', full: 'March' },
  { num: '04', short: 'Apr', full: 'April' },
  { num: '05', short: 'May', full: 'May' },
  { num: '06', short: 'Jun', full: 'June' },
  { num: '07', short: 'Jul', full: 'July' },
  { num: '08', short: 'Aug', full: 'August' },
  { num: '09', short: 'Sep', full: 'September' },
  { num: '10', short: 'Oct', full: 'October' },
  { num: '11', short: 'Nov', full: 'November' },
  { num: '12', short: 'Dec', full: 'December' },
];

/**
 * Compact 12-point SVG Sparkline for KPI cards
 */
function MiniSparkline({ values = [], color = '#059669' }) {
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, idx) => {
      const x = (idx / Math.max(1, values.length - 1)) * 72;
      const y = 20 - (v / max) * 16;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width="72" height="22" className="overflow-visible shrink-0">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={pts}
      />
    </svg>
  );
}

export default function DashboardView({
  invoices,
  orgProfile,
  selectedSite,
  onSelectSite,
  selectedYear,
  onSelectYear,
  selectedFramework = REPORTING_FRAMEWORKS.CSRD,
  selectedScopeFilter = 'all',
  onSelectScopeFilter,
  onOpenNewInvoice,
  onSwitchTab,
  isOwnerUnlocked = false,
  onRequestOwnerUnlock,
  onOpenDrilldown,
}) {
  const [selectedUtility, setSelectedUtility] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [activeMetric, setActiveMetric] = useState('usage'); // 'usage' | 'co2e' | 'gross' | 'net'
  const [chartBreakdownMode, setChartBreakdownMode] = useState('site'); // 'site' | 'utility'
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState(null);

  const siteOptions = ['All Sites', ...SITES];

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const invSite = inv.siteName || inv.facility || SITES[0];
      const matchSite =
        selectedSite === 'All Sites' || invSite === selectedSite;
      const invYear = (inv.billingPeriodStart || '').slice(0, 4);
      const matchYear =
        selectedYear === 'All Years' || invYear === selectedYear;
      const matchUtility =
        selectedUtility === 'all' || inv.category === selectedUtility;
      const matchSupplier =
        selectedSupplier === 'all' || inv.supplier === selectedSupplier;
      return matchSite && matchYear && matchUtility && matchSupplier;
    });
  }, [
    invoices,
    selectedSite,
    selectedYear,
    selectedUtility,
    selectedSupplier,
  ]);

  const analytics = useMemo(() => {
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

    const monthsMatrix = {};
    MONTH_LABELS.forEach((m) => {
      monthsMatrix[m.num] = {
        monthNum: m.num,
        short: m.short,
        full: m.full,
        totalUsage: 0,
        totalCo2e: 0,
        totalGross: 0,
        totalNet: 0,
        records: [],
        bySite: {},
        byUtility: {
          electricity: { usage: 0, co2e: 0, gross: 0, net: 0 },
          natural_gas: { usage: 0, co2e: 0, gross: 0, net: 0 },
          water: { usage: 0, co2e: 0, gross: 0, net: 0 },
        },
      };
      SITES.forEach((s) => {
        monthsMatrix[m.num].bySite[s] = {
          usage: 0,
          co2e: 0,
          gross: 0,
          net: 0,
          invoices: 0,
          records: [],
        };
      });
    });

    const siteMap = {};
    SITES.forEach((s) => {
      siteMap[s] = {
        siteName: s,
        electricityKwh: 0,
        gasKwh: 0,
        waterM3: 0,
        totalEnergyKwh: 0,
        totalUsageCombined: 0,
        scope1: 0,
        scope2: 0,
        waterTonnes: 0,
        totalCo2e: 0,
        netCost: 0,
        vatAmount: 0,
        grossCost: 0,
        invoiceCount: 0,
        actualCount: 0,
        activeMonths: new Set(),
        records: [],
      };
    });

    const supplierMap = {};
    SUPPLIERS.forEach((sup) => {
      supplierMap[sup] = {
        supplier: sup,
        electricityKwh: 0,
        gasKwh: 0,
        waterM3: 0,
        totalCo2e: 0,
        netCost: 0,
        vatAmount: 0,
        grossCost: 0,
        invoiceCount: 0,
        actualCount: 0,
        records: [],
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

      const isActual = (inv.readingType || 'Actual') === 'Actual';
      if (isActual) actualReadingCount++;
      if (inv.pdfAttachment?.dataUrl) pdfAttachedCount++;

      const normalizedUsage =
        inv.category === 'water' ? m.normalizedWaterM3 : m.normalizedEnergyKwh;

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

      const site = SITES.includes(inv.siteName) ? inv.siteName : SITES[0];
      const sup = SUPPLIERS.includes(inv.supplier)
        ? inv.supplier
        : SUPPLIERS[0];
      const monthSlice = (inv.billingPeriodStart || '2026-01').slice(5, 7);
      const monthKey = monthsMatrix[monthSlice] ? monthSlice : '01';

      const mBucket = monthsMatrix[monthKey];
      mBucket.totalUsage += normalizedUsage;
      mBucket.totalCo2e += m.co2eTonnes;
      mBucket.totalGross += gross;
      mBucket.totalNet += net;
      mBucket.records.push(inv);

      mBucket.bySite[site].usage += normalizedUsage;
      mBucket.bySite[site].co2e += m.co2eTonnes;
      mBucket.bySite[site].gross += gross;
      mBucket.bySite[site].net += net;
      mBucket.bySite[site].invoices += 1;
      mBucket.bySite[site].records.push(inv);

      const catKey = mBucket.byUtility[inv.category]
        ? inv.category
        : 'electricity';
      mBucket.byUtility[catKey].usage += normalizedUsage;
      mBucket.byUtility[catKey].co2e += m.co2eTonnes;
      mBucket.byUtility[catKey].gross += gross;
      mBucket.byUtility[catKey].net += net;

      const sBucket = siteMap[site];
      sBucket.invoiceCount += 1;
      if (isActual) sBucket.actualCount += 1;
      sBucket.activeMonths.add(monthKey);
      sBucket.netCost += net;
      sBucket.vatAmount += vat;
      sBucket.grossCost += gross;
      sBucket.totalCo2e += m.co2eTonnes;
      sBucket.totalUsageCombined += normalizedUsage;
      sBucket.records.push(inv);

      if (inv.category === 'electricity') {
        sBucket.electricityKwh += m.normalizedEnergyKwh;
        sBucket.totalEnergyKwh += m.normalizedEnergyKwh;
        sBucket.scope2 += m.co2eTonnes;
      } else if (inv.category === 'natural_gas') {
        sBucket.gasKwh += m.normalizedEnergyKwh;
        sBucket.totalEnergyKwh += m.normalizedEnergyKwh;
        sBucket.scope1 += m.co2eTonnes;
      } else {
        sBucket.waterM3 += m.normalizedWaterM3;
        sBucket.waterTonnes += m.co2eTonnes;
      }

      const supBucket = supplierMap[sup];
      supBucket.invoiceCount += 1;
      if (isActual) supBucket.actualCount += 1;
      supBucket.netCost += net;
      supBucket.vatAmount += vat;
      supBucket.grossCost += gross;
      supBucket.totalCo2e += m.co2eTonnes;
      supBucket.records.push(inv);
      if (inv.category === 'electricity') {
        supBucket.electricityKwh += m.normalizedEnergyKwh;
      } else if (inv.category === 'natural_gas') {
        supBucket.gasKwh += m.normalizedEnergyKwh;
      } else {
        supBucket.waterM3 += m.normalizedWaterM3;
      }
    });

    const totalGhgTonnes = scope1Tonnes + scope2Tonnes + waterTonnes;
    const totalEnergyKwh = electricityKwh + fuelKwhEq;
    const totalEnergyMwh = totalEnergyKwh / 1000;

    return {
      scope1Tonnes,
      scope2Tonnes,
      waterTonnes,
      totalGhgTonnes,
      electricityKwh,
      fuelKwhEq,
      totalEnergyKwh,
      totalEnergyMwh,
      waterM3,
      totalNet,
      totalVat,
      totalGross,
      actualReadingCount,
      pdfAttachedCount,
      monthsArray: MONTH_LABELS.map((m) => monthsMatrix[m.num]),
      siteSeries: Object.values(siteMap),
      supplierSeries: Object.values(supplierMap),
    };
  }, [filteredInvoices]);

  // Calculate Monthly Baseline Target for the active site/metric
  const monthlyBaselineTarget = useMemo(() => {
    const activeSitesList =
      selectedSite === 'All Sites' ? SITES : [selectedSite];
    return activeSitesList.reduce((acc, s) => {
      const t = SITE_BASELINE_TARGETS[s] || SITE_BASELINE_TARGETS[SITES[0]];
      if (activeMetric === 'co2e') return acc + t.monthlyCo2eTarget;
      if (activeMetric === 'gross') return acc + t.monthlyGrossTarget;
      if (activeMetric === 'net') return acc + t.monthlyGrossTarget * 0.85;
      return acc + t.monthlyKwhTarget;
    }, 0);
  }, [selectedSite, activeMetric]);

  const totalHeadcountFte = useMemo(() => {
    const activeSitesList =
      selectedSite === 'All Sites' ? SITES : [selectedSite];
    return activeSitesList.reduce(
      (acc, s) => acc + (SITE_BASELINE_TARGETS[s]?.headcountFte || 50),
      0
    );
  }, [selectedSite]);

  const metricMeta = useMemo(() => {
    if (activeMetric === 'co2e') {
      return {
        id: 'co2e',
        label: 'GHG Emissions (MT CO₂e)',
        unit: 'tCO₂e',
        prefix: '',
        decimals: 3,
        getVal: (obj) => obj.co2e ?? obj.totalCo2e ?? 0,
      };
    }
    if (activeMetric === 'gross') {
      return {
        id: 'gross',
        label: 'Gross Expenditure (£ GBP)',
        unit: 'GBP',
        prefix: '£',
        decimals: 2,
        getVal: (obj) => obj.gross ?? obj.grossCost ?? obj.totalGross ?? 0,
      };
    }
    if (activeMetric === 'net') {
      return {
        id: 'net',
        label: 'Net Expenditure (£ GBP)',
        unit: 'GBP',
        prefix: '£',
        decimals: 2,
        getVal: (obj) => obj.net ?? obj.netCost ?? obj.totalNet ?? 0,
      };
    }
    const unitLabel = selectedUtility === 'water' ? 'm³' : 'kWh';
    return {
      id: 'usage',
      label: `Metered Consumption (${unitLabel})`,
      unit: unitLabel,
      prefix: '',
      decimals: 0,
      getVal: (obj) =>
        obj.usage ?? obj.totalUsageCombined ?? obj.totalUsage ?? 0,
    };
  }, [activeMetric, selectedUtility]);

  const maxMonthlyBarValue = useMemo(() => {
    return Math.max(
      1,
      monthlyBaselineTarget * 1.15,
      ...analytics.monthsArray.map((m) => metricMeta.getVal(m))
    );
  }, [analytics.monthsArray, metricMeta, monthlyBaselineTarget]);

  const companyMetricTotal = useMemo(() => {
    return analytics.siteSeries.reduce(
      (acc, s) => acc + metricMeta.getVal(s),
      0
    );
  }, [analytics.siteSeries, metricMeta]);

  const formatMetricNumber = (val, decimals = metricMeta.decimals) => {
    const num = Number(val) || 0;
    return `${metricMeta.prefix}${num.toLocaleString('en-GB', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };

  const actualFidelityPct =
    filteredInvoices.length > 0
      ? Math.round(
          (analytics.actualReadingCount / filteredInvoices.length) * 100
        )
      : 100;

  return (
    <div className="space-y-3">
      {/* =====================================================================
          ROW 1: COMPACT PLATFORM TOOLBAR & FILTER STRIP (8px increments)
      ===================================================================== */}
      <div className="b2b-panel rounded p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-800">
              Telemetry Controls
            </span>
          </div>

          {/* Facility Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Facility:
            </span>
            <select
              value={selectedSite}
              onChange={(e) => onSelectSite(e.target.value)}
              className="text-xs font-semibold bg-transparent text-slate-900 focus:outline-none cursor-pointer"
            >
              {siteOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Utility Stream Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Stream:
            </span>
            <select
              value={selectedUtility}
              onChange={(e) => setSelectedUtility(e.target.value)}
              className="text-xs font-semibold bg-transparent text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="all">All Streams</option>
              <option value="electricity">Electricity (Scope 2)</option>
              <option value="natural_gas">Natural Gas (Scope 1)</option>
              <option value="water">Water (Scope 3)</option>
            </select>
          </div>

          {/* Supplier Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Supplier:
            </span>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="text-xs font-semibold bg-transparent text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="all">All Suppliers</option>
              {SUPPLIERS.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Active Metric Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
          {[
            { id: 'usage', label: 'Usage (kWh/m³)' },
            { id: 'co2e', label: 'GHG (MT CO₂e)' },
            { id: 'gross', label: 'Gross (£)' },
            { id: 'net', label: 'Net (£)' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveMetric(m.id)}
              className={`px-2.5 py-1 rounded-xs text-[11px] font-semibold transition-colors ${
                activeMetric === m.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          ROW 2: HIGH-DENSITY 6-COLUMN INTERACTIVE KPI STRIP (CLICK TO DRILL DOWN)
      ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        {/* KPI 1: Total GHG Emissions (Environmental — Emerald) */}
        <button
          type="button"
          onClick={() =>
            onOpenDrilldown &&
            onOpenDrilldown({
              title: 'Total Consolidated GHG Emissions (Scope 1 + 2 + Water)',
              disclosureCode: `${selectedFramework.scope1Code} / ${selectedFramework.scope2Code}`,
              formattedValue: `${analytics.totalGhgTonnes.toFixed(3)} MT CO₂e`,
              subtitle: `Combined across ${filteredInvoices.length} utility invoices`,
              factorLabel: 'DEFRA 2026 Multi-Stream Factors',
              formula:
                'Total MT CO₂e = Σ(Electricity kWh × 0.000207) + Σ(Gas kWh × 0.0001829) + Σ(Water m³ × 0.000149)',
              records: filteredInvoices,
            })
          }
          className="b2b-panel rounded p-3 text-left hover:border-slate-400 transition-colors group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Total GHG Footprint
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono-num text-[9px] font-semibold">
              ENV · {selectedFramework.id}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div>
              <AnimatedNumber
                value={analytics.totalGhgTonnes}
                decimals={2}
                className="text-xl font-bold text-slate-900"
              />
              <span className="font-mono-num text-[11px] text-slate-500 ml-1">
                MT CO₂e
              </span>
            </div>
            <MiniSparkline
              values={analytics.monthsArray.map((m) => m.totalCo2e)}
              color="#059669"
            />
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span className="font-mono-num">
              {analytics.totalEnergyMwh.toFixed(1)} MWh
            </span>
            <span className="text-emerald-700 font-medium flex items-center gap-0.5 group-hover:underline">
              Audit Source <ArrowUpRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* KPI 2: Scope 2 Electricity (Environmental — Emerald) */}
        <button
          type="button"
          onClick={() =>
            onOpenDrilldown &&
            onOpenDrilldown({
              title: 'Scope 2 Purchased Grid Electricity',
              disclosureCode: selectedFramework.scope2Code,
              formattedValue: `${analytics.electricityKwh.toLocaleString(
                'en-GB',
                { maximumFractionDigits: 0 }
              )} kWh (${analytics.scope2Tonnes.toFixed(3)} MT CO₂e)`,
              subtitle: 'Location-based UK grid electricity consumption',
              factorLabel: '0.20700 kgCO₂e / kWh',
              formula:
                'Scope 2 MT CO₂e = Normalized Electricity (kWh) × 0.207 kgCO₂e/kWh ÷ 1,000',
              records: filteredInvoices.filter(
                (i) => i.category === 'electricity'
              ),
            })
          }
          className="b2b-panel rounded p-3 text-left hover:border-slate-400 transition-colors group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Scope 2 · Electricity
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono-num text-[9px] font-semibold">
              ENV · S2
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div>
              <AnimatedNumber
                value={analytics.electricityKwh}
                decimals={0}
                className="text-xl font-bold text-slate-900"
              />
              <span className="font-mono-num text-[11px] text-slate-500 ml-1">
                kWh
              </span>
            </div>
            <MiniSparkline
              values={analytics.monthsArray.map(
                (m) => m.byUtility.electricity.usage
              )}
              color="#059669"
            />
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span className="font-mono-num text-emerald-700 font-semibold">
              {analytics.scope2Tonnes.toFixed(3)} MT CO₂e
            </span>
            <span className="text-slate-600 font-medium flex items-center gap-0.5 group-hover:underline">
              Drill-Down <ArrowUpRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* KPI 3: Scope 1 Natural Gas & Fuels (Environmental — Emerald) */}
        <button
          type="button"
          onClick={() =>
            onOpenDrilldown &&
            onOpenDrilldown({
              title: 'Scope 1 Stationary Combustion (Natural Gas & Fuels)',
              disclosureCode: selectedFramework.scope1Code,
              formattedValue: `${analytics.fuelKwhEq.toLocaleString('en-GB', {
                maximumFractionDigits: 0,
              })} kWh (${analytics.scope1Tonnes.toFixed(3)} MT CO₂e)`,
              subtitle: 'Direct stationary combustion across UK offices',
              factorLabel: '0.18290 kgCO₂e / kWh (2.046 kg/m³)',
              formula:
                'Scope 1 MT CO₂e = Normalized Gas (kWh) × 0.1829 kgCO₂e/kWh ÷ 1,000',
              records: filteredInvoices.filter(
                (i) => i.category === 'natural_gas'
              ),
            })
          }
          className="b2b-panel rounded p-3 text-left hover:border-slate-400 transition-colors group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Scope 1 · Natural Gas
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono-num text-[9px] font-semibold">
              ENV · S1
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div>
              <AnimatedNumber
                value={analytics.fuelKwhEq}
                decimals={0}
                className="text-xl font-bold text-slate-900"
              />
              <span className="font-mono-num text-[11px] text-slate-500 ml-1">
                kWh
              </span>
            </div>
            <MiniSparkline
              values={analytics.monthsArray.map(
                (m) => m.byUtility.natural_gas.usage
              )}
              color="#059669"
            />
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span className="font-mono-num text-emerald-700 font-semibold">
              {analytics.scope1Tonnes.toFixed(3)} MT CO₂e
            </span>
            <span className="text-slate-600 font-medium flex items-center gap-0.5 group-hover:underline">
              Drill-Down <ArrowUpRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* KPI 4: Water & Workforce Intensity (Social / Operations — Slate Blue) */}
        <button
          type="button"
          onClick={() =>
            onOpenDrilldown &&
            onOpenDrilldown({
              title: 'Water Withdrawal & Workforce Energy Intensity',
              disclosureCode: selectedFramework.waterCode,
              formattedValue: `${analytics.waterM3.toFixed(
                1
              )} m³ (${analytics.waterTonnes.toFixed(3)} MT CO₂e)`,
              subtitle: `Workforce intensity across ${totalHeadcountFte} FTE (${(
                analytics.totalEnergyKwh / Math.max(1, totalHeadcountFte)
              ).toFixed(0)} kWh/FTE)`,
              factorLabel: '0.14900 kgCO₂e / m³ (UK DEFRA)',
              formula:
                'Water MT CO₂e = Volume (m³) × 0.149 kgCO₂e/m³ ÷ 1,000 | Intensity = Total Energy kWh ÷ FTE',
              records: filteredInvoices.filter((i) => i.category === 'water'),
            })
          }
          className="b2b-panel rounded p-3 text-left hover:border-slate-400 transition-colors group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Water &amp; FTE Intensity
            </span>
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono-num text-[9px] font-semibold">
              SOC · OPS
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div>
              <AnimatedNumber
                value={analytics.waterM3}
                decimals={1}
                className="text-xl font-bold text-slate-900"
              />
              <span className="font-mono-num text-[11px] text-slate-500 ml-1">
                m³
              </span>
            </div>
            <MiniSparkline
              values={analytics.monthsArray.map((m) => m.byUtility.water.usage)}
              color="#2563eb"
            />
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span className="font-mono-num text-blue-700 font-semibold">
              {(
                analytics.totalEnergyKwh / Math.max(1, totalHeadcountFte)
              ).toFixed(0)}{' '}
              kWh/FTE
            </span>
            <span className="text-slate-600 font-medium flex items-center gap-0.5 group-hover:underline">
              Drill-Down <ArrowUpRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* KPI 5: Governance & Meter Verification Rate (Governance — Deep Indigo / Amber Warning) */}
        <button
          type="button"
          onClick={() =>
            onOpenDrilldown &&
            onOpenDrilldown({
              title: 'Governance & Meter Verification Assurance',
              disclosureCode: selectedFramework.govCode,
              formattedValue: `${actualFidelityPct}% Actual Readings (${analytics.actualReadingCount}/${filteredInvoices.length})`,
              subtitle: `${analytics.pdfAttachedCount} invoices have embedded PDF evidence in DB`,
              factorLabel: 'ISAE 3000 /AA1000 Data Quality Tier 1',
              formula:
                'Verification Rate (%) = (Actual Meter Invoices ÷ Total Logged Invoices) × 100',
              records: filteredInvoices,
            })
          }
          className="b2b-panel rounded p-3 text-left hover:border-slate-400 transition-colors group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Audit Assurance
            </span>
            <span
              className={`px-1.5 py-0.5 rounded font-mono-num text-[9px] font-semibold border ${
                actualFidelityPct === 100
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              GOV · {actualFidelityPct === 100 ? 'VERIFIED' : 'EST ALERT'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div>
              <span className="font-mono-num text-xl font-bold text-slate-900">
                {actualFidelityPct}%
              </span>
              <span className="font-mono-num text-[11px] text-slate-500 ml-1">
                Actual
              </span>
            </div>
            <span className="font-mono-num text-xs font-semibold text-indigo-700">
              {analytics.actualReadingCount}/{filteredInvoices.length}
            </span>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span className="font-mono-num">
              PDFs: {analytics.pdfAttachedCount}
            </span>
            <span className="text-indigo-700 font-medium flex items-center gap-0.5 group-hover:underline">
              Verify <ArrowUpRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* KPI 6: Financial Settlement (£ GBP Gross / Net / VAT — Governance Indigo) */}
        <button
          type="button"
          onClick={() =>
            onOpenDrilldown &&
            onOpenDrilldown({
              title: 'Total Utility Expenditure & UK VAT Settlement (£ GBP)',
              disclosureCode: 'UK HMRC Energy VAT (20% Standard / 5% De Minimis / 0%)',
              formattedValue: `£${analytics.totalGross.toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} Gross`,
              subtitle: `Net: £${analytics.totalNet.toFixed(
                2
              )} + VAT: £${analytics.totalVat.toFixed(2)}`,
              factorLabel: 'GBP (£) Statutory Invoice Settlement',
              formula:
                'Gross (£) = Net (£) + [Net (£) × Applicable UK Energy VAT Rate (20% | 5% | 0%)]',
              records: filteredInvoices,
            })
          }
          className="b2b-panel rounded p-3 text-left hover:border-slate-400 transition-colors group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Total Spend (£ GBP)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono-num text-[9px] font-semibold">
              FIN · GBP
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div>
              <AnimatedNumber
                value={analytics.totalGross}
                decimals={2}
                prefix="£"
                className="text-xl font-bold text-slate-900"
              />
            </div>
            <MiniSparkline
              values={analytics.monthsArray.map((m) => m.totalGross)}
              color="#4f46e5"
            />
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono-num">
            <span>Net £{analytics.totalNet.toFixed(0)}</span>
            <span>VAT £{analytics.totalVat.toFixed(0)}</span>
          </div>
        </button>
      </div>

      {/* =====================================================================
          ROW 3: PURPOSE-DRIVEN TELEMETRY CHARTS + BASELINE TARGET THRESHOLDS
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left 8 Cols: 12-Month Stacked Bar Chart with Baseline Target Line */}
        <div className="lg:col-span-8 b2b-panel rounded p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                  <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Monthly Telemetry &amp; Baseline Threshold —{' '}
                    {metricMeta.label}
                  </h2>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click any monthly bar to open source invoices in the Audit
                  Drawer. Crimson cap indicates monthly baseline target overrun.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setChartBreakdownMode('site')}
                  className={`px-2 py-0.5 rounded-xs font-medium ${
                    chartBreakdownMode === 'site'
                      ? 'bg-white text-slate-900 border border-slate-200'
                      : 'text-slate-600'
                  }`}
                >
                  By Facility
                </button>
                <button
                  type="button"
                  onClick={() => setChartBreakdownMode('utility')}
                  className={`px-2 py-0.5 rounded-xs font-medium ${
                    chartBreakdownMode === 'utility'
                      ? 'bg-white text-slate-900 border border-slate-200'
                      : 'text-slate-600'
                  }`}
                >
                  By Stream
                </button>
              </div>
            </div>

            {/* Compact Legend + Baseline Target Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-[11px] text-slate-600">
              {chartBreakdownMode === 'site' ? (
                <div className="flex flex-wrap items-center gap-3">
                  {SITES.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-xs ${SITE_SEMANTIC_META[s].dotClass}`}
                      />
                      <span>{s}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-emerald-600" />
                    <span>Electricity (Scope 2)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-teal-600" />
                    <span>Natural Gas (Scope 1)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-blue-600" />
                    <span>Water (Scope 3)</span>
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 font-mono-num text-[10px]">
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <span className="w-3 border-t border-dashed border-amber-600" />
                  Baseline Target: {formatMetricNumber(monthlyBaselineTarget)}{' '}
                  {metricMeta.prefix ? '' : metricMeta.unit}/mo
                </span>
                <span className="inline-flex items-center gap-1 text-red-600">
                  <span className="w-2 h-2 rounded-xs bg-red-600" />
                  Target Breach
                </span>
              </div>
            </div>
          </div>

          {/* 12-Month Bar Plot with Baseline Target Line */}
          <div className="relative pt-6 pb-1">
            {/* Horizontal Dashed Baseline Target Line */}
            {monthlyBaselineTarget > 0 && (
              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-500/90 pointer-events-none z-10 flex justify-end pr-1"
                style={{
                  bottom: `${Math.min(
                    92,
                    Math.max(
                      8,
                      (monthlyBaselineTarget / maxMonthlyBarValue) * 100
                    )
                  )}%`,
                }}
              >
                <span className="bg-amber-50 text-amber-800 border border-amber-300 px-1 rounded text-[9px] font-mono-num -mt-2.5">
                  TARGET {formatMetricNumber(monthlyBaselineTarget, 0)}
                </span>
              </div>
            )}

            <div className="h-48 flex items-end gap-2 border-b border-slate-200 pb-2 px-1">
              {analytics.monthsArray.map((m, idx) => {
                const monthTotal = metricMeta.getVal(m);
                const totalHeightPct =
                  monthTotal > 0
                    ? Math.max(5, (monthTotal / maxMonthlyBarValue) * 100)
                    : 0;
                const isBreach =
                  monthTotal > monthlyBaselineTarget &&
                  monthlyBaselineTarget > 0;

                return (
                  <div
                    key={m.monthNum}
                    onMouseEnter={() => setHoveredMonthIdx(idx)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    onClick={() =>
                      monthTotal > 0 &&
                      onOpenDrilldown &&
                      onOpenDrilldown({
                        title: `${m.full} ${selectedYear} — Monthly Audit Breakdown`,
                        disclosureCode: `${selectedFramework.label} · Monthly Period`,
                        formattedValue: `${formatMetricNumber(monthTotal)} ${
                          metricMeta.prefix ? '' : metricMeta.unit
                        }`,
                        subtitle: isBreach
                          ? `BREACH: Exceeds monthly baseline target (${formatMetricNumber(
                              monthlyBaselineTarget
                            )})`
                          : `Within monthly baseline target (${formatMetricNumber(
                              monthlyBaselineTarget
                            )})`,
                        factorLabel: 'UK DEFRA 2026 Verified Factors',
                        formula: `Monthly Aggregate across ${m.records.length} invoices in ${m.full}`,
                        records: m.records,
                      })
                    }
                    className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                  >
                    {/* Compact Tooltip */}
                    {hoveredMonthIdx === idx && monthTotal > 0 && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 w-52 p-2.5 rounded bg-slate-900 text-white text-[11px] border border-slate-700 pointer-events-none">
                        <div className="font-mono-num font-semibold border-b border-slate-700 pb-1 mb-1.5 flex justify-between">
                          <span>{m.full}</span>
                          <span
                            className={
                              isBreach ? 'text-red-400' : 'text-emerald-400'
                            }
                          >
                            {formatMetricNumber(monthTotal)}
                          </span>
                        </div>
                        {chartBreakdownMode === 'site'
                          ? SITES.map((s) => {
                              const v = metricMeta.getVal(m.bySite[s]);
                              if (v <= 0) return null;
                              return (
                                <div
                                  key={s}
                                  className="flex justify-between text-[10px] text-slate-300 font-mono-num"
                                >
                                  <span className="truncate pr-2">{s}</span>
                                  <span>{formatMetricNumber(v)}</span>
                                </div>
                              );
                            })
                          : [
                              { id: 'electricity', name: 'Electricity' },
                              { id: 'natural_gas', name: 'Natural Gas' },
                              { id: 'water', name: 'Water' },
                            ].map((u) => {
                              const v = metricMeta.getVal(m.byUtility[u.id]);
                              if (v <= 0) return null;
                              return (
                                <div
                                  key={u.id}
                                  className="flex justify-between text-[10px] text-slate-300 font-mono-num"
                                >
                                  <span>{u.name}</span>
                                  <span>{formatMetricNumber(v)}</span>
                                </div>
                              );
                            })}
                      </div>
                    )}

                    {/* Monospace Value Label */}
                    <div
                      className={`font-mono-num text-[9px] mb-1 ${
                        isBreach
                          ? 'text-red-600 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      {monthTotal > 0 ? formatMetricNumber(monthTotal, 0) : ''}
                    </div>

                    {/* Stacked Bar */}
                    <div
                      className={`w-full max-w-[30px] rounded-t-xs overflow-hidden flex flex-col-reverse bg-slate-100 ${
                        isBreach ? 'ring-1 ring-red-600' : ''
                      }`}
                      style={{
                        height: `${totalHeightPct}%`,
                        minHeight: monthTotal > 0 ? '4px' : '1px',
                      }}
                    >
                      {monthTotal > 0 &&
                        (chartBreakdownMode === 'site'
                          ? SITES.map((s) => {
                              const siteVal = metricMeta.getVal(m.bySite[s]);
                              const segPct =
                                monthTotal > 0
                                  ? (siteVal / monthTotal) * 100
                                  : 0;
                              if (segPct <= 0) return null;
                              return (
                                <div
                                  key={s}
                                  style={{ height: `${segPct}%` }}
                                  className={`w-full ${SITE_SEMANTIC_META[s].barClass}`}
                                />
                              );
                            })
                          : [
                              { id: 'electricity', cls: 'bg-emerald-600' },
                              { id: 'natural_gas', cls: 'bg-teal-600' },
                              { id: 'water', cls: 'bg-blue-600' },
                            ].map((u) => {
                              const uVal = metricMeta.getVal(m.byUtility[u.id]);
                              const segPct =
                                monthTotal > 0 ? (uVal / monthTotal) * 100 : 0;
                              if (segPct <= 0) return null;
                              return (
                                <div
                                  key={u.id}
                                  style={{ height: `${segPct}%` }}
                                  className={`w-full ${u.cls}`}
                                />
                              );
                            }))}
                      {isBreach && (
                        <div className="w-full h-1 bg-red-600 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Month X-Axis Labels */}
            <div className="flex items-center gap-2 pt-1.5 px-1">
              {analytics.monthsArray.map((m) => (
                <div
                  key={m.monthNum}
                  className="flex-1 text-center font-mono-num text-[10px] font-medium text-slate-600"
                >
                  {m.short}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Facility Baseline Target Utilization & Intensity */}
        <div className="lg:col-span-4 b2b-panel rounded p-3.5 flex flex-col justify-between">
          <div>
            <div className="pb-2.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Facility Target Utilization &amp; Intensity
                </h2>
              </div>
              <span className="font-mono-num text-[10px] text-slate-500">
                Click row to filter
              </span>
            </div>

            <div className="mt-2.5 space-y-2">
              {analytics.siteSeries.map((s) => {
                const val = metricMeta.getVal(s);
                const sharePct =
                  companyMetricTotal > 0 ? (val / companyMetricTotal) * 100 : 0;
                const activeMonths = Math.max(1, s.activeMonths.size);
                const monthlyAvg = val / activeMonths;
                const targetMeta =
                  SITE_BASELINE_TARGETS[s.siteName] ||
                  SITE_BASELINE_TARGETS[SITES[0]];
                const siteMonthlyTarget =
                  activeMetric === 'co2e'
                    ? targetMeta.monthlyCo2eTarget
                    : activeMetric === 'gross'
                    ? targetMeta.monthlyGrossTarget
                    : activeMetric === 'net'
                    ? targetMeta.monthlyGrossTarget * 0.85
                    : targetMeta.monthlyKwhTarget;

                const utilizationPct =
                  siteMonthlyTarget > 0
                    ? (monthlyAvg / siteMonthlyTarget) * 100
                    : 0;
                const isBreach = utilizationPct > 100;
                const isWarn = !isBreach && utilizationPct > 85;
                const isSelected = selectedSite === s.siteName;

                return (
                  <div
                    key={s.siteName}
                    onClick={() =>
                      onSelectSite(isSelected ? 'All Sites' : s.siteName)
                    }
                    className={`p-2.5 rounded border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                          {SITE_SEMANTIC_META[s.siteName].code}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {s.siteName}
                        </span>
                      </div>
                      <span className="font-mono-num font-bold text-slate-900">
                        {formatMetricNumber(val)}{' '}
                        {metricMeta.prefix ? '' : metricMeta.unit}
                      </span>
                    </div>

                    {/* Semantic Progress Bar vs Baseline Target */}
                    <div className="mt-1.5 w-full bg-slate-100 h-1.5 rounded-xs overflow-hidden">
                      <div
                        className={`h-full ${
                          isBreach
                            ? 'bg-red-600'
                            : isWarn
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, utilizationPct)}%` }}
                      />
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono-num text-slate-500">
                      <span>
                        Mo Avg: {formatMetricNumber(monthlyAvg, 0)} / Target:{' '}
                        {formatMetricNumber(siteMonthlyTarget, 0)}
                      </span>
                      <span
                        className={`font-semibold ${
                          isBreach
                            ? 'text-red-600'
                            : isWarn
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {utilizationPct.toFixed(0)}% of Target (
                        {sharePct.toFixed(0)}% share)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedSite !== 'All Sites' && (
            <button
              type="button"
              onClick={() => onSelectSite('All Sites')}
              className="mt-2 w-full py-1.5 rounded bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
            >
              Reset Facility Filter · Show All 4 Sites
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          ROW 4: HIGH-DENSITY CROSS-TABULATION PIVOT MATRIX (PER SITE, PER MONTH)
      ===================================================================== */}
      <div className="b2b-panel rounded overflow-hidden">
        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Table2 className="w-3.5 h-3.5 text-slate-700" />
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Cross-Tabulation Pivot Matrix — {metricMeta.label} Per Facility,
              Per Month ({selectedYear})
            </h2>
          </div>
          <span className="font-mono-num text-[11px] text-slate-500">
            Click any cell to inspect underlying invoice records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse b2b-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2 px-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                  Facility Name
                </th>
                {MONTH_LABELS.map((m) => (
                  <th key={m.num} className="py-2 px-2.5 text-right font-mono-num">
                    {m.short}
                  </th>
                ))}
                <th className="py-2 px-3 text-right bg-slate-100 text-slate-900 border-l border-slate-200">
                  Total
                </th>
                <th className="py-2 px-3 text-right bg-slate-50 text-slate-600">
                  Mo Avg
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {SITES.map((siteName) => {
                if (selectedSite !== 'All Sites' && selectedSite !== siteName) {
                  return null;
                }
                const siteRowObj = analytics.siteSeries.find(
                  (s) => s.siteName === siteName
                );
                const annualTotal = siteRowObj
                  ? metricMeta.getVal(siteRowObj)
                  : 0;
                const activeCount = Math.max(
                  1,
                  siteRowObj?.activeMonths?.size || 1
                );
                const monthlyAvg = annualTotal / activeCount;

                return (
                  <tr key={siteName}>
                    <td className="py-2 px-3 font-medium text-slate-900 sticky left-0 bg-white border-r border-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-xs ${SITE_SEMANTIC_META[siteName].dotClass}`}
                        />
                        <span>{siteName}</span>
                      </div>
                    </td>
                    {MONTH_LABELS.map((m) => {
                      const cellObj =
                        analytics.monthsArray.find((x) => x.monthNum === m.num)
                          ?.bySite[siteName] || {};
                      const cellVal = metricMeta.getVal(cellObj);
                      return (
                        <td
                          key={m.num}
                          onClick={() =>
                            cellVal > 0 &&
                            onOpenDrilldown &&
                            onOpenDrilldown({
                              title: `${siteName} — ${m.full} ${selectedYear}`,
                              disclosureCode: `${selectedFramework.label} · Facility Cell Audit`,
                              formattedValue: `${formatMetricNumber(cellVal)} ${
                                metricMeta.prefix ? '' : metricMeta.unit
                              }`,
                              subtitle: `${cellObj.records?.length || 0} invoices logged for ${siteName} in ${m.full}`,
                              factorLabel: 'UK DEFRA 2026 Verified Factors',
                              formula: `Cell Sum (${siteName}, ${m.full})`,
                              records: cellObj.records || [],
                            })
                          }
                          className={`py-2 px-2.5 text-right font-mono-num ${
                            cellVal > 0
                              ? 'text-slate-900 font-medium cursor-pointer hover:bg-indigo-50/70 hover:text-indigo-700'
                              : 'text-slate-300'
                          }`}
                        >
                          {cellVal > 0
                            ? formatMetricNumber(
                                cellVal,
                                activeMetric === 'co2e' ? 2 : 0
                              )
                            : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-mono-num font-bold text-slate-900 bg-slate-100/70 border-l border-slate-200 whitespace-nowrap">
                      {formatMetricNumber(annualTotal)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-num text-slate-600 whitespace-nowrap">
                      {formatMetricNumber(monthlyAvg)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white text-xs font-mono-num font-semibold">
                <td className="py-2 px-3 sticky left-0 bg-slate-900 border-r border-slate-800">
                  Portfolio Total
                </td>
                {analytics.monthsArray.map((m) => {
                  const val = metricMeta.getVal(m);
                  return (
                    <td key={m.monthNum} className="py-2 px-2.5 text-right">
                      {val > 0
                        ? formatMetricNumber(
                            val,
                            activeMetric === 'co2e' ? 2 : 0
                          )
                        : '—'}
                    </td>
                  );
                })}
                <td className="py-2 px-3 text-right text-emerald-400 border-l border-slate-800 whitespace-nowrap">
                  {formatMetricNumber(companyMetricTotal)}{' '}
                  {metricMeta.prefix ? '' : metricMeta.unit}
                </td>
                <td className="py-2 px-3 text-right text-slate-400 whitespace-nowrap">
                  {formatMetricNumber(companyMetricTotal / 12)}/mo
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* =====================================================================
          ROW 5: HIGH-DENSITY FACILITY & SUPPLIER BREAKDOWN TABLES
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Table A: Facility Multi-Utility Breakdown (7 Cols) */}
        <div className="lg:col-span-7 b2b-panel rounded overflow-hidden">
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Facility Multi-Stream Telemetry &amp; Assurance Summary
            </h2>
            <button
              type="button"
              onClick={() => onSwitchTab('invoices')}
              className="text-[11px] font-medium text-indigo-600 hover:underline flex items-center gap-0.5"
            >
              <span>Inspect Ledger</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse b2b-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2 px-3">Facility Name</th>
                  <th className="py-2 px-2.5 text-right">Elec (kWh)</th>
                  <th className="py-2 px-2.5 text-right">Gas (kWh)</th>
                  <th className="py-2 px-2.5 text-right">Water (m³)</th>
                  <th className="py-2 px-2.5 text-right">MT CO₂e</th>
                  <th className="py-2 px-2.5 text-right">Assurance</th>
                  <th className="py-2 px-3 text-right">Gross (£ GBP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {analytics.siteSeries.map((s) => {
                  const fidelity =
                    s.invoiceCount > 0
                      ? Math.round((s.actualCount / s.invoiceCount) * 100)
                      : 100;
                  return (
                    <tr
                      key={s.siteName}
                      onClick={() =>
                        onOpenDrilldown &&
                        onOpenDrilldown({
                          title: `${s.siteName} — Facility Audit Dossier`,
                          disclosureCode: `${selectedFramework.label} · Facility Breakdown`,
                          formattedValue: `${s.totalCo2e.toFixed(
                            3
                          )} MT CO₂e | £${s.grossCost.toFixed(2)}`,
                          subtitle: `${s.invoiceCount} utility invoices (${s.actualCount} Actual readings)`,
                          factorLabel: 'UK DEFRA 2026 Multi-Stream',
                          formula: `Facility Sum for ${s.siteName}`,
                          records: s.records,
                        })
                      }
                      className="cursor-pointer"
                    >
                      <td className="py-2 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-[10px] text-slate-400">
                            {SITE_SEMANTIC_META[s.siteName].code}
                          </span>
                          <span>{s.siteName}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num text-slate-800">
                        {s.electricityKwh.toLocaleString('en-GB', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num text-slate-800">
                        {s.gasKwh.toLocaleString('en-GB', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num text-slate-800">
                        {s.waterM3.toFixed(1)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num font-semibold text-emerald-700">
                        {s.totalCo2e.toFixed(3)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                            fidelity === 100
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {fidelity}% ACT
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono-num font-bold text-slate-900">
                        £
                        {s.grossCost.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table B: Contracted Suppliers Breakdown (5 Cols) */}
        <div className="lg:col-span-5 b2b-panel rounded overflow-hidden">
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Contracted UK Utilities Providers (EDF, SSE, EON, Octopus)
            </h2>
            <span className="font-mono-num text-[10px] text-slate-500">
              GBP (£)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse b2b-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2 px-3">Provider</th>
                  <th className="py-2 px-2.5 text-right">Invoices</th>
                  <th className="py-2 px-2.5 text-right">MT CO₂e</th>
                  <th className="py-2 px-2.5 text-right">Net (£)</th>
                  <th className="py-2 px-2.5 text-right">VAT (£)</th>
                  <th className="py-2 px-3 text-right">Gross (£)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {analytics.supplierSeries.map((sup) => (
                  <tr
                    key={sup.supplier}
                    onClick={() =>
                      onOpenDrilldown &&
                      onOpenDrilldown({
                        title: `Supplier Audit Ledger — ${sup.supplier}`,
                        disclosureCode: `${selectedFramework.label} · Vendor Settlement`,
                        formattedValue: `£${sup.grossCost.toFixed(
                          2
                        )} Gross (${sup.totalCo2e.toFixed(3)} MT CO₂e)`,
                        subtitle: `${sup.invoiceCount} invoices from ${sup.supplier}`,
                        factorLabel: 'UK DEFRA 2026 Factors',
                        formula: `Vendor Sum for ${sup.supplier}`,
                        records: sup.records,
                      })
                    }
                    className="cursor-pointer"
                  >
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {sup.supplier}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono-num text-slate-600">
                      {sup.invoiceCount}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono-num text-emerald-700 font-medium">
                      {sup.totalCo2e.toFixed(3)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono-num text-slate-700">
                      £{sup.netCost.toFixed(2)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono-num text-slate-500">
                      £{sup.vatAmount.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-num font-bold text-slate-900">
                      £
                      {sup.grossCost.toLocaleString('en-GB', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
