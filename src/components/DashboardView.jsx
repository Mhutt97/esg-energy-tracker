import React, { useState, useMemo } from 'react';
import {
  Building2,
  CheckCircle2,
  ArrowUpRight,
  BarChart3,
  Table2,
  Layers,
  Filter,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Zap,
  Flame,
  Droplets,
} from 'lucide-react';
import {
  calculateInvoiceEsgMetrics,
  SITES,
  SUPPLIERS,
  SUPPLIER_MARKET_FACTORS,
  DEFRA_FACTOR_REGISTRY,
  SBTI_PATHWAY_CONFIG,
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
  dashboardSubView = 'overview',
  onSelectDashboardSubView,
  scope2AccountingMethod = 'location',
  onChangeScope2Method,
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

  // Interactive Decarbonization / SBTi Scenario Sliders (Watershed / Plan A Workbench)
  const [regoUpgradePct, setRegoUpgradePct] = useState(65);
  const [gasElectrificationPct, setGasElectrificationPct] = useState(40);
  const [bmsEfficiencyPct, setBmsEfficiencyPct] = useState(15);
  const [waterConservationPct, setWaterConservationPct] = useState(20);

  // Factor Registry Filter
  const [factorScopeFilter, setFactorScopeFilter] = useState('all');

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
    let scope2LocationTonnes = 0;
    let scope2MarketTonnes = 0;
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
        totalLocationCo2e: 0,
        totalMarketCo2e: 0,
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
          byStream: {
            electricity: [],
            natural_gas: [],
            water: [],
          },
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
        scope2Location: 0,
        scope2Market: 0,
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
        locationCo2e: 0,
        marketCo2e: 0,
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

      const activeInvoiceCo2e =
        inv.category === 'electricity' && scope2AccountingMethod === 'market'
          ? m.marketCo2eTonnes
          : m.co2eTonnes;

      if (inv.category === 'electricity') {
        scope2LocationTonnes += m.locationCo2eTonnes;
        scope2MarketTonnes += m.marketCo2eTonnes;
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
      mBucket.totalCo2e += activeInvoiceCo2e;
      mBucket.totalLocationCo2e += m.locationCo2eTonnes;
      mBucket.totalMarketCo2e += m.marketCo2eTonnes;
      mBucket.totalGross += gross;
      mBucket.totalNet += net;
      mBucket.records.push(inv);

      const catKey = mBucket.byUtility[inv.category]
        ? inv.category
        : 'electricity';

      mBucket.bySite[site].usage += normalizedUsage;
      mBucket.bySite[site].co2e += activeInvoiceCo2e;
      mBucket.bySite[site].gross += gross;
      mBucket.bySite[site].net += net;
      mBucket.bySite[site].invoices += 1;
      mBucket.bySite[site].records.push(inv);
      mBucket.bySite[site].byStream[catKey].push(inv);

      mBucket.byUtility[catKey].usage += normalizedUsage;
      mBucket.byUtility[catKey].co2e += activeInvoiceCo2e;
      mBucket.byUtility[catKey].gross += gross;
      mBucket.byUtility[catKey].net += net;

      const sBucket = siteMap[site];
      sBucket.invoiceCount += 1;
      if (isActual) sBucket.actualCount += 1;
      sBucket.activeMonths.add(monthKey);
      sBucket.netCost += net;
      sBucket.vatAmount += vat;
      sBucket.grossCost += gross;
      sBucket.totalCo2e += activeInvoiceCo2e;
      sBucket.totalUsageCombined += normalizedUsage;
      sBucket.records.push(inv);

      if (inv.category === 'electricity') {
        sBucket.electricityKwh += m.normalizedEnergyKwh;
        sBucket.totalEnergyKwh += m.normalizedEnergyKwh;
        sBucket.scope2Location += m.locationCo2eTonnes;
        sBucket.scope2Market += m.marketCo2eTonnes;
        sBucket.scope2 += activeInvoiceCo2e;
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
      supBucket.locationCo2e += m.locationCo2eTonnes;
      supBucket.marketCo2e += m.marketCo2eTonnes;
      supBucket.totalCo2e += activeInvoiceCo2e;
      supBucket.records.push(inv);
      if (inv.category === 'electricity') {
        supBucket.electricityKwh += m.normalizedEnergyKwh;
      } else if (inv.category === 'natural_gas') {
        supBucket.gasKwh += m.normalizedEnergyKwh;
      } else {
        supBucket.waterM3 += m.normalizedWaterM3;
      }
    });

    const activeScope2Tonnes =
      scope2AccountingMethod === 'market'
        ? scope2MarketTonnes
        : scope2LocationTonnes;
    const totalLocationGhgTonnes =
      scope1Tonnes + scope2LocationTonnes + waterTonnes;
    const totalMarketGhgTonnes =
      scope1Tonnes + scope2MarketTonnes + waterTonnes;
    const totalGhgTonnes = scope1Tonnes + activeScope2Tonnes + waterTonnes;
    const scope2ProcurementDeltaTonnes = Math.max(
      0,
      scope2LocationTonnes - scope2MarketTonnes
    );

    const totalEnergyKwh = electricityKwh + fuelKwhEq;
    const totalEnergyMwh = totalEnergyKwh / 1000;

    return {
      scope1Tonnes,
      scope2Tonnes: activeScope2Tonnes,
      scope2LocationTonnes,
      scope2MarketTonnes,
      scope2ProcurementDeltaTonnes,
      waterTonnes,
      totalGhgTonnes,
      totalLocationGhgTonnes,
      totalMarketGhgTonnes,
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
  }, [filteredInvoices, scope2AccountingMethod]);

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

  const { totalHeadcountFte, totalFloorAreaM2 } = useMemo(() => {
    const activeSitesList =
      selectedSite === 'All Sites' ? SITES : [selectedSite];
    return activeSitesList.reduce(
      (acc, s) => {
        const meta = SITE_BASELINE_TARGETS[s] || {};
        acc.totalHeadcountFte += meta.headcountFte || 50;
        acc.totalFloorAreaM2 += meta.floorAreaM2 || 1000;
        return acc;
      },
      { totalHeadcountFte: 0, totalFloorAreaM2: 0 }
    );
  }, [selectedSite]);

  const metricMeta = useMemo(() => {
    if (activeMetric === 'co2e') {
      return {
        id: 'co2e',
        label: `GHG Emissions (MT CO₂e · ${
          scope2AccountingMethod === 'market' ? 'Market-Based' : 'Location-Based'
        })`,
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
  }, [activeMetric, selectedUtility, scope2AccountingMethod]);

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

  // =========================================================================
  // DATA COMPLETENESS MATRIX & ANOMALY ENGINE (Sweep / Normative / Envizi)
  // =========================================================================
  const completenessMatrix = useMemo(() => {
    const activeSitesList =
      selectedSite === 'All Sites' ? SITES : [selectedSite];
    const streams = [
      { id: 'electricity', label: 'Electricity', scope: 'Scope 2', icon: Zap },
      { id: 'natural_gas', label: 'Natural Gas', scope: 'Scope 1', icon: Flame },
      { id: 'water', label: 'Water', scope: 'Scope 3', icon: Droplets },
    ].filter((st) => selectedUtility === 'all' || st.id === selectedUtility);

    // Find latest active month index across dataset (or default to first 6 months if partially through year)
    let maxActiveMonthNum = 6;
    analytics.monthsArray.forEach((m, idx) => {
      if (m.records.length > 0 && idx + 1 > maxActiveMonthNum) {
        maxActiveMonthNum = idx + 1;
      }
    });

    const rows = [];
    let verifiedCells = 0;
    let estimatedCells = 0;
    let missingGapCells = 0;
    let totalEvaluatedCells = 0;

    activeSitesList.forEach((siteName) => {
      streams.forEach((stream) => {
        const monthCells = MONTH_LABELS.map((m, mIdx) => {
          const mObj = analytics.monthsArray[mIdx];
          const recs = mObj?.bySite?.[siteName]?.byStream?.[stream.id] || [];
          const isWithinReportingHorizon = mIdx + 1 <= maxActiveMonthNum;

          if (recs.length > 0) {
            const hasEstimated = recs.some(
              (r) => (r.readingType || 'Actual') === 'Estimated'
            );
            if (isWithinReportingHorizon) totalEvaluatedCells++;
            if (hasEstimated) {
              if (isWithinReportingHorizon) estimatedCells++;
              return {
                month: m,
                status: 'EST',
                records: recs,
              };
            }
            if (isWithinReportingHorizon) verifiedCells++;
            return {
              month: m,
              status: 'ACT',
              records: recs,
            };
          }

          if (isWithinReportingHorizon) {
            totalEvaluatedCells++;
            missingGapCells++;
            return {
              month: m,
              status: 'GAP',
              records: [],
            };
          }

          return {
            month: m,
            status: 'FUT',
            records: [],
          };
        });

        const populatedInHorizon = monthCells.filter(
          (c) => c.status === 'ACT' || c.status === 'EST'
        ).length;
        const coveragePct = Math.min(
          100,
          Math.round((populatedInHorizon / Math.max(1, maxActiveMonthNum)) * 100)
        );

        rows.push({
          key: `${siteName}-${stream.id}`,
          siteName,
          siteCode: SITE_SEMANTIC_META[siteName]?.code || 'UK',
          stream,
          monthCells,
          coveragePct,
        });
      });
    });

    // Tariff & Meter Anomaly Scanner
    const streamAvgRates = { electricity: 0.26, natural_gas: 0.085, water: 2.85 };
    const streamRateSums = {
      electricity: { cost: 0, qty: 0 },
      natural_gas: { cost: 0, qty: 0 },
      water: { cost: 0, qty: 0 },
    };

    filteredInvoices.forEach((inv) => {
      const m = calculateInvoiceEsgMetrics(inv);
      const qty =
        inv.category === 'water' ? m.normalizedWaterM3 : m.normalizedEnergyKwh;
      const net = Number(inv.netCost ?? inv.cost) || 0;
      if (qty > 0 && streamRateSums[inv.category]) {
        streamRateSums[inv.category].cost += net;
        streamRateSums[inv.category].qty += qty;
      }
    });

    Object.keys(streamRateSums).forEach((k) => {
      if (streamRateSums[k].qty > 0) {
        streamAvgRates[k] = streamRateSums[k].cost / streamRateSums[k].qty;
      }
    });

    const anomalies = [];
    filteredInvoices.forEach((inv) => {
      const m = calculateInvoiceEsgMetrics(inv);
      const qty =
        inv.category === 'water' ? m.normalizedWaterM3 : m.normalizedEnergyKwh;
      const net = Number(inv.netCost ?? inv.cost) || 0;
      const unitRate = qty > 0 ? net / qty : 0;
      const avgRate = streamAvgRates[inv.category] || 0.2;
      const rateDeviationPct =
        avgRate > 0 ? ((unitRate - avgRate) / avgRate) * 100 : 0;

      const reasons = [];
      let severity = 'WARN';
      if ((inv.readingType || 'Actual') === 'Estimated') {
        reasons.push('Estimated Meter Reading (Requires Supplier Actualization)');
      }
      if (Math.abs(rateDeviationPct) > 25) {
        reasons.push(
          `Unit Rate Variance (${rateDeviationPct > 0 ? '+' : ''}${rateDeviationPct.toFixed(
            0
          )}% vs portfolio £/${inv.category === 'water' ? 'm³' : 'kWh'} avg)`
        );
        if (rateDeviationPct > 35) severity = 'BREACH';
      }
      if (!inv.pdfAttachment?.dataUrl) {
        reasons.push('Missing Source Invoice PDF Evidence');
      }

      if (reasons.length > 0) {
        anomalies.push({
          invoice: inv,
          unitRate,
          rateDeviationPct,
          reasons,
          severity,
          co2eTonnes: m.co2eTonnes,
        });
      }
    });

    const completenessScorePct =
      totalEvaluatedCells > 0
        ? Math.round(
            ((verifiedCells + estimatedCells) / totalEvaluatedCells) * 100
          )
        : 100;

    return {
      rows,
      verifiedCells,
      estimatedCells,
      missingGapCells,
      totalEvaluatedCells,
      completenessScorePct,
      maxActiveMonthNum,
      anomalies,
    };
  }, [analytics.monthsArray, filteredInvoices, selectedSite, selectedUtility]);

  // =========================================================================
  // SBTi 1.5°C PATHWAY & DECARBONIZATION MODELER (Watershed / Plan A)
  // =========================================================================
  const decarbonizationModel = useMemo(() => {
    const activeMonthsCount = Math.max(
      1,
      analytics.monthsArray.filter((m) => m.records.length > 0).length
    );
    const annualizationMultiplier = 12 / activeMonthsCount;

    const annualizedLocScope2 =
      analytics.scope2LocationTonnes * annualizationMultiplier;
    const annualizedMktScope2 =
      analytics.scope2MarketTonnes * annualizationMultiplier;
    const annualizedScope1 = analytics.scope1Tonnes * annualizationMultiplier;
    const annualizedWater = analytics.waterTonnes * annualizationMultiplier;
    const annualizedElecSpend =
      filteredInvoices
        .filter((i) => i.category === 'electricity')
        .reduce((a, b) => a + (Number(b.netCost) || 0), 0) *
      annualizationMultiplier;
    const annualizedGasSpend =
      filteredInvoices
        .filter((i) => i.category === 'natural_gas')
        .reduce((a, b) => a + (Number(b.netCost) || 0), 0) *
      annualizationMultiplier;
    const annualizedWaterSpend =
      filteredInvoices
        .filter((i) => i.category === 'water')
        .reduce((a, b) => a + (Number(b.netCost) || 0), 0) *
      annualizationMultiplier;

    // Lever 1: BMS & HVAC Demand Efficiency reduces both electricity and gas demand
    const bmsFactor = bmsEfficiencyPct / 100;
    const bmsCo2eSaved =
      (annualizedMktScope2 + annualizedScope1) * bmsFactor;
    const bmsGbpSaved = (annualizedElecSpend + annualizedGasSpend) * bmsFactor;

    // Lever 2: Remaining Scope 2 Market-Based shifted to 100% REGO Renewable Tariff
    const postBmsMktScope2 = annualizedMktScope2 * (1 - bmsFactor);
    const regoCo2eSaved = postBmsMktScope2 * (regoUpgradePct / 100);
    const regoGbpSaved = annualizedElecSpend * 0.015 * (regoUpgradePct / 100);

    // Lever 3: Commercial Heat Pump Electrification of Natural Gas (COP 3.2 efficiency advantage)
    const postBmsScope1 = annualizedScope1 * (1 - bmsFactor);
    const heatPumpNetReductionRatio = 0.72; // Net GHG reduction after accounting for heat pump electricity
    const gasElecCo2eSaved =
      postBmsScope1 *
      (gasElectrificationPct / 100) *
      heatPumpNetReductionRatio;
    const gasElecGbpSaved =
      annualizedGasSpend * 0.18 * (gasElectrificationPct / 100);

    // Lever 4: Water Flow Restrictors & Greywater Recycling
    const waterCo2eSaved = annualizedWater * (waterConservationPct / 100);
    const waterGbpSaved = annualizedWaterSpend * (waterConservationPct / 100);

    const annualizedBaselineTotal =
      annualizedLocScope2 + annualizedScope1 + annualizedWater;
    const annualizedCurrentMarketTotal =
      annualizedMktScope2 + annualizedScope1 + annualizedWater;
    const totalScenarioAbatementTonnes =
      bmsCo2eSaved + regoCo2eSaved + gasElecCo2eSaved + waterCo2eSaved;
    const projectedResidualTonnes = Math.max(
      0,
      annualizedCurrentMarketTotal - totalScenarioAbatementTonnes
    );
    const totalAnnualGbpSavings =
      bmsGbpSaved + regoGbpSaved + gasElecGbpSaved + waterGbpSaved;

    // Scale SBTi Base Year (2022) to selected facility share
    const siteShareRatio =
      selectedSite === 'All Sites'
        ? 1
        : (SITE_BASELINE_TARGETS[selectedSite]?.monthlyCo2eTarget || 2.2) / 9.4;
    const base2022Tonnes =
      SBTI_PATHWAY_CONFIG.baseYearAnnualTonnesCo2e * siteShareRatio;

    const yearsTrajectory = [2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map(
      (yr) => {
        const yearsElapsed = yr - SBTI_PATHWAY_CONFIG.baseYear;
        const sbtiTargetTonnes =
          base2022Tonnes *
          (1 - (SBTI_PATHWAY_CONFIG.annualLinearReductionPct / 100) * yearsElapsed);
        let projectedTonnes = sbtiTargetTonnes;
        if (yr <= 2025) {
          projectedTonnes = base2022Tonnes * (1 - 0.035 * yearsElapsed);
        } else if (yr === 2026) {
          projectedTonnes = annualizedCurrentMarketTotal || sbtiTargetTonnes * 0.96;
        } else {
          const progressTo2030 = (yr - 2026) / 4;
          const start2026 =
            annualizedCurrentMarketTotal || sbtiTargetTonnes * 0.96;
          projectedTonnes =
            start2026 -
            (start2026 - projectedResidualTonnes) * progressTo2030;
        }
        return {
          year: yr,
          sbtiTargetTonnes: Math.max(0, sbtiTargetTonnes),
          projectedTonnes: Math.max(0, projectedTonnes),
        };
      }
    );

    const sbti2026Budget =
      yearsTrajectory.find((y) => y.year === 2026)?.sbtiTargetTonnes || 100;
    const isOnTrack2026 = projectedResidualTonnes <= sbti2026Budget;

    return {
      annualizedBaselineTotal,
      annualizedCurrentMarketTotal,
      totalScenarioAbatementTonnes,
      projectedResidualTonnes,
      totalAnnualGbpSavings,
      base2022Tonnes,
      sbti2026Budget,
      isOnTrack2026,
      yearsTrajectory,
      levers: [
        {
          id: 'rego',
          name: '100% REGO Renewable Electricity Tariff Expansion',
          scope: 'Scope 2 (Market)',
          pct: regoUpgradePct,
          setPct: setRegoUpgradePct,
          maxPct: 100,
          co2eSaved: regoCo2eSaved,
          gbpSaved: regoGbpSaved,
        },
        {
          id: 'heatpump',
          name: 'Commercial Air-Source Heat Pump Gas Electrification (COP 3.2)',
          scope: 'Scope 1 (Direct)',
          pct: gasElectrificationPct,
          setPct: setGasElectrificationPct,
          maxPct: 100,
          co2eSaved: gasElecCo2eSaved,
          gbpSaved: gasElecGbpSaved,
        },
        {
          id: 'bms',
          name: 'Smart BMS, HVAC Setback & LED Daylight Controls',
          scope: 'Scope 1 & 2',
          pct: bmsEfficiencyPct,
          setPct: setBmsEfficiencyPct,
          maxPct: 35,
          co2eSaved: bmsCo2eSaved,
          gbpSaved: bmsGbpSaved,
        },
        {
          id: 'water',
          name: 'Water Flow Restrictors & Acoustic Leak Telemetry',
          scope: 'Scope 3 (Water)',
          pct: waterConservationPct,
          setPct: setWaterConservationPct,
          maxPct: 40,
          co2eSaved: waterCo2eSaved,
          gbpSaved: waterGbpSaved,
        },
      ],
    };
  }, [
    analytics,
    filteredInvoices,
    selectedSite,
    regoUpgradePct,
    gasElectrificationPct,
    bmsEfficiencyPct,
    waterConservationPct,
  ]);

  return (
    <div className="space-y-3">
      {/* =====================================================================
          ROW 0: ESG WORKBENCH MODULE TABS (Watershed / Persefoni / Sweep Style)
      ===================================================================== */}
      <div className="b2b-panel rounded p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {[
            {
              id: 'overview',
              label: '01 · Executive Carbon & Utility Telemetry',
              badge: `${analytics.totalGhgTonnes.toFixed(2)} tCO₂e`,
            },
            {
              id: 'completeness',
              label: '02 · Data Completeness & Anomaly Matrix',
              badge: `${completenessMatrix.completenessScorePct}% Coverage`,
            },
            {
              id: 'decarbonization',
              label: '03 · SBTi 1.5°C Pathway & Decarbonization',
              badge: decarbonizationModel.isOnTrack2026
                ? '1.5°C ON TRACK'
                : 'GAP ALERT',
            },
            {
              id: 'disclosures',
              label: `04 · ${selectedFramework.id} Disclosures & DEFRA Factors`,
              badge: `${DEFRA_FACTOR_REGISTRY.length} Factors`,
            },
          ].map((tab) => {
            const active = dashboardSubView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  onSelectDashboardSubView && onSelectDashboardSubView(tab.id)
                }
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono-num text-[10px] px-1.5 py-0.5 rounded ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Dual Scope 2 Method Indicator */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-500 font-medium">Scope 2 Method:</span>
          <button
            type="button"
            onClick={() =>
              onChangeScope2Method &&
              onChangeScope2Method(
                scope2AccountingMethod === 'location' ? 'market' : 'location'
              )
            }
            className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 font-mono-num text-[10px] font-semibold hover:bg-emerald-100"
          >
            {scope2AccountingMethod === 'market'
              ? 'MARKET-BASED (REGO)'
              : 'LOCATION-BASED (UK GRID)'}
          </button>
        </div>
      </div>

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
          ROW 2: HIGH-DENSITY 6-COLUMN INTERACTIVE KPI STRIP (ALWAYS VISIBLE)
      ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        {/* KPI 1: Total GHG Emissions (Environmental — Emerald) */}
        <button
          type="button"
          onClick={() =>
            onOpenDrilldown &&
            onOpenDrilldown({
              title: `Total Consolidated GHG Emissions (${
                scope2AccountingMethod === 'market'
                  ? 'Market-Based'
                  : 'Location-Based'
              })`,
              disclosureCode: `${selectedFramework.scope1Code} / ${selectedFramework.scope2Code}`,
              formattedValue: `${analytics.totalGhgTonnes.toFixed(3)} MT CO₂e`,
              subtitle: `Location-Based: ${analytics.totalLocationGhgTonnes.toFixed(
                3
              )} tCO₂e · Market-Based: ${analytics.totalMarketGhgTonnes.toFixed(
                3
              )} tCO₂e`,
              factorLabel: 'DEFRA 2026 + Ofgem REGO Fuel Mix',
              formula:
                'Total MT CO₂e = Scope 1 (Gas) + Scope 2 (Location or Market Electricity) + Scope 3 (Water)',
              records: filteredInvoices,
            })
          }
          className="b2b-panel rounded p-3 text-left hover:border-slate-400 transition-colors group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Total GHG ({scope2AccountingMethod === 'market' ? 'Mkt' : 'Loc'})
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
              {((analytics.totalGhgTonnes * 1000) / Math.max(1, totalFloorAreaM2)).toFixed(
                1
              )}{' '}
              kg/m²
            </span>
            <span className="text-emerald-700 font-medium flex items-center gap-0.5 group-hover:underline">
              Audit Source <ArrowUpRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* KPI 2: Scope 2 Electricity (Dual Location vs Market) */}
        <button
          type="button"
          onClick={() =>
            onOpenDrilldown &&
            onOpenDrilldown({
              title: 'Scope 2 Purchased Electricity (Dual GHG Protocol Audit)',
              disclosureCode: selectedFramework.scope2Code,
              formattedValue: `${analytics.electricityKwh.toLocaleString(
                'en-GB',
                { maximumFractionDigits: 0 }
              )} kWh (${analytics.scope2Tonnes.toFixed(3)} MT CO₂e)`,
              subtitle: `Location-Based: ${analytics.scope2LocationTonnes.toFixed(
                3
              )} tCO₂e | Market-Based: ${analytics.scope2MarketTonnes.toFixed(
                3
              )} tCO₂e (REGO Delta: -${analytics.scope2ProcurementDeltaTonnes.toFixed(
                3
              )} tCO₂e)`,
              factorLabel: 'Loc: 0.207 kg/kWh · Mkt: Supplier REGO Mix',
              formula:
                'Location S2 = kWh × 0.207 ÷ 1,000 | Market S2 = Σ(kWh × Supplier REGO Factor) ÷ 1,000',
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
              Loc {analytics.scope2LocationTonnes.toFixed(2)} / Mkt{' '}
              {analytics.scope2MarketTonnes.toFixed(2)} t
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

        {/* KPI 5: Governance & Data Completeness Assurance (Governance — Deep Indigo / Amber Warning) */}
        <button
          type="button"
          onClick={() =>
            onSelectDashboardSubView && onSelectDashboardSubView('completeness')
          }
          className="b2b-panel rounded p-3 text-left hover:border-slate-400 transition-colors group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Data Completeness
            </span>
            <span
              className={`px-1.5 py-0.5 rounded font-mono-num text-[9px] font-semibold border ${
                actualFidelityPct === 100 &&
                completenessMatrix.missingGapCells === 0
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              GOV · {completenessMatrix.completenessScorePct}% COV
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
              Gaps: {completenessMatrix.missingGapCells} · PDFs:{' '}
              {analytics.pdfAttachedCount}
            </span>
            <span className="text-indigo-700 font-medium flex items-center gap-0.5 group-hover:underline">
              Matrix <ArrowUpRight className="w-2.5 h-2.5" />
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
              disclosureCode:
                'UK HMRC Energy VAT (20% Standard / 5% De Minimis / 0%)',
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
          MODULE 1: EXECUTIVE CARBON & UTILITY TELEMETRY ('overview')
      ===================================================================== */}
      {dashboardSubView === 'overview' && (
        <>
          {/* GHG PROTOCOL DUAL SCOPE 2 ACCOUNTING BAR (Persefoni / Watershed Signature Panel) */}
          <div className="b2b-panel rounded p-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-2.5 min-w-[260px] flex-1">
              <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    GHG Protocol Dual Scope 2 Accounting — Location-Based vs.
                    Market-Based
                  </h3>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono-num text-[10px] font-semibold">
                    REGO Saved:{' '}
                    {analytics.scope2ProcurementDeltaTonnes.toFixed(3)} MT CO₂e
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Compares physical UK Grid generation intensity (
                  <span className="font-mono-num">0.207 kgCO₂e/kWh</span>)
                  against supplier-specific REGO &amp; zero-carbon fuel mix
                  disclosures (Octopus 100% REGO, EDF Nuclear/REGO, EON, SSE).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 font-mono-num text-xs">
              <div className="px-3 py-1.5 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase">
                  Location-Based S2
                </div>
                <div className="font-bold text-slate-900">
                  {analytics.scope2LocationTonnes.toFixed(3)} MT CO₂e
                </div>
              </div>
              <div className="px-3 py-1.5 rounded bg-emerald-50/70 border border-emerald-200">
                <div className="text-[10px] text-emerald-700 uppercase">
                  Market-Based S2 (REGO)
                </div>
                <div className="font-bold text-emerald-800">
                  {analytics.scope2MarketTonnes.toFixed(3)} MT CO₂e
                </div>
              </div>
              <div className="px-3 py-1.5 rounded bg-indigo-50/70 border border-indigo-200">
                <div className="text-[10px] text-indigo-700 uppercase">
                  Procurement Reduction
                </div>
                <div className="font-bold text-indigo-800">
                  {analytics.scope2LocationTonnes > 0
                    ? `-${(
                        (analytics.scope2ProcurementDeltaTonnes /
                          analytics.scope2LocationTonnes) *
                        100
                      ).toFixed(1)}%`
                    : '0.0%'}
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: PURPOSE-DRIVEN TELEMETRY CHARTS + BASELINE TARGET THRESHOLDS */}
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
                      Drawer. Crimson cap indicates monthly baseline target
                      overrun.
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
                        <span
                          key={s}
                          className="inline-flex items-center gap-1.5"
                        >
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
                      Baseline Target:{' '}
                      {formatMetricNumber(monthlyBaselineTarget)}{' '}
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
                            formattedValue: `${formatMetricNumber(
                              monthTotal
                            )} ${metricMeta.prefix ? '' : metricMeta.unit}`,
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
                                  const v = metricMeta.getVal(
                                    m.byUtility[u.id]
                                  );
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

                        <div
                          className={`font-mono-num text-[9px] mb-1 ${
                            isBreach
                              ? 'text-red-600 font-bold'
                              : 'text-slate-500'
                          }`}
                        >
                          {monthTotal > 0
                            ? formatMetricNumber(monthTotal, 0)
                            : ''}
                        </div>

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
                                  const siteVal = metricMeta.getVal(
                                    m.bySite[s]
                                  );
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
                                  {
                                    id: 'electricity',
                                    cls: 'bg-emerald-600',
                                  },
                                  { id: 'natural_gas', cls: 'bg-teal-600' },
                                  { id: 'water', cls: 'bg-blue-600' },
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
                      companyMetricTotal > 0
                        ? (val / companyMetricTotal) * 100
                        : 0;
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

                        <div className="mt-1.5 w-full bg-slate-100 h-1.5 rounded-xs overflow-hidden">
                          <div
                            className={`h-full ${
                              isBreach
                                ? 'bg-red-600'
                                : isWarn
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                            }`}
                            style={{
                              width: `${Math.min(100, utilizationPct)}%`,
                            }}
                          />
                        </div>

                        <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono-num text-slate-500">
                          <span>
                            {(
                              (s.totalCo2e * 1000) /
                              Math.max(1, targetMeta.floorAreaM2)
                            ).toFixed(1)}{' '}
                            kgCO₂e/m² · {targetMeta.headcountFte} FTE
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
                            {utilizationPct.toFixed(0)}% Target (
                            {sharePct.toFixed(0)}%)
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

          {/* ROW 4: HIGH-DENSITY CROSS-TABULATION PIVOT MATRIX (PER SITE, PER MONTH) */}
          <div className="b2b-panel rounded overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Table2 className="w-3.5 h-3.5 text-slate-700" />
                <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Cross-Tabulation Pivot Matrix — {metricMeta.label} Per
                  Facility, Per Month ({selectedYear})
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
                      <th
                        key={m.num}
                        className="py-2 px-2.5 text-right font-mono-num"
                      >
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
                    if (
                      selectedSite !== 'All Sites' &&
                      selectedSite !== siteName
                    ) {
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
                            analytics.monthsArray.find(
                              (x) => x.monthNum === m.num
                            )?.bySite[siteName] || {};
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
                                  formattedValue: `${formatMetricNumber(
                                    cellVal
                                  )} ${
                                    metricMeta.prefix ? '' : metricMeta.unit
                                  }`,
                                  subtitle: `${
                                    cellObj.records?.length || 0
                                  } invoices logged for ${siteName} in ${
                                    m.full
                                  }`,
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

          {/* ROW 5: HIGH-DENSITY FACILITY & SUPPLIER BREAKDOWN TABLES */}
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

            {/* Table B: Contracted Suppliers Breakdown with REGO Fuel Mix (5 Cols) */}
            <div className="lg:col-span-5 b2b-panel rounded overflow-hidden">
              <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  UK Utilities Providers &amp; REGO Backing (EDF, SSE, EON,
                  Octopus)
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
                      <th className="py-2 px-2 text-right">REGO %</th>
                      <th className="py-2 px-2 text-right">Loc tCO₂e</th>
                      <th className="py-2 px-2 text-right">Mkt tCO₂e</th>
                      <th className="py-2 px-3 text-right">Gross (£)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {analytics.supplierSeries.map((sup) => {
                      const mktMeta =
                        SUPPLIER_MARKET_FACTORS[sup.supplier] || {};
                      return (
                        <tr
                          key={sup.supplier}
                          onClick={() =>
                            onOpenDrilldown &&
                            onOpenDrilldown({
                              title: `Supplier Audit Ledger — ${sup.supplier}`,
                              disclosureCode: `${selectedFramework.label} · ${
                                mktMeta.instrument || 'Vendor Settlement'
                              }`,
                              formattedValue: `£${sup.grossCost.toFixed(
                                2
                              )} Gross | Loc: ${sup.locationCo2e.toFixed(
                                3
                              )} tCO₂e · Mkt: ${sup.marketCo2e.toFixed(
                                3
                              )} tCO₂e`,
                              subtitle: `${sup.invoiceCount} invoices from ${sup.supplier} (${mktMeta.fuelMixNote})`,
                              factorLabel: `${mktMeta.marketKgCo2ePerKwh} kgCO₂e/kWh Market Factor`,
                              formula: `Vendor Sum for ${sup.supplier}`,
                              records: sup.records,
                            })
                          }
                          className="cursor-pointer"
                        >
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            <div>{sup.supplier}</div>
                            <div className="text-[10px] font-normal text-slate-500">
                              {sup.invoiceCount} bills
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right font-mono-num">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                              {mktMeta.regoSharePct ?? 0}%
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono-num text-slate-600">
                            {sup.locationCo2e.toFixed(3)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono-num text-emerald-700 font-semibold">
                            {sup.marketCo2e.toFixed(3)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-num font-bold text-slate-900">
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
          </div>
        </>
      )}

      {/* =====================================================================
          MODULE 2: DATA COMPLETENESS & ANOMALY MATRIX ('completeness')
          (Inspired by Sweep, Normative & IBM Envizi Data Health Workbenches)
      ===================================================================== */}
      {dashboardSubView === 'completeness' && (
        <div className="space-y-3">
          {/* Completeness Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="b2b-panel rounded p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Primary Data Coverage Score
              </div>
              <div className="mt-1 font-mono-num text-xl font-bold text-slate-900">
                {completenessMatrix.completenessScorePct}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Across {completenessMatrix.totalEvaluatedCells} active Site ×
                Stream monthly slots
              </div>
            </div>

            <div className="b2b-panel rounded p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Verified Actual Cells (ACT)
              </div>
              <div className="mt-1 font-mono-num text-xl font-bold text-emerald-700">
                {completenessMatrix.verifiedCells}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                ISAE 3000 Tier-1 Actual Meter Readings
              </div>
            </div>

            <div className="b2b-panel rounded p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                Estimated / Proxy Cells (EST)
              </div>
              <div className="mt-1 font-mono-num text-xl font-bold text-amber-600">
                {completenessMatrix.estimatedCells}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Flagged for supplier reconciliation
              </div>
            </div>

            <div className="b2b-panel rounded p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-red-700">
                Missing Utility Bill Gaps (GAP)
              </div>
              <div className="mt-1 font-mono-num text-xl font-bold text-red-600">
                {completenessMatrix.missingGapCells}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Unbilled facility-stream months in horizon
              </div>
            </div>
          </div>

          {/* 12-Month Site × Stream Data Completeness Matrix */}
          <div className="b2b-panel rounded overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  12-Month Utility Data Completeness Matrix — Facility × Stream
                  ({selectedYear})
                </h2>
              </div>
              <div className="flex items-center gap-3 font-mono-num text-[10px]">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <span className="w-2 h-2 rounded-xs bg-emerald-600" />
                  ACT = Verified Actual
                </span>
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <span className="w-2 h-2 rounded-xs bg-amber-500" />
                  EST = Estimated Bill
                </span>
                <span className="inline-flex items-center gap-1 text-red-700">
                  <span className="w-2 h-2 rounded-xs bg-red-600" />
                  GAP = Missing Utility Bill
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse b2b-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2 px-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      Facility
                    </th>
                    <th className="py-2 px-2.5 border-r border-slate-200">
                      Utility Stream
                    </th>
                    {MONTH_LABELS.map((m) => (
                      <th
                        key={m.num}
                        className="py-2 px-2 text-center font-mono-num"
                      >
                        {m.short}
                      </th>
                    ))}
                    <th className="py-2 px-3 text-right bg-slate-100 text-slate-900 border-l border-slate-200">
                      Coverage
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {completenessMatrix.rows.map((row) => {
                    const StreamIcon = row.stream.icon;
                    return (
                      <tr key={row.key}>
                        <td className="py-2 px-3 font-medium text-slate-900 sticky left-0 bg-white border-r border-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono-num text-[10px] text-slate-400">
                              {row.siteCode}
                            </span>
                            <span>{row.siteName}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <StreamIcon className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-medium">
                              {row.stream.label}
                            </span>
                            <span className="font-mono-num text-[10px] text-slate-400">
                              ({row.stream.scope})
                            </span>
                          </div>
                        </td>
                        {row.monthCells.map((cell) => {
                          if (cell.status === 'ACT') {
                            return (
                              <td
                                key={cell.month.num}
                                className="py-1.5 px-1.5 text-center"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenDrilldown &&
                                    onOpenDrilldown({
                                      title: `${row.siteName} · ${row.stream.label} (${cell.month.full})`,
                                      disclosureCode: `${selectedFramework.label} · Verified Actual Cell`,
                                      formattedValue: `${cell.records.length} Verified Invoice(s)`,
                                      subtitle:
                                        'Primary utility bill verified with actual meter reading',
                                      factorLabel: 'UK DEFRA 2026 Verified',
                                      formula:
                                        'Primary Activity Data × DEFRA Factor',
                                      records: cell.records,
                                    })
                                  }
                                  className="w-full py-1 px-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono-num text-[10px] font-semibold"
                                >
                                  ACT
                                </button>
                              </td>
                            );
                          }
                          if (cell.status === 'EST') {
                            return (
                              <td
                                key={cell.month.num}
                                className="py-1.5 px-1.5 text-center"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenDrilldown &&
                                    onOpenDrilldown({
                                      title: `${row.siteName} · ${row.stream.label} (${cell.month.full})`,
                                      disclosureCode: `${selectedFramework.label} · Estimated Reading Alert`,
                                      formattedValue: `${cell.records.length} Estimated Invoice(s)`,
                                      subtitle:
                                        'Estimated reading logged — obtain actual meter read for external assurance',
                                      factorLabel: 'UK DEFRA 2026 Factors',
                                      formula:
                                        'Estimated Activity Data × DEFRA Factor',
                                      records: cell.records,
                                    })
                                  }
                                  className="w-full py-1 px-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-mono-num text-[10px] font-semibold"
                                >
                                  EST
                                </button>
                              </td>
                            );
                          }
                          if (cell.status === 'GAP') {
                            return (
                              <td
                                key={cell.month.num}
                                className="py-1.5 px-1.5 text-center"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenNewInvoice && onOpenNewInvoice()
                                  }
                                  title="Missing utility bill gap — click to log invoice"
                                  className="w-full py-1 px-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-mono-num text-[10px] font-semibold"
                                >
                                  GAP
                                </button>
                              </td>
                            );
                          }
                          return (
                            <td
                              key={cell.month.num}
                              className="py-1.5 px-1.5 text-center font-mono-num text-[10px] text-slate-300"
                            >
                              —
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-slate-900 bg-slate-50 border-l border-slate-200">
                          {row.coveragePct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Automated Tariff & Meter Anomaly Scanner */}
          <div className="b2b-panel rounded overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Automated Audit Exception &amp; Tariff Variance Scanner (
                  {completenessMatrix.anomalies.length} Flagged)
                </h2>
              </div>
              <span className="font-mono-num text-[10px] text-slate-500">
                Scans for Estimated reads, &gt;25% £/unit tariff spikes &amp;
                missing PDFs
              </span>
            </div>

            {completenessMatrix.anomalies.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Zero tariff variances, estimated readings, or missing PDF
                exceptions detected in current filter scope.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse b2b-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-3">Severity</th>
                      <th className="py-2 px-2.5">Invoice Ref</th>
                      <th className="py-2 px-2.5">Facility &amp; Stream</th>
                      <th className="py-2 px-2.5 text-right">
                        Effective Unit Rate
                      </th>
                      <th className="py-2 px-2.5">Audit Exception Reason</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {completenessMatrix.anomalies.map((item) => (
                      <tr key={item.invoice.id}>
                        <td className="py-2 px-3 font-mono-num">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              item.severity === 'BREACH'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {item.severity}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 font-mono-num font-semibold text-slate-900">
                          {item.invoice.invoiceNumber}
                        </td>
                        <td className="py-2 px-2.5 text-slate-700">
                          {item.invoice.siteName} · {item.invoice.supplier} (
                          {item.invoice.category})
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono-num text-slate-800">
                          £{item.unitRate.toFixed(3)} /{' '}
                          {item.invoice.category === 'water' ? 'm³' : 'kWh'}
                        </td>
                        <td className="py-2 px-2.5 text-slate-600">
                          {item.reasons.join(' · ')}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenDrilldown &&
                              onOpenDrilldown({
                                title: `Audit Exception — ${item.invoice.invoiceNumber}`,
                                disclosureCode:
                                  'ISAE 3000 Control Exception Log',
                                formattedValue: `£${Number(
                                  item.invoice.grossCost
                                ).toFixed(2)} Gross (${item.co2eTonnes.toFixed(
                                  3
                                )} tCO₂e)`,
                                subtitle: item.reasons.join(' | '),
                                factorLabel: `Unit Rate: £${item.unitRate.toFixed(
                                  3
                                )}`,
                                formula:
                                  'Automated Tariff & Reading Fidelity Verification',
                                records: [item.invoice],
                              })
                            }
                            className="px-2 py-1 rounded bg-slate-900 text-white font-mono-num text-[10px] hover:bg-slate-800"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODULE 3: SBTi 1.5°C PATHWAY & DECARBONIZATION WORKBENCH ('decarbonization')
          (Inspired by Watershed & Plan A Net-Zero Action Planners)
      ===================================================================== */}
      {dashboardSubView === 'decarbonization' && (
        <div className="space-y-3">
          {/* Top Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="b2b-panel rounded p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                2022 SBTi Base Year Footprint
              </div>
              <div className="mt-1 font-mono-num text-xl font-bold text-slate-900">
                {decarbonizationModel.base2022Tonnes.toFixed(2)} MT CO₂e
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                SBTi 1.5°C Target: -4.2% linear reduction/yr
              </div>
            </div>

            <div className="b2b-panel rounded p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Modeled Abatement Reduction
              </div>
              <div className="mt-1 font-mono-num text-xl font-bold text-emerald-700">
                -{decarbonizationModel.totalScenarioAbatementTonnes.toFixed(2)}{' '}
                MT CO₂e
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                From active decarbonization levers below
              </div>
            </div>

            <div className="b2b-panel rounded p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Projected Residual Footprint
              </div>
              <div className="mt-1 font-mono-num text-xl font-bold text-slate-900">
                {decarbonizationModel.projectedResidualTonnes.toFixed(2)} MT
                CO₂e/yr
              </div>
              <div className="text-[11px] font-mono-num text-slate-500 mt-0.5">
                2026 SBTi Budget: {decarbonizationModel.sbti2026Budget.toFixed(2)}{' '}
                MT
              </div>
            </div>

            <div className="b2b-panel rounded p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
                Projected Annual OpEx Savings
              </div>
              <div className="mt-1 font-mono-num text-xl font-bold text-indigo-700">
                £
                {decarbonizationModel.totalAnnualGbpSavings.toLocaleString(
                  'en-GB',
                  { maximumFractionDigits: 0 }
                )}
                /yr
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Combined energy &amp; water cost reduction
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left 7 Cols: Interactive Abatement Levers ("What-If" Sliders) */}
            <div className="lg:col-span-7 b2b-panel rounded p-3.5 space-y-3">
              <div className="pb-2 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Interactive Decarbonization Scenario Levers (Watershed / Plan
                    A Model)
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Adjust operational abatement levers to simulate impact on
                    Scope 1, 2 &amp; Water emissions and annual £ GBP spend.
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-mono-num text-[10px] font-semibold border ${
                    decarbonizationModel.isOnTrack2026
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {decarbonizationModel.isOnTrack2026
                    ? 'SBTi 1.5°C ALIGNED'
                    : 'EXCEEDS SBTi BUDGET'}
                </span>
              </div>

              <div className="space-y-3">
                {decarbonizationModel.levers.map((lv) => (
                  <div
                    key={lv.id}
                    className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-900">
                          {lv.name}
                        </span>
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono-num text-[10px] text-slate-600">
                          {lv.scope}
                        </span>
                      </div>
                      <span className="font-mono-num font-bold text-emerald-700">
                        {lv.pct}% Adoption
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={lv.maxPct}
                      value={lv.pct}
                      onChange={(e) => lv.setPct(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded"
                    />

                    <div className="flex items-center justify-between font-mono-num text-[11px] text-slate-600">
                      <span>
                        Abatement:{' '}
                        <strong className="text-emerald-700">
                          -{lv.co2eSaved.toFixed(2)} MT CO₂e/yr
                        </strong>
                      </span>
                      <span>
                        Est. OpEx Saving:{' '}
                        <strong className="text-indigo-700">
                          £{lv.gbpSaved.toFixed(0)}/yr
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 5 Cols: 2022–2030 SBTi 1.5°C Corridor vs Modeled Trajectory */}
            <div className="lg:col-span-5 b2b-panel rounded p-3.5 flex flex-col justify-between">
              <div>
                <div className="pb-2 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    SBTi 1.5°C Trajectory (2022–2030)
                  </h2>
                  <span className="font-mono-num text-[10px] text-slate-500">
                    -4.2% Linear Corridor
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {decarbonizationModel.yearsTrajectory.map((row) => {
                    const maxRef = Math.max(
                      1,
                      decarbonizationModel.base2022Tonnes * 1.05
                    );
                    const targetPct = Math.min(
                      100,
                      (row.sbtiTargetTonnes / maxRef) * 100
                    );
                    const projPct = Math.min(
                      100,
                      (row.projectedTonnes / maxRef) * 100
                    );
                    const isOverBudget =
                      row.projectedTonnes > row.sbtiTargetTonnes;

                    return (
                      <div key={row.year} className="space-y-1">
                        <div className="flex items-center justify-between font-mono-num text-[11px]">
                          <span
                            className={
                              row.year === 2026
                                ? 'font-bold text-slate-900'
                                : 'text-slate-600'
                            }
                          >
                            {row.year} {row.year === 2026 ? '(Current)' : ''}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500">
                              SBTi: {row.sbtiTargetTonnes.toFixed(1)}t
                            </span>
                            <span
                              className={`font-semibold ${
                                isOverBudget
                                  ? 'text-red-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              Model: {row.projectedTonnes.toFixed(1)}t
                            </span>
                          </div>
                        </div>
                        <div className="relative h-2 bg-slate-100 rounded-xs overflow-hidden">
                          <div
                            className={`h-full ${
                              isOverBudget ? 'bg-red-600' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${projPct}%` }}
                          />
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-amber-600"
                            style={{ left: `${targetPct}%` }}
                            title={`SBTi Target: ${row.sbtiTargetTonnes.toFixed(
                              1
                            )} MT CO₂e`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono-num text-slate-500">
                <span>Amber Tick = SBTi 1.5°C Budget</span>
                <span>2030 Target: -33.6% vs 2022</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODULE 4: REGULATORY DISCLOSURES & DEFRA FACTOR REGISTRY ('disclosures')
          (Inspired by Persefoni & Workiva ESG Disclosure Suites)
      ===================================================================== */}
      {dashboardSubView === 'disclosures' && (
        <div className="space-y-3">
          {/* Statutory Disclosure Table */}
          <div className="b2b-panel rounded overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <div>
                  <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    {selectedFramework.fullName} — Quantitative Disclosure
                    Schedule ({selectedYear})
                  </h2>
                </div>
              </div>
              <span className="font-mono-num text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                {selectedFramework.label} · Audit-Ready Schedule
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse b2b-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2 px-3">Disclosure Reference</th>
                    <th className="py-2 px-2.5">Metric / Data Point</th>
                    <th className="py-2 px-2.5 text-right">Reported Value</th>
                    <th className="py-2 px-2.5">Unit</th>
                    <th className="py-2 px-2.5">Assurance Status</th>
                    <th className="py-2 px-3 text-right">Audit Trail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {[
                    {
                      code: selectedFramework.scope1Code,
                      metric:
                        'Gross Scope 1 Direct GHG Emissions (Stationary Natural Gas)',
                      value: analytics.scope1Tonnes.toFixed(3),
                      unit: 'MT CO₂e',
                      status: 'VERIFIED',
                      records: filteredInvoices.filter(
                        (i) => i.category === 'natural_gas'
                      ),
                    },
                    {
                      code: selectedFramework.scope2Code,
                      metric:
                        'Gross Scope 2 Location-Based GHG Emissions (UK Grid Average)',
                      value: analytics.scope2LocationTonnes.toFixed(3),
                      unit: 'MT CO₂e',
                      status: 'VERIFIED',
                      records: filteredInvoices.filter(
                        (i) => i.category === 'electricity'
                      ),
                    },
                    {
                      code: `${selectedFramework.scope2Code} (Mkt)`,
                      metric:
                        'Gross Scope 2 Market-Based GHG Emissions (Supplier REGO Tariffs)',
                      value: analytics.scope2MarketTonnes.toFixed(3),
                      unit: 'MT CO₂e',
                      status: 'VERIFIED',
                      records: filteredInvoices.filter(
                        (i) => i.category === 'electricity'
                      ),
                    },
                    {
                      code: selectedFramework.energyCode,
                      metric:
                        'Total Consolidated Energy Consumption (Electricity + Natural Gas)',
                      value: analytics.totalEnergyKwh.toLocaleString('en-GB', {
                        maximumFractionDigits: 0,
                      }),
                      unit: 'kWh',
                      status: 'VERIFIED',
                      records: filteredInvoices.filter(
                        (i) => i.category !== 'water'
                      ),
                    },
                    {
                      code: selectedFramework.waterCode,
                      metric:
                        'Total Municipal Water Withdrawal & Wastewater Treatment',
                      value: analytics.waterM3.toFixed(2),
                      unit: 'm³',
                      status: 'VERIFIED',
                      records: filteredInvoices.filter(
                        (i) => i.category === 'water'
                      ),
                    },
                    {
                      code: 'INTENSITY-M2',
                      metric: `Carbon Intensity per Gross Internal Floor Area (${totalFloorAreaM2.toLocaleString(
                        'en-GB'
                      )} m²)`,
                      value: (
                        (analytics.totalGhgTonnes * 1000) /
                        Math.max(1, totalFloorAreaM2)
                      ).toFixed(2),
                      unit: 'kg CO₂e / m²',
                      status: 'CALCULATED',
                      records: filteredInvoices,
                    },
                    {
                      code: 'INTENSITY-FTE',
                      metric: `Carbon Intensity per Full-Time Equivalent Employee (${totalHeadcountFte} FTE)`,
                      value: (
                        analytics.totalGhgTonnes /
                        Math.max(1, totalHeadcountFte)
                      ).toFixed(3),
                      unit: 'MT CO₂e / FTE',
                      status: 'CALCULATED',
                      records: filteredInvoices,
                    },
                    {
                      code: selectedFramework.govCode,
                      metric:
                        'Primary Meter Reading Verification Rate (Actual vs Estimated)',
                      value: `${actualFidelityPct}%`,
                      unit: '% Actual',
                      status:
                        actualFidelityPct === 100 ? 'VERIFIED' : 'REVIEW EST',
                      records: filteredInvoices,
                    },
                  ].map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-mono-num font-semibold text-indigo-700">
                        {row.code}
                      </td>
                      <td className="py-2 px-2.5 font-medium text-slate-900">
                        {row.metric}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num font-bold text-slate-900">
                        {row.value}
                      </td>
                      <td className="py-2 px-2.5 font-mono-num text-slate-500">
                        {row.unit}
                      </td>
                      <td className="py-2 px-2.5 font-mono-num">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                            row.status === 'REVIEW EST'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDrilldown &&
                            onOpenDrilldown({
                              title: row.metric,
                              disclosureCode: row.code,
                              formattedValue: `${row.value} ${row.unit}`,
                              subtitle: `${selectedFramework.fullName}`,
                              factorLabel: 'UK DEFRA 2026 Statutory Basis',
                              formula: `${row.code} Quantitative Roll-Up`,
                              records: row.records,
                            })
                          }
                          className="text-indigo-600 hover:underline font-mono-num text-[11px] inline-flex items-center gap-0.5"
                        >
                          <span>Lineage ({row.records.length})</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* UK DESNZ / DEFRA & Ofgem Emission Factor Registry */}
          <div className="b2b-panel rounded overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  UK DESNZ / DEFRA &amp; Ofgem Emission Factor Library Registry
                </h2>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-[10px] font-mono-num">
                {['all', 'Scope 1', 'Scope 2', 'Scope 3'].map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setFactorScopeFilter(sc)}
                    className={`px-2 py-0.5 rounded-xs font-semibold ${
                      factorScopeFilter === sc
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    {sc === 'all' ? 'All Factors' : sc}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse b2b-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2 px-3">Factor ID</th>
                    <th className="py-2 px-2.5">Stream / Supplier</th>
                    <th className="py-2 px-2.5">Scope</th>
                    <th className="py-2 px-2.5 text-right">Total Factor</th>
                    <th className="py-2 px-2.5 text-right">CO₂</th>
                    <th className="py-2 px-2.5 text-right">CH₄</th>
                    <th className="py-2 px-2.5 text-right">N₂O</th>
                    <th className="py-2 px-3">Authority &amp; Methodology</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {DEFRA_FACTOR_REGISTRY.filter(
                    (f) =>
                      factorScopeFilter === 'all' ||
                      f.scope.includes(factorScopeFilter)
                  ).map((f) => (
                    <tr key={f.id}>
                      <td className="py-2 px-3 font-mono-num font-semibold text-slate-900">
                        {f.id}
                      </td>
                      <td className="py-2 px-2.5 font-medium text-slate-900">
                        {f.category}
                      </td>
                      <td className="py-2 px-2.5 font-mono-num">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                          {f.scope}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num font-bold text-emerald-700">
                        {f.factorValue.toFixed(4)} {f.factorUnit}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num text-slate-600">
                        {f.co2Share}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num text-slate-600">
                        {f.ch4Share}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num text-slate-600">
                        {f.n2oShare}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        <span className="font-semibold text-slate-800">
                          {f.source}:
                        </span>{' '}
                        {f.methodology}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
