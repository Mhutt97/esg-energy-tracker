# EcoLedger ESG — Business Energy & Utility Invoice Tracker

A React + Vite + Tailwind CSS application for tracking business utility invoices (**Electricity Scope 2**, **Natural Gas & Stationary Fuels Scope 1**, and **Water & Wastewater GRI 303**) and generating audit-ready **GHG Protocol / GRI / CSRD** disclosures.

Designed to be hosted 100% statically on **GitHub Pages** while persisting invoice records via:
1. **GitHub Repository REST API** (commits `data/esg-invoices.json` directly to your repo with a Git audit trail)
2. **Google Sheets Backend** (two-way sync with a Google Sheet via a lightweight Google Apps Script Web App)
3. **Browser LocalStorage + CSV / JSON Import & Export**

---

## Deploying to GitHub Pages

This project includes a ready-to-run GitHub Actions workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

1. **Create a new GitHub repository** and push this folder:
   ```bash
   git init
   git add .
   git commit -m "feat: initial EcoLedger ESG energy tracker"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. In your GitHub repository, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. The `Deploy ESG Energy Tracker to GitHub Pages` workflow will automatically build the React + Vite bundle and publish it to `https://<your-username>.github.io/<your-repo>/`.

---

## Connecting Your Cloud Backend

Click the **Cloud Backend** button in the top navigation bar of the app:

### Option A: GitHub Repository API
1. Generate a **Fine-Grained Personal Access Token** on GitHub (**Settings → Developer settings → Personal access tokens → Fine-grained tokens**).
2. Grant it **Contents: Read and write** permission for your repository.
3. Enter your **GitHub Owner**, **Repository Name**, **Branch** (`main`), **File Path** (`data/esg-invoices.json`), and **Token** in the app's **Cloud Backend → GitHub Repository API** modal.
4. Click **Commit & Push Invoices to GitHub** (or enable **Auto-Sync**).

### Option B: Google Sheets Backend
1. Open a Google Sheet and click **Extensions → Apps Script**.
2. Click **Copy Apps Script** inside the app's **Cloud Backend → Google Sheets Webhook** tab and paste it into the Apps Script editor.
3. Click **Deploy → New deployment → Web app**, set *Execute as: Me* and *Who has access: Anyone*, and paste the resulting URL into the app.

---

## Local Development

If you want to run the Vite dev server locally (requires [Node.js 20+](https://nodejs.org/)):

```bash
npm install
npm run dev
```
