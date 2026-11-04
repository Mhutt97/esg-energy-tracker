/**
 * UK DEFRA / DESNZ GHG Conversion Factors & Validation Rules
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
  { value: 20, label: '20% Standard Rate' },
  { value: 5, label: '5% Reduced / De Minimis' },
  { value: 0, label: '0% Zero Rated' },
];

export const UTILITY_CATEGORIES = {
  electricity: {
    id: 'electricity',
    name: 'Electricity',
    scope: 'Scope 2',
    color: '#0f172a',
    accentColor: '#2563eb',
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
    color: '#b45309',
    accentColor: '#d97706',
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
        toKwh: 11.1868,
        kgCo2ePerUnitOverride: 2.046,
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
    color: '#0e7490',
    accentColor: '#0891b2',
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
        label: 'Gallons (Imperial)',
        toM3: 0.00454609,
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

/**
 * Comprehensive validation for utility invoice entry to prevent missing or erroneous data
 */
export function validateInvoiceForm(
  form,
  existingInvoices = [],
  editingId = null
) {
  const errors = {};

  // 1. Invoice Number
  const invNum = String(form.invoiceNumber || '').trim();
  if (!invNum) {
    errors.invoiceNumber = 'Invoice reference number is required.';
  } else if (invNum.length < 3) {
    errors.invoiceNumber = 'Invoice number must be at least 3 characters.';
  } else {
    const isDuplicate = existingInvoices.some(
      (inv) =>
        inv.id !== editingId &&
        String(inv.invoiceNumber || '')
          .trim()
          .toLowerCase() === invNum.toLowerCase()
    );
    if (isDuplicate) {
      errors.invoiceNumber = `Invoice "${invNum}" already exists in the ledger.`;
    }
  }

  // 2. Supplier & Site Name
  if (!SUPPLIERS.includes(form.supplier)) {
    errors.supplier = 'Select a valid UK utilities provider.';
  }
  if (!SITES.includes(form.siteName)) {
    errors.siteName = 'Select a valid UK site location.';
  }

  // 3. Dates (Invoice Date, Billing Start, Billing End)
  if (!form.invoiceDate) {
    errors.invoiceDate = 'Invoice date is required.';
  }
  if (!form.billingPeriodStart) {
    errors.billingPeriodStart = 'Billing start date is required.';
  }
  if (!form.billingPeriodEnd) {
    errors.billingPeriodEnd = 'Billing end date is required.';
  }

  if (form.billingPeriodStart && form.billingPeriodEnd) {
    const start = new Date(form.billingPeriodStart);
    const end = new Date(form.billingPeriodEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      errors.billingPeriodEnd = 'Invalid billing period dates.';
    } else if (end < start) {
      errors.billingPeriodEnd =
        'Billing end date cannot be earlier than the billing start date.';
    } else {
      const diffDays = (end - start) / (1000 * 60 * 60 * 24);
      if (diffDays > 370) {
        errors.billingPeriodEnd =
          'Billing period exceeds 12 months. Please verify start and end dates.';
      }
    }
  }

  if (form.invoiceDate && form.billingPeriodStart) {
    const invDate = new Date(form.invoiceDate);
    const start = new Date(form.billingPeriodStart);
    if (!isNaN(invDate.getTime()) && !isNaN(start.getTime())) {
      if (invDate < start) {
        errors.invoiceDate =
          'Invoice issue date cannot precede the billing period start date.';
      }
    }
  }

  // 4. Reading Type
  if (!READING_TYPES.includes(form.readingType)) {
    errors.readingType = 'Select Actual or Estimated reading type.';
  }

  // 5. Usage
  const usageStr = String(form.usage ?? '').trim();
  const usageVal = Number(usageStr);
  if (usageStr === '' || isNaN(usageVal)) {
    errors.usage = 'Metered usage value is required.';
  } else if (usageVal <= 0) {
    errors.usage = 'Usage must be greater than zero.';
  } else if (usageVal > 100000000) {
    errors.usage = 'Usage exceeds plausible single-invoice threshold.';
  }

  // 6. Net Cost & VAT
  const netStr = String(form.netCost ?? '').trim();
  const netVal = Number(netStr);
  if (netStr === '' || isNaN(netVal)) {
    errors.netCost = 'Net invoice amount (£) is required.';
  } else if (netVal <= 0) {
    errors.netCost = 'Net amount (£) must be greater than zero.';
  } else if (netVal > 10000000) {
    errors.netCost = 'Net amount (£) exceeds plausible invoice threshold.';
  }

  const vatRateNum = Number(form.vatRate);
  if (![20, 5, 0].includes(vatRateNum)) {
    errors.vatRate = 'VAT rate must be 20%, 5%, or 0%.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export const INITIAL_SAMPLE_INVOICES = [];

export const DEFAULT_ORG_PROFILE = {
  companyName: 'UK Energy & ESG Ledger',
  reportingYear: '2026',
  defaultCurrency: 'GBP',
};
