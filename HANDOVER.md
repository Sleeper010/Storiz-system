# Project Transition Guide: Photo Album Builder

## 📍 Project Location
**Directory**: `c:\Users\sleeper\.gemini\antigravity\scratch\photo-album-builder`
**Zip Recommendation**: Zip the entire `photo-album-builder` folder. (Exclude `node_modules` and `client/node_modules` if you want a smaller file - the next agent can run `npm install`).

---

## 🛠 Tech Stack
- **Frontend**: React (Vite)
- **Backend**: Node.js (Express)
- **Database/Storage**: Supabase (PostgreSQL & Storage Buckets: `system-assets`, `photos`)
- **Styling**: Vanilla CSS (Modern UI with Glassmorphism, CSS Variables, Animations)
- **Port Mapping**:
  - Client: `http://localhost:5173`
  - Server: `http://localhost:3001` (API: `/api/*`)

---

## 🚀 Current Status & Objective
The project is currently in the "Optimization & Stability" phase. The main goals are:
1.  **Sequential PDF Processing**: Ensure large batches of photos/PDFs are processed one by one to prevent server timeouts and OOM errors.
2.  **Global Branding**: Finalized `BrandingSettings.jsx` which allows uploading an `interior_branding.pdf` to Supabase `system-assets`. This file is used as the first page for generated interior PDF packages.
3.  **UI Resilience**: Fixing "Blackout" crashes during the album configuration phase, where the UI stops responding or turns black due to unhandled React errors (likely memory-related with many images).

---

## 🔑 Key Files for Handover
- `client/src/components/BrandingSettings.jsx`: Global asset management.
- `client/src/components/LoginGate.jsx`: Entry point for password-protected tool.
- `server/server.js`: Main Express entry point with extended timeouts (600s).
- `server/routes/pdf.js`: Core logic for PDF generation and merging.
- `.env`: Contains Supabase credentials and Session Secrets. (CRITICAL for the next agent).

---

## 📋 Next Steps for Agent
1.  **Run `npm install`**: In both root and `client/` directories.
2.  **Verify Supabase**: Check `.env` and ensure the `system-assets` bucket exists with "interior_branding.pdf".
3.  **Debug Album Congfig**: Investigating почему UI "blackouts" occur after uploading >50 images.
4.  **Connect Shopify**: Ensure the `/api/shopify` route is pulling correctly from the user's store.
