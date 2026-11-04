import {
  INITIAL_SAMPLE_INVOICES,
  DEFAULT_ORG_PROFILE,
  calculateInvoiceEsgMetrics,
  UTILITY_CATEGORIES,
} from '../data/emissionFactors.js';

const STORAGE_KEYS = {
  INVOICES: 'esg_tracker_invoices_v1',
  ORG_PROFILE: 'esg_tracker_org_profile_v1',
  BACKEND_CONFIG: 'esg_tracker_backend_config_v1',
};

export const DEFAULT_BACKEND_CONFIG = {
  activeMode: 'local', // 'local' | 'github' | 'gsheets'
  autoSync: false,
  lastSyncedAt: null,
  github: {
    owner: 'Mhutt97',
    repo: 'esg-energy-tracker',
    branch: 'main',
    filePath: 'data/esg-invoices.json',
    token: '',
  },
  gsheets: {
    webAppUrl: '',
    sheetName: 'ESG_Invoices',
  },
};

export function loadLocalState() {
  try {
    const rawInvoices = localStorage.getItem(STORAGE_KEYS.INVOICES);
    const rawProfile = localStorage.getItem(STORAGE_KEYS.ORG_PROFILE);
    const rawBackend = localStorage.getItem(STORAGE_KEYS.BACKEND_CONFIG);

    return {
      invoices: rawInvoices ? JSON.parse(rawInvoices) : INITIAL_SAMPLE_INVOICES,
      orgProfile: rawProfile
        ? { ...DEFAULT_ORG_PROFILE, ...JSON.parse(rawProfile) }
        : DEFAULT_ORG_PROFILE,
      backendConfig: rawBackend
        ? {
            ...DEFAULT_BACKEND_CONFIG,
            ...JSON.parse(rawBackend),
            github: {
              ...DEFAULT_BACKEND_CONFIG.github,
              ...(JSON.parse(rawBackend).github || {}),
            },
            gsheets: {
              ...DEFAULT_BACKEND_CONFIG.gsheets,
              ...(JSON.parse(rawBackend).gsheets || {}),
            },
          }
        : DEFAULT_BACKEND_CONFIG,
    };
  } catch (err) {
    console.error('Failed to load local state:', err);
    return {
      invoices: INITIAL_SAMPLE_INVOICES,
      orgProfile: DEFAULT_ORG_PROFILE,
      backendConfig: DEFAULT_BACKEND_CONFIG,
    };
  }
}

export function saveLocalInvoices(invoices) {
  localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
}

export function saveLocalOrgProfile(orgProfile) {
  localStorage.setItem(STORAGE_KEYS.ORG_PROFILE, JSON.stringify(orgProfile));
}

export function saveBackendConfig(backendConfig) {
  localStorage.setItem(
    STORAGE_KEYS.BACKEND_CONFIG,
    JSON.stringify(backendConfig)
  );
}

/**
 * UTF-8 safe Base64 helpers for GitHub Contents API
 */
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(base64) {
  const clean = base64.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * GitHub API Integration — Pulls JSON file from repository
 */
export async function pullFromGitHub(ghConfig) {
  const { owner, repo, branch = 'main', filePath, token } = ghConfig;
  if (!owner || !repo || !filePath || !token) {
    throw new Error(
      'Please provide GitHub Owner, Repository, File Path, and Personal Access Token.'
    );
  }

  const cleanPath = filePath.replace(/^\/+/, '');
  const url = `https://api.github.com/repos/${encodeURIComponent(
    owner.trim()
  )}/${encodeURIComponent(repo.trim())}/contents/${cleanPath}?ref=${encodeURIComponent(
    branch.trim()
  )}`;

  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (res.status === 404) {
    throw new Error(
      `File "${cleanPath}" not found on branch "${branch}". Click "Push / Commit to GitHub" first to initialize it.`
    );
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.message || `GitHub API returned HTTP ${res.status}`
    );
  }

  const data = await res.json();
  const decodedContent = base64ToUtf8(data.content);
  const parsed = JSON.parse(decodedContent);

  return {
    invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
    orgProfile: parsed.orgProfile || DEFAULT_ORG_PROFILE,
    sha: data.sha,
    htmlUrl: data.html_url,
  };
}

