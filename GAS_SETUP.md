# Google Apps Script Setup Guide

## ⚠️ The Main Issue

Your Google Apps Script wasn't syncing because **it didn't have a Sheet ID configured**. The old code used `getActiveSpreadsheet()` which only works if the script is bound directly to a sheet—not for standalone web apps deployed from script.google.com.

**The fix:** Use `SpreadsheetApp.openById(SHEET_ID)` instead.

---

## Step 1: Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click "Create New Spreadsheet"
3. Name it "Expenses" (or any name you like)
4. Look at the URL:
   ```
   https://docs.google.com/spreadsheets/d/1abc...xyz/edit
                                              ^^^^^^^^^^^^^^^^
                                              Copy this part
   ```

---

## Step 2: Update Your Google Apps Script

1. Go to your Google Apps Script project
2. Open `Code.gs` (or the file with the script code)
3. **Find line 7:**
   ```javascript
   const SHEET_ID     = ""; // ← Paste your Sheet ID here
   ```
4. **Replace the empty quotes with your Sheet ID:**
   ```javascript
   const SHEET_ID     = "1abc...xyz"; // Your actual Sheet ID
   ```
5. Click **Save** (or Ctrl+S)

---

## Step 3: Test Your Setup

1. In the Google Apps Script editor
2. Look for **"Select function"** dropdown (top center)
3. Choose **"testSetup"** instead of whatever is selected
4. Click the **▶ Run button**
5. A popup will ask for permissions—click **Allow**
6. Look at the **Execution log** (bottom) for results

### ✅ Good Output:
```
✓ SHEET_ID configured: 1abc...
✓ Sheet access OK: 2024-03
✓ Sheet headers OK: ID | Date | Title | Category | Amount | Notes
✓ addExpense works! Expense ID: abc123...
✓ getExpenses works! Found 1 expenses across all months
========== SETUP COMPLETE ==========
📋 Sheets are now organized by month (YYYY-MM format)
✅ New monthly sheets will be created automatically
```

**Note:** Sheets are created by MONTH (2024-03, 2024-04, etc.). When you add expenses, a new sheet is created automatically for each month.

### ❌ Bad Output Examples:
```
❌ SHEET_ID is NOT configured
   → Update line 7 in googleAppsScripts.js with your Sheet ID
```
**Fix:** Make sure you pasted the Sheet ID in line 7

```
❌ Cannot access sheet: Spreadsheet not found
```
**Fix:** 
- Your Sheet ID is wrong (copy it again from the URL)
- The spreadsheet doesn't exist
- Grant access if prompted

```
❌ Sheet headers don't match
```
**Fix:** Your sheet has the wrong column headers. They should be:
```
ID | Date | Title | Category | Amount | Notes
```

---

## Step 4: Deploy the Google Apps Script

1. Click **"Deploy"** button (top right)
2. Click **"New deployment"**
3. Click the **⚙ (gear icon)**
4. Select **"Web app"** from the dropdown
5. Set:
   - **Execute as:** Your email
   - **Who has access:** **Anyone** (this is important!)
6. Click **Deploy**
7. Copy the **Deployment URL** (looks like `https://script.google.com/macros/s/AKfy.../exec`)

---

## Step 5: Configure Your Expense Tracker App

1. Open your Expense Tracker app
2. Go to **Settings** (⚙ icon, bottom right)
3. In **"Google Apps Script URL"** field, paste the deployment URL
4. Click **"Test connection"**

### Result:
- 🟢 **Green dot** = Success! Everything is connected
- 🔴 **Red dot** = Something is wrong, see troubleshooting below

---

## 🎯 Important: Monthly Sheets Feature

Your app now automatically creates a new Google Sheet for each month!

When you add an expense:
1. The script extracts the month from the date
2. Creates a sheet named like `2024-03`, `2024-04`, etc.
3. Adds your expense to the correct month's sheet

**You don't need to create sheets manually** — it happens automatically!

