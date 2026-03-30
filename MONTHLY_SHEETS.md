# Monthly Sheets Feature

Your Google Apps Script now **automatically creates a new Google Sheet for each month**. This keeps your expenses organized by date.

## How It Works

### Before (Single Sheet)
```
Expenses sheet:
- January expense
- February expense  
- March expense
(All mixed together)
```

### After (Monthly Sheets)
```
2024-01 sheet:
- January expenses

2024-02 sheet:
- February expenses

2024-03 sheet:
- March expenses
(Organized by month!)
```

---

## Automatic Sheet Creation

When you add an expense, the script:

1. **Extracts the month** from the date (e.g., "2024-03")
2. **Checks if a sheet exists** for that month
3. **If not, creates it automatically** with headers
4. **Adds the expense** to the correct month's sheet

You **don't need to do anything** — sheets are created automatically!

---

## Sheet Naming Format

Sheets are named: **YYYY-MM** (e.g., `2024-03`, `2024-04`)

This format:
- ✅ Sorts chronologically (oldest first in the list)
- ✅ Is easy to read
- ✅ Matches your app's date format
- ✅ Works with the Reports feature

---

## Benefits

### 📁 Organization
- Keep annual records organized by month
- Easy to find expenses from a specific month
- Clear structure in Google Sheets

### 📊 Reports
- Click "Monthly Report" in your app
- Select the month you want
- Data is pulled from the correct monthly sheet automatically

### 📈 Scalability
- Works perfectly for years of expenses
- No performance issues even with thousands of entries
- Each sheet only contains one month's data

### 🔄 Bulk Operations
- In Google Sheets, you can:
  - Archive old month sheets
  - Export a single month as its own file
  - Share specific month sheets with others
  - Create formulas across months if needed

---

## What You'll See in Google Sheets

After adding expenses over a few months, your spreadsheet will have tabs like:

```
📊 Spreadsheet
├── 2024-01  (January expenses)
├── 2024-02  (February expenses)
├── 2024-03  (March expenses)
└── 2024-04  (April expenses)
```

Each sheet has columns:
```
A    | B              | C         | D           | E      | F
ID   | Date           | Title     | Category    | Amount | Notes
-----|----------------|-----------|-------------|--------|-------
abc  | 2024-03-01T... | Coffee    | Food & ... | 5.50   |
def  | 2024-03-05T... | Transport | Transport  | 12.00  |
...
```

---

## How to Use

### Adding Expenses
1. Open your Expense Tracker app
2. Add expense as usual
3. **The sheet is created automatically** for that month
4. Check your Google Sheet — new tabs appear!

### Viewing Monthly Data
1. In your app, go to **"Records"** or **"Report"**
2. Select a month
3. App automatically searches the correct sheet
4. See all expenses from that month

### Moving Expenses Between Months
If an expense date is wrong:
1. Open Google Sheets
2. Find the expense in the wrong month's sheet
3. Delete the row
4. Go back to your app and re-add with correct date
5. It goes to the right month automatically

### Exploring Historical Data
In Google Sheets, you can:
- Browse old month sheets
- View trends over time
- Export specific months
- Create pivot tables across months

---

## FAQs

**Q: Can I delete a monthly sheet?**
A: Yes! If you delete a sheet, those expenses won't appear in your app anymore. Be careful. Better to archive months you don't need.

**Q: What if I add an expense from 2023 in 2024?**
A: Perfect! A sheet named `2023-01` will be created automatically. It works for any date.

**Q: Can I have multiple sheets for the same month?**
A: No, the script prevents duplicates. If sheet `2024-03` exists, it reuses it.

**Q: How do I merge two months?**
A: In Google Sheets, copy/paste rows between sheets. The app will read from both normally.

**Q: What if I rename a sheet?**
A: The app expects format `YYYY-MM`. If you rename it differently, it might not find expenses. Better to leave sheet names as-is.

---

## Technical Details

### Sheet Creation Logic
```javascript
function getOrCreateMonthSheet(month) {
  // month = "2024-03"
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(month);  // Look for existing sheet
  
  if (!sheet) {
    // Doesn't exist, create it
    sheet = ss.insertSheet(month);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}
```

### Month Extraction
```javascript
function extractMonth(dateString) {
  // "2024-03-15T12:00:00Z" → "2024-03"
  const date = new Date(dateString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return yyyy + "-" + mm;
}
```

---

## Execution Logs

When you add an expense, check the Google Apps Script Execution Logs:

```
[GAS] Using sheet: 2024-03
[GAS] Appending row to 2024-03: [...]
[GAS] ✓ Expense added to sheet 2024-03: Coffee
```

---

## Troubleshooting

**Expense not appearing after adding?**
- Check Execution Logs in Google Apps Script
- Refresh your Google Sheet (Ctrl+R)
- Make sure the sheet was created (check tabs at bottom)

**Wrong sheet being used?**
- Check that expense date is correct
- The month is extracted from the date field
- If date is wrong, expense goes to wrong sheet

**Can't find a monthly sheet?**
- Scroll through the sheet tabs at the bottom
- Sheets are created as tabs, not separate files
- Look for format `YYYY-MM` (e.g., `2024-03`)

---

## Best Practices

✅ **DO:**
- Let the script create sheets automatically
- Use consistent date formats
- Only edit in Google Sheets if needed
- Archive old months periodically

❌ **DON'T:**
- Manually rename sheet tabs
- Delete sheets with data you need
- Edit the HEADERS row
- Share sensitive month sheets without permission

---

## Archiving Old Months

If you have too many sheet tabs, archive old months:

1. Right-click a monthly sheet tab
2. Choose "Copy to" → New spreadsheet
3. Name it "Expenses Archive 2023"
4. Delete the tab from your main sheet
5. Keep the archived spreadsheet for reference

---

## Summary

- ✅ Sheets created automatically by month
- ✅ Format: YYYY-MM (2024-03, 2024-04, etc.)
- ✅ Works with Reports and Records in the app
- ✅ Stays organized as you add years of data
- ✅ Easy to manage in Google Sheets

No manual sheet creation needed! Just add expenses and let the system organize them. 🎯
