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

const SITE_EDITORIAL_META = {
  'Head Office London': {
    code: 'LON · 01',
    coords: '51.5072° N, 0.1276° W',
    district: 'Bishopsgate, City of London',
    photo:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80',
    bg: '#121211',
    barClass: 'bg-[#121211]',
    dotClass: 'bg-[#121211]',
    badgeBg: 'bg-[#121211]/[0.06]',
    badgeText: 'text-[#121211]',
  },
  'Office Sheffield': {
    code: 'SHF · 02',
    coords: '53.3811° N, 1.4701° W',
    district: 'Heart of the City, South Yorkshire',
    photo:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80',
    bg: '#D9381E',
    barClass: 'bg-[#D9381E]',
    dotClass: 'bg-[#D9381E]',
    badgeBg: 'bg-[#D9381E]/[0.08]',
    badgeText: 'text-[#D9381E]',
  },
  'Office Leeds': {
    code: 'LDS · 03',
    coords: '53.8008° N, 1.5491° W',
    district: 'Wellington Place, West Yorkshire',
    photo:
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80',
    bg: '#1B4332',
    barClass: 'bg-[#1B4332]',
    dotClass: 'bg-[#1B4332]',
    badgeBg: 'bg-[#1B4332]/[0.08]',
    badgeText: 'text-[#1B4332]',
  },
  'Office Bristol': {
    code: 'BRS · 04',
    coords: '51.4545° N, 2.5879° W',
    district: 'Temple Quarter, Bristol',
    photo:
      'https://images.unsplash.com/photo-1464938050520-ef2270bb8ce8?auto=format&fit=crop&w=900&q=80',
    bg: '#B45309',
    barClass: 'bg-[#B45309]',
    dotClass: 'bg-[#B45309]',
    badgeBg: 'bg-[#B45309]/[0.09]',
    badgeText: 'text-[#B45309]',
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
    <div className="space-y-16 animate-fade-in">
      {/* =====================================================================
          00 / ANTI-GRAVITY ASYMMETRIC 16:9 EDITORIAL HERO SHOWCASE
      ===================================================================== */}
      <section className="relative pt-4 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Asymmetric Editorial Column (7 Cols) */}
          <div className="lg:col-span-7 space-y-7">
            <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white border border-[#121211]/[0.08] shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#D9381E]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#575550]">
                Monograph Nº 04 · UK Commercial Utility & Carbon Architecture
              </span>
            </div>

            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-[54px] text-[#121211] leading-[0.98] tracking-[-0.04em] uppercase">
              Weightless clarity for enterprise{' '}
              <span className="text-[#D9381E]">energy &amp; carbon</span>{' '}
              accounting.
            </h1>

            <p className="text-sm sm:text-base text-[#575550] max-w-2xl leading-relaxed font-normal">
              An editorial-grade environmental ledger engineered for UK
              multi-site operations. Harmonizing verified supplier invoices from{' '}
              <strong className="text-[#121211] font-medium">
                EDF, SSE, EON, and Octopus
              </strong>{' '}
              into real-time DEFRA Scope 1 &amp; Scope 2 intelligence across
              London, Sheffield, Leeds, and Bristol.
            </p>

            {/* Floating Action & Status Row */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              {isOwnerUnlocked ? (
                <button
                  type="button"
                  onClick={onOpenNewInvoice}
                  className="inline-flex items-center gap-2.5 bg-[#121211] hover:bg-[#D9381E] text-[#F6F5F0] text-xs font-medium px-6 py-3.5 rounded-full transition-all duration-300 ag-float-deep"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Utility Invoice</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRequestOwnerUnlock}
                  className="inline-flex items-center gap-2.5 bg-[#121211] hover:bg-[#D9381E] text-[#F6F5F0] text-xs font-medium px-6 py-3.5 rounded-full transition-all duration-300 ag-float-deep"
                  title="Data input and edits are restricted to the repository owner (Mhutt97)"
                >
                  <Lock className="w-3.5 h-3.5 text-[#D9381E]" />
                  <span>Read-Only · Owner Unlock (Mhutt97)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onSwitchTab('invoices')}
                className="inline-flex items-center gap-2 bg-white hover:bg-[#EFECE6] text-[#121211] border border-[#121211]/12 text-xs font-medium px-5 py-3.5 rounded-full transition-all duration-300 shadow-xs"
              >
                <span>Inspect Audit Ledger ({invoices.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#D9381E]" />
              </button>

              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 bg-[#EFECE6]/70 border border-[#121211]/[0.07] text-[#8C8982] text-xs font-medium px-4 py-3 rounded-full cursor-not-allowed select-none"
                title="Legacy Excel (.xlsx) workbook ingestion is locked during the testing phase"
              >
                <Lock className="w-3 h-3" />
                <span>Excel (.xlsx) Ingestion</span>
                <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 bg-[#121211]/[0.06] text-[#575550] rounded-full">
                  Testing
                </span>
              </button>
            </div>

            {/* Asymmetric Floating Hero Micro-Metrics Strip */}
            <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-[#121211]/10">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#8C8982]">
                  Net Carbon
                </div>
                <div className="font-editorial text-2xl text-[#121211] mt-1">
                  <AnimatedNumber
                    value={analytics.totalGhgTonnes}
                    decimals={2}
                  />
                  <span className="font-sans-clean text-xs text-[#8C8982] ml-1">
                    tCO₂e
                  </span>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#8C8982]">
                  Total Energy
                </div>
                <div className="font-editorial text-2xl text-[#121211] mt-1">
                  <AnimatedNumber
                    value={analytics.totalEnergyMwh}
                    decimals={2}
                  />
                  <span className="font-sans-clean text-xs text-[#8C8982] ml-1">
                    MWh
                  </span>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#8C8982]">
                  Gross Spend
                </div>
                <div className="font-editorial text-2xl text-[#121211] mt-1">
                  <AnimatedNumber
                    value={analytics.totalGross}
                    decimals={0}
                    prefix="£"
                  />
                  <span className="font-sans-clean text-xs text-[#8C8982] ml-1">
                    GBP
                  </span>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#8C8982]">
                  Meter Fidelity
                </div>
                <div className="font-editorial text-2xl text-[#1B4332] mt-1">
                  {filteredInvoices.length > 0
                    ? Math.round(
                        (analytics.actualReadingCount /
                          filteredInvoices.length) *
                          100
                      )
                    : 100}
                  %
                  <span className="font-sans-clean text-xs text-[#8C8982] ml-1">
                    Actual
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Asymmetric Multi-Depth Floating Composition (5 Cols) */}
          <div className="lg:col-span-5 relative py-4">
            {/* Primary Architectural Editorial Photograph Card (Depth Z-1) */}
            <div className="relative mx-auto max-w-md lg:max-w-none rounded-[28px] overflow-hidden ag-card-static p-3 bg-white">
              <div className="relative aspect-[4/4.6] rounded-[20px] overflow-hidden bg-[#EFECE6] group">
                <img
                  src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85"
                  alt="UK Commercial Architecture — Bishopsgate London"
                  className="w-full h-full object-cover editorial-photo"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121211]/70 via-[#121211]/10 to-transparent" />

                {/* Editorial Caption inside Frame */}
                <div className="absolute bottom-5 left-5 right-5 text-white flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                      Plate I · Architectural Dossier
                    </div>
                    <div className="font-editorial text-2xl leading-tight mt-0.5">
                      United Kingdom Commercial Portfolio
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 shrink-0">
                    4 Active Sites
                  </span>
                </div>
              </div>
            </div>

            {/* Floating Depth-of-Field Layer 2 (Top-Right Weightless Pill) */}
            <div className="hidden sm:flex items-center gap-2.5 absolute -top-2 -right-3 z-20 ag-glass px-4 py-2.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#1B4332]" />
              <span className="text-[11px] font-medium text-[#121211]">
                DEFRA 2026 · GBP (£) · 20% / 5% / 0% VAT
              </span>
            </div>

            {/* Floating Depth-of-Field Layer 3 (Bottom-Left Overhanging Glass Telemetry Card) */}
            <div className="sm:absolute -bottom-6 sm:-left-8 z-20 mt-4 sm:mt-0 sm:w-80 ag-glass rounded-3xl p-5">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#575550]">
                <span>Live Telemetry Layer</span>
                <span className="text-[#D9381E] font-semibold">
                  {selectedSite === 'All Sites' ? '4 UK Sites' : selectedSite}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div className="font-editorial text-3xl text-[#121211]">
                  {analytics.totalGhgTonnes.toFixed(2)}{' '}
                  <span className="font-sans-clean text-xs text-[#575550]">
                    tCO₂e
                  </span>
                </div>
                <span className="text-xs font-medium text-[#1B4332]">
                  £
                  {analytics.totalNet.toLocaleString('en-GB', {
                    maximumFractionDigits: 0,
                  })}{' '}
                  Net
                </span>
              </div>
              {/* Minimalist Scope Proportion Bar */}
              <div className="mt-3 h-1.5 w-full rounded-full bg-[#121211]/10 overflow-hidden flex">
                <div
                  className="bg-[#121211] h-full transition-all duration-500"
                  style={{
                    width: `${
                      analytics.totalGhgTonnes > 0
                        ? (analytics.scope2Tonnes / analytics.totalGhgTonnes) *
                          100
                        : 65
                    }%`,
                  }}
                />
                <div
                  className="bg-[#D9381E] h-full transition-all duration-500"
                  style={{
                    width: `${
                      analytics.totalGhgTonnes > 0
                        ? (analytics.scope1Tonnes / analytics.totalGhgTonnes) *
                          100
                        : 30
                    }%`,
                  }}
                />
                <div
                  className="bg-[#1B4332] h-full flex-1 transition-all duration-500"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-[#575550]">
                <span>Scope 2: {analytics.scope2Tonnes.toFixed(2)}t</span>
                <span>Scope 1: {analytics.scope1Tonnes.toFixed(2)}t</span>
                <span>Water: {analytics.waterTonnes.toFixed(2)}t</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          01 / WEIGHTLESS FLOATING FILTER & METRIC COMMAND BAR
      ===================================================================== */}
      <section className="ag-glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#575550] mr-2">
              <Filter className="w-3.5 h-3.5 text-[#D9381E]" />
              <span>01 / Telemetry Lens</span>
            </div>

            {/* Site Selector */}
            <div className="flex items-center gap-2 bg-white border border-[#121211]/10 rounded-full px-3.5 py-1.5 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-[#8C8982]" />
              <span className="text-[11px] uppercase tracking-wider text-[#8C8982]">
                Site
              </span>
              <select
                value={selectedSite}
                onChange={(e) => onSelectSite(e.target.value)}
                className="text-xs font-medium bg-transparent text-[#121211] focus:outline-none cursor-pointer"
              >
                {siteOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Utility Stream Selector */}
            <div className="flex items-center gap-2 bg-white border border-[#121211]/10 rounded-full px-3.5 py-1.5 shadow-2xs">
              <span className="text-[11px] uppercase tracking-wider text-[#8C8982]">
                Stream
              </span>
              <select
                value={selectedUtility}
                onChange={(e) => setSelectedUtility(e.target.value)}
                className="text-xs font-medium bg-transparent text-[#121211] focus:outline-none cursor-pointer"
              >
                <option value="all">All Utilities</option>
                <option value="electricity">Electricity (Scope 2)</option>
                <option value="natural_gas">Natural Gas & Fuels (Scope 1)</option>
                <option value="water">Water & Wastewater</option>
              </select>
            </div>

            {/* Supplier Selector */}
            <div className="flex items-center gap-2 bg-white border border-[#121211]/10 rounded-full px-3.5 py-1.5 shadow-2xs">
              <span className="text-[11px] uppercase tracking-wider text-[#8C8982]">
                Supplier
              </span>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="text-xs font-medium bg-transparent text-[#121211] focus:outline-none cursor-pointer"
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
            <div className="flex items-center gap-2 bg-white border border-[#121211]/10 rounded-full px-3.5 py-1.5 shadow-2xs">
              <span className="text-[11px] uppercase tracking-wider text-[#8C8982]">
                Period
              </span>
              <select
                value={selectedYear}
                onChange={(e) => onSelectYear(e.target.value)}
                className="text-xs font-medium bg-transparent text-[#121211] focus:outline-none cursor-pointer"
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
          <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-[#121211]/[0.06]">
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
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                  activeMetric === m.id
                    ? 'bg-[#121211] text-[#F6F5F0] shadow-xs'
                    : 'text-[#575550] hover:text-[#121211]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          02 / ASYMMETRIC FLOATING BENTO KPI ARCHITECTURE
      ===================================================================== */}
      <section className="space-y-5">
        <div className="flex items-baseline justify-between border-b border-[#121211]/10 pb-3">
          <div className="flex items-baseline gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D9381E]">
              02 / Portfolio Telemetry
            </span>
            <h2 className="font-editorial text-3xl text-[#121211]">
              <RevealText text="Consolidated Environmental & Financial Ledger" />
            </h2>
          </div>
          <span className="text-xs text-[#8C8982] hidden sm:inline">
            Showing {filteredInvoices.length} verified records · UK DEFRA
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Total GHG Footprint */}
          <div className="ag-card rounded-[26px] p-7 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8C8982]">
                01 · Total Carbon Footprint
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#121211] text-[#F6F5F0]">
                DEFRA 2026
              </span>
            </div>
            <div className="my-5 flex items-baseline gap-2.5">
              <AnimatedNumber
                value={analytics.totalGhgTonnes}
                decimals={2}
                className="font-editorial text-3xl sm:text-4xl text-[#121211]"
              />
              <span className="text-xs font-medium text-[#8C8982]">tCO₂e</span>
            </div>
            <div className="pt-4 border-t border-[#121211]/[0.07] flex items-center justify-between text-xs text-[#575550]">
              <span>Scope 1, Scope 2 &amp; Water</span>
              <span className="font-medium text-[#121211]">
                {filteredInvoices.length} invoices
              </span>
            </div>
          </div>

          {/* Card 2: Electricity Usage & Scope 2 */}
          <div className="ag-card rounded-[26px] p-7 flex flex-col justify-between lg:translate-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8C8982]">
                02 · Grid Electricity (Scope 2)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#121211]" />
            </div>
            <div className="my-5 flex items-baseline gap-2.5">
              <AnimatedNumber
                value={analytics.electricityKwh}
                decimals={0}
                className="font-editorial text-3xl sm:text-4xl text-[#121211]"
              />
              <span className="text-xs font-medium text-[#8C8982]">kWh</span>
            </div>
            <div className="pt-4 border-t border-[#121211]/[0.07] flex items-center justify-between text-xs text-[#575550]">
              <span>{(analytics.electricityKwh / 1000).toFixed(2)} MWh</span>
              <span className="font-medium text-[#121211]">
                {analytics.scope2Tonnes.toFixed(3)} tCO₂e
              </span>
            </div>
          </div>

          {/* Card 3: Natural Gas & Fuels (Scope 1) */}
          <div className="ag-card rounded-[26px] p-7 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8C8982]">
                03 · Natural Gas (Scope 1)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#D9381E]" />
            </div>
            <div className="my-5 flex items-baseline gap-2.5">
              <AnimatedNumber
                value={analytics.fuelKwhEq}
                decimals={0}
                className="font-editorial text-3xl sm:text-4xl text-[#121211]"
              />
              <span className="text-xs font-medium text-[#8C8982]">kWh-eq</span>
            </div>
            <div className="pt-4 border-t border-[#121211]/[0.07] flex items-center justify-between text-xs text-[#575550]">
              <span>{(analytics.fuelKwhEq / 1000).toFixed(2)} MWh</span>
              <span className="font-medium text-[#D9381E]">
                {analytics.scope1Tonnes.toFixed(3)} tCO₂e
              </span>
            </div>
          </div>

          {/* Card 4: Total Combined Energy (MWh) */}
          <div className="ag-card rounded-[26px] p-7 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8C8982]">
                04 · Combined Energy
              </span>
              <span className="text-[11px] text-[#8C8982]">
                Electricity + Gas
              </span>
            </div>
            <div className="my-5 flex items-baseline gap-2.5">
              <AnimatedNumber
                value={analytics.totalEnergyMwh}
                decimals={2}
                className="font-editorial text-3xl sm:text-4xl text-[#121211]"
              />
              <span className="text-xs font-medium text-[#8C8982]">MWh</span>
            </div>
            <div className="pt-4 border-t border-[#121211]/[0.07] flex items-center justify-between text-xs text-[#575550]">
              <span>Normalized Total:</span>
              <span className="font-medium text-[#121211]">
                {analytics.totalEnergyKwh.toLocaleString('en-GB', {
                  maximumFractionDigits: 0,
                })}{' '}
                kWh
              </span>
            </div>
          </div>

          {/* Card 5: Water & Wastewater */}
          <div className="ag-card rounded-[26px] p-7 flex flex-col justify-between lg:translate-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8C8982]">
                05 · Water Supply &amp; Treatment
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#1B4332]" />
            </div>
            <div className="my-5 flex items-baseline gap-2.5">
              <AnimatedNumber
                value={analytics.waterM3}
                decimals={1}
                className="font-editorial text-3xl sm:text-4xl text-[#121211]"
              />
              <span className="text-xs font-medium text-[#8C8982]">m³</span>
            </div>
            <div className="pt-4 border-t border-[#121211]/[0.07] flex items-center justify-between text-xs text-[#575550]">
              <span>Embodied Water GHG:</span>
              <span className="font-medium text-[#1B4332]">
                {analytics.waterTonnes.toFixed(3)} tCO₂e
              </span>
            </div>
          </div>

          {/* Card 6: Financial Expenditure (£ GBP) */}
          <div className="ag-card rounded-[26px] p-7 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8C8982]">
                06 · Settlement (£ GBP)
              </span>
              {filteredInvoices.length > 0 &&
              analytics.actualReadingCount === filteredInvoices.length ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#1B4332] bg-[#1B4332]/10 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  100% Actual
                </span>
              ) : (
                <span className="text-[11px] text-[#8C8982]">
                  {analytics.actualReadingCount}/{filteredInvoices.length} Actual
                </span>
              )}
            </div>
            <div className="my-5 flex items-baseline gap-2.5">
              <AnimatedNumber
                value={analytics.totalGross}
                decimals={2}
                prefix="£"
                className="font-editorial text-3xl sm:text-4xl text-[#121211]"
              />
              <span className="text-xs font-medium text-[#8C8982]">Gross</span>
            </div>
            <div className="pt-4 border-t border-[#121211]/[0.07] flex items-center justify-between text-xs text-[#575550]">
              <span>
                Net:{' '}
                <strong className="text-[#121211]">
                  £
                  {analytics.totalNet.toLocaleString('en-GB', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </span>
              <span>
                VAT:{' '}
                <strong className="text-[#121211]">
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
      </section>

      {/* =====================================================================
          03 / EDITORIAL SITE ARCHITECTURE LOOKBOOK (CRISP PHOTOGRAPHY + LIVE DATA)
      ===================================================================== */}
      <section className="space-y-6 pt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#121211]/10 pb-3">
          <div className="flex items-baseline gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D9381E]">
              03 / Site Architecture
            </span>
            <h2 className="font-editorial text-3xl text-[#121211]">
              Regional Facility Dossiers
            </h2>
          </div>
          <p className="text-xs text-[#8C8982]">
            Select any architectural card to isolate its telemetry across all
            graphs and matrices
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {analytics.siteSeries.map((s, idx) => {
            const meta =
              SITE_EDITORIAL_META[s.siteName] ||
              SITE_EDITORIAL_META['Head Office London'];
            const isSelected = selectedSite === s.siteName;
            return (
              <div
                key={s.siteName}
                onClick={() =>
                  onSelectSite(isSelected ? 'All Sites' : s.siteName)
                }
                className={`group cursor-pointer rounded-[26px] p-3.5 transition-all duration-500 ${
                  idx % 2 === 1 ? 'lg:translate-y-4' : ''
                } ${
                  isSelected
                    ? 'bg-[#121211] text-[#F6F5F0] ag-float-deep'
                    : 'ag-card text-[#121211]'
                }`}
              >
                {/* Crisp Architectural Photography Placeholder */}
                <div className="relative aspect-[16/10] rounded-[18px] overflow-hidden bg-[#EFECE6] mb-4">
                  <img
                    src={meta.photo}
                    alt={s.siteName}
                    className="w-full h-full object-cover editorial-photo"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#121211] text-[10px] font-semibold uppercase tracking-widest">
                    {meta.code}
                  </div>
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] text-white/90 font-medium">
                    <span>{meta.coords}</span>
                    <span>{s.invoiceCount} invoices</span>
                  </div>
                </div>

                <div className="px-2 pb-2 space-y-3">
                  <div>
                    <div
                      className={`text-[10px] uppercase tracking-[0.14em] ${
                        isSelected ? 'text-white/60' : 'text-[#8C8982]'
                      }`}
                    >
                      {meta.district}
                    </div>
                    <h3 className="font-editorial text-2xl leading-tight mt-0.5">
                      {s.siteName}
                    </h3>
                  </div>

                  <div
                    className={`pt-3 border-t grid grid-cols-2 gap-2 text-xs ${
                      isSelected
                        ? 'border-white/15'
                        : 'border-[#121211]/[0.07]'
                    }`}
                  >
                    <div>
                      <div
                        className={`text-[10px] uppercase tracking-wider ${
                          isSelected ? 'text-white/60' : 'text-[#8C8982]'
                        }`}
                      >
                        Energy (kWh)
                      </div>
                      <div className="font-semibold mt-0.5">
                        {s.totalEnergyKwh.toLocaleString('en-GB', {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-[10px] uppercase tracking-wider ${
                          isSelected ? 'text-white/60' : 'text-[#8C8982]'
                        }`}
                      >
                        Gross (£)
                      </div>
                      <div className="font-semibold mt-0.5">
                        £
                        {s.grossCost.toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          04 / ACTIVE LIVE GRAPHS: TEMPORAL VARIANCE & SITE SHARE
      ===================================================================== */}
      <section className="space-y-6 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#121211]/10 pb-3">
          <div className="flex items-baseline gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D9381E]">
              04 / Temporal Variance
            </span>
            <h2 className="font-editorial text-3xl text-[#121211]">
              Active Monthly &amp; Proportional Graphs
            </h2>
          </div>
          <span className="text-xs text-[#8C8982]">
            Active Metric: <strong className="text-[#121211]">{metricMeta.label}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
          {/* Live Graph 1: Monthly Performance by Site / Utility */}
          <div className="lg:col-span-2 ag-card rounded-[28px] p-7 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#121211]/[0.07]">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D9381E]">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Live Interactive Graph · 12-Month Horizon</span>
                  </div>
                  <h3 className="font-editorial text-2xl text-[#121211] mt-1">
                    {metricMeta.label} per Month (
                    {chartBreakdownMode === 'site'
                      ? 'Stacked by Site Name'
                      : 'Stacked by Utility Stream'}
                    )
                  </h3>
                </div>

                {/* Breakdown Mode Switcher */}
                <div className="inline-flex items-center bg-[#EFECE6] p-1 rounded-full border border-[#121211]/[0.06] text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setChartBreakdownMode('site')}
                    className={`px-3.5 py-1 rounded-full transition-all ${
                      chartBreakdownMode === 'site'
                        ? 'bg-[#121211] text-[#F6F5F0] shadow-2xs'
                        : 'text-[#575550] hover:text-[#121211]'
                    }`}
                  >
                    By Site Name
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartBreakdownMode('utility')}
                    className={`px-3.5 py-1 rounded-full transition-all ${
                      chartBreakdownMode === 'utility'
                        ? 'bg-[#121211] text-[#F6F5F0] shadow-2xs'
                        : 'text-[#575550] hover:text-[#121211]'
                    }`}
                  >
                    By Utility
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-4 mb-2 text-xs font-medium text-[#575550]">
                {chartBreakdownMode === 'site' ? (
                  <div className="flex flex-wrap items-center gap-5">
                    {SITES.map((s) => (
                      <span key={s} className="inline-flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${SITE_EDITORIAL_META[s].dotClass}`}
                        />
                        <span>{s}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-5">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#121211]" />
                      Electricity (Scope 2)
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#D9381E]" />
                      Natural Gas (Scope 1)
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1B4332]" />
                      Water
                    </span>
                  </div>
                )}
                <span className="text-[11px] text-[#8C8982]">
                  Hover any month bar for site breakdown
                </span>
              </div>
            </div>

            {/* 12-Month Stacked Bar Chart Canvas */}
            <div className="relative pt-8 pb-2">
              <div className="h-64 flex items-end gap-2.5 sm:gap-3.5 border-b border-[#121211]/10 pb-3 px-1">
                {analytics.monthsArray.map((m, idx) => {
                  const monthTotal = metricMeta.getVal(m);
                  const totalHeightPct =
                    monthTotal > 0
                      ? Math.max(6, (monthTotal / maxMonthlyBarValue) * 100)
                      : 0;

                  return (
                    <div
                      key={m.monthNum}
                      onMouseEnter={() => setHoveredMonthIdx(idx)}
                      onMouseLeave={() => setHoveredMonthIdx(null)}
                      className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                    >
                      {/* Hover Tooltip */}
                      {hoveredMonthIdx === idx && monthTotal > 0 && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 -translate-y-full z-20 w-56 p-3.5 rounded-2xl bg-[#121211] text-[#F6F5F0] text-[11px] shadow-2xl pointer-events-none">
                          <div className="font-semibold text-white border-b border-white/15 pb-1.5 mb-2 flex justify-between">
                            <span>
                              {m.full}{' '}
                              {selectedYear !== 'All Years' ? selectedYear : ''}
                            </span>
                            <span className="text-[#D9381E]">
                              {formatMetricNumber(monthTotal)}{' '}
                              {metricMeta.prefix ? '' : metricMeta.unit}
                            </span>
                          </div>
                          {chartBreakdownMode === 'site' ? (
                            <div className="space-y-1">
                              {SITES.map((s) => {
                                const v = metricMeta.getVal(m.bySite[s]);
                                if (v <= 0) return null;
                                return (
                                  <div
                                    key={s}
                                    className="flex items-center justify-between text-white/80"
                                  >
                                    <span className="truncate pr-2">{s}:</span>
                                    <span className="font-semibold text-white">
                                      {formatMetricNumber(v)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {[
                                { id: 'electricity', name: 'Electricity' },
                                { id: 'natural_gas', name: 'Natural Gas' },
                                { id: 'water', name: 'Water' },
                              ].map((u) => {
                                const v = metricMeta.getVal(m.byUtility[u.id]);
                                if (v <= 0) return null;
                                return (
                                  <div
                                    key={u.id}
                                    className="flex items-center justify-between text-white/80"
                                  >
                                    <span>{u.name}:</span>
                                    <span className="font-semibold text-white">
                                      {formatMetricNumber(v)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Value Label Above Bar */}
                      <div className="text-[10px] font-medium text-[#8C8982] mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {monthTotal > 0 ? formatMetricNumber(monthTotal, 0) : ''}
                      </div>

                      {/* Stacked Bar Container */}
                      <div
                        className="w-full max-w-[34px] rounded-t-lg overflow-hidden flex flex-col-reverse bg-[#EFECE6] transition-all duration-500 group-hover:brightness-110"
                        style={{
                          height: `${totalHeightPct}%`,
                          minHeight: monthTotal > 0 ? '6px' : '2px',
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
                                    className={`w-full ${SITE_EDITORIAL_META[s].barClass} transition-all duration-500`}
                                  />
                                );
                              })
                            : [
                                { id: 'electricity', cls: 'bg-[#121211]' },
                                { id: 'natural_gas', cls: 'bg-[#D9381E]' },
                                { id: 'water', cls: 'bg-[#1B4332]' },
                              ].map((u) => {
                                const uVal = metricMeta.getVal(
                                  m.byUtility[u.id]
                                );
                                const segPct =
                                  monthTotal > 0
                                    ? (uVal / monthTotal) * 100
                                    : 0;
                                if (segPct <= 0) return null;
                                return (
                                  <div
                                    key={u.id}
                                    style={{ height: `${segPct}%` }}
                                    className={`w-full ${u.cls} transition-all duration-500`}
                                  />
                                );
                              }))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Month X-Axis Labels */}
              <div className="flex items-center gap-2.5 sm:gap-3.5 pt-2.5 px-1">
                {analytics.monthsArray.map((m) => (
                  <div
                    key={m.monthNum}
                    className="flex-1 text-center text-[11px] font-medium text-[#575550]"
                  >
                    {m.short}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Graph 2: Site Comparison & Proportional Distribution */}
          <div className="ag-card rounded-[28px] p-7 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D9381E]">
                <Layers className="w-3.5 h-3.5" />
                <span>Proportional Share</span>
              </div>
              <h3 className="font-editorial text-2xl text-[#121211] mt-1">
                {metricMeta.label} by Site
              </h3>
              <p className="text-xs text-[#8C8982] mt-1">
                Click any site below to isolate its monthly profile
              </p>

              {/* Stacked Company Proportion Bar */}
              <div className="mt-5 h-3 w-full rounded-full bg-[#EFECE6] overflow-hidden flex gap-0.5 p-0.5">
                {analytics.siteSeries.map((s) => {
                  const val = metricMeta.getVal(s);
                  const pct =
                    companyMetricTotal > 0
                      ? (val / companyMetricTotal) * 100
                      : 0;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={s.siteName}
                      style={{ width: `${pct}%` }}
                      className={`h-full first:rounded-l-full last:rounded-r-full ${
                        SITE_EDITORIAL_META[s.siteName].barClass
                      } transition-all duration-500`}
                      title={`${s.siteName}: ${pct.toFixed(1)}%`}
                    />
                  );
                })}
              </div>

              {/* Site Cards List */}
              <div className="mt-5 space-y-3">
                {analytics.siteSeries.map((s) => {
                  const val = metricMeta.getVal(s);
                  const sharePct =
                    companyMetricTotal > 0
                      ? (val / companyMetricTotal) * 100
                      : 0;
                  const activeMonthsCount = Math.max(1, s.activeMonths.size);
                  const monthlyAvg = val / activeMonthsCount;
                  const isSelected = selectedSite === s.siteName;

                  return (
                    <button
                      key={s.siteName}
                      type="button"
                      onClick={() =>
                        onSelectSite(isSelected ? 'All Sites' : s.siteName)
                      }
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-[#121211] bg-[#121211]/[0.04]'
                          : 'border-[#121211]/[0.07] hover:border-[#121211]/25 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#121211] flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              SITE_EDITORIAL_META[s.siteName].dotClass
                            }`}
                          />
                          {s.siteName}
                        </span>
                        <span className="font-semibold text-[#121211]">
                          {formatMetricNumber(val)}{' '}
                          {metricMeta.prefix ? '' : metricMeta.unit}
                        </span>
                      </div>

                      <div className="mt-2 w-full bg-[#EFECE6] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            SITE_EDITORIAL_META[s.siteName].barClass
                          } transition-all duration-500`}
                          style={{ width: `${Math.min(100, sharePct)}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-[#8C8982]">
                        <span>
                          Avg/active mo:{' '}
                          <strong className="text-[#121211]">
                            {formatMetricNumber(monthlyAvg)}
                          </strong>
                        </span>
                        <span className="font-medium text-[#575550]">
                          {sharePct.toFixed(1)}% of total
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedSite !== 'All Sites' && (
              <button
                type="button"
                onClick={() => onSelectSite('All Sites')}
                className="mt-4 w-full py-2.5 rounded-full bg-[#EFECE6] hover:bg-[#121211] hover:text-white text-xs font-medium text-[#121211] transition-colors"
              >
                Reset Filter · Show All 4 UK Sites
              </button>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          05 / LIVE CROSS-TABULATION MATRIX: TOTAL PER SITE PER MONTH
      ===================================================================== */}
      <section className="ag-card rounded-[28px] overflow-hidden">
        <div className="p-7 border-b border-[#121211]/[0.08] flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D9381E]">
              <Table2 className="w-3.5 h-3.5" />
              <span>05 / Cross-Tabulation Pivot Matrix</span>
            </div>
            <h3 className="font-editorial text-2xl text-[#121211] mt-1">
              {metricMeta.label} — Per Site, Per Month (
              {selectedYear === 'All Years' ? 'All Years' : selectedYear})
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#575550]">
            <span>Active Stream:</span>
            <span className="font-medium px-3 py-1 rounded-full bg-[#EFECE6] text-[#121211]">
              {selectedUtility === 'all'
                ? 'All Utilities Combined'
                : selectedUtility === 'electricity'
                ? 'Electricity (kWh)'
                : selectedUtility === 'natural_gas'
                ? 'Natural Gas (kWh)'
                : 'Water (m³)'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#EFECE6]/60 border-b border-[#121211]/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#575550]">
                <th className="py-4 px-5 sticky left-0 bg-[#F6F5F0] z-10">
                  Site Name
                </th>
                {MONTH_LABELS.map((m) => (
                  <th key={m.num} className="py-4 px-3 text-right">
                    {m.short}
                  </th>
                ))}
                <th className="py-4 px-5 text-right bg-[#EFECE6] text-[#121211]">
                  Annual Total
                </th>
                <th className="py-4 px-5 text-right bg-[#EFECE6]/50 text-[#575550]">
                  Monthly Avg
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121211]/[0.06] text-xs">
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
                  <tr
                    key={siteName}
                    className="hover:bg-[#EFECE6]/40 transition-colors"
                  >
                    <td className="py-4 px-5 font-medium text-[#121211] sticky left-0 bg-white whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${SITE_EDITORIAL_META[siteName].dotClass}`}
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
                          className={`py-4 px-3 text-right tabular-nums ${
                            cellVal > 0
                              ? 'font-medium text-[#121211]'
                              : 'text-[#8C8982]/40'
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
                    <td className="py-4 px-5 text-right font-semibold text-[#121211] bg-[#EFECE6]/40 whitespace-nowrap">
                      {formatMetricNumber(annualTotal)}{' '}
                      {metricMeta.prefix ? '' : metricMeta.unit}
                    </td>
                    <td className="py-4 px-5 text-right font-medium text-[#575550] bg-[#EFECE6]/20 whitespace-nowrap">
                      {formatMetricNumber(monthlyAvg)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#121211] text-[#F6F5F0] text-xs font-semibold">
                <td className="py-4 px-5 sticky left-0 bg-[#121211]">
                  Portfolio Total
                </td>
                {analytics.monthsArray.map((m) => {
                  const val = metricMeta.getVal(m);
                  return (
                    <td key={m.monthNum} className="py-4 px-3 text-right">
                      {val > 0
                        ? formatMetricNumber(
                            val,
                            activeMetric === 'co2e' ? 2 : 0
                          )
                        : '—'}
                    </td>
                  );
                })}
                <td className="py-4 px-5 text-right text-[#D9381E] whitespace-nowrap">
                  {formatMetricNumber(companyMetricTotal)}{' '}
                  {metricMeta.prefix ? '' : metricMeta.unit}
                </td>
                <td className="py-4 px-5 text-right text-white/70 whitespace-nowrap">
                  {formatMetricNumber(companyMetricTotal / 12)} / mo
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* =====================================================================
          06 / MULTI-UTILITY SITE & SUPPLIER BREAKDOWN TABLES
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Table A: Complete Site Breakdown */}
        <div className="lg:col-span-7 ag-card rounded-[28px] overflow-hidden">
          <div className="p-6 border-b border-[#121211]/[0.08] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D9381E]">
                Site Summary Ledger
              </div>
              <h3 className="font-editorial text-2xl text-[#121211] mt-0.5">
                Multi-Utility Consumption &amp; Spend by Site
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('invoices')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#121211] hover:text-[#D9381E] transition-colors"
            >
              <span>Full Audit Ledger</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#EFECE6]/50 border-b border-[#121211]/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#575550]">
                  <th className="py-3.5 px-5">Site Name</th>
                  <th className="py-3.5 px-3 text-right">Electricity</th>
                  <th className="py-3.5 px-3 text-right">Natural Gas</th>
                  <th className="py-3.5 px-3 text-right">Water</th>
                  <th className="py-3.5 px-3 text-right">GHG (tCO₂e)</th>
                  <th className="py-3.5 px-5 text-right">Gross (£ GBP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121211]/[0.06] text-xs">
                {analytics.siteSeries.map((s) => (
                  <tr
                    key={s.siteName}
                    onClick={() =>
                      onSelectSite(
                        selectedSite === s.siteName ? 'All Sites' : s.siteName
                      )
                    }
                    className="hover:bg-[#EFECE6]/40 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-5 font-medium text-[#121211]">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            SITE_EDITORIAL_META[s.siteName].dotClass
                          }`}
                        />
                        <span>{s.siteName}</span>
                      </div>
                      <div className="text-[10px] text-[#8C8982] pl-4">
                        {s.invoiceCount} invoices ({s.actualCount} Actual)
                      </div>
                    </td>
                    <td className="py-4 px-3 text-right font-medium text-[#121211]">
                      {s.electricityKwh.toLocaleString('en-GB', {
                        maximumFractionDigits: 0,
                      })}{' '}
                      <span className="text-[10px] text-[#8C8982]">kWh</span>
                    </td>
                    <td className="py-4 px-3 text-right font-medium text-[#121211]">
                      {s.gasKwh.toLocaleString('en-GB', {
                        maximumFractionDigits: 0,
                      })}{' '}
                      <span className="text-[10px] text-[#8C8982]">kWh</span>
                    </td>
                    <td className="py-4 px-3 text-right font-medium text-[#121211]">
                      {s.waterM3.toFixed(1)}{' '}
                      <span className="text-[10px] text-[#8C8982]">m³</span>
                    </td>
                    <td className="py-4 px-3 text-right font-semibold text-[#1B4332]">
                      {s.totalCo2e.toFixed(3)} t
                    </td>
                    <td className="py-4 px-5 text-right font-semibold text-[#121211]">
                      £
                      {s.grossCost.toLocaleString('en-GB', {
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

        {/* Table B: Utilities Provider Summary (EDF, SSE, EON, Octopus) */}
        <div className="lg:col-span-5 ag-card rounded-[28px] overflow-hidden">
          <div className="p-6 border-b border-[#121211]/[0.08]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D9381E]">
              Contracted UK Suppliers
            </div>
            <h3 className="font-editorial text-2xl text-[#121211] mt-0.5">
              Summary by Utilities Provider
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#EFECE6]/50 border-b border-[#121211]/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#575550]">
                  <th className="py-3.5 px-5">Provider</th>
                  <th className="py-3.5 px-3 text-right">Net (£)</th>
                  <th className="py-3.5 px-3 text-right">VAT (£)</th>
                  <th className="py-3.5 px-5 text-right">Gross (£)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121211]/[0.06] text-xs">
                {analytics.supplierSeries.map((sup) => (
                  <tr
                    key={sup.supplier}
                    onClick={() =>
                      setSelectedSupplier(
                        selectedSupplier === sup.supplier ? 'all' : sup.supplier
                      )
                    }
                    className="hover:bg-[#EFECE6]/40 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-5">
                      <div className="font-medium text-[#121211]">
                        {sup.supplier}
                      </div>
                      <div className="text-[10px] text-[#8C8982]">
                        {sup.invoiceCount} invoices ·{' '}
                        {sup.totalCo2e.toFixed(2)} tCO₂e
                      </div>
                    </td>
                    <td className="py-4 px-3 text-right font-medium text-[#575550]">
                      £
                      {sup.netCost.toLocaleString('en-GB', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-4 px-3 text-right font-medium text-[#8C8982]">
                      £
                      {sup.vatAmount.toLocaleString('en-GB', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-4 px-5 text-right font-semibold text-[#121211]">
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
