// ============================================================
//  EXPENSE TRACKER — Google Apps Script Backend (Native SpreadsheetApp)
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
// 🔴 YOU MUST SET THIS: Copy your Google Sheet ID here
const SHEET_ID     = "1CnIHN6ObrP1BVDV7qaijWzEQIHCgDcEo3-MtSUzjbfM"; // ← Paste your Sheet ID
const HEADERS      = ["ID", "Date", "Title", "Category", "Amount", "Notes"];

// Validate on startup
function onOpen() {
  if (!SHEET_ID || SHEET_ID.trim() === "") {
    Logger.log("❌ ERROR: SHEET_ID is not set! Update line 7 in Code.gs");
  } else {
    Logger.log("✓ Sheet ID is configured");
  }
}

// ── ENTRY POINTS ─────────────────────────────────────────────
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function doOptions(e) {
  // Handle CORS preflight requests with proper headers
  const output = ContentService.createTextOutput('');
  output.setMimeType(ContentService.MimeType.TEXT);
  
  // Add explicit CORS headers for preflight
  output.addHeader('Access-Control-Allow-Origin', '*');
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  output.addHeader('Access-Control-Max-Age', '86400');
  
  return output;
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

// Helper to build JSON response with explicit CORS headers
function buildJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  
  // Add explicit CORS headers
  output.addHeader('Access-Control-Allow-Origin', '*');
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  output.addHeader('Access-Control-Max-Age', '86400');
  
  return output;
}

// ── ACTIONS ──────────────────────────────────────────────────
function addExpense(data) {
  Logger.log("[GAS] addExpense called with: " + JSON.stringify(data));
  
  if (!data.title)  {
    Logger.log("❌ Missing title");
    throw new Error("title is required");
  }
  if (!data.amount) {
    Logger.log("❌ Missing amount");
    throw new Error("amount is required");
  }

  try {
    // Extract month from date (YYYY-MM format)
    const date = data.date || new Date().toISOString();
    const month = extractMonth(date);
    
    // Get or create sheet for this month
    const sheet = getOrCreateMonthSheet(month);
    Logger.log("[GAS] Using sheet: " + sheet.getName());
    
    const id = Utilities.getUuid();
    const row = [
      id,
      date,
      data.title,
      data.category || "Other",
      parseFloat(data.amount),
      data.notes || ""
    ];

    Logger.log("[GAS] Appending row to " + month + ": " + JSON.stringify(row));
    sheet.appendRow(row);
    
    const result = { ok: true, expense: rowToObj(row) };
    Logger.log("[GAS] ✓ Expense added to sheet " + month + ": " + data.title);
    return result;
  } catch (err) {
    Logger.log("❌ [GAS] addExpense error: " + err.message);
    throw err;
  }
}

function getExpenses(params) {
  Logger.log("[GAS] getExpenses called with params: " + JSON.stringify(params));
  
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let allRows = [];
    
    // Get all sheets and collect data
    const sheets = ss.getSheets();
    Logger.log("[GAS] Found " + sheets.length + " sheets");
    
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const sheetName = sheet.getName();
      
      // Skip non-month sheets (like "Form Responses" or default sheets)
      if (!/^\d{4}-\d{2}$/.test(sheetName)) {
        Logger.log("[GAS] Skipping non-month sheet: " + sheetName);
        continue;
      }
      
      // Get all data from the sheet
      const range = sheet.getDataRange();
      const values = range.getValues();
      
      Logger.log("[GAS] Sheet " + sheetName + " has " + values.length + " rows");
      
      // Skip header row
      for (let row = 1; row < values.length; row++) {
        const rowData = values[row];
        if (rowData[0]) { // If ID exists
          allRows.push(rowToObj(rowData));
        }
      }
    }
    
    Logger.log("[GAS] Total expenses loaded: " + allRows.length);
    
    // Apply filters
    let results = allRows;
    
    if (params.category && params.category !== "All") {
      Logger.log("[GAS] Filtering by category: " + params.category);
      results = results.filter(e => e.category === params.category);
    }
    
    if (params.search) {
      Logger.log("[GAS] Filtering by search: " + params.search);
      const search = params.search.toLowerCase();
      results = results.filter(e => 
        e.title.toLowerCase().includes(search) || 
        (e.notes || "").toLowerCase().includes(search)
      );
    }
    
    // Sort by date descending
    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    Logger.log("[GAS] Returned " + results.length + " expenses");
    
    return { ok: true, expenses: results };
  } catch (err) {
    Logger.log("❌ [GAS] getExpenses error: " + err.message);
    throw err;
  }
}

function deleteExpense(id) {
  Logger.log("[GAS] deleteExpense called with id: " + id);
  
  try {
    if (!id) {
      Logger.log("❌ deleteExpense: id is required");
      throw new Error("id is required");
    }
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheets = ss.getSheets();
    
    // Search across all month sheets
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const sheetName = sheet.getName();
      
      // Skip non-month sheets
      if (!/^\d{4}-\d{2}$/.test(sheetName)) continue;
      
      const range = sheet.getDataRange();
      const values = range.getValues();
      
      Logger.log("[GAS] Looking for id=" + id + " in sheet " + sheetName);
      
      // Search for the expense (skip header row at index 0)
      for (let row = 1; row < values.length; row++) {
        if (values[row][0] === id) {
          // Delete this row (row index is 0-based, so row+1 for deleteRow)
          sheet.deleteRow(row + 1);
          Logger.log("[GAS] ✓ Deleted expense " + id + " from sheet " + sheetName + " at row " + (row + 1));
          return { ok: true, deleted: id };
        }
      }
    }

    Logger.log("❌ Expense not found: " + id);
    return { ok: false, error: "Expense not found: " + id };
  } catch (err) {
    Logger.log("❌ deleteExpense error: " + err.message);
    throw err;
  }
}

function getMonthlyReport(params) {
  try {
    const month = params.month || getCurrentMonth();
    Logger.log("[GAS] getMonthlyReport for month: " + month);
    
    const { expenses } = getExpenses({ month });
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

// Get spreadsheet metadata (sheet names,  IDs, etc.)
// Get or create a sheet for a given month (YYYY-MM format)
function getOrCreateMonthSheet(month) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  let sheet = ss.getSheetByName(month);
  if (sheet) {
    Logger.log("[GAS] Found existing sheet: " + month);
    return sheet;
  }
  
  Logger.log("[GAS] Creating new sheet: " + month);
  sheet = ss.insertSheet(month);
  
  // Add headers
  sheet.appendRow(HEADERS);
  
  // Format header row
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  
  Logger.log("[GAS] ✓ Sheet created: " + month);
  return sheet;
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
  
  // Check 2: Can access spreadsheet
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    Logger.log("✓ Spreadsheet access OK");
  } catch (err) {
    Logger.log("❌ Cannot access spreadsheet: " + err.message);
    Logger.log("   → Check SHEET_ID is correct");
    return;
  }
  
  // Check 3: Can create/access monthly sheets
  try {
    const month = getCurrentMonth();
    const sheet = getOrCreateMonthSheet(month);
    Logger.log("✓ Sheet access/creation OK: " + month);
  } catch (err) {
    Logger.log("❌ Cannot create sheet: " + err.message);
    return;
  }
  
  // Check 4: Try test add/get
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