/**
 * GitHub API Integration — Commits JSON database directly to the repository
 */
export async function pushToGitHub(ghConfig, payload) {
  const { owner, repo, branch = 'main', filePath, token } = ghConfig;
  if (!owner || !repo || !filePath || !token) {
    throw new Error(
      'Please provide GitHub Owner, Repository, File Path, and Personal Access Token.'
    );
  }

  const cleanPath = filePath.replace(/^\/+/, '');
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(
    owner.trim()
  )}/${encodeURIComponent(repo.trim())}/contents/${cleanPath}`;

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.trim()}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Step 1: Check if file already exists to retrieve its SHA
  let existingSha = null;
  const getRes = await fetch(
    `${baseUrl}?ref=${encodeURIComponent(branch.trim())}`,
    { headers }
  );

  if (getRes.ok) {
    const existingData = await getRes.json();
    existingSha = existingData.sha;
  } else if (getRes.status !== 404) {
    const errBody = await getRes.json().catch(() => ({}));
    throw new Error(
      errBody.message || `Failed to inspect GitHub file (HTTP ${getRes.status})`
    );
  }

  // Step 2: Enrich invoices with calculated ESG metrics for repository auditability
  const enrichedPayload = {
    schemaVersion: '1.0',
    updatedAt: new Date().toISOString(),
    orgProfile: payload.orgProfile,
    invoices: payload.invoices.map((inv) => ({
      ...inv,
      calculatedEsg: calculateInvoiceEsgMetrics(inv),
    })),
  };

  const jsonString = JSON.stringify(enrichedPayload, null, 2);
  const body = {
    message: `chore(esg): sync ${payload.invoices.length} utility invoices via EcoLedger ESG Tracker`,
    content: utf8ToBase64(jsonString),
    branch: branch.trim(),
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const putRes = await fetch(baseUrl, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const errBody = await putRes.json().catch(() => ({}));
    throw new Error(
      errBody.message || `GitHub commit failed (HTTP ${putRes.status})`
    );
  }

  const result = await putRes.json();
  return {
    commitSha: result.commit?.sha,
    htmlUrl: result.content?.html_url,
  };
}

/**
 * Google Sheets Apps Script Webhook Integration — Pulls rows from Google Sheet
 */
export async function pullFromGoogleSheets(gsConfig) {
  const { webAppUrl } = gsConfig;
  if (!webAppUrl || !webAppUrl.startsWith('https://')) {
    throw new Error(
      'Please enter a valid Google Apps Script Web App URL starting with https://'
    );
  }

  const res = await fetch(webAppUrl.trim(), {
    method: 'GET',
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Google Sheets Web App returned HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return {
    invoices: Array.isArray(data.invoices) ? data.invoices : [],
    orgProfile: data.orgProfile || null,
  };
}

/**
 * Google Sheets Apps Script Webhook Integration — Pushes rows to Google Sheet
 */
export async function pushToGoogleSheets(gsConfig, payload) {
  const { webAppUrl } = gsConfig;
  if (!webAppUrl || !webAppUrl.startsWith('https://')) {
    throw new Error(
      'Please enter a valid Google Apps Script Web App URL starting with https://'
    );
  }

  const enrichedInvoices = payload.invoices.map((inv) => {
    const metrics = calculateInvoiceEsgMetrics(inv);
    return {
      ...inv,
      scope: metrics.scope,
      normalizedEnergyKwh: Number(metrics.normalizedEnergyKwh.toFixed(2)),
      normalizedWaterM3: Number(metrics.normalizedWaterM3.toFixed(2)),
      locationBasedCo2eTonnes: Number(
        metrics.locationBasedCo2eTonnes.toFixed(4)
      ),
      marketBasedCo2eTonnes: Number(metrics.marketBasedCo2eTonnes.toFixed(4)),
    };
  });

  // Using text/plain avoids CORS preflight rejection on Google Apps Script endpoints
  const res = await fetch(webAppUrl.trim(), {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'syncAll',
      updatedAt: new Date().toISOString(),
      orgProfile: payload.orgProfile,
      invoices: enrichedInvoices,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google Sheets sync failed with HTTP ${res.status}`);
  }

  const result = await res.json();
  if (result.error) {
    throw new Error(result.error);
  }
  return result;
}

