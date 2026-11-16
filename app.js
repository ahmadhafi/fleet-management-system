// app.js — Phusion Passenger & cPanel Node.js Entrypoint
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiledServer = path.join(__dirname, 'dist-server', 'index.js');
// Default to auto-seeding demo fixtures on cPanel startup if not set
process.env.AUTO_SEED_DEMO = process.env.AUTO_SEED_DEMO || 'true';

if (fs.existsSync(compiledServer)) {
  await import('./dist-server/index.js');
} else {
  try {
    await import('tsx/esm');
    await import('./src/server/index.ts');
  } catch (err) {
    console.error('[cPanel Startup] Error: dist-server/index.js not found. Run "npm run build".', err);
    process.exit(1);
  }
}
