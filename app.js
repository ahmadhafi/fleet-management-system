// app.js — Phusion Passenger & cPanel Node.js CommonJS Entrypoint
'use strict';

process.env.AUTO_SEED_DEMO = process.env.AUTO_SEED_DEMO || 'true';
require('./dist-server/index.cjs');
