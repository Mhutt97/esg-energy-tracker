/**
 * UK DEFRA / DESNZ GHG Conversion Factors, Normalizers & Validation Engine
 * Configured for UK Business Energy & ESG Invoice Tracking (GBP £)
 */

export const SUPPLIERS = ['EDF', 'SSE', 'EON', 'Octopus'];

export const SITES = [
  'Head Office London',
  'Office Sheffield',
  'Office Leeds',
  'Office Bristol',
];

export const TENANT_ENTITIES = [
  {
    id: 'uk-holdings',
    name: 'UK Commercial Holdings Ltd',
    jurisdiction: 'UK · GBP (£)',
    sites: SITES,
  },
  {
    id: 'uk-north',
    name: 'Northern Operations Division',
    jurisdiction: 'Sheffield & Leeds · GBP (£)',
    sites: ['Office Sheffield', 'Office Leeds'],
  },
  {
    id: 'uk-south',
    name: 'Southern & HQ Division',
    jurisdiction: 'London & Bristol · GBP (£)',
    sites: ['Head Office London', 'Office Bristol'],
  },
];

export const REPORTING_FRAMEWORKS = {
  CSRD: {
    id: 'CSRD',
    label: 'CSRD (ESRS E1)',
    fullName: 'EU/UK Corporate Sustainability Reporting Directive — ESRS E1',
    scope1Code: 'ESRS E1-6 §48 (Gross Scope 1 GHG)',
    scope2Code: 'ESRS E1-6 §49 (Location-Based Scope 2 GHG)',
    energyCode: 'ESRS E1-5 §37 (Total Energy Consumption MWh)',
    waterCode: 'ESRS E3-4 §28 (Total Water Consumption m³)',
    govCode: 'ESRS 2 GOV-1 / Audit Verification Rate',
  },
  GRI: {
    id: 'GRI',
    label: 'GRI 302 / 305',
    fullName: 'Global Reporting Initiative — Energy (302) & Emissions (305)',
    scope1Code: 'GRI 305-1 (Direct Scope 1 GHG Emissions)',
    scope2Code: 'GRI 305-2 (Energy Indirect Scope 2 GHG)',
    energyCode: 'GRI 302-1 (Energy Consumption Within Org)',
    waterCode: 'GRI 303-5 (Water Consumption)',
    govCode: 'GRI 2-5 (External Assurance & Meter Fidelity)',
  },
  SEC: {
    id: 'SEC',
    label: 'SEC Climate',
    fullName: 'SEC Reg S-K Item 1504 — Climate-Related Disclosures',
    scope1Code: 'Reg S-K §229.1504(a)(1) Scope 1',
    scope2Code: 'Reg S-K §229.1504(a)(2) Scope 2',
    energyCode: 'Operational Energy Intensity (kWh / MWh)',
    waterCode: 'Resource Dependency — Water Withdrawal (m³)',
    govCode: 'Item 1501 Attestation & Controls',
  },
  SECR: {
    id: 'SECR',
    label: 'UK SECR / DEFRA',
    fullName: 'UK Streamlined Energy & Carbon Reporting (DESNZ / DEFRA 2026)',
    scope1Code: 'UK SECR Direct Combustion (Natural Gas & Fuels)',
    scope2Code: 'UK SECR Purchased Grid Electricity',
    energyCode: 'UK SECR Aggregate kWh Equivalent',
    waterCode: 'DEFRA Water Supply & Treatment Factors',
    govCode: 'HMRC VAT (20% / 5% / 0%) & Actual Meter Audit',
  },
};

export const SITE_BASELINE_TARGETS = {
  'Head Office London': {
    monthlyKwhTarget: 18000,
    monthlyCo2eTarget: 3.6,
    monthlyGrossTarget: 4500,
    headcountFte: 145,
    floorAreaM2: 3200,
  },
  'Office Sheffield': {
    monthlyKwhTarget: 9500,
    monthlyCo2eTarget: 1.9,
    monthlyGrossTarget: 2200,
    headcountFte: 68,
    floorAreaM2: 1550,
  },
  'Office Leeds': {
    monthlyKwhTarget: 11000,
    monthlyCo2eTarget: 2.2,
    monthlyGrossTarget: 2600,
    headcountFte: 82,
    floorAreaM2: 1850,
  },
  'Office Bristol': {
    monthlyKwhTarget: 8500,
    monthlyCo2eTarget: 1.7,
    monthlyGrossTarget: 1950,
    headcountFte: 55,
    floorAreaM2: 1300,
  },
};

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
    color: '#2563eb',
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
    color: '#d97706',
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
    color: '#0891b2',
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
 * Strips currency symbols (£, $, €), commas, and whitespace to parse numbers reliably
 */
