# Expense Tracker Sync - What Was Fixed

## The Problem
Expenses weren't syncing to Google Sheets, with no clear feedback about what was failing.

## Root Causes
1. **No error handling** - API calls failed silently
2. **No retry logic** - One failure = permanent failure
3. **No logging** - Impossible to debug
4. **Service Worker issues** - Confused about API endpoints
5. **GitHub Pages incompatibility** - Path issues with service worker
6. **CORS problems** - Fetch calls didn't explicitly handle cross-origin

## What Was Fixed

### 1. Better Error Handling
**Before**: Expenses disappeared into a void with no feedback
**After**: Every action is logged to the console with details:
```
[API] Posting (attempt 1/3): addExpense
[API] Post successful: addExpense
```

### 2. Automatic Retries
**Before**: One network hiccup = loss of data
**After**: Automatically retries up to 3 times:
- GET requests: 1-second delays between retries
- POST requests: 1.5-second delays between retries

### 3. Request Timeouts
**Before**: Requests could hang forever
**After**: 
- GET requests timeout after 10 seconds
- POST requests timeout after 15 seconds

### 4. Service Worker Communication
**Before**: SW had hardcoded API URL
**After**: SW gets API_URL from main app via postMessage, stays in sync

### 5. Manual Sync Trigger
**Before**: Had to wait for online event to sync
**After**: Changing API URL in Settings triggers automatic sync attempt

### 6. Queue Persistence
**Before**: Partial failures would lose some expenses
**After**: Only successfully synced items are removed from queue

---

## How to Use

### Monitor Sync (Console)
Open DevTools (`F12`) → **Console** tab to see what's happening:

```
// When adding an expense:
[App] Service Worker registered
[App] Pinging API...
[App] Ping result: OK
[API] Posting (attempt 1/3): addExpense
[API] Post successful: addExpense
Expense added ✓

// When offline, syncing later:
[App] Coming online, flushing queue
[Queue] Starting sync for 2 expense(s)
[Queue] Syncing expense 1/2: Coffee
[Queue] ✓ Synced: Coffee
[Queue] Syncing expense 2/2: Lunch
[Queue] ✓ Synced: Lunch
Synced 2 expenses ✓
```

### Troubleshooting with Logs
If sync fails:
1. Open Console (F12)
2. Look for `[API]` or `[Queue]` errors
3. Check Network tab for HTTP status codes
4. See SYNC_DEBUG.md for detailed guide

### Setting Up Google Apps Script
See **README.md** for complete setup, but key points:
1. Create Google Sheet with headers
2. Create Google Apps Script with provided code
3. Replace SHEET_ID with your actual ID
4. Deploy as "Web app" with "Anyone" access
5. Test the URL with `?action=ping`

---

## Console Log Prefixes

When debugging, look for these prefixes:

| Prefix | Meaning |
|--------|---------|
| `[App]` | Main application events |
| `[API]` | API call details |
| `[Queue]` | Offline queue sync |
| `[Settings]` | Settings changes |
| `[SW]` | Service Worker events |

---

## Testing Sync

### Test 1: Add Expense Online
1. Green dot in header
2. Add an expense
3. Look in Console for `[API] Post successful`
4. Check Google Sheet — data should appear

### Test 2: Add Expense Offline
1. Disconnect internet (or use DevTools throttling)
2. Add an expense
3. Red bar appears at top ("No connection")
4. Expense shows with "pending sync" in Records tab
5. Look in Console for `[Queue] Queued expense`

### Test 3: Sync When Back Online
1. Reconnect internet (or turn off throttling)
2. Watch Console for `[Queue] Starting sync`
3. Data should sync to Google Sheet

### Test 4: Queue Persistence
1. Go offline
2. Add 3 expenses
3. Refresh the page (hard refresh: Ctrl+Shift+R)
4. Go online
5. Expenses should sync

---

## What Each Part Does

```
BROWSER ──┐
  │       └─→ SW.js (Service Worker)
  │           ├─ Caches app shell
  │           ├─ Routes API calls
  │           └─ Handles offline
  │
  ├─→ index.html (App)
  │   ├─ Detects online/offline
  │   ├─ Calls apiPost() for sync
  │   └─ Manages offline queue
  │
  └──→ Google Apps Script (Backend)
      ├─ doPost() - receives expenses
      ├─ doGet() - serves data
      └─ Writes to Google Sheet
```

---

## New Features

### 1. Console Logging
Full visibility into what's happening — essential for debugging

### 2. Retry Logic
Automatically retries failed API calls multiple times

### 3. Timeouts
Prevents hanging requests from blocking the queue

### 4. Service Worker Sync
SW now properly aware of configured API_URL

### 5. Manual Sync Trigger
Change API URL in Settings to manually trigger queue flush

---

## Files Changed

- **sw.js** - Better offline support + logging
- **index.html** - Improved API calls, retries, logging
- **README.md** - Complete setup guide  
- **SYNC_DEBUG.md** - Debugging troubleshooting guide

---

## Next Steps

1. **Set up your Google Apps Script** (see README.md)
2. **Test the connection** in Settings (green dot)
3. **Monitor the Console** while using the app
4. **Check Google Sheet** for synced data
5. **Enable Service Worker** (happens automatically)

---

## Questions?

- **How do I debug sync issues?** → See SYNC_DEBUG.md
- **How do I set up Google Sheets?** → See README.md
- **What are the console logs telling me?** → Check the tables above
- **Why did my expenses not sync?** → Check Console + Network tabs

The app should now properly sync expenses with clear feedback and automatic retries.
