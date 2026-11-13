# Internal Company Fleet Management System (Web App & Universal PWA)

A secure, mobile-first internal company fleet management web application and installable Progressive Web App (PWA) built to manage an 8-vehicle mixed-energy corporate fleet (**5 Gasoline** + **3 Electric**) across **9 organizational departments**.

## Key Features & Revisions Implemented

1. **Company-Driver Dispatch Only (No Self-Drive)**
   - Self-drive is disabled at both the UI and API validation layers (`POST /api/trips`). Every trip booking requires a company driver.
2. **Pure Authentication + 4-Field Privacy-First Registration with Admin Approval**
   - No quick role switcher. Users must genuinely sign in with their credentials.
   - Account registration (`POST /api/auth/register`) collects **only 4 fields** (`nickname`, `department_id`, `group_username`, `password` — zero personal PII) and creates the account in `PENDING_APPROVAL` status until an Administrator approves it.
3. **Administrator Vehicle Edit & Standby / Deactivation Control**
   - Administrators can edit vehicle `car_type` (`Sedan`, `SUV`, `MPV`, `Executive EV`, `Van`), `registration_plate`, `make`, `model`, `seats`, `odometer`, `battery_percent`, and set any vehicle to `Standby`, `Deactivated`, `In Maintenance`, or `Retired` with a `standby_reason` (`PATCH /api/vehicles/:id`), immediately blocking new bookings on that car.
4. **Immediate Schedule Lock on Unapproved Bookings**
   - Submitting a trip request (`POST /api/trips`) immediately creates a `PENDING_APPROVAL` booking (and driver assignment if a preferred driver is selected) inside an atomic SQLite `BEGIN IMMEDIATE` transaction, locking the vehicle and driver slot against double-booking even before Administrator approval.
5. **Universal Installable PWA + Web Push Notifications for All Roles**
   - Drivers, Administrators, Fleet Managers, HWS Approvers, and Employees can install the PWA (`public/manifest.webmanifest` + `public/sw.js`) and subscribe to Web Push (`VAPID`) + in-app notifications for booking approvals/rejections, booking reminders, and driver dispatch orders.
   - Lock-screen push notification payloads are automatically sanitized (`NTF-06`) to strip sensitive personal identifiers.
   - Offline mutations are blocked (`WEB-03`) so bookings, approvals, and assignments are always validated against live server state.
6. **Admin Usage Analytics Dashboard (Completed Trips & Distance Summary)**
   - Starting from `COMPLETED` trips, Administrators can inspect trip counts and distance traveled (`km`) **per Day, per Week, and per Month**, broken down **per car (each of the 8 vehicles)**, **per driver**, and **combined across all 8 vehicles** (`GET /api/analytics/usage`).
   - Strictly separates **Gasoline (`Litres`, `km/L`)** and **Electric (`kWh`, `kWh/100 km`)** energy metrics (`EV-05`, `RPT-04`).

---

## Pre-Seeded Accounts (For Testing & Evaluation)

| Role | Group Username | Password | Description |
| :--- | :--- | :--- | :--- |
| **Administrator (`ADM`)** | `admin.fleet` | `Fleet@2026!` | Full system governance, account approvals, vehicle edit/standby, usage analytics |
| **Fleet Manager (`FM`)** | `fm.ops` | `Fleet@2026!` | Fleet operations, dispatch assignment, maintenance, fuel & EV charging |
| **Head of Workplace Services (`HWS`)** | `hws.approver` | `Fleet@2026!` | Trip request approvals, schedule oversight, GPS & analytics |
| **Department Admin (`EMP` + `is_department_admin`)** | `dept.eng` | `Fleet@2026!` | Engineering department visibility & trip booking |
| **Driver (`DRV`)** | `driver.budi` | `Fleet@2026!` | Driver PWA: dispatch acknowledgment, start/end trip odometer, EV battery %, inspection, damage, 20-min foreground GPS |
| **Driver (`DRV`)** | `driver.andi` | `Fleet@2026!` | Driver PWA (assigned to Hyundai IONIQ 5 EV) |
| **Employee (`EMP`)** | `emp.sari` | `Fleet@2026!` | General employee trip request & schedule booking |

---

## Local Development & Verification

```bash
# Install dependencies
npm install

# Run full PRD & Revision acceptance test suite (13 test suites)
npm test

# Build production frontend bundle
npm run build

# Start development server (Express API + Vite HMR on port 3000)
npm run dev
```

---

## Deploying to Vercel

This project is pre-configured for zero-config deployment on **Vercel**:
- [`vercel.json`](./vercel.json) routes `/api/*` requests to the Express serverless function in [`api/index.ts`](./api/index.ts) and serves the Vite SPA bundle from `dist/`.
- Uses Node.js 24 built-in `node:sqlite` (`DatabaseSync`) with automatic `/tmp/fleet-management.db` initialization and seed data when `process.env.VERCEL` is detected.
