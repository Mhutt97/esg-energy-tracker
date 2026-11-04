/**
 * UK DEFRA / DESNZ GHG Conversion Factors & Utility Definitions
 * Configured for UK Business Energy & ESG Invoice Tracking (GBP £)
 */

export const SUPPLIERS = ['EDF', 'SSE', 'EON', 'Octopus'];

export const SITES = [
  'Head Office London',
  'Office Sheffield',
  'Office Leeds',
  'Office Bristol',
];

export const READING_TYPES = ['Actual', 'Estimated'];

export const VAT_RATES = [
  { value: 20, label: '20% (Standard Rate)' },
  { value: 5, label: '5% (Reduced / De Minimis)' },
  { value: 0, label: '0% (Zero Rated)' },
];

export const UTILITY_CATEGORIES = {
  electricity: {
    id: 'electricity',
    name: 'Electricity',
    scope: 'Scope 2',
    color: '#2563eb', // blue-600
    // UK DEFRA Grid Electricity factor (kgCO2e per kWh)
    kgCo2ePerKwh: 0.207,
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
    name: 'Natural Gas & Fuels',
    scope: 'Scope 1',
    color: '#d97706', // amber-600
    // UK DEFRA Natural Gas factor (kgCO2e per kWh)
    kgCo2ePerKwh: 0.1829,
    units: [
      {
        id: 'kWh',
        label: 'kWh (Gas Kilowatt-hours)',
        toKwh: 1,
      },
      {
        id: 'm3',
        label: 'm³ (Cubic Metres)',
        toKwh: 11.1868, // UK standard m³ to kWh conversion
        kgCo2ePerUnitOverride: 2.046, // UK DEFRA kgCO2e per m³ natural gas
      },
      {
        id: 'therms',
        label: 'therms',
        toKwh: 29.3071,
        kgCo2ePerUnitOverride: 5.31,
      },
      {
        id: 'liters',
        label: 'Litres (Liquid Fuel)',
        toKwh: 10.0,
        kgCo2ePerUnitOverride: 2.68,
      },
    ],
  },
  water: {
    id: 'water',
    name: 'Water & Wastewater',
    scope: 'Water',
    color: '#0891b2', // cyan-600
    // UK DEFRA Water Supply factor (kgCO2e per m³)
    kgCo2ePerM3: 0.149,
    units: [
      {
        id: 'm3',
        label: 'm³ (Cubic Metres)',
        toM3: 1,
      },
      {
        id: 'kL',
        label: 'kL (Kilolitres = m³)',
        toM3: 1,
      },
      {
        id: 'gallons',
        label: 'Gallons',
        toM3: 0.00454609, // Imperial gallon to m³
      },
    ],
  },
};

/**
 * Calculates normalized energy (kWh), normalized water (m³), and GHG emissions (tCO2e)
 * using UK DEFRA conversion factors.
 */
export function calculateInvoiceEsgMetrics(invoice) {
  const usage = Math.max(0, Number(invoice.usage ?? invoice.quantity) || 0);
  const category = invoice.category || 'electricity';

  if (category === 'electricity') {
    const unitObj =
      UTILITY_CATEGORIES.electricity.units.find((u) => u.id === invoice.unit) ||
      UTILITY_CATEGORIES.electricity.units[0];
    const normalizedEnergyKwh = usage * unitObj.toKwh;
    const factor = UTILITY_CATEGORIES.electricity.kgCo2ePerKwh;
    const co2eTonnes = (normalizedEnergyKwh * factor) / 1000;

    return {
      scope: 'Scope 2',
      normalizedEnergyKwh,
      normalizedWaterM3: 0,
      co2eTonnes,
      effectiveFactorLabel: `${factor.toFixed(3)} kgCO₂e/kWh (UK DEFRA)`,
    };
  }

  if (category === 'natural_gas') {
    const unitObj =
      UTILITY_CATEGORIES.natural_gas.units.find((u) => u.id === invoice.unit) ||
      UTILITY_CATEGORIES.natural_gas.units[0];
    const normalizedEnergyKwh = usage * unitObj.toKwh;

    let totalKgCo2e = 0;
    if (unitObj.kgCo2ePerUnitOverride) {
      totalKgCo2e = usage * unitObj.kgCo2ePerUnitOverride;
    } else {
      totalKgCo2e =
        normalizedEnergyKwh * UTILITY_CATEGORIES.natural_gas.kgCo2ePerKwh;
    }

    const co2eTonnes = totalKgCo2e / 1000;

    return {
      scope: 'Scope 1',
      normalizedEnergyKwh,
      normalizedWaterM3: 0,
      co2eTonnes,
      effectiveFactorLabel: `${UTILITY_CATEGORIES.natural_gas.kgCo2ePerKwh.toFixed(
        4
      )} kgCO₂e/kWh (UK DEFRA)`,
    };
  }

  // Water & Wastewater
  const unitObj =
    UTILITY_CATEGORIES.water.units.find((u) => u.id === invoice.unit) ||
    UTILITY_CATEGORIES.water.units[0];
  const normalizedWaterM3 = usage * unitObj.toM3;
  const factorPerM3 = UTILITY_CATEGORIES.water.kgCo2ePerM3;
  const co2eTonnes = (normalizedWaterM3 * factorPerM3) / 1000;

  return {
    scope: 'Water',
    normalizedEnergyKwh: 0,
    normalizedWaterM3,
    co2eTonnes,
    effectiveFactorLabel: `${factorPerM3.toFixed(3)} kgCO₂e/m³ (UK DEFRA)`,
  };
}

// Start with an empty invoice ledger (no USD or test invoices)
export const INITIAL_SAMPLE_INVOICES = [];

export const DEFAULT_ORG_PROFILE = {
  companyName: 'UK Business Energy Tracker',
  reportingYear: '2026',
  defaultCurrency: 'GBP',
};
