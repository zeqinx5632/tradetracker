# TradeTrack

A sleek trading journal designed for GitHub Pages.

## Included

- 3 tabs: Calendar, Analytics, Friends
- Calendar views: 1 Day, 1 Week, 1 Month, 1 Year, All Time
- Click a day to add multiple trades
- Each trade stores:
  - Profit/Loss dollar amount
  - Reason behind the trade
- Days automatically show green for profit and red for loss
- Analytics:
  - Cumulative P/L
  - Win rate
  - Total trades
  - Average trade
  - Winning/losing trades
  - Profit factor
  - Recent trade table
- Friends UI with usernames, friend requests, accept/decline, and performance-sharing setting
- Responsive layout for desktop and mobile
- Data persists in the browser using localStorage

## Run locally

Open `index.html` in a browser.

## Put it on GitHub Pages

1. Create a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md`.
3. In GitHub, open **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Select your main branch and `/root`.
6. Save. GitHub will provide your site URL.

## Important: real accounts and friends

GitHub Pages is static hosting. The included Friends tab is a functional local/demo interface, but it cannot actually send a request to another person's browser.

For real multi-user accounts, login, friend requests, and shared performance data, connect a backend such as Supabase or Firebase. The UI is intentionally separated so that this backend can be added without redesigning the site.

A production version should also add authentication, database rules, privacy controls, and server-side validation before allowing users to share data.

## Data privacy

Trade entries are currently stored only in the browser's localStorage. Clearing browser/site data will remove them.
