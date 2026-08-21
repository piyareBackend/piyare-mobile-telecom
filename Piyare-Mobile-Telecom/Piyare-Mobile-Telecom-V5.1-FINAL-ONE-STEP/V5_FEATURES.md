# v5 owner features

## Google Drive + Sheets only
No dedicated database is required.

Sheets:
- SiteContent
- HomepageBlocks
- Products
- Orders
- Repairs
- Coupons
- Customers
- Reviews
- Feedback
- Notifications
- Users
- Analytics
- ActivityLog

Private Drive folders:
- Media
- Backups

## Notifications
Use an external WhatsApp provider only through a server-side API key stored in Apps Script Properties. Never put the API key in HTML/JS. Trigger:
- order received
- order confirmed
- order shipped/ready
- repair received
- repair diagnosis/estimate
- repair ready
- repair completed

For a free/low-cost setup, use owner notifications in the Control Room first; WhatsApp automation requires a WhatsApp Business API/provider.

## Backup
Snapshots are JSON exports stored in a private Drive folder. Before restore:
1. verify owner session
2. verify snapshot ID exists in the backup folder
3. validate expected sheet names/columns
4. create a pre-restore backup
5. restore transactionally as far as Apps Script permits
6. write an audit entry

## Homepage Block Manager
Each block has type, title, enabled flag, position and a controlled content payload. Do NOT allow arbitrary JavaScript or raw HTML from the owner panel.

## Security
Role permissions must be checked on the server, not merely hidden in the UI. Owner is the only role allowed to manage users, security, backups and restores.
