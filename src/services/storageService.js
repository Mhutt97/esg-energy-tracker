import {
  INITIAL_SAMPLE_INVOICES,
  DEFAULT_ORG_PROFILE,
  calculateInvoiceEsgMetrics,
  UTILITY_CATEGORIES,
  SITES,
  SUPPLIERS,
  parseCleanNumber,
  normalizeUkDateToIso,
  normalizeSiteName,
  normalizeSupplierName,
  sanitizeInvoiceRecord,
} from '../data/emissionFactors.js';

const STORAGE_KEYS = {
  INVOICES: 'esg_tracker_invoices_uk_v2',
  ORG_PROFILE: 'esg_tracker_org_profile_uk_v2',
  BACKEND_CONFIG: 'esg_tracker_backend_config_v1',
};

const IDB_CONFIG = {
  DB_NAME: 'uk_esg_energy_ledger_db',
  DB_VERSION: 1,
  STORE_INVOICES: 'invoices_store',
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

/**
 * IndexedDB helper for storing large invoice datasets + PDF attachments (>5 MB)
 */
function openLedgerIndexedDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }
    const req = indexedDB.open(IDB_CONFIG.DB_NAME, IDB_CONFIG.DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_INVOICES)) {
        db.createObjectStore(IDB_CONFIG.STORE_INVOICES);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveInvoicesToIndexedDb(invoices) {
  try {
    const db = await openLedgerIndexedDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORE_INVOICES, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORE_INVOICES);
      store.put(invoices, 'all_invoices');
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB save fallback:', err);
    return false;
  }
}

export async function loadInvoicesFromIndexedDb() {
  try {
    const db = await openLedgerIndexedDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORE_INVOICES, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORE_INVOICES);
      const req = store.get('all_invoices');
      req.onsuccess = () => {
        db.close();
        if (Array.isArray(req.result)) {
          resolve(
            req.result
              .map((inv, idx) => sanitizeInvoiceRecord(inv, idx))
              .filter(Boolean)
          );
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB load fallback:', err);
    return null;
  }
}

export function loadLocalState() {
  try {
    const rawInvoices = localStorage.getItem(STORAGE_KEYS.INVOICES);
    const rawProfile = localStorage.getItem(STORAGE_KEYS.ORG_PROFILE);
    const rawBackend = localStorage.getItem(STORAGE_KEYS.BACKEND_CONFIG);

    const parsedInvoices = rawInvoices ? JSON.parse(rawInvoices) : null;
    const sanitizedInvoices = Array.isArray(parsedInvoices)
      ? parsedInvoices
          .map((inv, idx) => sanitizeInvoiceRecord(inv, idx))
          .filter(Boolean)
      : INITIAL_SAMPLE_INVOICES;

    const parsedBackend = rawBackend ? JSON.parse(rawBackend) : {};

    return {
      invoices: sanitizedInvoices,
      orgProfile: rawProfile
        ? { ...DEFAULT_ORG_PROFILE, ...JSON.parse(rawProfile) }
        : DEFAULT_ORG_PROFILE,
      backendConfig: {
        ...DEFAULT_BACKEND_CONFIG,
        ...parsedBackend,
        github: {
          ...DEFAULT_BACKEND_CONFIG.github,
          ...(parsedBackend.github || {}),
        },
        gsheets: {
          ...DEFAULT_BACKEND_CONFIG.gsheets,
          ...(parsedBackend.gsheets || {}),
        },
      },
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
  // Always persist full records (including PDFs) to IndexedDB asynchronously
  saveInvoicesToIndexedDb(invoices);

  try {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  } catch (err) {
    // If localStorage hits the 5 MB browser quota due to multiple PDF attachments,
    // store lightweight invoice records in localStorage while IndexedDB retains full PDFs
    try {
      const lightweight = invoices.map((inv) => ({
        ...inv,
        pdfAttachment: inv.pdfAttachment
          ? {
              ...inv.pdfAttachment,
              dataUrl: null,
              storedInIndexedDb: true,
            }
          : null,
      }));
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(lightweight));
    } catch (innerErr) {
      console.error('LocalStorage quota exceeded:', innerErr);
    }
  }
}

export function saveLocalOrgProfile(orgProfile) {
  try {
    localStorage.setItem(STORAGE_KEYS.ORG_PROFILE, JSON.stringify(orgProfile));
  } catch (err) {
    console.error('Failed to save orgProfile:', err);
  }
}

export function saveBackendConfig(backendConfig) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.BACKEND_CONFIG,
      JSON.stringify(backendConfig)
    );
  } catch (err) {
    console.error('Failed to save backendConfig:', err);
  }
}

