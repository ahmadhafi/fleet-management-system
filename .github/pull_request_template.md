## Description
<!-- Provide a concise summary of the business motivation, design rationale, and bug/feature being addressed. -->

## Branch & SDLC Target
- [ ] `develop` (Feature branch integration)
- [ ] `staging` / `test` (Pre-launch release assessment & UAT)
- [ ] `main` (Production hotfix / release promotion)

## Type of Change
- [ ] `feat`: New feature or user capability
- [ ] `fix`: Bug fix
- [ ] `refactor`: Code reorganization with zero functional change
- [ ] `perf`: Performance optimization or concurrency tuning
- [ ] `sec`: Cyber security hardening, auth, or input sanitization
- [ ] `test`: New or updated automated tests
- [ ] `docs`: Documentation, runbook, or architecture updates

## Senior Engineering Checklist (10+ Years Standard)
- [ ] **Clean Code & Bus Factor**: Code is self-documenting, modular, and does not require tribal knowledge.
- [ ] **Database Integrity**: Does NOT violate append-only triggers (`ASN-04`, `REQ-06`, `TRP-10`, `GPS-09`, `AUD-02`).
- [ ] **Security Defense**: No credentials/Maps API keys exposed; inputs sanitized; mime-types & magic bytes verified.
- [ ] **Type Safety**: `npx tsc --noEmit` passes cleanly with zero errors.
- [ ] **Automated Tests**: Added/updated test coverage in `tests/`; all test suites pass 100% green.
- [ ] **Zero Regression**: Tested against 12 official Company Groups and established multi-role workflows.
- [ ] **Rollback Plan**: In the event of an outage or unforeseen regression, can this change be rolled back safely?

## Verification Steps
1. ...
2. ...
