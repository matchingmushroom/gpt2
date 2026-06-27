/**
 * Great Pickle Taste — Google Apps Script Web App
 * 
 * Deploy as: Web App → Execute as "Me" → Access "Anyone"
 * Triggers daily backup at 11:30 PM NPT via time-driven trigger.
 * 
 * Endpoints:
 *   POST /uploadImage    — Upload product image, return Drive URL
 *   POST /uploadBill     — Upload purchase bill, return Drive URL
 *   POST /backupCSV      — Save CSV backup to Drive
 *   POST /exportReport   — Save CSV report to Drive
 *   POST /migrateImages  — Migrate existing product images to organized folders
 *   POST /archiveKPI     — Archive daily KPI snapshot to Drive + Sheets
 *   POST /archiveReport  — Archive finalized P&L or Balance Sheet to Drive + Sheets
 *   GET  /readArchive    — Read archived data (kpi/pnl/bs) by period
 *   GET  /getStatus      — Return Drive storage status
 */

// ─── Configuration ──────────────────────────────────────────

var ROOT_FOLDER_NAME = 'Great Pickle Taste Backup';
var IMAGE_FOLDER_PATH = 'Products/Images';
var BILL_FOLDER_PATH = 'Purchases/Bills';
var BACKUP_FOLDER_PATH = 'Database Backups';
var REPORT_FOLDER_PATH = 'Reports';