/**
 * Ready-to-copy Google Apps Script code for the user's Google Sheet
 */
export const GOOGLE_APPS_SCRIPT_SNIPPET = `// 1. Open your Google Sheet -> Extensions -> Apps Script
// 2. Paste this script and click Deploy -> New deployment -> Web app
// 3. Set "Execute as: Me" and "Who has access: Anyone", then copy the Web App URL!

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const metaSheet = ss.getSheetByName('ESG_RawState');
  if (!metaSheet) {
    return ContentService.createTextOutput(JSON.stringify({ invoices: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const rawJson = metaSheet.getRange('A1').getValue();
  return ContentService.createTextOutput(rawJson || JSON.stringify({ invoices: [] }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Save full state in hidden/meta sheet for lossless 2-way sync
    let metaSheet = ss.getSheetByName('ESG_RawState') || ss.insertSheet('ESG_RawState');
    metaSheet.getRange('A1').setValue(JSON.stringify(payload));
    
    // Write formatted ESG Ledger table to 'ESG_Invoices' sheet
    let tableSheet = ss.getSheetByName('ESG_Invoices') || ss.insertSheet('ESG_Invoices');
    tableSheet.clearContents();
    
    const headers = [
      'Invoice #', 'Facility', 'Supplier', 'Category', 'Scope',
      'Billing Start', 'Billing End', 'Quantity', 'Unit', 'Renewable %',
      'Normalized Energy (kWh)', 'Water (m3)', 'Location CO2e (t)', 'Market CO2e (t)',
      'Cost', 'Currency', 'Status', 'Notes'
    ];
    tableSheet.appendRow(headers);
    
    (payload.invoices || []).forEach(inv => {
      tableSheet.appendRow([
        inv.invoiceNumber, inv.facility, inv.supplier, inv.category, inv.scope,
        inv.billingPeriodStart, inv.billingPeriodEnd, inv.quantity, inv.unit, inv.renewablePct || 0,
        inv.normalizedEnergyKwh, inv.normalizedWaterM3, inv.locationBasedCo2eTonnes, inv.marketBasedCo2eTonnes,
        inv.cost, inv.currency, inv.status, inv.notes || ''
      ]);
    });
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: (payload.invoices || []).length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

/**
 * Generates an audit-ready CSV string from invoices
 */
export function exportInvoicesToCsv(invoices) {
  const headers = [
    'Invoice ID',
    'Invoice Number',
    'Facility',
    'Supplier',
    'Account Number',
    'Category',
    'Subtype',
    'ESG Scope',
    'Billing Start',
    'Billing End',
    'Invoice Date',
    'Quantity',
    'Unit',
    'Grid Region',
    'Renewable %',
    'Renewable Instrument',
    'Normalized Energy (kWh)',
    'Normalized Water (m3)',
    'Location-Based GHG (tCO2e)',
    'Market-Based GHG (tCO2e)',
    'Total Cost',
    'Currency',
    'Verification Status',
    'Notes',
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = invoices.map((inv) => {
    const metrics = calculateInvoiceEsgMetrics(inv);
    const catName = UTILITY_CATEGORIES[inv.category]?.name || inv.category;
    return [
      inv.id,
      inv.invoiceNumber,
      inv.facility,
      inv.supplier,
      inv.accountNumber || '',
      catName,
      inv.subtype || '',
      metrics.scope,
      inv.billingPeriodStart,
      inv.billingPeriodEnd,
      inv.invoiceDate || '',
      inv.quantity,
      inv.unit,
      inv.gridRegion || 'US_EPA_AVG',
      inv.renewablePct || 0,
      inv.renewableInstrument || '',
      metrics.normalizedEnergyKwh.toFixed(2),
      metrics.normalizedWaterM3.toFixed(2),
      metrics.locationBasedCo2eTonnes.toFixed(4),
      metrics.marketBasedCo2eTonnes.toFixed(4),
      inv.cost,
      inv.currency || 'USD',
      inv.status || 'Verified',
      inv.notes || '',
    ]
      .map(escapeCsv)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Parses a CSV file string into invoice records
 */
export function parseCsvToInvoices(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error('CSV file must include a header row and at least one data row.');
  }

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const findCol = (candidates) =>
    headers.findIndex((h) => candidates.some((c) => h.includes(c)));

  const idxInvNum = findCol(['invoice number', 'invoice #', 'invoice_number']);
  const idxFacility = findCol(['facility', 'site', 'location', 'building']);
  const idxSupplier = findCol(['supplier', 'provider', 'utility', 'vendor']);
  const idxCategory = findCol(['category', 'type', 'utility type']);
  const idxStart = findCol(['billing start', 'start date', 'period start']);
  const idxEnd = findCol(['billing end', 'end date', 'period end']);
  const idxQty = findCol(['quantity', 'usage', 'consumption', 'amount']);
  const idxUnit = findCol(['unit', 'uom']);
  const idxRenew = findCol(['renewable %', 'renewable', 'green %']);
  const idxCost = findCol(['total cost', 'cost', 'spend', 'price']);
  const idxCurrency = findCol(['currency']);
  const idxStatus = findCol(['status', 'verification']);
  const idxNotes = findCol(['notes', 'comment']);

  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length < 3) continue;

    const rawCat = (idxCategory >= 0 ? cols[idxCategory] : '').toLowerCase();
    let category = 'electricity';
    if (rawCat.includes('gas') || rawCat.includes('fuel') || rawCat.includes('diesel') || rawCat.includes('therm')) {
      category = 'natural_gas';
    } else if (rawCat.includes('water') || rawCat.includes('sewage')) {
      category = 'water';
    }

    const defaultUnit =
      category === 'electricity'
        ? 'kWh'
        : category === 'natural_gas'
        ? 'therms'
        : 'm3';

    imported.push({
      id: `inv-csv-${Date.now()}-${i}`,
      invoiceNumber:
        (idxInvNum >= 0 && cols[idxInvNum]) || `CSV-${1000 + i}`,
      facility:
        (idxFacility >= 0 && cols[idxFacility]) || 'Main Facility',
      supplier:
        (idxSupplier >= 0 && cols[idxSupplier]) || 'Utility Provider',
      accountNumber: '',
      category,
      subtype:
        category === 'electricity'
          ? 'grid_electricity'
          : category === 'natural_gas'
          ? 'natural_gas'
          : 'municipal_water',
      billingPeriodStart:
        (idxStart >= 0 && cols[idxStart]) || '2026-01-01',
      billingPeriodEnd: (idxEnd >= 0 && cols[idxEnd]) || '2026-01-31',
      invoiceDate: (idxEnd >= 0 && cols[idxEnd]) || '2026-02-01',
      quantity: Number(idxQty >= 0 ? cols[idxQty] : 0) || 0,
      unit: (idxUnit >= 0 && cols[idxUnit]) || defaultUnit,
      renewablePct: Number(idxRenew >= 0 ? cols[idxRenew] : 0) || 0,
      renewableInstrument: '',
      gridRegion: 'US_EPA_AVG',
      cost: Number(idxCost >= 0 ? cols[idxCost] : 0) || 0,
      currency: (idxCurrency >= 0 && cols[idxCurrency]) || 'USD',
      status: (idxStatus >= 0 && cols[idxStatus]) || 'Verified',
      notes: (idxNotes >= 0 && cols[idxNotes]) || 'Imported via CSV',
    });
  }

  return imported;
}
