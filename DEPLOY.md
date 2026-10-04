# Deploy on Render

This app is a **single Node web service** plus **one PostgreSQL database**. Production requires `DATABASE_URL`; there is no `db.json` on the server.

---

## What Render runs

| Step | Command | Result |
|------|---------|--------|
| Build | `npm ci && npm run render:verify` | Typecheck + Vite client build + `dist/server.cjs` |
| Start | `npm start` → `node dist/server.cjs` | Express on `PORT` (set by Render), serves `dist/` + `/api/*` |
| Health | `GET /api/health` | `{ "ok": true }` — used by Render health checks |

Blueprint: [`render.yaml`](render.yaml) creates web service **`take-profit-portal`** and Postgres **`take-profit-db`**.

---

## 1. Put the code in Git

Render deploys from a Git repository (GitHub, GitLab, or Bitbucket).

1. Initialize and commit locally (do **not** commit `.env` — it is gitignored):

   ```bash
   git init -b main
   git add -A
   git status   # confirm no .env or secrets
   git commit -m "Prepare Render deployment"
   ```

2. Create a repository on your Git host, add it as `origin`, and push `main`.

---

## 2. Create services on Render (Blueprint)

1. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect the repository containing this project.
3. Render reads `render.yaml` and provisions:
   - **PostgreSQL** `take-profit-db`
   - **Web Service** `take-profit-portal` with:
     - `DATABASE_URL` (from the database)
     - `JWT_SECRET` (auto-generated — copy and store safely in Render env if you ever recreate the service)
     - `NODE_ENV=production`
     - `PAYMENT_MODE=sandbox`
4. Wait for the first deploy. Open the `*.onrender.com` URL.

**Manual alternative:** create Postgres + Web Service yourself; set build/start commands and env vars to match the table in [`render.yaml`](render.yaml).

---

## 3. Load data into Postgres (once)

After the database exists, from your **local machine** use the **External Database URL** (Render → Postgres → Connect → External):

**Option A — import from a JSON snapshot (your export or `db.sample.json` for structure only):**

```bash
DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require" npm run db:import -- path/to/snapshot.json
```

Dry run:

```bash
DATABASE_URL="..." npm run db:import -- path/to/snapshot.json --dry-run
```

**Option B — production-clean (only hidden system manager, no sessions):**

```bash
DATABASE_URL="..." npm run db:reset-system
```

Then log in with the system manager account created at bootstrap (`manager@portal.com`). Set a new password in production after first login.

---

## 4. Environment variables (Render → Web Service → Environment)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Linked from Render Postgres (Blueprint does this) |
| `JWT_SECRET` | Yes | Stable random string; changing it logs everyone out |
| `NODE_ENV` | Yes | `production` |
| `PAYMENT_MODE` | Yes | `sandbox` (default) or `live` |
| `LIVE_TAKE_PROFIT_URL` | If live | See [`.env.example`](.env.example) |
| `LIVE_TAKE_PROFIT_API_KEY` | If live | See [`.env.example`](.env.example) |
| `PGSSL` | Rarely | Render Postgres uses SSL by default; local Docker may need `PGSSL=false` |

Never commit real secrets; set them only in Render’s dashboard.

---

## 5. Custom domain & public deposit

1. Render → web service → **Settings** → **Custom Domains** → add your domain and DNS records.
2. In the manager backoffice: **Team & security → Settings**:
   - Enable **public landing** if you want `https://yourdomain.com/deposit` without an agent link.
   - Configure onboarding guide path and 24h expiry messaging.

Agent links: `https://yourdomain.com/deposit/index.html?session=...`

---

## 6. Verify after deploy

1. `https://YOUR-SERVICE.onrender.com/api/health` → `{"ok":true}`
2. Login → `/backoffice` (manager) or `/agent`
3. Create a deposit link → open in incognito → checkout loads
4. Complete or open session → onboarding guide / settings behave as configured

---

## 7. Local dev matching production (optional)

```bash
docker compose up -d
cp .env.example .env
# DATABASE_URL=postgresql://take_profit:take_profit@localhost:5432/take_profit
# PGSSL=false
npm run dev
```

Without `DATABASE_URL`, dev uses **`db.json` only** (not used in production).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on Render | Run `npm run render:verify` locally; fix TypeScript/build errors |
| “DATABASE_URL is required” | Link Postgres to the web service or set `DATABASE_URL` manually |
| Session not found on deposit link | Confirm session exists in Postgres (`db:import` or create link after deploy) |
| Stale API / HTML for `/api/...` | Redeploy; ensure latest commit is built |
| Health check failing | Confirm `GET /api/health` returns 200 |

---

## Files reference

- [`render.yaml`](render.yaml) — Blueprint definition
- [`db/schema.sql`](db/schema.sql) — applied automatically on startup when `DATABASE_URL` is set
- [`scripts/import-db-json.ts`](scripts/import-db-json.ts) — one-time migration from a JSON snapshot
- [`scripts/package-deploy.sh`](scripts/package-deploy.sh) — builds `take-profit-portal-deploy.zip` (source only; no `node_modules`, `dist`, secrets, or local `db.json`)
