// ============================================================
//  EXPENSE TRACKER — Google Apps Script Backend (Sheets API v4)
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
// 🔴 YOU MUST SET THIS: Copy your Google Sheet ID here
const SHEET_ID     = "1CnIHN6ObrP1BVDV7qaijWzEQIHCgDcEo3-MtSUzjbfM"; // ← Paste your Sheet ID

// 🔴 YOU MUST SET THIS: Get API key from Google Cloud Console
// Go to: https://console.cloud.google.com/
// Enable "Google Sheets API" for your project
// Create API Key (Credentials → Create Credentials → API Key)
const SHEETS_API_KEY = "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"; // ← Paste your API key here

const SHEETS_API_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const HEADERS      = ["ID", "Date", "Title", "Category", "Amount", "Notes"];

// Validate on startup
function onOpen() {
  const checks = [];
  
  if (!SHEET_ID || SHEET_ID.trim() === "") {
    checks.push("❌ SHEET_ID not set");
  } else {
    checks.push("✓ SHEET_ID configured");
  }
  
  if (!SHEETS_API_KEY || SHEETS_API_KEY.trim() === "") {
    checks.push("❌ SHEETS_API_KEY not set - get from console.cloud.google.com");
  } else {
    checks.push("✓ SHEETS_API_KEY configured");
  }
  
  Logger.log(checks.join(" | "));
}

// ── ENTRY POINTS ─────────────────────────────────────────────
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function doOptions(e) {
  // Google Apps Script automatically handles CORS for standalone web apps
  // No explicit handling needed - just return OK
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ── HANDLE REQUEST WITH CORS ─────────────────────────────────
function handleRequest(e) {
  try {
    // Log raw request details for debugging
    Logger.log("=== INCOMING REQUEST ===");
    Logger.log("Method: " + (e.parameter ? "GET" : "POST"));
    Logger.log("Parameters: " + JSON.stringify(e.parameter));
    Logger.log("PostData: " + (e.postData ? e.postData.contents : "none"));
    
    // Validate SHEET_ID first
    if (!SHEET_ID || SHEET_ID.trim() === "") {
      Logger.log("❌ SHEET_ID not configured!");
      return buildJsonResponse({ ok: false, error: "SHEET_ID not configured. Update line 7 with your Sheet ID." });
    }

    // Parse params and body - try multiple ways to get action
    const params = e.parameter || {};
    let body = {};
    let action = params.action; // Try from URL params first
    
    // Try to parse POST body
    if (e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents || "{}");
        Logger.log("[GAS] Parsed body: " + JSON.stringify(body).substring(0, 100));
      } catch (parseErr) {
        Logger.log("⚠ Could not parse body: " + parseErr.message);
      }
    }
    
    // If no action in URL, try body
    if (!action) {
      action = body.action;
    }

    Logger.log("[GAS] ACTION: " + action);
    Logger.log("[GAS] Body keys: " + Object.keys(body).join(", "));

    // Handle different request formats
    let result;
    
    if (!action) {
      // No action provided - return helpful error
      result = {
        ok: false,
        error: "Missing action parameter",
        hint: "Send ?action=ping or POST {\"action\":\"ping\"}",
        received: {
          action: action,
          params: params,
          bodyKeys: Object.keys(body)
        }
      };
    } else {
      // Process the action
      switch (action) {
        case "addExpense":    result = addExpense(body);            break;
        case "getExpenses":   result = getExpenses(params);         break;
        case "deleteExpense": result = deleteExpense(body.id);      break;
        case "getMonthly":    result = getMonthlyReport(params);    break;
        case "ping":          result = { ok: true, msg: "alive", timestamp: new Date().toISOString() };  break;
        default:
          result = { ok: false, error: "Unknown action: " + action, available: ["addExpense", "getExpenses", "deleteExpense", "getMonthly", "ping"] };
      }
    }

    Logger.log("[GAS] RESULT: " + JSON.stringify(result).substring(0, 150));
    return buildJsonResponse(result);
  } catch (err) {
    Logger.log("❌ [GAS] CRITICAL ERROR: " + err.message);
    Logger.log("Stack: " + err.stack);
    return buildJsonResponse({ 
      ok: false, 
      error: err.message,
      type: "exception"
    });
  }
}

