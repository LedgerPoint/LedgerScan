# LedgerScan — Deployment Guide

## How it works
LedgerScan uses a Vercel serverless function (`/api/fmp.js`) as a proxy.
Your browser calls `/api/fmp` → Vercel calls FMP → returns data.
This solves the CORS problem completely. Your API key lives securely
in Vercel's environment variables, never exposed to the browser.

---

## Deploy in 5 minutes

### Step 1 — Push to GitHub
1. Go to github.com and create a new repository called `ledgerscan`
2. Upload all these files keeping the same folder structure:
   ```
   ledgerscan/
   ├── api/
   │   └── fmp.js
   ├── src/
   │   ├── main.jsx
   │   └── App.jsx
   ├── index.html
   ├── package.json
   ├── vite.config.js
   └── vercel.json
   ```

### Step 2 — Deploy on Vercel
1. Go to vercel.com and sign up (free)
2. Click "Add New Project"
3. Import your `ledgerscan` GitHub repo
4. Vercel will auto-detect it as a Vite project
5. Under "Build & Output Settings":
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Click Deploy

### Step 3 — Add your API key
1. In Vercel, go to your project → Settings → Environment Variables
2. Add a new variable:
   - Name:  `FMP_API_KEY`
   - Value: `OmLPPLNIJrEWSdDIzSV6Ajvn58MAYpfV`
3. Click Save
4. Go to Deployments → click the 3 dots on latest → Redeploy

That's it. Your app will be live at `https://ledgerscan.vercel.app` (or similar).

---

## Upgrading your FMP plan
Free tier: 250 API calls/day, some endpoints limited
Starter ($15/mo): Unlimited calls, institutional ownership data, more endpoints

To upgrade: financialmodelingprep.com/developer/docs/pricing
