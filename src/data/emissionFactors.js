/**
 * Standard GHG Protocol / EPA / DEFRA / IEA Emission Factors & Unit Conversions
 * Covers:
 * 1. Electricity (Scope 2 — kWh, MWh, Renewable %, Location-Based vs. Market-Based tCO2e)
 * 2. Natural Gas & Stationary Fuels (Scope 1 — therms, m³, liters, gallons, kWh)
 * 3. Water & Wastewater (ESG Water Stewardship / Scope 3 embodied — m³, gallons, kL)
 */

export const GRID_REGIONS = {
  US_EPA_AVG: {
    id: 'US_EPA_AVG',
    label: 'United States (EPA eGRID National Avg)',
    kgCo2ePerKwh: 0.386,
    residualKgCo2ePerKwh: 0.412,
  },
  US_ERCOT: {
    id: 'US_ERCOT',
    label: 'US — ERCOT (Texas)',
    kgCo2ePerKwh: 0.372,
    residualKgCo2ePerKwh: 0.398,
  },
  US_CAMX: {
    id: 'US_CAMX',
    label: 'US — WECC California (CAMX)',
    kgCo2ePerKwh: 0.225,
    residualKgCo2ePerKwh: 0.265,
  },
  UK_DEFRA: {
    id: 'UK_DEFRA',
    label: 'United Kingdom (DEFRA / DESNZ)',
    kgCo2ePerKwh: 0.207,
    residualKgCo2ePerKwh: 0.315,
  },
  EU_AVG: {
    id: 'EU_AVG',
    label: 'European Union (EEA / IEA Avg)',
    kgCo2ePerKwh: 0.251,
    residualKgCo2ePerKwh: 0.368,
  },
  CA_AVG: {
    id: 'CA_AVG',
    label: 'Canada (NIR National Avg)',
    kgCo2ePerKwh: 0.110,
    residualKgCo2ePerKwh: 0.135,
  },
  AU_NGA: {
    id: 'AU_NGA',
    label: 'Australia (NGA National Avg)',
    kgCo2ePerKwh: 0.650,
    residualKgCo2ePerKwh: 0.710,
  },
};

export const UTILITY_CATEGORIES = {
  electricity: {
    id: 'electricity',
    name: 'Electricity',
    scope: 'Scope 2',
    griRef: 'GRI 302-1 / GRI 305-2',
    color: '#2563eb', // blue-600
    subtypes: [
      { id: 'grid_electricity', label: 'Grid Electricity' },
      { id: 'green_tariff', label: 'Green Tariff / PPA Electricity' },
      { id: 'onsite_solar', label: 'On-Site Solar Generation' },
    ],
    units: [
      {
        id: 'kWh',
        label: 'kWh (Kilowatt-hours)',
        toKwh: 1,
      },
      {
        id: 'MWh',
        label: 'MWh (Megawatt-hours)',
        toKwh: 1000,
      },
    ],
  },
  natural_gas: {
    id: 'natural_gas',
    name: 'Natural Gas & Stationary Fuels',
    scope: 'Scope 1',
    griRef: 'GRI 302-1 / GRI 305-1',
    color: '#d97706', // amber-600
    subtypes: [
      {
        id: 'natural_gas',
        label: 'Natural Gas (Pipeline)',
        // kgCO2e per normalized kWh (HHV basis ~ 0.1812 kgCO2e/kWh)
        kgCo2ePerKwh: 0.1812,
      },
      {
        id: 'diesel_stationary',
        label: 'Stationary Diesel (Backup Generators)',
        kgCo2ePerKwh: 0.253,
      },
      {
        id: 'propane_lpg',
        label: 'Propane / LPG',
        kgCo2ePerKwh: 0.2145,
      },
      {
        id: 'heating_oil',
        label: 'Heating Oil / Distillate Fuel',
        kgCo2ePerKwh: 0.2468,
      },
    ],
    units: [
      {
        id: 'therms',
        label: 'therms (US Therms)',
        toKwh: 29.3071, // 1 therm = 29.3071 kWh
        kgCo2ePerUnitOverride: 5.31, // EPA standard: 5.31 kgCO2e / therm natural gas
      },
      {
        id: 'm3',
        label: 'm³ (Cubic Meters)',
        toKwh: 10.55, // 1 m³ natural gas ≈ 10.55 kWh
        kgCo2ePerUnitOverride: 2.02, // DEFRA/EPA avg: ~2.02 kgCO2e / m³ natural gas
      },
      {
        id: 'kWh',
        label: 'kWh (Gas Kilowatt-hours)',
        toKwh: 1,
      },
      {
        id: 'liters',
        label: 'Liters (Liquid Fuel)',
        toKwh: 10.0, // ~10 kWh per liter diesel/heating oil
        kgCo2ePerUnitOverride: 2.68, // 2.68 kgCO2e / liter diesel
      },
      {
        id: 'gallons',
        label: 'US Gallons (Liquid Fuel)',
        toKwh: 37.85,
        kgCo2ePerUnitOverride: 10.18, // 10.18 kgCO2e / US gallon diesel
      },
    ],
  },
  water: {
    id: 'water',
    name: 'Water & Wastewater',
    scope: 'Water (GRI 303)',
    griRef: 'GRI 303-3 / Scope 3 Cat 1',
    color: '#0891b2', // cyan-600
    subtypes: [
      {
        id: 'municipal_water',
        label: 'Municipal Potable Water Supply',
        kgCo2ePerM3: 0.149, // DEFRA water supply factor
      },
      {
        id: 'wastewater',
        label: 'Wastewater & Sewage Treatment',
        kgCo2ePerM3: 0.272, // DEFRA wastewater treatment factor
      },
      {
        id: 'recycled_water',
        label: 'Recycled / Non-Potable Greywater',
        kgCo2ePerM3: 0.045,
      },
    ],
    units: [
      {
        id: 'm3',
        label: 'm³ (Cubic Meters)',
        toM3: 1,
      },
      {
        id: 'gallons',
        label: 'gallons (US Gallons)',
        toM3: 0.00378541, // 1 US gallon = 0.00378541 m³
      },
      {
        id: 'kL',
        label: 'kL (Kiloliters = m³)',
        toM3: 1,
      },
    ],
  },
};