// Helper to build JSON response
// Google Apps Script automatically handles CORS headers
function buildJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ACTIONS ──────────────────────────────────────────────────
function addExpense(data) {
  Logger.log("[GAS] addExpense called with: " + JSON.stringify(data));
  
  if (!data.title)  {
    throw new Error("title is required");
  }
  if (!data.amount) {
    throw new Error("amount is required");
  }
  if (!SHEETS_API_KEY || SHEETS_API_KEY.trim() === "") {
    throw new Error("SHEETS_API_KEY not configured");
  }

  try {
    // Extract month and ensure sheet exists
    const date = data.date || new Date().toISOString();
    const month = extractMonth(date);
    
    ensureSheetExists(month);
    
    const id = Utilities.getUuid();
    const row = [
      id,
      date,
      data.title,
      data.category || "Other",
      parseFloat(data.amount),
      data.notes || ""
    ];

    // Append row using Sheets API
    const range = `'${month}'!A:F`;
    const appendUrl = `${SHEETS_API_URL}/${SHEET_ID}/values/${encodeURIComponent(range)}:append?key=${SHEETS_API_KEY}`;
    
    const appendPayload = {
      values: [row],
      majorDimension: "ROWS"
    };
    
    const response = UrlFetchApp.fetch(appendUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(appendPayload),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      const error = JSON.parse(response.getContentText());
      throw new Error("Failed to append: " + (error.error?.message || response.getResponseCode()));
    }
    
    Logger.log("[GAS] ✓ Expense added to " + month);
    return { ok: true, expense: rowToObj(row) };
  } catch (err) {
    Logger.log("❌ addExpense error: " + err.message);
    throw err;
  }
}

function getExpenses(params) {
  Logger.log("[GAS] getExpenses called with params: " + JSON.stringify(params));
  
  if (!SHEETS_API_KEY || SHEETS_API_KEY.trim() === "") {
    throw new Error("SHEETS_API_KEY not configured");
  }
  
  try {
    const spreadsheetInfo = getSpreadsheetInfo();
    const sheetNames = spreadsheetInfo.sheets.map(s => s.properties.title);
    
    let allRows = [];
    
    // Fetch data from each month sheet
    for (const sheetName of sheetNames) {
      // Only process month sheets (YYYY-MM format)
      if (!sheetName.match(/^\d{4}-\d{2}$/)) continue;
      
      const sheetData = fetchSheetData(sheetName);
      allRows = allRows.concat(sheetData);
      Logger.log("[GAS] Fetched " + sheetData.length + " rows from " + sheetName);
    }
    
    Logger.log("[GAS] Total rows loaded: " + allRows.length);
    
    // Apply filters
    let results = allRows;
    
    if (params.category && params.category !== "All") {
      results = results.filter(e => e.category === params.category);
    }
    
    if (params.search) {
      const q = params.search.toLowerCase();
      results = results.filter(e => 
        e.title.toLowerCase().includes(q) || 
        (e.notes || "").toLowerCase().includes(q)
      );
    }
    
    // Sort by date descending
    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    Logger.log("[GAS] Returned " + results.length + " expenses");
    
    return { ok: true, expenses: results };
  } catch (err) {
    Logger.log("❌ getExpenses error: " + err.message);
    throw err;
  }
}

function deleteExpense(id) {
  Logger.log("[GAS] deleteExpense called with id: " + id);
  
  if (!id) {
    throw new Error("id is required");
  }
  if (!SHEETS_API_KEY || SHEETS_API_KEY.trim() === "") {
    throw new Error("SHEETS_API_KEY not configured");
  }
  
  try {
    const spreadsheetInfo = getSpreadsheetInfo();
    const sheetNames = spreadsheetInfo.sheets.map(s => s.properties.title);
    
    // Search across all month sheets
    for (const sheetName of sheetNames) {
      if (!sheetName.match(/^\d{4}-\d{2}$/)) continue;
      
      const sheetData = fetchSheetData(sheetName);
      
      // Find the row with this ID
      for (let i = 0; i < sheetData.length; i++) {
        if (sheetData[i].id === id) {
          // Delete this row using batchUpdate
          deleteSheetRow(spreadsheetInfo, sheetName, i + 2); // +2 because row 1 is header, +1 for 1-based
          Logger.log("[GAS] ✓ Deleted expense " + id);
          return { ok: true, deleted: id };
        }
      }
    }
    
    throw new Error("Expense not found: " + id);
  } catch (err) {
    Logger.log("❌ deleteExpense error: " + err.message);
    throw err;
  }
}