// ─── Main Entry Point ───────────────────────────────────────

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;

    var result;
    switch (action) {
      case 'uploadImage':
        result = uploadImage(params);
        break;
      case 'uploadBill':
        result = uploadBill(params);
        break;
      case 'backupCSV':
        result = saveCSV(params, BACKUP_FOLDER_PATH);
        break;
      case 'exportReport':
        result = saveCSV(params, REPORT_FOLDER_PATH);
        break;
      case 'migrateImages':
        result = migrateImages(params);
        break;
      case 'archiveKPI':
        result = archiveKPI(params);
        break;
      case 'archiveReport':
        result = archiveReport(params);
        break;
      case 'pushToSheets':
        result = pushToSheets(params);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'getStatus') {
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: getStatus() }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'readArchive') {
    var archiveType = e.parameter.type;      // 'kpi' | 'pnl' | 'bs'
    var periodId = e.parameter.periodId;      // e.g., '2082_83'

    var result = readArchive(archiveType, periodId);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Helpers: Folder Management ─────────────────────────────

function getOrCreateFolder(path) {
  var parts = path.split('/');
  var parent = DriveApp.getRootFolder();

  // Start from ROOT_FOLDER_NAME
  var rootFolders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (!rootFolders.hasNext()) {
    parent = DriveApp.createFolder(ROOT_FOLDER_NAME);
  } else {
    parent = rootFolders.next();
  }

  // Navigate/create subfolders
  for (var i = 0; i < parts.length; i++) {
    var folders = parent.getFoldersByName(parts[i]);
    if (folders.hasNext()) {
      parent = folders.next();
    } else {
      parent = parent.createFolder(parts[i]);
    }
  }

  return parent;
}

function getMimeType(fileName) {
  var ext = fileName.split('.').pop().toLowerCase();
  var mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'pdf': 'application/pdf'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ─── Endpoint: uploadImage ──────────────────────────────────

function uploadImage(params) {
  var productSlug = params.productSlug;
  var fileName = params.fileName;
  var base64Data = params.base64Data || params.data;
  var folderId = params.folderId;

  if (!base64Data) throw new Error('Missing image data');

  var mimeType = getMimeType(fileName);
  var rawData;

  if (base64Data.indexOf('base64,') > -1) {
    rawData = Utilities.base64Decode(base64Data.split(',')[1]);
  } else {
    rawData = Utilities.base64Decode(base64Data);
  }

  var folder;
  if (folderId) {
    // Upload to user-specified folder directly
    folder = DriveApp.getFolderById(folderId);
  } else {
    // Fall back to default Products/Images/{productSlug}
    folder = getOrCreateFolder(IMAGE_FOLDER_PATH + (productSlug ? '/' + productSlug : ''));
  }

  var timestamp = new Date().getTime();
  var safeFileName = timestamp + '-' + fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  var blob = Utilities.newBlob(rawData, mimeType, safeFileName);
  var file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  return {
    url: 'https://lh3.googleusercontent.com/d/' + fileId,
    fileName: safeFileName,
    fileId: fileId
  };
}

// ─── Endpoint: uploadBill ───────────────────────────────────

function uploadBill(params) {
  var purchaseNumber = params.purchaseNumber;
  var fileName = params.fileName;
  var base64Data = params.base64Data || params.data;
  var folderId = params.folderId;

  if (!base64Data) throw new Error('Missing bill data');

  var mimeType = getMimeType(fileName);
  var rawData;

  if (base64Data.indexOf('base64,') > -1) {
    rawData = Utilities.base64Decode(base64Data.split(',')[1]);
  } else {
    rawData = Utilities.base64Decode(base64Data);
  }

  var folder;
  if (folderId) {
    folder = DriveApp.getFolderById(folderId);
  } else {
    folder = getOrCreateFolder(BILL_FOLDER_PATH);
  }

  var safeFileName = (purchaseNumber ? purchaseNumber + '-' : '') + fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  var blob = Utilities.newBlob(rawData, mimeType, safeFileName);
  var file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  return {
    url: 'https://lh3.googleusercontent.com/d/' + fileId,
    fileName: safeFileName,
    fileId: fileId
  };
}

// ─── Endpoint: saveCSV (shared by backupCSV + exportReport) ─

function saveCSV(params, basePath) {
  var fileName = params.fileName;
  var csvContent = params.csvContent;

  // Add BOM for Excel UTF-8 compatibility
  var bom = '\ufeff';
  var content = bom + csvContent;

  var folder = getOrCreateFolder(basePath);
  var blob = Utilities.newBlob(content, 'text/csv', fileName);
  var file = folder.createFile(blob);

  return {
    fileName: fileName,
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    sizeBytes: content.length
  };
}

// ─── Endpoint: migrateImages ────────────────────────────────

function migrateImages(params) {
  var images = params.images;   // [{ productSlug, existingUrl }]
  var results = [];

  for (var i = 0; i < images.length; i++) {
    try {
      var img = images[i];
      var existingUrl = img.existingUrl;

      // Extract file ID from Google Drive URL
      // Format: https://drive.google.com/file/d/{FILE_ID}/view
      var match = existingUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (!match) {
        results.push({
          productSlug: img.productSlug,
          existingUrl: existingUrl,
          success: false,
          error: 'Could not extract file ID from URL'
        });
        continue;
      }

      var fileId = match[1];
      var sourceFile = DriveApp.getFileById(fileId);

      // Copy to organized folder
      var destFolder = getOrCreateFolder(IMAGE_FOLDER_PATH + '/' + img.productSlug);
      var copiedFile = sourceFile.makeCopy(sourceFile.getName(), destFolder);

      copiedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      results.push({
        productSlug: img.productSlug,
        existingUrl: existingUrl,
        newUrl: copiedFile.getUrl(),
        success: true
      });

    } catch (err) {
      results.push({
        productSlug: img.productSlug,
        existingUrl: img.existingUrl,
        success: false,
        error: err.message
      });
    }
  }

  return {
    total: images.length,
    migrated: results.filter(function(r) { return r.success; }).length,
    failed: results.filter(function(r) { return !r.success; }).length,
    results: results
  };
}

// ─── Endpoint: getStatus ────────────────────────────────────

function getStatus() {
  var rootFolders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (!rootFolders.hasNext()) {
    return {
      connected: true,
      rootFolder: ROOT_FOLDER_NAME,
      rootFolderId: null,
      usedStorage: 0,
      totalStorage: 15 * 1024 * 1024 * 1024,  // 15 GB (free tier)
      fileCount: 0
    };
  }

  var root = rootFolders.next();
  var files = root.getFiles();
  var totalSize = 0;
  var fileCount = 0;

  while (files.hasNext()) {
    var f = files.next();
    totalSize += f.getSize();
    fileCount++;
  }

  return {
    connected: true,
    rootFolder: ROOT_FOLDER_NAME,
    rootFolderId: root.getId(),
    usedStorage: totalSize,
    totalStorage: 15 * 1024 * 1024 * 1024,
    fileCount: fileCount
  };
}

// ─── Daily Auto Backup (Time-Based Trigger) ─────────────────

/**
 * Setup: Run this function once in the GAS editor to create the trigger.
 * Resources → Current project's triggers → Add trigger:
 *   Function: dailyBackup
 *   Event source: Time-driven
 *   Type: Day timer
 *   Time: 11:30 PM to 12:30 AM
 */
function setupDailyBackup() {
  ScriptApp.newTrigger('dailyBackup')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .nearMinute(30)
    .inTimezone('Asia/Kathmandu')
    .create();
}

function dailyBackup() {
  // This function is a placeholder.
  // The actual CSV generation happens client-side in the admin panel.
  // The GAS daily backup trigger fires a notification or can be extended
  // to call back to Firebase if a backend endpoint exists.
  //
  // For the current architecture (static site):
  // - The admin panel checks on load if backup is due
  // - If yes, generates CSVs client-side and pushes to GAS via backupCSV
  // - This function serves as a safety net / future server-side backup
  Logger.log('Daily backup trigger fired at: ' + new Date().toISOString());
}

// ─── Endpoint: archiveKPI ────────────────────────────────────

/**
 * Archives a daily KPI snapshot to Drive and appends to sheet.
 * Called by:
 *   - Admin panel on daily midnight trigger
 *   - Admin panel on period close
 */
function archiveKPI(params) {
  var date = params.date;               // BS date string, e.g. "2083-04-15"
  var salesToday = params.salesToday || 0;
  var pendingOrders = params.pendingOrders || 0;
  var netProfit = params.netProfit || 0;
  var expensesVsBudget = params.expensesVsBudget || 0;
  var outstandingCredit = params.outstandingCredit || 0;
  var outstandingPayables = params.outstandingPayables || 0;
  var lowStockCount = params.lowStockCount || 0;

  // Build CSV row
  var header = 'Date,SalesToday,PendingOrders,NetProfit,ExpensesVsBudget,OutstandingCredit,OutstandingPayables,LowStockCount\n';
  var row = [date, salesToday, pendingOrders, netProfit, expensesVsBudget, outstandingCredit, outstandingPayables, lowStockCount].join(',');
  var csvContent = '\ufeff' + header + row;

  // Save to Drive
  var folder = getOrCreateFolder('Archives');
  var fileName = 'kpi-' + date + '.csv';
  var blob = Utilities.newBlob(csvContent, 'text/csv', fileName);
  folder.createFile(blob);

  return {
    date: date,
    fileName: fileName,
    metrics: {
      salesToday: salesToday,
      pendingOrders: pendingOrders,
      netProfit: netProfit,
      expensesVsBudget: expensesVsBudget,
      outstandingCredit: outstandingCredit,
      outstandingPayables: outstandingPayables,
      lowStockCount: lowStockCount
    }
  };
}

// ─── Endpoint: archiveReport ─────────────────────────────────

/**
 * Archives a finalized P&L or Balance Sheet report to Drive.
 * Called by admin panel on period close.
 */
function archiveReport(params) {
  var reportType = params.reportType;    // 'pnl' | 'balance_sheet'
  var periodId = params.periodId;        // e.g., '2082_83'
  var data = params.data;               // full cache document
  var generatedAt = params.generatedAt || new Date().toISOString();

  // Flatten data object to CSV
  var flatten = function(obj, prefix) {
    var result = {};
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        var val = obj[key];
        var k = prefix ? prefix + '_' + key : key;
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          var nested = flatten(val, k);
          for (var nk in nested) {
            if (nested.hasOwnProperty(nk)) result[nk] = nested[nk];
          }
        } else {
          result[k] = val;
        }
      }
    }
    return result;
  };

  var flat = flatten(data, '');
  flat.reportType = reportType;
  flat.periodId = periodId;
  flat.generatedAt = generatedAt;

  // Build CSV
  var keys = Object.keys(flat);
  var header = keys.join(',') + '\n';
  var values = keys.map(function(k) {
    var val = flat[k];
    var str = String(val !== null && val !== undefined ? val : '');
    return str.indexOf(',') > -1 ? '"' + str.replace(/"/g, '""') + '"' : str;
  }).join(',');
  var csvContent = '\ufeff' + header + values;

  // Save to Drive
  var folder = getOrCreateFolder('Archives');
  var fileName = reportType + '-' + periodId + '.csv';
  var blob = Utilities.newBlob(csvContent, 'text/csv', fileName);
  folder.createFile(blob);

  return {
    reportType: reportType,
    periodId: periodId,
    fileName: fileName,
    generatedAt: generatedAt
  };
}

