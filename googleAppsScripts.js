// ============================================================
//  EXPENSE TRACKER — Google Apps Script Backend (CORS enabled)
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
// 🔴 YOU MUST SET THIS: Copy your Google Sheet ID here
const SHEET_ID     = "1CnIHN6ObrP1BVDV7qaijWzEQIHCgDcEo3-MtSUzjbfM"; // ← Paste your Sheet ID here (from URL)
const HEADERS      = ["ID", "Date", "Title", "Category", "Amount", "Notes"];

// Validate on startup
function onOpen() {
  if (!SHEET_ID || SHEET_ID.trim() === "") {
    Logger.log("❌ ERROR: SHEET_ID is not set! Update line 7 in Code.gs");
  } else {
    Logger.log("✓ Sheet ID is configured: " + SHEET_ID);
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
  // Handle CORS preflight requests
  return buildJsonResponse({ ok: true });
}

// ── HANDLE REQUEST WITH CORS ─────────────────────────────────
function handleRequest(e) {
  try {
    // Validate SHEET_ID first
    if (!SHEET_ID || SHEET_ID.trim() === "") {
      Logger.log("❌ SHEET_ID not configured!");
      return buildJsonResponse({ ok: false, error: "SHEET_ID not configured. Update line 7 with your Sheet ID." });
    }

    // Parse params and body
    const params = e.parameter || {};
    const body   = e.postData ? JSON.parse(e.postData.contents || "{}") : {};
    const action = params.action || body.action;

    Logger.log("[GAS] Action: " + action + ", Body: " + JSON.stringify(body).substring(0, 100));

    let result;
    switch (action) {
      case "addExpense":    result = addExpense(body);            break;
      case "getExpenses":   result = getExpenses(params);         break;
      case "deleteExpense": result = deleteExpense(body.id);      break;
      case "getMonthly":    result = getMonthlyReport(params);    break;
      case "ping":          result = { ok: true, msg: "alive" };  break;
      default:
        result = { ok: false, error: "Unknown action: " + action };
    }

    Logger.log("[GAS] Result: " + JSON.stringify(result).substring(0, 100));
    return buildJsonResponse(result);
  } catch (err) {
    Logger.log("❌ [GAS] Error: " + err.message);
    return buildJsonResponse({ ok: false, error: err.message });
  }
}

// Helper to build JSON response (CORS is automatic for Apps Script web apps)
function buildJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
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
    const month = extractMonth(date); // e.g., "2024-03"
    
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
  try {
    let expenses = [];
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheets = ss.getSheets();
    
    // If searching for a specific month, only search that sheet
    if (params.month) {
      const sheet = ss.getSheetByName(params.month);
      if (!sheet) {
        Logger.log("[GAS] No sheet found for month: " + params.month);
        return { ok: true, expenses: [] };
      }
      const rows = sheet.getDataRange().getValues();
      if (rows.length > 1) {
        expenses = rows.slice(1).map(rowToObj);
      }
      Logger.log("[GAS] Found " + expenses.length + " expenses in sheet " + params.month);
    } else {
      // Search across ALL sheets (for Records tab which shows all)
      for (const sheet of sheets) {
        const sheetName = sheet.getName();
        // Skip "Config" or other non-month sheets (month sheets are like "2024-03")
        if (!sheetName.match(/^\d{4}-\d{2}$/)) continue;
        
        const rows = sheet.getDataRange().getValues();
        if (rows.length > 1) {
          const sheetExpenses = rows.slice(1).map(rowToObj);
          expenses = expenses.concat(sheetExpenses);
          Logger.log("[GAS] Added " + sheetExpenses.length + " from sheet " + sheetName);
        }
      }
      Logger.log("[GAS] Total expenses from all sheets: " + expenses.length);
    }

    if (params.category && params.category !== "All") {
      const before = expenses.length;
      expenses = expenses.filter(e => e.category === params.category);
      Logger.log("[GAS] Filtered by category " + params.category + ": " + before + " → " + expenses.length);
    }
    
    if (params.search) {
      const q = params.search.toLowerCase();
      const before = expenses.length;
      expenses = expenses.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.notes || "").toLowerCase().includes(q)
      );
      Logger.log("[GAS] Filtered by search: " + before + " → " + expenses.length);
    }

    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    Logger.log("[GAS] ✓ Returning " + expenses.length + " expenses");
    return { ok: true, expenses };
  } catch (err) {
    Logger.log("❌ [GAS] getExpenses error: " + err.message);
    throw err;
  }
}

