# Deliverance Church International Utawala - Child Dedication Portal

A dedicated, secure web portal for Deliverance Church International (DCI) Utawala to manage child dedication registrations, fellowship zone leader approvals, pastoral review, and quarterly dedication service scheduling.

---

## 🌟 Key Features

1. **Parent Registration & Form Submission**:
   - Parents register their children for upcoming dedication services.
   - Automatic quarterly schedule alignment (dedication services occur on designated Sundays determined by the church leadership and pastor).
   - Zone selection (Zone A through Zone E) for local fellowship oversight.

2. **Fellowship Zone Leader Approval**:
   - Zone leaders log in and **only see and approve members belonging to their designated fellowship zone** (strict data isolation).
   - Once a zone leader confirms the parent's membership in their zone fellowship, their verification is complete.

3. **Church Administration & Pastoral Oversight**:
   - Church office and pastoral team have a full administrative dashboard.
   - Comprehensive overview across all zones, identifying pending approvals with the ability to step in and approve if a fellowship leader is unavailable.
   - Set and publish dedication service dates, generate baby dedication certificates, and export registry reports (Excel/CSV).

4. **Smooth Google Authentication**:
   - Seamless one-click Google Sign-in for pastoral leadership, administrators, and zone leaders.

---

## 🚀 Running Locally

If you downloaded the ZIP and extracted it to your computer:

### Prerequisites
- Node.js (version 18 or higher recommended)
- npm or pnpm

### Steps
1. Open your terminal in the extracted folder:
   ```bash
   cd dcu-child-dedication-portal
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser at `http://localhost:3000` (or the URL displayed in your terminal).

---

## 🚢 Publishing to GitHub & Deploying to Vercel

### Step 1: Upload to GitHub
1. Go to [GitHub](https://github.com) and click **New Repository**.
2. Name it (e.g. `dcu-child-dedication-portal`) and set it to **Private** or **Public**.
3. You can either:
   - **Upload files directly in GitHub**: Click **"uploading an existing file"**, drag-and-drop the extracted files (excluding `node_modules` if any), and commit.
   - **Or use Git CLI**:
     ```bash
     git init
     git add .
     git commit -m "Initial commit of DCI Utawala Dedication Portal"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/dcu-child-dedication-portal.git
     git push -u origin main
     ```

### Step 2: Connect to Vercel
1. Go to [Vercel](https://vercel.com) and sign in with GitHub.
2. Click **"Add New..."** &rarr; **"Project"**.
3. Select your GitHub repository `dcu-child-dedication-portal`.
4. Click **Deploy**. Vercel will automatically build Vite and serve the app with HTTPS.
5. (Optional) In Vercel Project Settings &rarr; **Domains**, attach your official church domain (e.g., `dedications.dcutawala.org`).