/**
 * Converts a Base64 PDF Data URL into a native browser Blob URL so iframes and new tabs
 * never get blocked by Chromium data-URI security policies.
 */
export function createPdfBlobUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  try {
    const parts = dataUrl.split(',');
    const base64 = parts.length > 1 ? parts[1] : parts[0];
    const clean = base64.replace(/\s/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Failed to create PDF Blob URL:', err);
    return dataUrl;
  }
}

/**
 * Computes storage diagnostics for the Backend Configuration modal
 */
export function getStorageDiagnostics(invoices = []) {
  const jsonBytes = new TextEncoder().encode(
    JSON.stringify(invoices)
  ).byteLength;
  const pdfCount = invoices.filter(
    (inv) => inv.pdfAttachment && inv.pdfAttachment.name
  ).length;
  const pdfBytes = invoices.reduce(
    (acc, inv) => acc + (Number(inv.pdfAttachment?.size) || 0),
    0
  );
  return {
    invoiceCount: invoices.length,
    pdfCount,
    totalKb: (jsonBytes / 1024).toFixed(1),
    totalMb: (jsonBytes / (1024 * 1024)).toFixed(2),
    pdfKb: (pdfBytes / 1024).toFixed(1),
  };
}

/**
 * UTF-8 safe Base64 helpers for GitHub Contents & Blob APIs
 */
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize)
    );
  }
  return btoa(binary);
}