function getMonthlyReport(params) {
  try {
    const month = params.month || getCurrentMonth();
    Logger.log("[GAS] getMonthlyReport for month: " + month);
    
    // Get expenses for this specific month
    const sheetData = fetchSheetData(month);
    const expenses = sheetData;
    Logger.log("[GAS] Got " + expenses.length + " expenses for month");

    const total    = expenses.reduce((s, e) => s + e.amount, 0);
    const byDay    = {};
    const byCat    = {};
    const uniqueDays = new Set();

    expenses.forEach(e => {
      const day = String(e.date).slice(0, 10);
      byDay[day] = (byDay[day] || 0) + e.amount;
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
      uniqueDays.add(day);
    });

    const dailyAvg = uniqueDays.size > 0 ? total / uniqueDays.size : 0;
    const topCat   = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

    const result = {
      ok: true,
      month,
      total:    round2(total),
      count:    expenses.length,
      dailyAvg: round2(dailyAvg),
      topCategory: topCat ? topCat[0] : null,
      byDay,
      byCat,
      expenses
    };
    
    Logger.log("[GAS] ✓ Monthly report: $" + result.total.toFixed(2) + " across " + result.count + " items");
    return result;
  } catch (err) {
    Logger.log("❌ getMonthlyReport error: " + err.message);
    throw err;
  }
}

// ── HELPERS ──────────────────────────────────────────────────

// Get spreadsheet metadata using Sheets API
function getSpreadsheetInfo() {
  const url = `${SHEETS_API_URL}/${SHEET_ID}?key=${SHEETS_API_KEY}`;
  
  const response = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error("Failed to get spreadsheet info: " + response.getContentText());
  }
  
  return JSON.parse(response.getContentText());
}

// Fetch data from a specific sheet using Sheets API
function fetchSheetData(sheetName) {
  const range = `'${sheetName}'!A:F`;
  const url = `${SHEETS_API_URL}/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${SHEETS_API_KEY}`;
  
  const response = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() === 404) {
    Logger.log("[GAS] Sheet not found: " + sheetName);
    return [];
  }
  
  if (response.getResponseCode() !== 200) {
    Logger.log("[GAS] Error fetching sheet: " + response.getContentText());
    return [];
  }
  
  const result = JSON.parse(response.getContentText());
  if (!result.values || result.values.length <= 1) {
    return [];
  }
  
  // Skip header row (index 0)
  return result.values.slice(1).map(rowToObj);
}

// Ensure a sheet exists using batchUpdate API
function ensureSheetExists(month) {
  const sheetInfo = getSpreadsheetInfo();
  const sheetNames = sheetInfo.sheets.map(s => s.properties.title);
  
  if (sheetNames.includes(month)) {
    Logger.log("[GAS] Sheet already exists: " + month);
    return;
  }
  
  Logger.log("[GAS] Creating new sheet: " + month);
  
  const payload = {
    requests: [
      {
        addSheet: {
          properties: {
            title: month,
            gridProperties: { rowCount: 1000, columnCount: 6 }
          }
        }
      }
    ]
  };
  
  const url = `${SHEETS_API_URL}/${SHEET_ID}:batchUpdate?key=${SHEETS_API_KEY}`;
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error("Failed to create sheet: " + response.getContentText());
  }
  
  // Now add headers to the new sheet
  const range = `'${month}'!A1:F1`;
  const headerUrl = `${SHEETS_API_URL}/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${SHEETS_API_KEY}`;
  const headerPayload = {
    values: [HEADERS],
    majorDimension: "ROWS"
  };
  
  const headerRes = UrlFetchApp.fetch(headerUrl, {
    method: "put",
    contentType: "application/json",
    payload: JSON.stringify(headerPayload),
    muteHttpExceptions: true
  });
  
  if (headerRes.getResponseCode() !== 200) {
    Logger.log("⚠ Warning: Failed to add headers: " + headerRes.getContentText());
  }
  
  Logger.log("[GAS] ✓ Sheet created: " + month);
}

// Delete a row using batchUpdate API
function deleteSheetRow(spreadsheetInfo, sheetName, rowIndex) {
  const sheet = spreadsheetInfo.sheets.find(s => s.properties.title === sheetName);
  
  if (!sheet) {
    throw new Error("Sheet not found: " + sheetName);
  }
  
  const sheetId = sheet.properties.sheetId;
  
  const payload = {
    requests: [
      {
        deleteRange: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: rowIndex - 1,
            endIndex: rowIndex
          },
          shiftDimension: "ROWS"
        }
      }
    ]
  };
  
  const url = `${SHEETS_API_URL}/${SHEET_ID}:batchUpdate?key=${SHEETS_API_KEY}`;
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error("Failed to delete row: " + response.getContentText());
  }
}

