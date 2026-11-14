# GalaxyFleet Operations & Disaster Recovery Runbook

> **Target Audience**: DevOps Engineers, SREs, and Full-Stack Developers maintaining the GalaxyFleet platform in production.
> **Bus Factor Guarantee**: Complete operational commands, backup procedures, and incident recovery steps.

---

## 1. Quick Service Operations

### 1.1 Starting the Application
```bash
# Production server mode (Node.js with tsx runtime)
npm run start

# Development mode (Vite HMR frontend + API proxy)
npm run dev
```

### 1.2 Environment Variables
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP port for incoming traffic |
| `HOST` | `0.0.0.0` | Binding interface IP |
| `NODE_ENV` | `development` | Set to `production` in live deployments |
| `DB_PATH` | `./data/fleet-management-v2.db` | Path to persistent SQLite database |

---

## 2. Health Monitoring & Diagnostic Probes

### 2.1 Basic Liveness Probe (L4 / L7 Load Balancers)
```bash
curl -i http://localhost:3000/api/health
```
**Expected Response (HTTP 200)**:
```json
{
  "status": "ok",
  "service": "GalaxyFleet Corporate Fleet Management",
  "uptime_sec": 1284,
  "timestamp": "2026-11-14T10:00:00.000Z"
}
```

### 2.2 Deep Readiness Probe (Verifies DB, Memory & WAL)
```bash
curl -i http://localhost:3000/api/health/deep
```
**Expected Response (HTTP 200)**:
```json
{
  "status": "ready",
  "database": "connected",
  "sqlite_wal": true,
  "memory": {
    "heapUsedMb": 42,
    "heapTotalMb": 68,
    "rssMb": 94
  },
  "uptime_sec": 1284,
  "timestamp": "2026-11-14T10:00:00.000Z"
}
```

---

## 3. High-Traffic Surge & Disaster Recovery

### 3.1 Handling Traffic Spikes (Hundreds of Simultaneous Employees)
* **SQLite WAL Mode**: Allows simultaneous reads while writes commit without lock contention.
* **Rate Limiter**: The sliding-window rate limiter automatically caps excessive request volume per IP (200 req/min) returning `HTTP 429 Too Many Requests` with a `Retry-After` header.
* **Connection Draining on Server Restart**:
  When updating or restarting the server process (`SIGTERM` or `SIGINT`), the server gracefully stops accepting new connections, drains existing HTTP responses, checkpoints the SQLite WAL file, and terminates cleanly.

### 3.2 Database Backup Procedure
SQLite with WAL mode can be safely backed up online using the SQLite `.backup` command or Node script:
```bash
# Online hot backup (zero downtime)
sqlite3 data/fleet-management-v2.db ".backup 'data/backup-$(date +%Y%m%d_%H%M%S).db'"
```

### 3.3 Database Restoration Procedure
In the event of hardware or storage failure:
```bash
# 1. Stop server process
kill -SIGTERM $(pgrep -f "tsx src/server/index.ts")

# 2. Swap in the verified backup file
cp data/backup-YYYYMMDD_HHMMSS.db data/fleet-management-v2.db
rm -f data/fleet-management-v2.db-wal data/fleet-management-v2.db-shm

# 3. Restart server
npm run start
```

### 3.4 Administrative Data Reset
If transitioning from pilot/testing to live production, an Administrator (`role: ADM`) can invoke:
* **Option A: Reset Operations Only**: Wipes test bookings/trips while keeping vehicles, drivers, and groups, prompting for custom real starting odometers.
* **Option B: Factory Reset**: Restores database to 12 official Company Groups and 1 Administrator account.
* Both require typing the exact safety keyword `"RESET"`.