// ─── Endpoint: pushToSheets ──────────────────────────────────

/**
 * Pushes finance data to a Google Sheet (6 tabs).
 * Called by admin panel "Push to Sheets" button.
 */
function pushToSheets(params) {
  var sheetId = params.sheetId;
  var data = params.data;

  if (!sheetId) {
    // Create a new spreadsheet
    var ss = SpreadsheetApp.create('GPT Finance Report - ' + new Date().toISOString().split('T')[0]);
    sheetId = ss.getId();
  }

  var ss = SpreadsheetApp.openById(sheetId);

  // Helper to write a tab
  function writeTab(sheetName, headers, rows) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear();
    }
    // Write header
    var headerRow = headers.map(function(h) { return h.label; });
    sheet.getRange(1, 1, 1, headers.length).setValues([headerRow]).setFontWeight('bold');

    // Write data rows
    if (rows.length > 0) {
      var values = rows.map(function(row) {
        return headers.map(function(h) {
          var val = row[h.key];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object' && val.seconds) {
            return new Date(val.seconds * 1000).toISOString().split('T')[0];
          }
          return typeof val === 'number' ? Math.round(val * 100) / 100 : String(val);
        });
      });
      sheet.getRange(2, 1, values.length, headers.length).setValues(values);
      // Auto-resize columns
      for (var c = 0; c < headers.length; c++) {
        sheet.autoResizeColumn(c + 1);
      }
    }
  }

  // Tab 1: Chart of Accounts
  if (data.accounts) {
    writeTab('ChartOfAccounts', [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'normalBalance', label: 'Normal Balance' },
      { key: 'description', label: 'Description' },
      { key: 'isActive', label: 'Active' },
    ], data.accounts);
  }

  // Tab 2: Journal Entries
  if (data.journalEntries) {
    writeTab('JournalEntries', [
      { key: 'entryNumber', label: 'Entry #' },
      { key: 'entryDate', label: 'Date' },
      { key: 'description', label: 'Description' },
      { key: 'totalDebit', label: 'Total Debit' },
      { key: 'totalCredit', label: 'Total Credit' },
      { key: 'referenceType', label: 'Reference Type' },
      { key: 'referenceId', label: 'Reference ID' },
      { key: 'posted', label: 'Posted' },
    ], data.journalEntries);
  }

  // Tab 3: Trial Balance
  if (data.trialBalance) {
    writeTab('TrialBalance', [
      { key: 'accountCode', label: 'Code' },
      { key: 'accountName', label: 'Account' },
      { key: 'type', label: 'Type' },
      { key: 'totalDebit', label: 'Total Debit' },
      { key: 'totalCredit', label: 'Total Credit' },
      { key: 'balance', label: 'Balance' },
      { key: 'normalBalance', label: 'Normal Balance' },
    ], data.trialBalance);
  }

  // Tab 4: Fixed Assets
  if (data.fixedAssets) {
    writeTab('FixedAssets', [
      { key: 'name', label: 'Asset Name' },
      { key: 'assetType', label: 'Type' },
      { key: 'purchaseDate', label: 'Purchase Date' },
      { key: 'cost', label: 'Cost' },
      { key: 'salvageValue', label: 'Salvage Value' },
      { key: 'usefulLifeYears', label: 'Useful Life (yrs)' },
      { key: 'depreciationMethod', label: 'Method' },
      { key: 'accumulatedDepreciation', label: 'Acc. Depreciation' },
      { key: 'currentBookValue', label: 'Book Value' },
      { key: 'isActive', label: 'Active' },
    ], data.fixedAssets);
  }

  // Tab 5: Payroll
  if (data.payrollRuns) {
    writeTab('Payroll', [
      { key: 'periodLabel', label: 'Period' },
      { key: 'totalGrossPay', label: 'Gross Pay' },
      { key: 'totalDeductions', label: 'Deductions' },
      { key: 'totalNetPay', label: 'Net Pay' },
      { key: 'status', label: 'Status' },
      { key: 'disbursedAt', label: 'Disbursed At' },
    ], data.payrollRuns);
  }

  // Tab 6: Daily Register
  if (data.dailyRegisters) {
    writeTab('DailyRegister', [
      { key: 'date', label: 'Date' },
      { key: 'openingCash', label: 'Opening Cash' },
      { key: 'cashSales', label: 'Cash Sales' },
      { key: 'totalExpenses', label: 'Expenses' },
      { key: 'totalPurchases', label: 'Purchases' },
      { key: 'closingCash', label: 'Closing Cash' },
      { key: 'cashDifference', label: 'Cash Diff' },
      { key: 'status', label: 'Status' },
    ], data.dailyRegisters);
  }

  // Remove default Sheet1 if it exists and is empty
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getNumSheets() === 1) {
    // Only delete if it's the only sheet and has no data
    var lastRow = defaultSheet.getLastRow();
    if (lastRow === 0) {
      ss.deleteSheet(defaultSheet);
    }
  }

  return {
    sheetId: sheetId,
    sheetUrl: ss.getUrl(),
    tabs: ['ChartOfAccounts', 'JournalEntries', 'TrialBalance', 'FixedAssets', 'Payroll', 'DailyRegister']
  };
}