function base64ToUtf8(base64) {
  const clean = String(base64 || '').replace(/\s/g, '');
  if (!clean) return '';
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function encodeGitHubFilePath(filePath) {
  return String(filePath || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Tests GitHub Repository & PAT permissions
 */
export async function testGitHubConnection(ghConfig) {
  const { owner, repo, branch = 'main', token } = ghConfig;
  if (!owner || !repo || !token) {
    throw new Error(
      'Please enter GitHub Owner, Repository Name, and Personal Access Token.'
    );
  }

  const repoUrl = `https://api.github.com/repos/${encodeURIComponent(
    owner.trim()
  )}/${encodeURIComponent(repo.trim())}`;

  const res = await fetch(repoUrl, {
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.message || `GitHub connection test failed (HTTP ${res.status})`
    );
  }

  const repoData = await res.json();
  const canPush = Boolean(repoData.permissions?.push);
  return {
    fullName: repoData.full_name,
    defaultBranch: repoData.default_branch || branch,
    canPush,
    private: repoData.private,
  };
}

/**
 * GitHub API Integration — Pulls JSON file from repository (with >1 MB Git Blob API fallback)
 */
export async function pullFromGitHub(ghConfig) {
  const { owner, repo, branch = 'main', filePath, token } = ghConfig;
  if (!owner || !repo || !filePath || !token) {
    throw new Error(
      'Please provide GitHub Owner, Repository, File Path, and Personal Access Token.'
    );
  }

  const cleanPath = encodeGitHubFilePath(filePath);
  const url = `https://api.github.com/repos/${encodeURIComponent(
    owner.trim()
  )}/${encodeURIComponent(
    repo.trim()
  )}/contents/${cleanPath}?ref=${encodeURIComponent(branch.trim())}`;

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.trim()}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const res = await fetch(url, {
    cache: 'no-store',
    headers,
  });

  if (res.status === 404) {
    throw new Error(
      `File "${filePath}" not found on branch "${branch}". Click "Commit & Push Invoices to GitHub" first to initialize it.`
    );
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.message || `GitHub API returned HTTP ${res.status}`
    );
  }

  const data = await res.json();
  let base64Content = data.content;

  // If file exceeds 1 MB, GitHub Contents API omits `content` and provides `sha` for Git Blob API
  if (!base64Content && data.sha) {
    const blobUrl = `https://api.github.com/repos/${encodeURIComponent(
      owner.trim()
    )}/${encodeURIComponent(repo.trim())}/git/blobs/${encodeURIComponent(
      data.sha
    )}`;
    const blobRes = await fetch(blobUrl, { cache: 'no-store', headers });
    if (!blobRes.ok) {
      throw new Error(
        `Failed to fetch large Git blob (HTTP ${blobRes.status})`
      );
    }
    const blobData = await blobRes.json();
    base64Content = blobData.content;
  }

  const decodedContent = base64ToUtf8(base64Content);
  const parsed = JSON.parse(decodedContent || '{}');
  const sanitizedInvoices = Array.isArray(parsed.invoices)
    ? parsed.invoices
        .map((inv, idx) => sanitizeInvoiceRecord(inv, idx))
        .filter(Boolean)
    : [];

  return {
    invoices: sanitizedInvoices,
    orgProfile: parsed.orgProfile || DEFAULT_ORG_PROFILE,
    sha: data.sha,
    htmlUrl: data.html_url,
  };
}

/**
 * GitHub API Integration — Commits JSON database directly to repository with automatic 409 Conflict retry
 */
export async function pushToGitHub(ghConfig, payload, retryCount = 0) {
  const { owner, repo, branch = 'main', filePath, token } = ghConfig;
  if (!owner || !repo || !filePath || !token) {
    throw new Error(
      'Please provide GitHub Owner, Repository, File Path, and Personal Access Token.'
    );
  }

  const cleanPath = encodeGitHubFilePath(filePath);
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(
    owner.trim()
  )}/${encodeURIComponent(repo.trim())}/contents/${cleanPath}`;

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.trim()}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  let existingSha = null;
  const getRes = await fetch(
    `${baseUrl}?ref=${encodeURIComponent(branch.trim())}`,
    {
      cache: 'no-store',
      headers,
    }
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

  const enrichedPayload = {
    schemaVersion: '2.2',
    updatedAt: new Date().toISOString(),
    orgProfile: payload.orgProfile,
    invoices: (payload.invoices || []).map((inv, idx) => {
      const cleanInv = sanitizeInvoiceRecord(inv, idx);
      return {
        ...cleanInv,
        calculatedEsg: calculateInvoiceEsgMetrics(cleanInv),
      };
    }),
  };

  const jsonString = JSON.stringify(enrichedPayload, null, 2);
  const body = {
    message: `chore(esg): sync ${enrichedPayload.invoices.length} utility invoices via UK Energy & ESG Intelligence`,
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

  // Automatically resolve SHA conflict if two updates happened in rapid succession
  if (putRes.status === 409 && retryCount < 1) {
    return pushToGitHub(ghConfig, payload, retryCount + 1);
  }

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
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Google Sheets Web App returned HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }

  const sanitizedInvoices = Array.isArray(data.invoices)
    ? data.invoices
        .map((inv, idx) => sanitizeInvoiceRecord(inv, idx))
        .filter(Boolean)
    : [];

  return {
    invoices: sanitizedInvoices,
    orgProfile: data.orgProfile || null,
  };
}

/**
 * Google Sheets Apps Script Webhook Integration — Pushes rows to Google Sheet
 * Strips heavy Base64 PDF blobs so Google Sheets cells never exceed the 50,000-character limit!
 */
export async function pushToGoogleSheets(gsConfig, payload) {
  const { webAppUrl } = gsConfig;
  if (!webAppUrl || !webAppUrl.startsWith('https://')) {
    throw new Error(
      'Please enter a valid Google Apps Script Web App URL starting with https://'
    );
  }

  const enrichedInvoices = (payload.invoices || []).map((inv, idx) => {
    const cleanInv = sanitizeInvoiceRecord(inv, idx);
    const metrics = calculateInvoiceEsgMetrics(cleanInv);
    return {
      ...cleanInv,
      // Omit raw Base64 PDF dataUrl from Google Sheets cell storage to avoid 50k char cell limit
      pdfAttachment: cleanInv.pdfAttachment
        ? {
            name: cleanInv.pdfAttachment.name,
            size: cleanInv.pdfAttachment.size,
            type: 'application/pdf',
            uploadedAt: cleanInv.pdfAttachment.uploadedAt,
          }
        : null,
      scope: metrics.scope,
      normalizedEnergyKwh: Number(metrics.normalizedEnergyKwh.toFixed(2)),
      normalizedWaterM3: Number(metrics.normalizedWaterM3.toFixed(2)),
      co2eTonnes: Number(metrics.co2eTonnes.toFixed(4)),
      pdfFileName: cleanInv.pdfAttachment?.name || '',
    };
  });

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
 * Ready-to-copy Google Apps Script code for the user's Google Sheet.
 * Uses multi-row 40,000-char chunking in ESG_RawState so it never hits the 50,000-char cell limit.
 */
export const GOOGLE_APPS_SCRIPT_SNIPPET = `// 1. Open your Google Sheet -> Extensions -> Apps Script
// 2. Paste this script and click Deploy -> New deployment -> Web app
// 3. Set "Execute as: Me" and "Who has access: Anyone", then copy the Web App URL!

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const metaSheet = ss.getSheetByName('ESG_RawState');
  if (!metaSheet || metaSheet.getLastRow() === 0) {
    return ContentService.createTextOutput(JSON.stringify({ invoices: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const values = metaSheet.getRange(1, 1, metaSheet.getLastRow(), 1).getValues();
  const rawJson = values.map(r => r[0]).join('');
  return ContentService.createTextOutput(rawJson || JSON.stringify({ invoices: [] }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const rawText = e.postData.contents;
    const payload = JSON.parse(rawText);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Chunk state into 40,000-char rows to avoid Google Sheets' 50,000-char single-cell limit
    let metaSheet = ss.getSheetByName('ESG_RawState') || ss.insertSheet('ESG_RawState');
    metaSheet.clearContents();
    const chunkSize = 40000;
    const chunks = [];
    for (let i = 0; i < rawText.length; i += chunkSize) {
      chunks.push([rawText.substring(i, i + chunkSize)]);
    }
    if (chunks.length > 0) {
      metaSheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
    }
    
    let tableSheet = ss.getSheetByName('ESG_Invoices') || ss.insertSheet('ESG_Invoices');
    tableSheet.clearContents();
    
    const headers = [
      'Invoice #', 'Invoice Date', 'Site Name', 'Supplier', 'Category', 'Scope',
      'Billing Start', 'Billing End', 'Usage', 'Unit',
      'Normalized Energy (kWh)', 'Water (m3)', 'CO2e (t)',
      'Net (£)', 'VAT Rate (%)', 'VAT (£)', 'Gross (£)', 'Currency', 'Reading Type', 'PDF Document', 'Notes'
    ];
    const rows = [headers];
    
    (payload.invoices || []).forEach(inv => {
      rows.push([
        inv.invoiceNumber, inv.invoiceDate || '', inv.siteName, inv.supplier, inv.category, inv.scope,
        inv.billingPeriodStart, inv.billingPeriodEnd, inv.usage, inv.unit,
        inv.normalizedEnergyKwh, inv.normalizedWaterM3, inv.co2eTonnes,
        inv.netCost, inv.vatRate, inv.vatAmount, inv.grossCost, 'GBP', inv.readingType, inv.pdfFileName || '', inv.notes || ''
      ]);
    });
    
    tableSheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: (payload.invoices || []).length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

/**
 * Generates an audit-ready CSV string from invoices (GBP £)
 */
export function exportInvoicesToCsv(invoices) {
  const headers = [
    'Invoice ID',
    'Invoice Number',
    'Invoice Date',
    'Site Name',
    'Supplier',
    'Category',
    'ESG Scope',
    'Billing Start',
    'Billing End',
    'Usage',
    'Unit',
    'Normalized Energy (kWh)',
    'Normalized Water (m3)',
    'GHG Emissions (tCO2e)',
    'Net Cost (GBP)',
    'VAT Rate (%)',
    'VAT Amount (GBP)',
    'Gross Cost (GBP)',
    'Currency',
    'Reading Type',
    'PDF Document Attached',
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

  const rows = invoices.map((inv, idx) => {
    const cleanInv = sanitizeInvoiceRecord(inv, idx);
    const metrics = calculateInvoiceEsgMetrics(cleanInv);
    const catName =
      UTILITY_CATEGORIES[cleanInv.category]?.name || cleanInv.category;

    return [
      cleanInv.id,
      cleanInv.invoiceNumber,
      cleanInv.invoiceDate,
      cleanInv.siteName,
      cleanInv.supplier,
      catName,
      metrics.scope,
      cleanInv.billingPeriodStart,
      cleanInv.billingPeriodEnd,
      cleanInv.usage,
      cleanInv.unit,
      metrics.normalizedEnergyKwh.toFixed(2),
      metrics.normalizedWaterM3.toFixed(2),
      metrics.co2eTonnes.toFixed(4),
      cleanInv.netCost.toFixed(2),
      cleanInv.vatRate,
      cleanInv.vatAmount.toFixed(2),
      cleanInv.grossCost.toFixed(2),
      'GBP',
      cleanInv.readingType,
      cleanInv.pdfAttachment?.name || 'None',
      cleanInv.notes || '',
    ]
      .map(escapeCsv)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Parses a CSV file string into sanitized UK invoice records.
 * Supports UK DD/MM/YYYY dates and currency-formatted numbers (e.g. "£3,190.00").
 */
export function parseCsvToInvoices(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error(
      'CSV file must include a header row and at least one data row.'
    );
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

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Prioritize exact header match before substring match so 'date' never steals 'start date'
  const findCol = (candidates) => {
    for (const c of candidates) {
      const exactIdx = headers.findIndex((h) => h === c);
      if (exactIdx >= 0) return exactIdx;
    }
    for (const c of candidates) {
      const subIdx = headers.findIndex((h) => h.includes(c));
      if (subIdx >= 0) return subIdx;
    }
    return -1;
  };

  const idxInvNum = findCol([
    'invoice number',
    'invoice ref',
    'invoice #',
    'invoice_number',
  ]);
  const idxInvDate = findCol(['invoice date', 'issue date', 'tax date']);
  const idxSite = findCol(['site name', 'site', 'facility', 'location']);
  const idxSupplier = findCol([
    'supplier',
    'utilities provider',
    'provider',
    'utility',
  ]);
  const idxCategory = findCol(['category', 'stream', 'utility type', 'type']);
  const idxStart = findCol(['billing start', 'start date', 'period start']);
  const idxEnd = findCol(['billing end', 'end date', 'period end']);
  const idxUsage = findCol(['usage', 'quantity', 'consumption', 'billed usage']);
  const idxUnit = findCol(['unit', 'uom', 'unit of measure']);
  const idxNet = findCol(['net cost (gbp)', 'net cost', 'net (£)', 'net', 'cost']);
  const idxVatRate = findCol(['vat rate (%)', 'vat rate', 'vat %']);
  const idxReading = findCol(['reading type', 'reading', 'status']);
  const idxNotes = findCol(['notes', 'comment', 'audit notes']);

  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length < 3) continue;

    const rawCat = (idxCategory >= 0 ? cols[idxCategory] : '').toLowerCase();
    let category = 'electricity';
    if (
      rawCat.includes('gas') ||
      rawCat.includes('fuel') ||
      rawCat.includes('therm')
    ) {
      category = 'natural_gas';
    } else if (rawCat.includes('water')) {
      category = 'water';
    }

    const defaultUnit =
      category === 'electricity'
        ? 'kWh'
        : category === 'natural_gas'
        ? 'kWh'
        : 'm3';

    const netCost = parseCleanNumber(idxNet >= 0 ? cols[idxNet] : 0, 0);
    const rawVat =
      idxVatRate >= 0 ? parseCleanNumber(cols[idxVatRate], 20) : 20;
    const vatRate = [20, 5, 0].includes(rawVat) ? rawVat : 20;

    const startIso = normalizeUkDateToIso(
      idxStart >= 0 ? cols[idxStart] : '',
      '2026-01-01'
    );
    const endIso = normalizeUkDateToIso(
      idxEnd >= 0 ? cols[idxEnd] : '',
      startIso
    );
    const invDateIso = normalizeUkDateToIso(
      idxInvDate >= 0 ? cols[idxInvDate] : '',
      endIso
    );

    const record = sanitizeInvoiceRecord(
      {
        id: `inv-csv-${Date.now()}-${i}`,
        invoiceNumber:
          (idxInvNum >= 0 && cols[idxInvNum]) || `INV-${1000 + i}`,
        invoiceDate: invDateIso,
        siteName: idxSite >= 0 ? cols[idxSite] : SITES[0],
        supplier: idxSupplier >= 0 ? cols[idxSupplier] : SUPPLIERS[0],
        category,
        billingPeriodStart: startIso,
        billingPeriodEnd: endIso,
        usage: parseCleanNumber(idxUsage >= 0 ? cols[idxUsage] : 0, 0),
        unit: (idxUnit >= 0 && cols[idxUnit]) || defaultUnit,
        netCost,
        vatRate,
        readingType: idxReading >= 0 ? cols[idxReading] : 'Actual',
        notes: idxNotes >= 0 ? cols[idxNotes] : '',
      },
      i
    );

    if (record && record.usage > 0) {
      imported.push(record);
    }
  }

  return imported;
}

/**
 * Validates and parses a JSON Database Snapshot file for restoration
 */
export function parseJsonBackup(jsonText) {
  const parsed = JSON.parse(jsonText);
  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.invoices)
    ? parsed.invoices
    : null;

  if (!rawList) {
    throw new Error(
      'Invalid JSON snapshot format: missing "invoices" array.'
    );
  }

  const sanitizedInvoices = rawList
    .map((inv, idx) => sanitizeInvoiceRecord(inv, idx))
    .filter(Boolean);

  return {
    invoices: sanitizedInvoices,
    orgProfile:
      parsed.orgProfile && typeof parsed.orgProfile === 'object'
        ? parsed.orgProfile
        : null,
  };
}
