# Security Policy & Defense-in-Depth Architecture

> **Security Mandate**: Protect corporate employee identities, vehicle telemetry, and operational data against unauthorized access, data exfiltration, tampering, and denial-of-service.

---

## 1. Multi-Layer Defense-in-Depth Model

GalaxyFleet implements five concentric rings of cyber security defense:

```
[ Ring 1: Edge & Network Security ]
  • Sliding-window Rate Limiter (200 req/min per IP)
  • Strict Security Headers (CSP, HSTS 365d, X-Frame-Options DENY, nosniff)
  • Reverse Proxying of external APIs (MapTiler keys never exposed to client)

[ Ring 2: Authentication & Identity Vault ]
  • Scrypt key derivation with unique 16-byte cryptographically secure salts
  • Timing-safe password comparison (anti-timing side-channel attacks)
  • Anti-Brute Force Lockout: 8 failed attempts triggers automatic 5-min IP/user lockout
  • Session revocation on sign-out (anti-replay defense)

[ Ring 3: Role-Based Access Control (RBAC) ]
  • 5 Confirmed Roles: Administrator (ADM), Fleet Manager (FM), Head of WS (HWS), Driver (DRV), Employee (EMP)
  • Server-enforced middleware (`requireAuth`, `requireRoles`) on every business endpoint
  • Self-approval rejection (TC-REQ-02)

[ Ring 4: Anti-Malware & File Upload Protection ]
  • File uploads inspected for size (<10MB), declared MIME type, and binary magic bytes
  • MZ (Windows executable / PE header) detection blocks disguised malicious files
  • EICAR standard antivirus test signature detection blocks test payloads

[ Ring 5: Storage & Audit Immutability ]
  • SQLite triggers enforce append-only rules for assignments, decisions, odometer readings, and GPS breadcrumbs
  • Tamper-proof audit log (`audit_events`) logs actor, action, timestamp, IP, and state deltas
```

---

## 2. Threat Modeling & Countermeasures

| Threat Vector | Mitigation Strategy | Implementation |
| :--- | :--- | :--- |
| **Credential Stuffing / Brute-Force** | Account lockout + audit logging | `failedLoginAttempts` map in `app.ts` |
| **Cross-Site Scripting (XSS)** | Strict CSP + parameterized UI rendering | Express CSP middleware |
| **Clickjacking** | Frame ancestor restriction | `X-Frame-Options: DENY` |
| **SQL Injection** | Strict parameterized statements | `db.prepare(sql).run(...params)` everywhere |
| **API Abuse / Scraping** | Sliding-window token bucket | `src/server/rate-limit.ts` |
| **Tampering with Trip History** | DB-level immutability triggers | `src/server/db.ts` |
| **Malicious File Upload** | Binary magic-byte analysis | `checkMagicBytes` in `src/server/app.ts` |

---

## 3. Vulnerability Reporting
If you identify a security vulnerability in GalaxyFleet, please report it immediately to the System Administrator or Security Lead. Do not disclose vulnerabilities publicly before a patched hotfix branch has been verified and deployed.
