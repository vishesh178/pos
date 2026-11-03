# CURATED ART — PREMIUM ERP & BILLING MANAGEMENT SYSTEM WITH ZOHO API INTEGRATION

Curated Art is an offline-first, production-oriented ERP and Point-of-Sale (POS) billing system built specifically for luxury home décor showrooms selling metal wall art, brass wall clocks, fluted ceramic planters, artisanal showpieces, framed botanical canvases, and decorative terracotta urns.

The application integrates official **Zoho Books** and **Zoho Inventory** REST APIs for the Indian Data Center (`accounts.zoho.in` and `api.zohoapis.in`) while ensuring local store operations and billing remain 100% resilient and uninterrupted even during network outages.

---

## System Architecture

* **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons, Recharts
* **Desktop Application:** Electron (Hardware scanner listeners, silent thermal receipt printing, safe IPC)
* **Backend:** Node.js, Express REST API, JWT Authentication, Role-Based Access Control
* **Database & ORM:** SQLite (`server/database/curated_art.db`) via Prisma ORM (supports switching to centralized PostgreSQL)
* **Sync Engine:** Transactional Outbox Pattern via `SyncJob` table with rate-limited exponential backoff
* **Security:** AES-256-GCM encryption for Zoho OAuth tokens and client secrets (never sent to the frontend)

---

## Default Showroom Credentials

| Role | Email | Password | Allowed Modules |
| :--- | :--- | :--- | :--- |
| **Owner / Admin** | `admin@curatedart.in` | `admin123` | Full access, Zoho Settings, Users, Backups |
| **Store Manager** | `manager@curatedart.in` | `manager123` | POS, Inventory, Purchases, Expenses, Reports |
| **Billing Staff** | `cashier@curatedart.in` | `cashier123` | POS Billing, Customer Lookup, Sales Returns |

---

## Core Capabilities

1. **High-Speed Keyboard-Friendly POS (`F2`, `F4`, `F8`)**:
   - Hardware USB barcode scanner keystroke buffer detection (< 50ms keystrokes).
   - Fast catalog search by name, category, SKU, and EAN-13 barcode.
   - Dual receipt engine: **80mm Thermal Receipt** (ESC/POS styled) and **A4 Full GST Tax Invoice**.
   - Multiple payment options: Cash (with automatic change return calculator), Dynamic UPI QR Code, Card, and Split payments.

2. **Indian GST Calculation Engine**:
   - Automated detection of **Intra-state** (CGST 9% + SGST 9%) vs **Inter-state** (IGST 18%) based on Customer State vs Showroom State (`24-Gujarat`).
   - Reverse tax-inclusive price calculation and proportional item/bill discount distribution.
   - Mathematical round-off to the nearest rupee.

3. **Product & Inventory Management**:
   - Automated SKU generator (e.g. `CA-MF-2026-0008` for Metal Frames).
   - EAN-13 barcode generator with GS1 standard checksum digit calculation.
   - Barcode label print sheet modal (single thermal label and A4 24-up label sheet).
   - Real-time stock movement ledger (`SALE`, `PURCHASE`, `RETURN_INWARD`, `DAMAGE_OUTWARD`, `ADJUSTMENT_ADD`, `ADJUSTMENT_SUBTRACT`, `OPENING`).
   - Bulk CSV import with duplicate detection and preview, plus one-click catalog export.

4. **Purchases & Supplier Management**:
   - Supplier ledger and contact management.
   - Purchase Orders (PO lifecycle: `DRAFT`, `ISSUED`, `RECEIVED`, `CANCELLED`).
   - Inward Purchase Bills that automatically increment stock levels, update purchase cost history, and record supplier balances.

5. **Expenses & Financial Reports**:
   - Showroom expense tracker (Showroom Rent, Electricity, Staff Salaries, Freight, Packaging, Marketing).
   - Real-time Gross Profit calculation from Cost of Goods Sold (COGS).
   - Net Profit estimation and expense allocation donut charts.
   - Statutory Indian GST Reports: **GSTR-1** (B2C Small, B2B, HSN Summary Table 12) and **GSTR-3B** (Output Tax vs Inward ITC).

6. **Zoho API Integration (India Data Center)**:
   - Official OAuth 2.0 consent flow with `access_type=offline` and encrypted refresh token storage.
   - Asynchronous background worker processing the transactional outbox (`SyncJob`).
   - Idempotency & duplicate prevention checking `reference_number` before issuing API calls.

7. **Database Disaster Recovery**:
   - One-click snapshot backups to `database/backups/`.
   - Safe restore workflow with automatic pre-restore snapshots.

---

## Quick Start & Setup

### 1. Installation & Database Generation
```bash
# Install dependencies
npm install

# Generate Prisma client and seed initial data
npm run setup
```

### 2. Running in Development
```bash
# Starts Express API server (port 5050) and Vite frontend (port 5173) concurrently
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Launching Electron Desktop App
```bash
npm run electron
```

### 4. Running the Automated Test Suite
```bash
npm test
```
Runs 16 native automated unit and integration tests covering AES-256-GCM crypto, JWT auth, GST calculations, POS atomic checkout, EAN-13 barcode checksums, and outbox sync job retries.

### 5. Production Build
```bash
npm run build
```

---

## Environment Variables (`.env`)

```ini
PORT=5050
NODE_ENV=development
DATABASE_URL="file:./server/database/curated_art.db"
JWT_SECRET="curated_art_jwt_secret_luxury_decor_2026_secure"
APP_ENCRYPTION_KEY="c8f9b2a1e4d3c2b1a0987654321fedcb"
ZOHO_DC="in"
```

