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
} from 'lucide-react';
import {
  calculateInvoiceEsgMetrics,
  SITES,
  SUPPLIERS,
} from '../data/emissionFactors.js';
import { AnimatedNumber, RevealText } from './AnimatedText.jsx';

const SITE_COLORS = {
  'Head Office London': {
    bg: '#2563eb',
    lightBg: 'rgba(37, 99, 235, 0.10)',
    border: 'rgba(37, 99, 235, 0.28)',
    text: '#1d4ed8',
    barClass: 'bg-blue-600',
    dotClass: 'bg-blue-600',
  },
  'Office Sheffield': {
    bg: '#0ea5e9',
    lightBg: 'rgba(14, 165, 233, 0.10)',
    border: 'rgba(14, 165, 233, 0.28)',
    text: '#0284c7',
    barClass: 'bg-sky-500',
    dotClass: 'bg-sky-500',
  },
  'Office Leeds': {
    bg: '#059669',
    lightBg: 'rgba(5, 150, 105, 0.10)',
    border: 'rgba(5, 150, 105, 0.28)',
    text: '#047857',
    barClass: 'bg-emerald-600',
    dotClass: 'bg-emerald-600',
  },
  'Office Bristol': {
    bg: '#d97706',
    lightBg: 'rgba(217, 119, 6, 0.10)',
    border: 'rgba(217, 119, 6, 0.28)',
    text: '#b45309',
    barClass: 'bg-amber-600',
    dotClass: 'bg-amber-600',
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

export default function DashboardView({
  invoices,
  orgProfile,
  selectedSite,
  onSelectSite,
  selectedYear,
  onSelectYear,
  onOpenNewInvoice,
  onSwitchTab,
  isOwnerUnlocked = false,
  onRequestOwnerUnlock,
}) {
  const [selectedUtility, setSelectedUtility] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [activeMetric, setActiveMetric] = useState('usage'); // 'usage' | 'co2e' | 'gross' | 'net'
  const [chartBreakdownMode, setChartBreakdownMode] = useState('site'); // 'site' | 'utility'
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState(null);

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

    // 12-month structure (01..12)
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
        };
      });
    });

    // Site breakdown table structure
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
      };
    });

    // Supplier breakdown table structure
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

      // Determine normalized usage for the selected stream
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

      // Populate Month × Site Matrix
      const mBucket = monthsMatrix[monthKey];
      mBucket.totalUsage += normalizedUsage;
      mBucket.totalCo2e += m.co2eTonnes;
      mBucket.totalGross += gross;
      mBucket.totalNet += net;

      mBucket.bySite[site].usage += normalizedUsage;
      mBucket.bySite[site].co2e += m.co2eTonnes;
      mBucket.bySite[site].gross += gross;
      mBucket.bySite[site].net += net;
      mBucket.bySite[site].invoices += 1;

      const catKey = mBucket.byUtility[inv.category]
        ? inv.category
        : 'electricity';
      mBucket.byUtility[catKey].usage += normalizedUsage;
      mBucket.byUtility[catKey].co2e += m.co2eTonnes;
      mBucket.byUtility[catKey].gross += gross;
      mBucket.byUtility[catKey].net += net;

      // Populate Site Summary
      const sBucket = siteMap[site];
      sBucket.invoiceCount += 1;
      if (isActual) sBucket.actualCount += 1;
      sBucket.activeMonths.add(monthKey);
      sBucket.netCost += net;
      sBucket.vatAmount += vat;
      sBucket.grossCost += gross;
      sBucket.totalCo2e += m.co2eTonnes;
      sBucket.totalUsageCombined += normalizedUsage;

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

      // Populate Supplier Summary
      const supBucket = supplierMap[sup];
      supBucket.invoiceCount += 1;
      supBucket.netCost += net;
      supBucket.vatAmount += vat;
      supBucket.grossCost += gross;
      supBucket.totalCo2e += m.co2eTonnes;
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

  const metricMeta = useMemo(() => {
    if (activeMetric === 'co2e') {
      return {
        id: 'co2e',
        label: 'GHG Emissions (tCO₂e)',
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
      label: `Total Metered Usage (${unitLabel})`,
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
      ...analytics.monthsArray.map((m) => metricMeta.getVal(m))
    );
  }, [analytics.monthsArray, metricMeta]);

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Page Title & Interactive Filter Command Bar */}
      <div className="card-surface rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-blue-600 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-full">
              <span>Live Multi-Site Telemetry & ESG Ledger</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gradient-heading mt-1.5">
              <RevealText text="UK Business Energy & Site Performance Summaries" />
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200/90 text-slate-400 text-xs font-semibold px-3.5 py-2 rounded-xl cursor-not-allowed select-none"
              title="Legacy Excel (.xlsx) workbook ingestion is locked during the testing phase"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Upload Excel (.xlsx)</span>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                Testing
              </span>
            </button>

            {isOwnerUnlocked ? (
              <button
                type="button"
                onClick={onOpenNewInvoice}
                className="inline-flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
                style={{
                  background:
                    'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.32)',
                }}
              >
                <Plus className="w-4 h-4" />
                Log Utility Invoice
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequestOwnerUnlock}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                title="Data input and edits are restricted to the repository owner (Mhutt97)"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Read-Only · Owner Unlock</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Filter Controls */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-1">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Filter Ledger:</span>
            </div>

            {/* Site Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">
                Site:
              </span>
              <select
                value={selectedSite}
                onChange={(e) => onSelectSite(e.target.value)}
                className="text-xs font-bold bg-transparent text-slate-900 focus:outline-none"
              >
                {siteOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Utility Stream Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-500">
                Utility:
              </span>
              <select
                value={selectedUtility}
                onChange={(e) => setSelectedUtility(e.target.value)}
                className="text-xs font-bold bg-transparent text-slate-900 focus:outline-none"
              >
                <option value="all">All Utilities</option>
                <option value="electricity">Electricity (Scope 2)</option>
                <option value="natural_gas">Natural Gas & Fuels (Scope 1)</option>
                <option value="water">Water & Wastewater</option>
              </select>
            </div>

            {/* Supplier Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-500">
                Supplier:
              </span>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="text-xs font-bold bg-transparent text-slate-900 focus:outline-none"
              >
                <option value="all">All Suppliers</option>
                {SUPPLIERS.map((sup) => (
                  <option key={sup} value={sup}>
                    {sup}
                  </option>
                ))}
              </select>
            </div>

            {/* Reporting Year Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-500">
                Year:
              </span>
              <select
                value={selectedYear}
                onChange={(e) => onSelectYear(e.target.value)}
                className="text-xs font-bold bg-transparent text-slate-900 focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Metric Switcher for Graphs & Matrix */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {[
              { id: 'usage', label: 'Usage (kWh/m³)' },
              { id: 'co2e', label: 'Emissions (tCO₂e)' },
              { id: 'gross', label: 'Gross (£)' },
              { id: 'net', label: 'Net (£)' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMetric(m.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeMetric === m.id
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Executive KPI Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Total GHG Footprint */}
        <div className="card-surface rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Carbon Footprint
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
              UK DEFRA
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <AnimatedNumber
              value={analytics.totalGhgTonnes}
              decimals={2}
              className="text-3xl font-extrabold tracking-tight text-slate-900"
            />
            <span className="text-xs font-bold text-slate-500">tCO₂e</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Combined Scope 1, Scope 2 & Water</span>
            <span className="font-bold text-slate-700">
              {filteredInvoices.length} invoices
            </span>
          </div>
        </div>

        {/* Card 2: Electricity Usage & Scope 2 */}
        <div className="card-surface rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Electricity Usage (Scope 2)
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <AnimatedNumber
              value={analytics.electricityKwh}
              decimals={0}
              className="text-3xl font-extrabold tracking-tight text-slate-900"
            />
            <span className="text-xs font-bold text-slate-500">kWh</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{(analytics.electricityKwh / 1000).toFixed(2)} MWh</span>
            <span className="font-bold text-blue-700">
              {analytics.scope2Tonnes.toFixed(3)} tCO₂e
            </span>
          </div>
        </div>

        {/* Card 3: Natural Gas & Fuels (Scope 1) */}
        <div className="card-surface rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Natural Gas & Fuels (Scope 1)
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <AnimatedNumber
              value={analytics.fuelKwhEq}
              decimals={0}
              className="text-3xl font-extrabold tracking-tight text-slate-900"
            />
            <span className="text-xs font-bold text-slate-500">kWh-eq</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{(analytics.fuelKwhEq / 1000).toFixed(2)} MWh</span>
            <span className="font-bold text-amber-700">
              {analytics.scope1Tonnes.toFixed(3)} tCO₂e
            </span>
          </div>
        </div>

        {/* Card 4: Total Combined Energy (MWh) */}
        <div className="card-surface rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Energy Consumption
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              Electricity + Gas
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <AnimatedNumber
              value={analytics.totalEnergyMwh}
              decimals={2}
              className="text-2xl font-extrabold tracking-tight text-slate-900"
            />
            <span className="text-xs font-bold text-slate-500">MWh</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Normalized kWh Total:</span>
            <span className="font-bold text-slate-700">
              {analytics.totalEnergyKwh.toLocaleString('en-GB', {
                maximumFractionDigits: 0,
              })}{' '}
              kWh
            </span>
          </div>
        </div>

        {/* Card 5: Water & Wastewater */}
        <div className="card-surface rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Water & Wastewater
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <AnimatedNumber
              value={analytics.waterM3}
              decimals={1}
              className="text-2xl font-extrabold tracking-tight text-slate-900"
            />
            <span className="text-xs font-bold text-slate-500">m³</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Embodied Water GHG:</span>
            <span className="font-bold text-cyan-700">
              {analytics.waterTonnes.toFixed(3)} tCO₂e
            </span>
          </div>
        </div>

        {/* Card 6: Financial Expenditure (£ GBP) */}
        <div className="card-surface rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Invoice Spend (£ GBP)
            </span>
            {filteredInvoices.length > 0 &&
            analytics.actualReadingCount === filteredInvoices.length ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                100% Actual
              </span>
            ) : (
              <span className="text-[11px] font-bold text-slate-500">
                {analytics.actualReadingCount}/{filteredInvoices.length} Actual
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <AnimatedNumber
              value={analytics.totalGross}
              decimals={2}
              prefix="£"
              className="text-2xl font-extrabold tracking-tight text-slate-900"
            />
            <span className="text-xs font-bold text-slate-400">Gross</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Net:{' '}
              <strong className="text-slate-700">
                £
                {analytics.totalNet.toLocaleString('en-GB', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </span>
            <span>
              VAT:{' '}
              <strong className="text-slate-700">
                £
                {analytics.totalVat.toLocaleString('en-GB', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* LIVE GRAPHS ROW: Monthly Multi-Site Graph + Site Share Distribution Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Graph 1: Monthly Performance by Site / Utility */}
        <div className="lg:col-span-2 card-surface rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Active Live Graph · Monthly Breakdown</span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                  {metricMeta.label} per Month (
                  {chartBreakdownMode === 'site'
                    ? 'Stacked by Site Name'
                    : 'Stacked by Utility Stream'}
                  )
                </h3>
              </div>

              {/* Breakdown Mode Switcher */}
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setChartBreakdownMode('site')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    chartBreakdownMode === 'site'
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Site Name
                </button>
                <button
                  type="button"
                  onClick={() => setChartBreakdownMode('utility')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    chartBreakdownMode === 'utility'
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Utility
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 mb-2 text-xs font-semibold text-slate-600">
              {chartBreakdownMode === 'site' ? (
                <div className="flex flex-wrap items-center gap-4">
                  {SITES.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${SITE_COLORS[s].dotClass}`}
                      />
                      <span>{s}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    Electricity (Scope 2)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Natural Gas (Scope 1)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    Water
                  </span>
                </div>
              )}

              {hoveredMonthIdx !== null && (
                <span className="text-xs font-bold text-blue-600">
                  {analytics.monthsArray[hoveredMonthIdx].full}:{' '}
                  {formatMetricNumber(
                    metricMeta.getVal(analytics.monthsArray[hoveredMonthIdx])
                  )}{' '}
                  {metricMeta.prefix ? '' : metricMeta.unit}
                </span>
              )}
            </div>

            {/* 12-Month Interactive Bar Chart */}
            <div className="h-64 pt-6 pb-2 px-1 flex items-end gap-2 sm:gap-3 border-b border-slate-200 relative">
              {analytics.monthsArray.map((mItem, idx) => {
                const monthTotal = metricMeta.getVal(mItem);
                const segments =
                  chartBreakdownMode === 'site'
                    ? SITES.map((s) => ({
                        key: s,
                        label: s,
                        val: metricMeta.getVal(mItem.bySite[s]),
                        barClass: SITE_COLORS[s].barClass,
                      }))
                    : [
                        {
                          key: 'electricity',
                          label: 'Electricity',
                          val: metricMeta.getVal(mItem.byUtility.electricity),
                          barClass: 'bg-blue-600',
                        },
                        {
                          key: 'natural_gas',
                          label: 'Natural Gas',
                          val: metricMeta.getVal(mItem.byUtility.natural_gas),
                          barClass: 'bg-amber-500',
                        },
                        {
                          key: 'water',
                          label: 'Water',
                          val: metricMeta.getVal(mItem.byUtility.water),
                          barClass: 'bg-cyan-500',
                        },
                      ];

                return (
                  <div
                    key={mItem.monthNum}
                    onMouseEnter={() => setHoveredMonthIdx(idx)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                  >
                    <div className="text-[10px] font-bold text-slate-500 mb-1.5 group-hover:text-blue-600 transition-colors">
                      {monthTotal > 0
                        ? formatMetricNumber(
                            monthTotal,
                            activeMetric === 'usage' ? 0 : 1
                          )
                        : '—'}
                    </div>
                    <div className="w-full max-w-[44px] flex flex-col-reverse rounded-t-lg overflow-hidden bg-slate-100/90 h-44 justify-start border border-slate-200/50 group-hover:border-blue-300 transition-all">
                      {segments.map((seg) => {
                        if (seg.val <= 0) return null;
                        const pct = (seg.val / maxMonthlyBarValue) * 100;
                        return (
                          <div
                            key={seg.key}
                            style={{ height: `${Math.max(3, pct)}%` }}
                            className={`${seg.barClass} transition-all duration-500`}
                            title={`${mItem.full} · ${
                              seg.label
                            }: ${formatMetricNumber(seg.val)} ${
                              metricMeta.prefix ? '' : metricMeta.unit
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span className="mt-2 text-xs font-bold text-slate-600 group-hover:text-blue-600">
                      {mItem.short}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Hover any month column above to inspect site-level figures, or
              switch metrics in the top bar.
            </span>
            <button
              type="button"
              onClick={() => onSwitchTab && onSwitchTab('invoices')}
              className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700"
            >
              <span>Manage Underlying Invoices</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Graph 2: Site Comparison & Share Distribution */}
        <div className="card-surface rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-100">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-600">
                <Layers className="w-3.5 h-3.5" />
                <span>Site Distribution</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {metricMeta.label} by Site
              </h3>
            </div>

            <div className="mt-4 space-y-4">
              {analytics.siteSeries.map((site) => {
                const siteVal = metricMeta.getVal(site);
                const sharePct =
                  companyMetricTotal > 0
                    ? (siteVal / companyMetricTotal) * 100
                    : 0;
                const activeMonthsCount = site.activeMonths.size || 1;
                const monthlyAvg =
                  site.invoiceCount > 0 ? siteVal / activeMonthsCount : 0;
                const palette = SITE_COLORS[site.siteName] || SITE_COLORS[SITES[0]];

                return (
                  <div
                    key={site.siteName}
                    onClick={() =>
                      onSelectSite(
                        selectedSite === site.siteName
                          ? 'All Sites'
                          : site.siteName
                      )
                    }
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      selectedSite === site.siteName
                        ? 'border-blue-500 bg-blue-50/40 shadow-2xs'
                        : 'border-slate-200/80 hover:border-blue-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-900 flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${palette.dotClass}`}
                        />
                        {site.siteName}
                      </span>
                      <span className="font-extrabold text-slate-900">
                        {formatMetricNumber(siteVal)}{' '}
                        {metricMeta.prefix ? '' : metricMeta.unit}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>
                        Avg/mo: {formatMetricNumber(monthlyAvg)}{' '}
                        {metricMeta.prefix ? '' : metricMeta.unit}
                      </span>
                      <span>
                        {sharePct.toFixed(1)}% share · {site.invoiceCount}{' '}
                        {site.invoiceCount === 1 ? 'bill' : 'bills'}
                      </span>
                    </div>

                    <div className="mt-2 w-full h-2 bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${palette.barClass} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(100, sharePct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Click any site card to isolate its monthly profile</span>
            {selectedSite !== 'All Sites' && (
              <button
                type="button"
                onClick={() => onSelectSite('All Sites')}
                className="font-bold text-blue-600 hover:underline"
              >
                Reset to All Sites
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LIVE SUMMARY TABLE 1: Site × Month Matrix (Total Usage / Emissions / Spend per Site per Month) */}
      <div className="card-surface rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-600">
              <Table2 className="w-3.5 h-3.5" />
              <span>Live Cross-Tabulation Matrix</span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
              {metricMeta.label} — Per Site, Per Month ({selectedYear})
            </h3>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {[
              { id: 'usage', label: 'Total Usage' },
              { id: 'co2e', label: 'Emissions (tCO₂e)' },
              { id: 'gross', label: 'Gross Spend (£)' },
              { id: 'net', label: 'Net Spend (£)' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMetric(m.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeMetric === m.id
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10 min-w-[180px]">
                  Site Name
                </th>
                {MONTH_LABELS.map((m) => (
                  <th key={m.num} className="py-3 px-3 text-right">
                    {m.short}
                  </th>
                ))}
                <th className="py-3 px-4 text-right bg-blue-50/50 text-blue-900">
                  YTD Total
                </th>
                <th className="py-3 px-4 text-right bg-slate-100/70 text-slate-700">
                  Monthly Avg
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {SITES.map((siteName) => {
                const palette = SITE_COLORS[siteName];
                let rowTotal = 0;
                let monthsWithData = 0;

                const monthCells = analytics.monthsArray.map((mObj) => {
                  const cellVal = metricMeta.getVal(mObj.bySite[siteName]);
                  rowTotal += cellVal;
                  if (cellVal > 0) monthsWithData += 1;
                  return { monthNum: mObj.monthNum, val: cellVal };
                });

                const rowAvg =
                  monthsWithData > 0 ? rowTotal / monthsWithData : 0;

                return (
                  <tr
                    key={siteName}
                    className="hover:bg-slate-50/90 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${palette.dotClass}`}
                        />
                        <span>{siteName}</span>
                      </div>
                    </td>
                    {monthCells.map((cell) => (
                      <td
                        key={cell.monthNum}
                        className={`py-3.5 px-3 text-right font-semibold ${
                          cell.val > 0 ? 'text-slate-900' : 'text-slate-300'
                        }`}
                      >
                        {cell.val > 0 ? formatMetricNumber(cell.val) : '—'}
                      </td>
                    ))}
                    <td className="py-3.5 px-4 text-right font-extrabold text-blue-700 bg-blue-50/30">
                      {formatMetricNumber(rowTotal)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-700 bg-slate-50/60">
                      {formatMetricNumber(rowAvg)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-extrabold text-xs">
                <td className="py-3.5 px-4 sticky left-0 bg-slate-900 z-10">
                  Total Across All Sites ({metricMeta.unit})
                </td>
                {analytics.monthsArray.map((mObj) => {
                  const colVal = metricMeta.getVal(mObj);
                  return (
                    <td key={mObj.monthNum} className="py-3.5 px-3 text-right">
                      {colVal > 0 ? formatMetricNumber(colVal) : '—'}
                    </td>
                  );
                })}
                <td className="py-3.5 px-4 text-right text-sky-300 bg-slate-950">
                  {formatMetricNumber(companyMetricTotal)}
                </td>
                <td className="py-3.5 px-4 text-right text-slate-300 bg-slate-950">
                  {formatMetricNumber(companyMetricTotal / 12)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* LIVE SUMMARY TABLE 2 & 3: Comprehensive Site Breakdown & Supplier Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Comprehensive Site Multi-Utility Summary Table */}
        <div className="lg:col-span-2 card-surface rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-200/80">
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Site-Level Multi-Utility Ledger Summary
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
              Total Usage, Emissions & Spend by Site Name
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Site Name</th>
                  <th className="py-3 px-3 text-right">Electricity</th>
                  <th className="py-3 px-3 text-right">Natural Gas</th>
                  <th className="py-3 px-3 text-right">Water</th>
                  <th className="py-3 px-3 text-right">Emissions</th>
                  <th className="py-3 px-3 text-right">Net (£)</th>
                  <th className="py-3 px-3 text-right">VAT (£)</th>
                  <th className="py-3 px-4 text-right">Gross (£ GBP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {analytics.siteSeries.map((site) => {
                  const palette = SITE_COLORS[site.siteName];
                  return (
                    <tr
                      key={site.siteName}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${palette.dotClass}`}
                          />
                          <div>
                            <div>{site.siteName}</div>
                            <div className="text-[11px] font-normal text-slate-400">
                              {site.invoiceCount} invoices · {site.actualCount}{' '}
                              actual
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-800">
                        {site.electricityKwh.toLocaleString('en-GB', {
                          maximumFractionDigits: 0,
                        })}{' '}
                        <span className="text-slate-400">kWh</span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-800">
                        {site.gasKwh.toLocaleString('en-GB', {
                          maximumFractionDigits: 0,
                        })}{' '}
                        <span className="text-slate-400">kWh</span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-800">
                        {site.waterM3.toLocaleString('en-GB', {
                          maximumFractionDigits: 1,
                        })}{' '}
                        <span className="text-slate-400">m³</span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-blue-700">
                        {site.totalCo2e.toFixed(3)}{' '}
                        <span className="text-slate-400 font-normal">t</span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-700">
                        £
                        {site.netCost.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-700">
                        £
                        {site.vatAmount.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                        £
                        {site.grossCost.toLocaleString('en-GB', {
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

        {/* Utilities Provider Summary Table */}
        <div className="card-surface rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-200/80">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                Provider Allocation
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                Summary by Utilities Provider
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-3 text-right">Usage (kWh)</th>
                    <th className="py-3 px-3 text-right">CO₂e</th>
                    <th className="py-3 px-4 text-right">Gross (£)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {analytics.supplierSeries.map((sup) => {
                    const combinedKwh = sup.electricityKwh + sup.gasKwh;
                    return (
                      <tr
                        key={sup.supplier}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div>{sup.supplier}</div>
                          <div className="text-[11px] font-normal text-slate-400">
                            {sup.invoiceCount}{' '}
                            {sup.invoiceCount === 1 ? 'invoice' : 'invoices'}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-semibold text-slate-800">
                          {combinedKwh.toLocaleString('en-GB', {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-blue-700">
                          {sup.totalCo2e.toFixed(3)}t
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                          £
                          {sup.grossCost.toLocaleString('en-GB', {
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

          <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
            <span>PDF Documents Stored in DB:</span>
            <span className="font-bold text-slate-800">
              {analytics.pdfAttachedCount} / {filteredInvoices.length} invoices
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
