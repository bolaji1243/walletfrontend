# FastPay Frontend

This project is intentionally organized in a way that keeps current routes and relative paths working.

## Main structure

- `/index.html`
  Landing page
- `/css`
  Shared landing-page styles
- `/js`
  Shared scripts and app helpers
- `/signup`
  Authentication pages, styles, and scripts
- `/dashboard`
  Logged-in app pages, page-level styles, and page-level scripts

## Important active files

- `/js/fastpay-core.js`
  Shared frontend helper for API base URL, auth helpers, redirects, response parsing, and theme handling
- `/dashboard/dashboard.html`
  Main dashboard
- `/dashboard/saving.html`
  Savings overview
- `/dashboard/goals.html`
  Active goals page
- `/dashboard/deposit.html`
  Deposit flow

## Compatibility files kept on purpose

- `/goals.html`
  Redirects to `/dashboard/goals.html` so old links do not break
- `/dashboard/calendar.html`
  Redirects to `/dashboard/calender.html` so both spellings work
- `/dashboard/pin-modal.css`
  Imports `/dashboard/pin-model.css` so existing references keep working

## Safe structure rule

When cleaning this project further, prefer:

1. Adding compatibility files first
2. Updating references second
3. Renaming or moving originals only after every reference is confirmed

This keeps the app stable while the structure improves gradually.
