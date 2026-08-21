# Piyare Mobile Telecom v5.1 — Production setup

## Important
This package is production-oriented, but deployment must happen inside YOUR Google account. I cannot deploy into your Drive/Sheets account from this chat.

## 1. Create the Google Sheet
Create one empty Google Sheet and copy its spreadsheet ID.

## 2. Create two Google Drive folders
- `PMT-Media` — public-view only for website images.
- `PMT-Backups` — PRIVATE. Never enable public link sharing.

Copy both folder IDs.

## 3. Apps Script
Open the Sheet → Extensions → Apps Script.
Replace the script with `backend/Code.gs`.

Run this function once from Apps Script:

`setupPMT("SPREADSHEET_ID","MEDIA_FOLDER_ID","BACKUP_FOLDER_ID","owner","YOUR_STRONG_PASSWORD","Owner")`

Use a strong unique password of at least 10 characters. Do not put it into the website.

The function creates the required sheets automatically.

## 4. Deploy API
Deploy → New deployment → Web app.
- Execute as: Me
- Access: Anyone

Copy the `/exec` URL.

The public website uses GET only for public content/repair tracking. Admin GET endpoints require a valid session token. Admin writes require a valid session and server-side role authorization.

## 5. Website API URL
Open `/admin/login.html`, paste the `/exec` URL and sign in.

## 6. Static hosting
Upload the website files to your hosting provider. Do NOT upload a separate `.env` containing secrets.

## 7. Security checklist before launch
- Keep the backup folder private.
- Keep spreadsheet sharing restricted to the owner/staff who need it.
- Do not publish the Apps Script source.
- Do not put Drive IDs, Sheet IDs, passwords or WhatsApp API keys in frontend JS.
- Use HTTPS hosting.
- Use a custom domain if available.
- Change the owner password after initial setup.
- Create staff accounts from Control Room instead of sharing the owner password.
- Test login, logout, session expiry, upload, backup and restore before accepting real orders.

## WhatsApp automation
The v5 control room records notification events. Actual automated WhatsApp messages require a WhatsApp Business API/provider account. Store its credentials only in Apps Script Properties and call the provider from Apps Script. Never put the provider token in HTML/JS.

## 8. Automatic backups and low-stock alerts
After `setupPMT(...)`, run `installProductionTriggers()` once in Apps Script. This creates:
- daily private Drive backup
- low-stock check every 6 hours

Optional owner email alerts use Script Property `PMT_ALERT_EMAIL`.

Optional WhatsApp automation uses `PMT_WA_WEBHOOK_URL` as a server-side webhook. The provider/API credentials must stay server-side. The webhook receives `{phone,message}`. If you do not configure it, notifications remain inside the Control Room and optional owner email.