export function parseCleanNumber(val, fallback = 0) {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  if (val === null || val === undefined) return fallback;
  const cleaned = String(val)
    .replace(/[£$€,\s]/g, '')
    .trim();
  if (!cleaned) return fallback;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Normalizes UK (DD/MM/YYYY or DD-MM-YYYY) or ISO (YYYY-MM-DD) dates into strict YYYY-MM-DD
 */
export function normalizeUkDateToIso(rawDate, fallback = '2026-01-01') {
  if (!rawDate) return fallback;
  const str = String(rawDate).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // UK DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ukMatch) {
    const day = ukMatch[1].padStart(2, '0');
    const month = ukMatch[2].padStart(2, '0');
    const year = ukMatch[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return fallback;
}

/**
 * Matches free-text site names to canonical UK SITES
 */
export function normalizeSiteName(rawSite) {
  if (!rawSite) return SITES[0];
  const s = String(rawSite).trim();
  if (SITES.includes(s)) return s;
  const lower = s.toLowerCase();
  if (lower.includes('sheffield')) return 'Office Sheffield';
  if (lower.includes('leeds')) return 'Office Leeds';
  if (lower.includes('bristol')) return 'Office Bristol';
  if (lower.includes('london') || lower.includes('head'))
    return 'Head Office London';
  return SITES[0];
}

/**
 * Matches free-text supplier names to canonical UK SUPPLIERS
 */
export function normalizeSupplierName(rawSupplier) {
  if (!rawSupplier) return SUPPLIERS[0];
  const s = String(rawSupplier).trim();
  if (SUPPLIERS.includes(s)) return s;
  const lower = s.toLowerCase();
  if (lower.includes('octopus')) return 'Octopus';
  if (lower.includes('sse')) return 'SSE';
  if (lower.includes('eon') || lower.includes('e.on')) return 'EON';
  if (lower.includes('edf')) return 'EDF';
  return SUPPLIERS[0];
}

/**
 * Normalizes an entire invoice object to guarantee schema consistency across imports and versions
 */
export function sanitizeInvoiceRecord(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null;

  const rawCat = String(raw.category || 'electricity').toLowerCase();
  let category = 'electricity';
  if (
    rawCat.includes('gas') ||
    rawCat.includes('fuel') ||
    rawCat === 'natural_gas'
  ) {
    category = 'natural_gas';
  } else if (rawCat.includes('water')) {
    category = 'water';
  }

  const catUnits = UTILITY_CATEGORIES[category].units;
  const unit = catUnits.some((u) => u.id === raw.unit)
    ? raw.unit
    : catUnits[0].id;

  const usage = Math.max(0, parseCleanNumber(raw.usage ?? raw.quantity, 0));
  const netCost = Math.max(0, parseCleanNumber(raw.netCost ?? raw.cost, 0));
  const rawVatRate = parseCleanNumber(raw.vatRate, 20);
  const vatRate = [20, 5, 0].includes(rawVatRate) ? rawVatRate : 20;
  const vatAmount = Number((netCost * (vatRate / 100)).toFixed(2));
  const grossCost = Number((netCost + vatAmount).toFixed(2));

  const billingPeriodStart = normalizeUkDateToIso(
    raw.billingPeriodStart,
    '2026-01-01'
  );
  const billingPeriodEnd = normalizeUkDateToIso(
    raw.billingPeriodEnd,
    billingPeriodStart
  );
  const invoiceDate = normalizeUkDateToIso(raw.invoiceDate, billingPeriodEnd);

  const readingType =
    String(raw.readingType || raw.status || '')
      .toLowerCase()
      .includes('est')
      ? 'Estimated'
      : 'Actual';

  return {
    id: raw.id || `inv-${Date.now()}-${idx}`,
    invoiceNumber: String(raw.invoiceNumber || `INV-${1000 + idx}`).trim(),
    invoiceDate,
    siteName: normalizeSiteName(raw.siteName || raw.facility),
    supplier: normalizeSupplierName(raw.supplier),
    category,
    billingPeriodStart,
    billingPeriodEnd,
    readingType,
    usage,
    unit,
    netCost,
    vatRate,
    vatAmount,
    grossCost,
    currency: 'GBP',
    notes: String(raw.notes || '').trim(),
    pdfAttachment:
      raw.pdfAttachment && typeof raw.pdfAttachment === 'object'
        ? {
            name: String(raw.pdfAttachment.name || 'invoice.pdf'),
            size: Number(raw.pdfAttachment.size) || 0,
            type: 'application/pdf',
            uploadedAt:
              raw.pdfAttachment.uploadedAt || new Date().toISOString(),
            dataUrl: raw.pdfAttachment.dataUrl || null,
          }
        : null,
  };
}

/**
 * Calculates normalized energy (kWh), normalized water (m³), and GHG emissions (tCO2e)
 * using UK DEFRA conversion factors.
 */
export function calculateInvoiceEsgMetrics(invoice) {
  const usage = Math.max(
    0,
    parseCleanNumber(invoice?.usage ?? invoice?.quantity, 0)
  );
  const category = invoice?.category || 'electricity';

  if (category === 'electricity') {
    const unitObj =
      UTILITY_CATEGORIES.electricity.units.find(
        (u) => u.id === invoice?.unit
      ) || UTILITY_CATEGORIES.electricity.units[0];
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
      UTILITY_CATEGORIES.natural_gas.units.find(
        (u) => u.id === invoice?.unit
      ) || UTILITY_CATEGORIES.natural_gas.units[0];
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
    UTILITY_CATEGORIES.water.units.find((u) => u.id === invoice?.unit) ||
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
  const usageVal = parseCleanNumber(usageStr, NaN);
  if (usageStr === '' || isNaN(usageVal)) {
    errors.usage = 'Metered usage value is required.';
  } else if (usageVal <= 0) {
    errors.usage = 'Usage must be greater than zero.';
  } else if (usageVal > 100000000) {
    errors.usage = 'Usage exceeds plausible single-invoice threshold.';
  }

  // 6. Net Cost & VAT
  const netStr = String(form.netCost ?? '').trim();
  const netVal = parseCleanNumber(netStr, NaN);
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
  companyName: 'UK Energy & ESG Intelligence',
  reportingYear: '2026',
  defaultCurrency: 'GBP',
};