function deleteExpense(id) {
  try {
    if (!id) {
      Logger.log("❌ deleteExpense: id is required");
      throw new Error("id is required");
    }
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheets = ss.getSheets();
    
    // Search across all sheets for this expense ID
    for (const sheet of sheets) {
      const sheetName = sheet.getName();
      // Only search month sheets (format: YYYY-MM)
      if (!sheetName.match(/^\d{4}-\d{2}$/)) continue;
      
      const data = sheet.getDataRange().getValues();
      Logger.log("[GAS] Looking for id=" + id + " in sheet " + sheetName);
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
          sheet.deleteRow(i + 1);
          Logger.log("[GAS] ✓ Deleted expense " + id + " from sheet " + sheetName);
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

// Get or create a sheet for a specific month (e.g., "2024-03")
function getOrCreateMonthSheet(month) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(month);
    
    if (!sheet) {
      Logger.log("[GAS] Creating new sheet for month: " + month);
      sheet = ss.insertSheet(month);
      // Add headers
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
      Logger.log("[GAS] ✓ Sheet created: " + month);
    }
    
    return sheet;
  } catch (err) {
    Logger.log("❌ [GAS] getOrCreateMonthSheet() error: " + err.message);
    throw new Error("Failed to access/create sheet for month " + month + ": " + err.message);
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
    Logger.log("   → Update line 7 in googleAppsScripts.js with your Sheet ID");
    Logger.log("   → Find it in Google Sheets URL: docs.google.com/spreadsheets/d/[ID]/edit");
    return;
  }
  Logger.log("✓ SHEET_ID configured: " + SHEET_ID.substring(0, 20) + "...");
  
  // Check 2: Can create/access monthly sheets
  try {
    const month = getCurrentMonth();
    const sheet = getOrCreateMonthSheet(month);
    Logger.log("✓ Sheet access OK: " + sheet.getName());
  } catch (err) {
    Logger.log("❌ Cannot access/create sheet: " + err.message);
    Logger.log("   → Check SHEET_ID is correct");
    Logger.log("   → Ensure Google Apps Script has access to the spreadsheet");
    return;
  }
  
  // Check 3: Headers exist
  try {
    const month = getCurrentMonth();
    const sheet = getOrCreateMonthSheet(month);
    const headers = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    const headersMatch = headers.join(",") === HEADERS.join(",");
    if (headersMatch) {
      Logger.log("✓ Sheet headers OK: " + headers.join(" | "));
    } else {
      Logger.log("⚠ Sheet headers don't match:");
      Logger.log("  Expected: " + HEADERS.join(" | "));
      Logger.log("  Found:    " + headers.join(" | "));
    }
  } catch (err) {
    Logger.log("❌ Error checking headers: " + err.message);
  }
  
  // Check 4: Try test add/get
  try {
    Logger.log("\n--- Testing addExpense (auto-creates monthly sheet) ---");
    const testExpense = {
      title: "✓ Test Expense " + new Date().getTime(),
      amount: 12.34,
      category: "Food & drinks",
      date: new Date().toISOString(),
      notes: "Automated test"
    };
    const addResult = addExpense(testExpense);
    if (addResult.ok) {
      Logger.log("✓ addExpense works! Expense ID: " + addResult.expense.id);
    } else {
      Logger.log("❌ addExpense failed: " + addResult.error);
    }
    
    Logger.log("\n--- Testing getExpenses ---");
    const getResult = getExpenses({});
    if (getResult.ok) {
      Logger.log("✓ getExpenses works! Found " + getResult.expenses.length + " expenses across all months");
    } else {
      Logger.log("❌ getExpenses failed: " + getResult.error);
    }
  } catch (err) {
    Logger.log("❌ Test error: " + err.message);
  }
  
  Logger.log("\n========== SETUP COMPLETE ==========");
  Logger.log("📋 Sheets are now organized by month (YYYY-MM format)");
  Logger.log("✅ New monthly sheets will be created automatically as you add expenses");
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