// ─── Endpoint: readArchive ───────────────────────────────────

/**
 * Reads archived data from Drive.
 * Called by admin panel when viewing historical reports.
 * 
 * Since GAS can't efficiently query multiple CSV files, this
 * returns the metadata of available archive files for a given type.
 * The actual CSV content should be fetched by the client directly
 * from the Drive file URL.
 */
function readArchive(archiveType, periodId) {
  // archiveType: 'kpi' | 'pnl' | 'bs'
  // periodId: optional filter, e.g., '2082_83'

  var folder = getOrCreateFolder('Archives');
  var files = folder.getFiles();
  var archives = [];

  while (files.hasNext()) {
    var f = files.next();
    var name = f.getName();

    // Match by type prefix
    var matches = false;
    if (archiveType === 'kpi' && name.indexOf('kpi-') === 0) matches = true;
    if (archiveType === 'pnl' && name.indexOf('pnl-') === 0) matches = true;
    if (archiveType === 'bs' && name.indexOf('balance-sheet-') === 0) matches = true;

    if (matches) {
      if (!periodId || name.indexOf(periodId) > -1) {
        archives.push({
          fileName: name,
          fileUrl: f.getUrl(),
          fileId: f.getId(),
          sizeBytes: f.getSize(),
          lastUpdated: f.getLastUpdated()
        });
      }
    }
  }

  // Sort newest first
  archives.sort(function(a, b) {
    return b.lastUpdated - a.lastUpdated;
  });

  return {
    type: archiveType,
    periodId: periodId || 'all',
    archives: archives,
    count: archives.length
  };
}

// ─── Utilities ──────────────────────────────────────────────

function testUploadImage() {
  // Test function — run from GAS editor to verify setup
  Logger.log('Root folder: ' + getOrCreateFolder('').getName());
  Logger.log('Status: ' + JSON.stringify(getStatus()));
}