// Extract month from ISO date string (YYYY-MM-DD)
function extractMonth(dateString) {
  try {
    const date = new Date(dateString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return yyyy + "-" + mm;
  } catch (err) {
    Logger.log("⚠ extractMonth error, using current month: " + err.message);
    return getCurrentMonth();
  }
}

// Get the current month in YYYY-MM format
function getCurrentMonth() {
  const now = new Date();
  const mm  = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${mm}`;
}

function rowToObj(row) {
  return {
    id:       row[0],
    date:     row[1],
    title:    row[2],
    category: row[3],
    amount:   parseFloat(row[4]) || 0,
    notes:    row[5] || ""
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

// ── TEST FUNCTION ────────────────────────────────────────────
// Run this in Apps Script to verify setup: Apps Script → Run → testSetup()
function testSetup() {
  Logger.log("========== EXPENSE TRACKER SETUP TEST ==========");
  
  // Check 1: SHEET_ID
  if (!SHEET_ID || SHEET_ID.trim() === "") {
    Logger.log("❌ SHEET_ID is NOT configured");
    return;
  }
  Logger.log("✓ SHEET_ID configured");
  
  // Check 2: SHEETS_API_KEY
  if (!SHEETS_API_KEY || SHEETS_API_KEY.trim() === "") {
    Logger.log("❌ SHEETS_API_KEY is NOT configured");
    Logger.log("   → Get API key from https://console.cloud.google.com/");
    Logger.log("   → Enable 'Google Sheets API'");
    Logger.log("   → Create API Key (Credentials → Create Credentials → API Key)");
    Logger.log("   → Paste key on line 9 of Code.gs");
    return;
  }
  Logger.log("✓ SHEETS_API_KEY configured");
  
  // Check 3: Can access spreadsheet
  try {
    const info = getSpreadsheetInfo();
    Logger.log("✓ Spreadsheet access OK");
  } catch (err) {
    Logger.log("❌ Cannot access spreadsheet: " + err.message);
    Logger.log("   → Check SHEET_ID is correct");
    Logger.log("   → Check SHEETS_API_KEY has access to Sheets API");
    return;
  }
  
  // Check 4: Can create/access monthly sheets
  try {
    const month = getCurrentMonth();
    ensureSheetExists(month);
    Logger.log("✓ Sheet access/creation OK: " + month);
  } catch (err) {
    Logger.log("❌ Cannot create sheet: " + err.message);
    return;
  }
  
  // Check 5: Try test add/get
  try {
    Logger.log("\n--- Testing addExpense ---");
    const testExpense = {
      title: "✓ Test " + new Date().getTime(),
      amount: 12.34,
      category: "Test",
      date: new Date().toISOString(),
      notes: "Automated test"
    };
    const addResult = addExpense(testExpense);
    if (addResult.ok) {
      Logger.log("✓ addExpense works!");
    } else {
      Logger.log("❌ addExpense failed: " + addResult.error);
    }
    
    Logger.log("\n--- Testing getExpenses ---");
    const getResult = getExpenses({});
    if (getResult.ok) {
      Logger.log("✓ getExpenses works! Found " + getResult.expenses.length + " total expenses");
    } else {
      Logger.log("❌ getExpenses failed: " + getResult.error);
    }
  } catch (err) {
    Logger.log("❌ Test error: " + err.message);
  }
  
  Logger.log("\n========== SETUP COMPLETE ==========");
  Logger.log("✅ Your app is ready! Go back to your Expense Tracker and add an expense.");
}

// ── OPTIONAL: MONTHLY EMAIL REPORT ───────────────────────────
function sendMonthlyEmail() {
  const lastMonth = getPrevMonth();
  const report    = getMonthlyReport({ month: lastMonth });
  if (report.count === 0) return;

  const catRows = Object.entries(report.byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) =>
      `<tr><td style="padding:4px 8px">${cat}</td>
       <td style="padding:4px 8px;text-align:right">SGD ${amt.toFixed(2)}</td></tr>`).join("");

  const html = `
    <h2>Expense Report — ${lastMonth}</h2>
    <p><strong>Total spent:</strong> SGD ${report.total.toFixed(2)}</p>
    <p><strong>Transactions:</strong> ${report.count}</p>
    <p><strong>Daily average:</strong> SGD ${report.dailyAvg.toFixed(2)}</p>
    <h3>By category</h3>
    <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <tr style="background:#f0f0f0"><th style="padding:4px 8px">Category</th><th style="padding:4px 8px">Amount</th></tr>
      ${catRows}
    </table>
    <p style="color:#888;font-size:12px">Sent from your Expense Tracker (Google Apps Script)</p>
  `;

  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: `Expense Report ${lastMonth}`,
    htmlBody: html
  });
}

function getPrevMonth() {
  const now  = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mm   = String(prev.getMonth() + 1).padStart(2, "0");
  return `${prev.getFullYear()}-${mm}`;
}