Example of your Google Sheets after using the app:
```
📊 Expenses Spreadsheet
├── 2024-01  ← January expenses (created automatically)
├── 2024-02  ← February expenses (created automatically)
├── 2024-03  ← March expenses (created automatically)
└── 2024-04  ← April expenses (created automatically)
```

For more details, see [MONTHLY_SHEETS.md](./MONTHLY_SHEETS.md)

---

## Step 6: Test Adding an Expense

1. In the app, go to the **"Add"** tab
2. Add a test expense:
   - Title: "Test"
   - Amount: 5.00
   - Category: Any
3. Click "Add expense"
4. Open your Google Sheet and refresh
5. **A new sheet tab should appear** with the month (e.g., "2024-03")
6. You should see the expense in row 2 of that new sheet

If it appears ✅, you're done! Sync is working with monthly sheets.

If you add expenses from different months, new sheets will be created automatically for each month. ✨

If it appears ✅, you're done! Sync is working.

---

## Troubleshooting

### "Connection failed — check URL"
1. **Check the URL** - Make sure it ends with `/exec` (not `/exec?v=1`)
2. **Verify it's deployed as "Web app"** not "Script"
3. **Check "Who has access"** - Should be **"Anyone"**, not "Only myself"
4. **Try running testSetup()** again in the Google Apps Script console

### No data appears in Google Sheet after adding expense
1. Open the Google Apps Script console
2. Go to **View** → **Execution logs** (bottom)
3. Look for errors like:
   - `❌ SHEET_ID not configured` → Update line 7
   - `❌ Cannot access sheet` → Check SHEET_ID is correct
   - `❌ [GAS] addExpense error` → Check error details

### Expenses appear in app but not in Google Sheet
1. **They might be in local cache** - The app stores them locally first
2. **Check the sheet has the right columns:**
   ```
   A: ID  |  B: Date  |  C: Title  |  D: Category  |  E: Amount  |  F: Notes
   ```
3. **Refresh your Google Sheet** (Ctrl+R or F5)
4. **Check the Execution logs** in Google Apps Script

### "ERR_TIMED_OUT" in browser console
1. The Google Apps Script is taking too long to respond
2. It might be creating the sheet for the first time
3. Wait a moment and try again
4. Check the Execution log for errors

---

## Debug Checklist

- [ ] SHEET_ID pasted in line 7 of googleAppsScripts.js
- [ ] testSetup() runs successfully (green checks)
- [ ] Script deployed as "Web app" (not "Script")
- [ ] Deployment has "Anyone" access
- [ ] Updated app with correct deployment URL
- [ ] Test connection shows green dot
- [ ] Can add expense in app
- [ ] Expense appears in Google Sheet

---

## Example File Structure

Your Google Sheet should look like this:

| A | B | C | D | E | F |
|---|---|---|---|-----|-------|
| ID | Date | Title | Category | Amount | Notes |
| abc-123 | 2024-03-30T12:00:00Z | Coffee | Food & drinks | 5.5 | Grande latte |
| def-456 | 2024-03-30T13:00:00Z | Grab | Transport | 12.0 | Home to office |

The app will automatically:
- Create column A (ID) with unique IDs
- Add dates in column B
- Add titles, categories, amounts, and notes
- Keep adding new rows

---

## Running Execution Logs

To see what's happening in your script:

1. In Google Apps Script editor
2. Click **View** → **Execution logs** (bottom panel)
3. You'll see timestamps with log messages like:
   ```
   [GAS] Action: addExpense
   [GAS] ✓ Expense added successfully: Coffee
   ```

This shows exactly what's happening on the server side.

---

## Questions?

If it still doesn't work:
1. Check the **Execution logs** in Google Apps Script
2. Check the browser **Console** (F12) for errors
3. Make sure the Sheet ID is correct
4. Verify the deployment URL is correct
5. Check that deployment says "Anyone" has access

---

## Security Note

This setup allows **anyone with the URL** to add/read/delete expenses. For production, you might want to add authentication. For now, it's fine for personal use—just don't share the URL publicly.
