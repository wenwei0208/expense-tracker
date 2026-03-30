# Expense Tracker PWA

A Progressive Web App for tracking daily expenses, scanning receipts with AI, and syncing to Google Sheets.

## Features

- ✅ **Add expenses** with amount, category, date, and notes
- 📷 **Scan receipts** using AI (Claude API)
- 📊 **Monthly reports** with charts and category breakdown
- 💾 **Offline-first** — works without internet, syncs when online
- 📤 **Export to Excel** — download monthly reports
- 🌐 **Progressive Web App** — install on mobile home screen
- 🔗 **Google Sheets sync** — automatically uploads expenses

## Setup Guide

### 1. Deploy on GitHub Pages

```bash
# Clone or fork this repo
git clone https://github.com/yourusername/expense-tracker.git
cd expense-tracker

# Commit and push to main/master branch
git add .
git commit -m "Initial commit"
git push origin main
```

Then enable GitHub Pages in your repository settings:
- Go to **Settings → Pages**
- Select **Deploy from a branch**
- Choose **main** (or your default branch)
- Click Save

Your app will be live at: `https://yourusername.github.io/expense-tracker/`

---

### 2. Set Up Google Apps Script for Sync

Your app needs a **Google Apps Script** to receive expense data. Follow these steps:

#### Step A: Create a Google Sheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet called "Expenses"
3. In the sheet, create these column headers in row 1:
   ```
   Date | Title | Category | Amount | Notes | Synced
   ```
4. Copy the Sheet ID from the URL (e.g., `1abc...xyz`)

#### Step B: Create a Google Apps Script  
1. Go to [Google Apps Script](https://script.google.com)
2. Click **Create Project**
3. Copy this code into `Code.gs`:

```javascript
// Get the Sheet ID - update this with your actual Sheet ID
const SHEET_ID = "YOUR_SHEET_ID_HERE";
const SHEET_NAME = "Expenses";

// Main endpoint handler
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'addExpense') {
      addExpenseToSheet(data);
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        expense: { id: Utilities.getUuid(), ...data }
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'deleteExpense') {
      deleteExpenseFromSheet(data.id);
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: false, error: "Unknown action"
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false, error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// GET endpoint for testing
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'ping') {
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getExpenses') {
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      expenses: readExpensesFromSheet()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    ok: false, error: "Unknown action"
  })).setMimeType(ContentService.MimeType.JSON);
}

function addExpenseToSheet(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  sheet.appendRow([
    data.date,
    data.title,
    data.category,
    data.amount,
    data.notes || '',
    new Date().toISOString()
  ]);
}

function deleteExpenseFromSheet(id) {
  // Optional: implement deletion logic
  // For now, expenses are just appended
}

function readExpensesFromSheet() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  const expenses = [];
  for (let i = 1; i < values.length; i++) { // Skip header row
    const row = values[i];
    if (row[0]) { // Only if date exists
      expenses.push({
        id: `sheet_${i}`,
        date: row[0],
        title: row[1],
        category: row[2],
        amount: parseFloat(row[3]) || 0,
        notes: row[4] || ''
      });
    }
  }
  return expenses;
}
```

4. Replace `YOUR_SHEET_ID_HERE` with your actual Sheet ID
5. Click **Deploy** → **New deployment**
   - Type: **Web app**
   - Execute as: Your email
   - Who has access: **Anyone**
6. Copy the **Deployment URL** (looks like `https://script.google.com/macros/s/AKfy.../exec`)

#### Step C: Configure the App
1. Go to your deployed Expense Tracker app
2. Click **⚙ Settings** (bottom tab)
3. Paste the Google Apps Script URL
4. Click **Test connection** — you should see a green dot

---

### 3. Optional: Set Up Receipt Scanning

To use AI receipt scanning:

1. Get an [Anthropic API key](https://console.anthropic.com/keys)
2. In **Settings**, paste your API key
3. Go to the **📷 Scan** tab and try scanning a receipt

---

## Troubleshooting

### Expenses aren't syncing to Google Sheets

**Check these:**
1. ✅ Is the API URL set in Settings? (Green dot should appear)
2. ✅ Can you "Test connection" successfully?
3. ✅ Are you online when adding expenses?
4. ✅ Check browser console (F12 → Console) for error messages

**If still failing:**
- Make sure your Google Apps Script is deployed as **"Web app"** with **"Anyone"** access
- Check the Sheet ID is correct
- Open DevTools (F12) and look at the console logs for details

### App won't install as PWA on mobile

- The app must be served over **HTTPS** (GitHub Pages does this automatically)
- If on desktop, look for "Install" in your browser menu
- On mobile, look for "Add to Home screen" in the browser menu

### Offline queue isn't syncing

The queue automatically syncs when:
- ✅ The app detects internet connection
- ✅ You navigate to any tab
- ✅ You come back online

You can also manually trigger sync by changing the API URL in Settings.

---

## File Structure

```
expense-tracker/
├── index.html      # Main app (HTML + CSS + JS)
├── sw.js           # Service Worker (offline support)
├── manifest.json   # PWA manifest
└── README.md       # This file
```

---

## How It Works

```
┌─────────────────────────────────────────────┐
│         Expense Tracker App                 │
│  (Runs in browser, stores locally)          │
└─────────────┬───────────────────────────────┘
              │
              ├─ ONLINE? ─→ Send to Google Apps Script ─→ Google Sheet
              │
              └─ OFFLINE? ─→ Queue locally, sync when online
```

## License

MIT
