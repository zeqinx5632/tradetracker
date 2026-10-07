# TradeTrack — Simple Supabase Version

This version uses Supabase for accounts, trades, analytics, and friends.

## 1. Upload these files to GitHub

Replace the existing files in your repository with:
- index.html
- styles.css
- app.js
- supabase.sql

## 2. Put your Supabase publishable key in app.js

At the top of `app.js`, keep the quotation marks:

`supabaseUrl: "https://YOUR-PROJECT.supabase.co"`

`supabasePublishableKey: "YOUR_PUBLISHABLE_KEY"`

Use the **publishable** key only. Never put a secret/service-role key in this file.

## 3. Turn off email confirmation in Supabase

In Supabase Dashboard, open Authentication settings and turn **Confirm email** OFF for Email authentication.

This version displays only username + password. Internally, it uses a private synthetic email address for Supabase Auth; your users do not enter or see an email address.

## 4. Database

If you already ran the previous `supabase.sql`, you normally do not need to run it again. If this is a fresh project, run the included SQL in Supabase SQL Editor.

## 5. GitHub Pages

Commit the files to `main`. GitHub Pages should then update automatically.