export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'CAD', symbol: 'CA$', label: 'CAD (CA$)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
];

/**
 * Calculates normalized energy (kWh), normalized water (m³), and Scope 1/2 GHG emissions (tCO2e)
 * for an individual invoice record.
 */
export function calculateInvoiceEsgMetrics(invoice) {
  const quantity = Math.max(0, Number(invoice.quantity) || 0);
  const category = invoice.category || 'electricity';

  if (category === 'electricity') {
    const unitObj =
      UTILITY_CATEGORIES.electricity.units.find((u) => u.id === invoice.unit) ||
      UTILITY_CATEGORIES.electricity.units[0];
    const normalizedEnergyKwh = quantity * unitObj.toKwh;

    const regionObj =
      GRID_REGIONS[invoice.gridRegion] || GRID_REGIONS.US_EPA_AVG;
    const customFactor =
      invoice.customEmissionFactor !== undefined &&
      invoice.customEmissionFactor !== '' &&
      invoice.customEmissionFactor !== null
        ? Number(invoice.customEmissionFactor)
        : null;

    const gridKgPerKwh =
      customFactor !== null ? customFactor : regionObj.kgCo2ePerKwh;

    const renewablePct = Math.min(
      100,
      Math.max(0, Number(invoice.renewablePct) || 0)
    );
    const nonRenewableFraction = (100 - renewablePct) / 100;
    const renewableKwh = normalizedEnergyKwh * (renewablePct / 100);

    // Location-based reflects physical grid average regardless of contractual instruments
    const locationBasedCo2eTonnes =
      (normalizedEnergyKwh * gridKgPerKwh) / 1000;

    // Market-based accounts for RECs, Guarantees of Origin, PPAs, or on-site solar (0 factor for renewable portion)
    const marketBasedCo2eTonnes =
      (normalizedEnergyKwh * nonRenewableFraction * gridKgPerKwh) / 1000;

    return {
      scope: 'Scope 2',
      normalizedEnergyKwh,
      normalizedWaterM3: 0,
      renewableKwh,
      locationBasedCo2eTonnes,
      marketBasedCo2eTonnes,
      effectiveFactorLabel: `${gridKgPerKwh.toFixed(3)} kgCO₂e/kWh`,
    };
  }

  if (category === 'natural_gas') {
    const unitObj =
      UTILITY_CATEGORIES.natural_gas.units.find((u) => u.id === invoice.unit) ||
      UTILITY_CATEGORIES.natural_gas.units[0];
    const subtypeObj =
      UTILITY_CATEGORIES.natural_gas.subtypes.find(
        (s) => s.id === invoice.subtype
      ) || UTILITY_CATEGORIES.natural_gas.subtypes[0];

    const normalizedEnergyKwh = quantity * unitObj.toKwh;
    let totalKgCo2e = 0;

    if (
      invoice.customEmissionFactor !== undefined &&
      invoice.customEmissionFactor !== '' &&
      invoice.customEmissionFactor !== null
    ) {
      totalKgCo2e = quantity * Number(invoice.customEmissionFactor);
    } else if (
      subtypeObj.id === 'natural_gas' &&
      unitObj.kgCo2ePerUnitOverride &&
      (unitObj.id === 'therms' || unitObj.id === 'm3')
    ) {
      totalKgCo2e = quantity * unitObj.kgCo2ePerUnitOverride;
    } else if (
      subtypeObj.id !== 'natural_gas' &&
      (unitObj.id === 'liters' || unitObj.id === 'gallons') &&
      unitObj.kgCo2ePerUnitOverride
    ) {
      totalKgCo2e = quantity * unitObj.kgCo2ePerUnitOverride;
    } else {
      totalKgCo2e = normalizedEnergyKwh * subtypeObj.kgCo2ePerKwh;
    }

    const co2eTonnes = totalKgCo2e / 1000;

    return {
      scope: 'Scope 1',
      normalizedEnergyKwh,
      normalizedWaterM3: 0,
      renewableKwh: 0,
      locationBasedCo2eTonnes: co2eTonnes,
      marketBasedCo2eTonnes: co2eTonnes,
      effectiveFactorLabel: `${subtypeObj.kgCo2ePerKwh.toFixed(3)} kgCO₂e/kWh-eq`,
    };
  }

  // Water & Wastewater
  const unitObj =
    UTILITY_CATEGORIES.water.units.find((u) => u.id === invoice.unit) ||
    UTILITY_CATEGORIES.water.units[0];
  const subtypeObj =
    UTILITY_CATEGORIES.water.subtypes.find((s) => s.id === invoice.subtype) ||
    UTILITY_CATEGORIES.water.subtypes[0];

  const normalizedWaterM3 = quantity * unitObj.toM3;
  const factorPerM3 =
    invoice.customEmissionFactor !== undefined &&
    invoice.customEmissionFactor !== '' &&
    invoice.customEmissionFactor !== null
      ? Number(invoice.customEmissionFactor)
      : subtypeObj.kgCo2ePerM3;

  const co2eTonnes = (normalizedWaterM3 * factorPerM3) / 1000;

  return {
    scope: 'Water (GRI 303)',
    normalizedEnergyKwh: 0,
    normalizedWaterM3,
    renewableKwh: 0,
    locationBasedCo2eTonnes: co2eTonnes,
    marketBasedCo2eTonnes: co2eTonnes,
    effectiveFactorLabel: `${factorPerM3.toFixed(3)} kgCO₂e/m³`,
  };
}

