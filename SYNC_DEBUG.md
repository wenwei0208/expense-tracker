# Sync Debugging Guide

If expenses aren't syncing to Google Sheets, follow this guide.

## Step 1: Check Your Setup

### Is the API URL configured?
1. Open the app in your browser
2. Look at the top-right corner of the header
3. You should see a **colored dot**:
   - 🟢 **Green** = API connected ✓
   - 🔴 **Red** or 🔘 **Gray** = API not set or fails

If it's red/gray, go to **Settings** (⚙) and check:
- Is the "Google Apps Script URL" field filled?
- Is it the correct URL from your deployment?

### Test the Connection
1. In Settings, paste your Google Apps Script URL
2. Click **Test connection**
3. Wait a few seconds
4. The dot should turn green

---

## Step 2: Enable Browser Console Logging

This is crucial for debugging. Open **Developer Tools**:
- **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I`
- **Firefox**: Press `F12`
- **Safari**: Press `Cmd+Option+I`

Go to the **Console** tab. You'll see detailed logs like:
```
[App] Service Worker registered
[API] Posting (attempt 1/3): addExpense
[API] Post successful: addExpense
[Queue] Starting sync for 2 expense(s)
```

---

## Step 3: Add an Expense and Watch the Logs

1. Open the Console tab (keep it visible)
2. Go to the **Add** tab
3. Enter an expense:
   - Title: "Test expense"
   - Amount: 5.00
   - Category: Any
4. Click **Add expense**

### What Should Happen:

**ONLINE (green dot):**
```
[API] Posting (attempt 1/3): addExpense
[API] Post successful: addExpense
```
Then the expense appears in "Recent" and is sent to Google Sheets.

**OFFLINE (red bar shows at top):**
```
[Queue] Queued expense: Test expense | Queue size: 1
Saved offline — will sync
```
The expense is saved locally and will sync when online.

---

## Step 4: Check the Google Apps Script URL

Your URL should look like:
```
https://script.google.com/macros/s/AKfycbxXXXXXXXXXXXXXXXXXXXX/exec
```

**Do NOT include** `?v=1` or anything after `/exec`.

---

## Step 5: Verify Your Google Apps Script

### Is it deployed as a "Web App"?
1. Go to your [Google Apps Script project](https://script.google.com)
2. Click **Deployments** (right panel)
3. You should see "New deployment → Web app"
4. The deployment type must be **Web app**, NOT just "Script"

### Is the access set to "Anyone"?
1. In Deployments, click on your web app URL
2. Look at "Who has access"
3. It should say: **"Anyone"** (not "Only myself")
4. If not, delete the deployment and create a new one with "Anyone"

### Did you replace the SHEET_ID?
In your script's `Code.gs`, line 2 should have your real Sheet ID:
```javascript
const SHEET_ID = "1abc...xyz"; // This must be your actual ID
```

Test if the API responds:
1. Copy your API URL
2. Edit it to test: Add `?action=ping` at the end
3. Paste the full URL in your browser's address bar
4. Press Enter
5. You should see:
   ```json
   {"ok": true}
   ```

If you see an error or blank page, your Google Apps Script isn't set up correctly.

---

## Step 6: Check the Browser Network Tab

1. Open DevTools → **Network** tab
2. Filter to show only `Fetch`
3. Add an expense or manually test sync
4. Look for requests to `script.google.com`
5. Click on each request and check:
   - **Status**: Should be `200` (not 404, 403,500)
   - **Response**: Should show `{"ok":true}` or similar

**Common Issues:**
- `404`: URL is wrong
- `403`: Google Apps Script access denied (check "Anyone" setting)
- `500`: Error in your Google Apps Script code
- `No request appears`: API_URL not set or network error

---

## Step 7: Check if Expenses are Actually in Google Sheets

1. Open your Google Sheet
2. Go to the sheet named "Expenses"
3. Look at the rows — do you see your test expenses?

If yes, ✓ Sync is working!
If no, the Google Apps Script code might have an issue.

---

## Step 8: Manual Queue Flush

If you have queued expenses waiting to sync:

1. Go to **Settings** (⚙)
2. Change the API URL to something else, then back to the correct URL
3. The app should attempt to flush the queue automatically
4. Watch the console for sync logs

---

## Debug Checklist

- [ ] API URL is set in Settings
- [ ] Test connection shows a green dot
- [ ] Google Apps Script is deployed as "Web app"
- [ ] Deployment has "Anyone" access
- [ ] Sheet ID is correct in your script
- [ ] Testing `?action=ping` URL returns `{"ok":true}`
- [ ] Network tab shows `200` status for API calls
- [ ] Browser console shows `[API] Post successful`
- [ ] Expenses appear in Google Sheet
- [ ] No CORS errors in console

---

## Common Error Messages

### "Set your API URL in Settings"
- **Fix**: Go to Settings and paste your Google Apps Script URL

### "Connection failed — check URL"
- **Fix**: 
  1. Check the URL is correct (copy from deployment again)
  2. Make sure it ends with `/exec` (not `/exec?v=1` or anything else)
  3. Verify the script is deployed as "Web app" with "Anyone" access

### "Could not reach API (offline)"
- **Cause**: You're offline OR the URL is wrong
- **Fix**: Check your internet, then verify URL

### CORS errors in console
- **Cause**: Google Apps Script not deployed correctly
- **Fix**: 
  1. Delete the current deployment
  2. Create a new one → **Web app** → **Anyone**

---

## Advanced: Check Service Worker

The Service Worker (sw.js) helps with offline support. To check if it's working:

1. Open DevTools → **Application** tab
2. Look for **Service Workers** on the left
3. You should see one listed with status "activated and running"
4. If not, refresh the page
5. Open **Storage** → **Cache Storage** → Look for `expense-tracker-v1`

The service worker will:
- Serve the app when offline
- Queue API requests when offline
- Attempt to sync when online

---

## Need Help?

Share these details when asking for help:
1. What URL are you using?
2. The error message from DevTools Console
3. The Network tab showing the failed request
4. Screenshot of your Google Sheet

Check the [main README](./README.md) for setup instructions.
