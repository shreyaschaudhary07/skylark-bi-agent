/**
 * Data Processor — Cleans and normalizes messy Monday.com data
 * Handles: missing values, inconsistent dates, duplicate headers,
 * #VALUE! errors, quantity parsing, sector normalization
 */

/**
 * Known duplicate header patterns in the raw data
 * Rows where column values match header text should be skipped
 */
const HEADER_SENTINEL_VALUES = [
  'Deal Status', 'Close Date (A)', 'Closure Probability',
  'Tentative Close Date', 'Deal Stage', 'Product deal',
  'Sector/service', 'Created Date'
];

/**
 * Sector normalization map
 */
const SECTOR_ALIASES = {
  'mining': 'Mining',
  'renewables': 'Renewables',
  'railways': 'Railways',
  'powerline': 'Powerline',
  'construction': 'Construction',
  'dsp': 'DSP',
  'others': 'Others',
  'tender': 'Tender',
  'manufacturing': 'Manufacturing',
  'aviation': 'Aviation',
  'security and surveillance': 'Security & Surveillance',
  'security & surveillance': 'Security & Surveillance',
};

/**
 * Parse a date string, handling various formats
 * Returns ISO string or null
 */
function parseDate(value) {
  if (!value || value.trim() === '' || value === '-') return null;

  const cleaned = value.trim();

  // ISO format YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // MM/DD/YYYY
  const mdyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdyMatch) {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Parse a numeric value, handling currency, commas, #VALUE!, units
 */
function parseNumber(value) {
  if (!value || value === '' || value === '-') return null;

  const cleaned = value.toString().trim();

  // #VALUE! error
  if (cleaned.includes('#VALUE!') || cleaned.includes('#REF!') || cleaned.includes('#N/A')) {
    return null;
  }

  // Remove currency symbols, commas, and leading/trailing spaces
  let numeric = cleaned
    .replace(/[₹$€£,]/g, '')
    .replace(/\s/g, '')
    .trim();

  // Extract number from strings like "500 HA", "350 KM", "40MW"
  const numberMatch = numeric.match(/^[-+]?[\d,]*\.?\d+/);
  if (numberMatch) {
    const parsed = parseFloat(numberMatch[0].replace(/,/g, ''));
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}

/**
 * Parse quantity values that may contain units
 * Returns { value: number, unit: string }
 */
function parseQuantity(value) {
  if (!value || value === '' || value === '-' || value === 'NA') {
    return { value: null, unit: null };
  }

  const cleaned = value.toString().trim();

  // Match patterns like "500 HA", "350 KM", "40MW", "3 Quarter", "45days", "3 Rooftops"
  const match = cleaned.match(/^([\d,]+\.?\d*)\s*(.*)$/);
  if (match) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    const unit = match[2].trim() || null;
    if (!isNaN(num)) return { value: num, unit };
  }

  return { value: null, unit: cleaned };
}

/**
 * Normalize sector/service names
 */
function normalizeSector(sector) {
  if (!sector || sector.trim() === '') return 'Unknown';

  const key = sector.trim().toLowerCase();
  return SECTOR_ALIASES[key] || sector.trim();
}

/**
 * Normalize deal status
 */
function normalizeStatus(status) {
  if (!status || status.trim() === '') return 'Unknown';

  const cleaned = status.trim().toLowerCase();
  if (cleaned === 'open') return 'Open';
  if (cleaned === 'dead') return 'Dead';
  if (cleaned === 'won') return 'Won';
  if (cleaned === 'on hold') return 'On Hold';

  // If it matches a header value, it's a junk row
  if (HEADER_SENTINEL_VALUES.map(h => h.toLowerCase()).includes(cleaned)) {
    return '__HEADER_ROW__';
  }

  return status.trim();
}

/**
 * Normalize execution status for work orders
 */
function normalizeExecutionStatus(status) {
  if (!status || status.trim() === '') return 'Unknown';

  const cleaned = status.trim().toLowerCase();
  const statusMap = {
    'completed': 'Completed',
    'ongoing': 'Ongoing',
    'not started': 'Not Started',
    'pause / struck': 'Paused',
    'partial completed': 'Partially Completed',
    'details pending from client': 'Pending',
    'executed until current month': 'Active (Recurring)',
  };

  return statusMap[cleaned] || status.trim();
}

/**
 * Check if a row is a duplicate header row
 */
function isHeaderRow(row) {
  const values = Object.values(row);
  const headerHits = values.filter(v =>
    typeof v === 'string' && HEADER_SENTINEL_VALUES.includes(v.trim())
  );
  return headerHits.length >= 3;
}

/**
 * Process deals board data
 */
function processDealsData(rows) {
  const quality = {
    totalRows: rows.length,
    skippedRows: 0,
    missingFields: {},
    issues: [],
  };

  const processed = [];

  for (const row of rows) {
    // Skip duplicate header rows
    if (isHeaderRow(row)) {
      quality.skippedRows++;
      quality.issues.push(`Skipped duplicate header row: "${row._name || 'unnamed'}"`);
      continue;
    }

    const status = normalizeStatus(
      row['Deal Status'] || row['Subitems'] || ''
    );

    // Skip rows flagged as header rows
    if (status === '__HEADER_ROW__') {
      quality.skippedRows++;
      continue;
    }

    const deal = {
      id: row._id,
      dealName: row._name || row['Deal Name'] || 'Unknown',
      ownerCode: row['Owner code'] || null,
      clientCode: row['Client Code'] || null,
      dealStatus: status,
      closeDate: parseDate(row['Close Date (A)'] || ''),
      closureProbability: row['Closure Probability'] || null,
      dealValue: parseNumber(row['Masked Deal value'] || row['Numbers'] || ''),
      tentativeCloseDate: parseDate(row['Tentative Close Date'] || ''),
      dealStage: row['Deal Stage'] || null,
      productDeal: row['Product deal'] || null,
      sector: normalizeSector(row['Sector/service'] || row['Sector'] || ''),
      createdDate: parseDate(row['Created Date'] || ''),
    };

    // Track missing fields
    for (const [key, val] of Object.entries(deal)) {
      if (val === null || val === '' || val === 'Unknown') {
        quality.missingFields[key] = (quality.missingFields[key] || 0) + 1;
      }
    }

    processed.push(deal);
  }

  quality.processedRows = processed.length;

  return { data: processed, quality };
}

/**
 * Process work orders board data
 */
function processWorkOrdersData(rows) {
  const quality = {
    totalRows: rows.length,
    skippedRows: 0,
    missingFields: {},
    issues: [],
  };

  const processed = [];

  for (const row of rows) {
    // Skip mostly-empty rows
    const filledCount = Object.values(row).filter(v => v && v.toString().trim() !== '').length;
    if (filledCount < 4) {
      quality.skippedRows++;
      continue;
    }

    const wo = {
      id: row._id,
      dealName: row._name || row['Deal name masked'] || 'Unknown',
      customerCode: row['Customer Name Code'] || null,
      serialNumber: row['Serial #'] || null,
      natureOfWork: row['Nature of Work'] || null,
      lastExecutedMonth: row['Last executed month of recurring project'] || null,
      executionStatus: normalizeExecutionStatus(row['Execution Status'] || ''),
      dataDeliveryDate: parseDate(row['Data Delivery Date'] || ''),
      poDate: parseDate(row['Date of PO/LOI'] || ''),
      documentType: row['Document Type'] || null,
      startDate: parseDate(row['Probable Start Date'] || ''),
      endDate: parseDate(row['Probable End Date'] || ''),
      personnelCode: row['BD/KAM Personnel code'] || null,
      sector: normalizeSector(row['Sector'] || ''),
      typeOfWork: row['Type of Work'] || null,
      softwarePlatform: row['Is any Skylark software platform part of the client deliverables in this deal?'] || 'NONE',
      lastInvoiceDate: parseDate(row['Last invoice date'] || ''),
      latestInvoiceNo: row['latest invoice no.'] || null,
      amountExclGST: parseNumber(row['Amount in Rupees (Excl of GST) (Masked)'] || ''),
      amountInclGST: parseNumber(row['Amount in Rupees (Incl of GST) (Masked)'] || ''),
      billedExclGST: parseNumber(row['Billed Value in Rupees (Excl of GST.) (Masked)'] || ''),
      billedInclGST: parseNumber(row['Billed Value in Rupees (Incl of GST.) (Masked)'] || ''),
      collectedAmount: parseNumber(row['Collected Amount in Rupees (Incl of GST.) (Masked)'] || ''),
      toBillExclGST: parseNumber(row['Amount to be billed in Rs. (Exl. of GST) (Masked)'] || ''),
      toBillInclGST: parseNumber(row['Amount to be billed in Rs. (Incl. of GST) (Masked)'] || ''),
      receivable: parseNumber(row['Amount Receivable (Masked)'] || ''),
      arPriority: row['AR Priority account'] || null,
      quantityByOps: parseQuantity(row['Quantity by Ops'] || ''),
      quantityPerPO: parseQuantity(row['Quantities as per PO'] || ''),
      quantityBilled: parseQuantity(row['Quantity billed (till date)'] || ''),
      balanceQty: parseQuantity(row['Balance in quantity'] || ''),
      invoiceStatus: row['Invoice Status'] || null,
      billingMonth: row['Expected Billing Month'] || null,
      actualBillingMonth: row['Actual Billing Month'] || null,
      collectionMonth: row['Actual Collection Month'] || null,
      woStatus: row['WO Status (billed)'] || null,
      collectionStatus: row['Collection status'] || null,
      billingStatus: row['Billing Status'] || null,
    };

    // Track missing critical fields
    const criticalFields = ['dealName', 'sector', 'executionStatus', 'amountExclGST', 'natureOfWork'];
    for (const key of criticalFields) {
      if (wo[key] === null || wo[key] === '' || wo[key] === 'Unknown') {
        quality.missingFields[key] = (quality.missingFields[key] || 0) + 1;
      }
    }

    processed.push(wo);
  }

  quality.processedRows = processed.length;

  return { data: processed, quality };
}

/**
 * Generate data quality summary
 */
function generateQualitySummary(dealsQuality, workOrdersQuality) {
  const summary = {
    deals: {
      total: dealsQuality.totalRows,
      processed: dealsQuality.processedRows,
      skipped: dealsQuality.skippedRows,
      topMissingFields: Object.entries(dealsQuality.missingFields)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([field, count]) => ({
          field,
          missing: count,
          pct: Math.round((count / dealsQuality.processedRows) * 100),
        })),
    },
    workOrders: {
      total: workOrdersQuality.totalRows,
      processed: workOrdersQuality.processedRows,
      skipped: workOrdersQuality.skippedRows,
      topMissingFields: Object.entries(workOrdersQuality.missingFields)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([field, count]) => ({
          field,
          missing: count,
          pct: Math.round((count / workOrdersQuality.processedRows) * 100),
        })),
    },
    issues: [
      ...dealsQuality.issues,
      ...workOrdersQuality.issues,
    ],
  };

  return summary;
}

module.exports = {
  parseDate,
  parseNumber,
  parseQuantity,
  normalizeSector,
  normalizeStatus,
  normalizeExecutionStatus,
  isHeaderRow,
  processDealsData,
  processWorkOrdersData,
  generateQualitySummary,
};
