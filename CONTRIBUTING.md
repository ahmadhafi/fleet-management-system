# Enterprise Software Development Life Cycle (SDLC) & Contributing Guide

> **Guiding Principle**: Software quality is non-negotiable. Every code change must be verifiable, auditable, and maintainable by anyone stepping into the codebase ("The Bus Factor").

---

## 1. Enterprise Branching Model (GitFlow / Multi-Tier Assessment)

To guarantee zero downtime and prevent unverified features from breaking production, GalaxyFleet enforces a strict 4-tier branching hierarchy:

```
[feature/*, fix/*]  ──PR──>  develop  ──PR──>  staging / test  ──PR──>  main (Production)
      │                         │                    │                       │
 Local Development      Integration Testing    Pre-Launch Assessment     Production Release
 & Unit Verification    & Automated CI         & User Acceptance (UAT)   & Live Operations
```

### Branch Roles & Policies

| Branch | Stage | Protection Level | Purpose |
| :--- | :--- | :--- | :--- |
| **`main`** | **Production** | 🔒 Strictly Protected | Represents live, deployed code. Only promoted from `staging` after full QA sign-off or critical hotfix. |
| **`staging`** / **`test`** | **Pre-Launch Assessment** | 🛡️ Protected | Staging & UAT environment. Runs end-to-end integration tests, load tests, and stakeholder acceptance before production deployment. |
| **`develop`** | **Active Integration** | 🛡️ Protected | Central integration branch for ongoing engineering work. Feature PRs merge here first. |
| **`feature/*`** | **Development** | Developer Sandbox | Individual feature branches branched off `develop`. |
| **`hotfix/*`** | **Emergency Patch** | Developer Sandbox | Emergency production fixes branched off `main`, merged into `main`, `staging`, and `develop`. |

---

## 2. Step-by-Step Development Workflow

### Step 1: Branch from `develop`
```bash
git checkout develop
git pull origin develop
git checkout -b feature/awesome-new-capability
```

### Step 2: Implement with Clean Code Standards
* **Self-documenting variable & function names**: Avoid obscure acronyms or single-letter variables.
* **Keep functions small & focused**: Single Responsibility Principle (SRP).
* **Defensive programming**: Handle `null`, `undefined`, empty arrays, and unexpected inputs.
* **Preserve existing database triggers and constraints**: Do not disable triggers outside explicit admin migration routines.

### Step 3: Run Local Validation Suite
Before opening a Pull Request, verify all checks pass:
```bash
# 1. Typecheck TypeScript
npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.node.json --noEmit

# 2. Linting
npm run lint

# 3. Automated Test Suite (All 29+ Tests)
npm test

# 4. Production Build Verification
npm run build
```

### Step 4: Commit with Conventional Commits
Format your commit message according to the Conventional Commits specification:
```
<type>(<scope>): <short imperative summary>

[optional detailed description]
```
Allowed types:
* `feat`: A new feature or capability
* `fix`: A bug fix
* `refactor`: Code reorganization with zero functional change
* `perf`: Performance or concurrency improvement
* `sec`: Security hardening or vulnerability fix
* `test`: Adding or updating test cases
* `docs`: Documentation updates

### Step 5: Open a Pull Request Targetting `develop`
* Use the automated Pull Request template.
* Fill out the Senior Engineering Checklist.
* Wait for GitHub Actions CI to report green status.
* Solicit peer code review before merging.

### Step 6: Promotion from `develop` &rarr; `staging` &rarr; `main`
1. Once features in `develop` are complete, create a PR from `develop` to `staging` (or `test`).
2. Run pre-launch assessment and user acceptance testing in staging.
3. Once validated, merge `staging` into `main` and tag the release (e.g. `v2.1.0`).
