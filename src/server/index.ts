import fs from 'node:fs';
import { createApp } from './app.ts';
import { checkpointDb, flushAndCloseDb } from './db.ts';
import { ensureSqlEngineLoaded, isSqlEngineReady } from './sqlite-compat.ts';

const rawPort = process.env.PORT;
const isSocketPort = Boolean(rawPort && Number.isNaN(Number(rawPort)));
const PORT: number | string = isSocketPort ? (rawPort as string) : Number(rawPort || 3000);
const HOST = process.env.HOST;
const app = createApp();

// Warm SQL engine immediately (no-op for native node:sqlite; fast WASM init on Node 18/20).
// Requests to /api/* automatically await this promise if they arrive before init completes.
ensureSqlEngineLoaded().catch((err) => {
  console.error('[GalaxyFleet FATAL] Failed to initialize SQLite engine:', err);
  process.exit(1);
});

const onListen = () => {
  console.log(`[GalaxyFleet] Production Server online at ${isSocketPort ? PORT : `http://${HOST || '0.0.0.0'}:${PORT}`} (PID: ${process.pid})`);
  console.log(`[GalaxyFleet] Environment: ${process.env.NODE_ENV || 'development'}`);
};

// Bind synchronously so cPanel Phusion Passenger / lsnode intercepts listen() immediately on require('./dist-server/index.cjs')
const server: ReturnType<typeof app.listen> = isSocketPort
  ? app.listen(PORT, onListen)
  : HOST
  ? app.listen(PORT as number, HOST, onListen)
  : app.listen(PORT as number, onListen);

// Periodic WAL checkpointing every 10 minutes to maintain optimal WAL size & concurrency
const walTimer = setInterval(() => {
  if (!isSqlEngineReady()) return;
  try {
    checkpointDb();
  } catch (err) {
    console.error('[GalaxyFleet] Background WAL checkpoint error:', err);
  }
}, 10 * 60 * 1000);
walTimer.unref();

// Auto-recycle under cPanel Phusion Passenger / LiteSpeed lsnode / PM2 when dist-server/index.cjs is updated on disk
// (prevents serving newly pulled dist/ frontend against a stale in-memory backend process)
const isManagedSupervisor = Boolean(
  process.env.PASSENGER_APP_ENV ||
    process.env.IN_PASSENGER ||
    process.env.LSNODE_SOCKET ||
    process.env.LSNODE_UID ||
    process.env.PM2_HOME ||
    isSocketPort
);
if (isManagedSupervisor && process.env.NODE_ENV !== 'test' && typeof __filename === 'string' && __filename.endsWith('.cjs')) {
  try {
    const bootBundleMtime = fs.statSync(__filename).mtimeMs;
    const bundleWatchTimer = setInterval(() => {
      try {
        const currentMtime = fs.statSync(__filename).mtimeMs;
        if (currentMtime > bootBundleMtime + 500) {
          console.log('[GalaxyFleet] Detected updated dist-server/index.cjs on disk; gracefully recycling supervisor worker.');
          gracefulShutdown('BUNDLE_UPDATED');
        }
      } catch {}
    }, 15 * 1000);
    bundleWatchTimer.unref();
  } catch {}
}

// Graceful Shutdown Handler (SIGTERM & SIGINT)
let isShuttingDown = false;
function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[GalaxyFleet] Received ${signal}. Initiating graceful connection draining...`);

  if (!server) {
    flushAndCloseDb();
    process.exit(0);
    return;
  }

  // Stop accepting new HTTP connections
  server.close((err) => {
    if (err) {
      console.error('[GalaxyFleet] Error during server socket close:', err);
    } else {
      console.log('[GalaxyFleet] Server sockets successfully closed.');
    }

    try {
      flushAndCloseDb();
      console.log('[GalaxyFleet] SQLite WAL successfully checkpointed and database flushed cleanly.');
    } catch (dbErr) {
      console.error('[GalaxyFleet] Database flush error during shutdown:', dbErr);
    }

    console.log('[GalaxyFleet] Graceful teardown complete. Exiting cleanly.');
    process.exit(0);
  });

  // Failsafe timeout: force exit if long-lived keep-alive connections do not drain in 10s
  setTimeout(() => {
    console.error('[GalaxyFleet] Connection draining timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Top-level crash isolation traps
process.on('uncaughtException', (err) => {
  console.error('[GalaxyFleet FATAL] Uncaught Exception:', err);
  try {
    flushAndCloseDb();
  } catch {}
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[GalaxyFleet WARN] Unhandled Rejection at:', promise, 'reason:', reason);
});