export const INITIAL_SAMPLE_INVOICES = [
  {
    id: 'inv-2026-001',
    invoiceNumber: 'AE-904812-01',
    supplier: 'Austin Energy',
    facility: 'HQ - Austin Tech Campus',
    accountNumber: 'ACCT-88210',
    category: 'electricity',
    subtype: 'grid_electricity',
    billingPeriodStart: '2026-01-01',
    billingPeriodEnd: '2026-01-31',
    invoiceDate: '2026-02-05',
    quantity: 48500,
    unit: 'kWh',
    renewablePct: 35,
    renewableInstrument: 'Green Tariff / PPA',
    gridRegion: 'US_ERCOT',
    cost: 5820.0,
    currency: 'USD',
    status: 'Verified',
    notes: 'Includes 35% Texas wind PPA allocation',
  },
  {
    id: 'inv-2026-002',
    invoiceNumber: 'AE-905114-02',
    supplier: 'Austin Energy',
    facility: 'HQ - Austin Tech Campus',
    accountNumber: 'ACCT-88210',
    category: 'electricity',
    subtype: 'grid_electricity',
    billingPeriodStart: '2026-02-01',
    billingPeriodEnd: '2026-02-28',
    invoiceDate: '2026-03-04',
    quantity: 44200,
    unit: 'kWh',
    renewablePct: 35,
    renewableInstrument: 'Green Tariff / PPA',
    gridRegion: 'US_ERCOT',
    cost: 5304.0,
    currency: 'USD',
    status: 'Verified',
    notes: 'February billing cycle',
  },
  {
    id: 'inv-2026-003',
    invoiceNumber: 'AE-905992-03',
    supplier: 'Austin Energy',
    facility: 'HQ - Austin Tech Campus',
    accountNumber: 'ACCT-88210',
    category: 'electricity',
    subtype: 'grid_electricity',
    billingPeriodStart: '2026-03-01',
    billingPeriodEnd: '2026-03-31',
    invoiceDate: '2026-04-05',
    quantity: 51800,
    unit: 'kWh',
    renewablePct: 50,
    renewableInstrument: 'RECs / Guarantees of Origin',
    gridRegion: 'US_ERCOT',
    cost: 6216.0,
    currency: 'USD',
    status: 'Verified',
    notes: 'Increased REC retirement to 50% for Q1 ESG target',
  },
  {
    id: 'inv-2026-004',
    invoiceNumber: 'TGS-44109-01',
    supplier: 'Texas Gas Service',
    facility: 'HQ - Austin Tech Campus',
    accountNumber: 'GAS-19402',
    category: 'natural_gas',
    subtype: 'natural_gas',
    billingPeriodStart: '2026-01-01',
    billingPeriodEnd: '2026-01-31',
    invoiceDate: '2026-02-03',
    quantity: 1420,
    unit: 'therms',
    renewablePct: 0,
    gridRegion: 'US_ERCOT',
    cost: 1590.4,
    currency: 'USD',
    status: 'Verified',
    notes: 'Winter heating load — Building A & B boilers',
  },
  {
    id: 'inv-2026-005',
    invoiceNumber: 'TGS-44890-02',
    supplier: 'Texas Gas Service',
    facility: 'HQ - Austin Tech Campus',
    accountNumber: 'GAS-19402',
    category: 'natural_gas',
    subtype: 'natural_gas',
    billingPeriodStart: '2026-02-01',
    billingPeriodEnd: '2026-02-28',
    invoiceDate: '2026-03-03',
    quantity: 1150,
    unit: 'therms',
    renewablePct: 0,
    gridRegion: 'US_ERCOT',
    cost: 1288.0,
    currency: 'USD',
    status: 'Verified',
    notes: 'February space heating',
  },
  {
    id: 'inv-2026-006',
    invoiceNumber: 'AWU-77123-Q1',
    supplier: 'Austin Water Utility',
    facility: 'HQ - Austin Tech Campus',
    accountNumber: 'WTR-30091',
    category: 'water',
    subtype: 'municipal_water',
    billingPeriodStart: '2026-01-01',
    billingPeriodEnd: '2026-03-31',
    invoiceDate: '2026-04-08',
    quantity: 165000,
    unit: 'gallons',
    renewablePct: 0,
    gridRegion: 'US_ERCOT',
    cost: 1410.0,
    currency: 'USD',
    status: 'Verified',
    notes: 'Q1 municipal water & cooling tower makeup',
  },
  {
    id: 'inv-2026-007',
    invoiceNumber: 'OCT-UK-2026-01',
    supplier: 'Octopus Energy Business',
    facility: 'London EMEA Hub',
    accountNumber: 'MPAN-22000419',
    category: 'electricity',
    subtype: 'green_tariff',
    billingPeriodStart: '2026-01-01',
    billingPeriodEnd: '2026-01-31',
    invoiceDate: '2026-02-02',
    quantity: 19.4,
    unit: 'MWh',
    renewablePct: 100,
    renewableInstrument: 'REGO Backed Green Tariff',
    gridRegion: 'UK_DEFRA',
    cost: 4268.0,
    currency: 'USD',
    status: 'Verified',
    notes: '100% REGO certified renewable electricity tariff',
  },
  {
    id: 'inv-2026-008',
    invoiceNumber: 'BG-UK-88310-02',
    supplier: 'British Gas Business',
    facility: 'London EMEA Hub',
    accountNumber: 'MPRN-991827',
    category: 'natural_gas',
    subtype: 'natural_gas',
    billingPeriodStart: '2026-02-01',
    billingPeriodEnd: '2026-02-28',
    invoiceDate: '2026-03-05',
    quantity: 2150,
    unit: 'm3',
    renewablePct: 0,
    gridRegion: 'UK_DEFRA',
    cost: 1980.0,
    currency: 'USD',
    status: 'Pending Audit',
    notes: 'Meter reading awaiting final landlord sub-meter sign-off',
  },
  {
    id: 'inv-2026-009',
    invoiceNumber: 'TW-UK-10492-Q1',
    supplier: 'Thames Water',
    facility: 'London EMEA Hub',
    accountNumber: 'TW-558291',
    category: 'water',
    subtype: 'municipal_water',
    billingPeriodStart: '2026-01-01',
    billingPeriodEnd: '2026-03-31',
    invoiceDate: '2026-04-06',
    quantity: 310,
    unit: 'm3',
    renewablePct: 0,
    gridRegion: 'UK_DEFRA',
    cost: 890.0,
    currency: 'USD',
    status: 'Verified',
    notes: 'Q1 office water consumption',
  },
];

export const DEFAULT_ORG_PROFILE = {
  companyName: 'Acme Sustainability Corp',
  reportingYear: '2026',
  defaultCurrency: 'USD',
  floorAreaM2: 8500, // Square meters across facilities (for energy/carbon intensity)
  headcountFte: 240, // Full-time equivalent employees (for per-employee ESG intensity)
  scope2AccountingMethod: 'market', // 'market' or 'location'
  targetReductionTonnes: 65, // Annual GHG cap/target in tCO2e
};
