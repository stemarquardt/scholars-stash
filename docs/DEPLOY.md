# Deployment Guide — Scholars' Stash on Railway

This document walks through every step to go from the local dev repo to a live production deployment on Railway, reachable at a subdomain of your own domain. It is safe to pause and resume — each phase is independent.

**Target architecture:**
- App (API + frontend) → Railway (single service)
- Database → Railway managed PostgreSQL
- SSL + DNS → Cloudflare (free)
- Domain → `stash.yourdomain.com` (subdomain via iwantmyname → Cloudflare)

**Estimated time:** 1–2 hours end to end, mostly waiting on DNS propagation.

---

## Prerequisites — install / verify these first

```bash
# Node 24 via nvm
nvm use 24
node --version   # should print v24.x.x

# pnpm
pnpm --version

# PostgreSQL client tools (pg_dump, psql)
psql --version   # should print 14+ — install via: brew install postgresql@16

# Git
git --version
```

Accounts you need (all free tiers are fine):
- **GitHub** — github.com
- **Railway** — railway.app (sign up with GitHub)
- **Cloudflare** — cloudflare.com

---

## Phase 1 — Push the repo to GitHub

### 1.1 Create the GitHub repo

1. Go to github.com → **New repository**
2. Name it `edu-link-hub` (or whatever you prefer)
3. Set it to **Private**
4. Do NOT initialise with a README — the repo already has content
5. Click **Create repository**

### 1.2 Push your local repo

Run these from the repo root (`/Users/stephen/src/Edu-Link-Hub`):

```bash
# The repo is already a git repo. Add the GitHub remote:
git remote add origin https://github.com/YOUR_USERNAME/edu-link-hub.git

# Make sure you're on main
git checkout -b main

# Stage everything (secrets are covered by .gitignore — safe to add all)
git add -A

# Commit
git commit -m "Initial commit — Scholars' Stash"

# Push
git push -u origin main
```

**Verify on GitHub:** open the repo and confirm you do NOT see any `.env` files and DO see `.env.example` files. If you see a real `.env` file, stop and fix `.gitignore` before continuing.

---

## Phase 2 — Set up Cloudflare DNS

Cloudflare sits in front of your domain for free SSL, DDoS protection, and DNS management. You'll add the Railway subdomain here later (Phase 6).

### 2.1 Add your domain to Cloudflare

1. Log in to cloudflare.com → **Add a site**
2. Enter your domain (e.g. `yourdomain.com`) → **Continue**
3. Select the **Free** plan → **Continue**
4. Cloudflare will scan for existing DNS records — review and keep anything you want, or start fresh
5. Cloudflare gives you **two nameserver addresses** — they look like:
   ```
   aria.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
   Copy these — you need them in the next step.

### 2.2 Update nameservers at iwantmyname

1. Log in to iwantmyname.com
2. Go to **Domains** → click your domain
3. Find **Nameservers** → **Edit nameservers**
4. Replace the current nameservers with the two Cloudflare ones
5. Save

**DNS propagation takes 10 minutes to 48 hours.** Most of the time it's under an hour. You can check progress at [whatsmydns.net](https://www.whatsmydns.net) — search for your domain's NS records. When they show Cloudflare's nameservers you're ready.

> You can continue with Phases 3–5 while waiting. Come back to Phase 6 once propagation is done.

---

## Phase 3 — Set up Railway

### 3.1 Create a Railway project

1. Go to railway.app → **New Project**
2. Select **Deploy from GitHub repo**
3. Authorise Railway to access your GitHub account if prompted
4. Select your `edu-link-hub` repo
5. Railway detects the `Dockerfile` and `railway.json` automatically
6. Click **Deploy** — Railway will start the first build (it will fail for now since there are no env vars yet — that's expected)

### 3.2 Add a PostgreSQL database

1. Inside your Railway project dashboard, click **+ New**
2. Choose **Database** → **Add PostgreSQL**
3. Railway creates a managed Postgres instance and adds it to your project

### 3.3 Link DATABASE_URL to your app service

1. Click on your app service (the one built from GitHub)
2. Go to **Variables** tab
3. Click **+ Add Variable Reference**
4. Choose `DATABASE_URL` from the Postgres service — Railway auto-fills the connection string

---

## Phase 4 — Configure environment variables

In your Railway app service → **Variables** tab, add each of the following.

> **Where to find these values:** copy them from `artifacts/api-server/.env` on your local machine.

| Variable | Value | Notes |
|---|---|---|
| `PORT` | `8080` | Railway may set this automatically — set it explicitly anyway |
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | *(linked from Postgres in step 3.3)* | |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | From your local `.env` |
| `CORS_ORIGIN` | `https://stash.yourdomain.com` | Your actual subdomain |
| `GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `https://stash.yourdomain.com/api/callback/google` | Must match exactly what you register in step 5.1 |
| `STATIC_FILES_PATH` | `/app/public` | Already set in Dockerfile — can skip |

**When you add Facebook or Discord later:**

| Variable | Value |
|---|---|
| `FACEBOOK_APP_ID` | From Meta Developers dashboard |
| `FACEBOOK_APP_SECRET` | From Meta Developers dashboard |
| `FACEBOOK_CALLBACK_URL` | `https://stash.yourdomain.com/api/callback/facebook` |
| `DISCORD_CLIENT_ID` | From Discord Developer Portal |
| `DISCORD_CLIENT_SECRET` | From Discord Developer Portal |
| `DISCORD_CALLBACK_URL` | `https://stash.yourdomain.com/api/callback/discord` |

After adding all variables, Railway will trigger a redeploy automatically.

---

## Phase 5 — Update OAuth callback URLs

The Google OAuth app currently only allows `localhost` callbacks. You need to add your production URL.

### 5.1 Google Cloud Console

1. Go to console.cloud.google.com → **APIs & Services** → **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Under **Authorised redirect URIs**, click **+ Add URI**
4. Add: `https://stash.yourdomain.com/api/callback/google`
5. Under **Authorised JavaScript origins**, click **+ Add URI**
6. Add: `https://stash.yourdomain.com`
7. Click **Save**

> Keep the `localhost` entries — you still need them for local dev.

---

## Phase 6 — Set up the subdomain in Cloudflare

> Complete this after Phase 2 nameserver propagation has finished.

### 6.1 Get your Railway app's domain

1. In Railway, click your app service → **Settings** → **Networking**
2. Under **Public Networking**, you'll see a generated domain like `edu-link-hub-production.up.railway.app`
3. Copy that domain

### 6.2 Add the CNAME record in Cloudflare

1. In Cloudflare → your domain → **DNS** → **Records** → **Add record**
2. Set:
   - **Type:** `CNAME`
   - **Name:** `stash` (this creates `stash.yourdomain.com`)
   - **Target:** `edu-link-hub-production.up.railway.app` (your Railway domain from above)
   - **Proxy status:** Proxied (orange cloud — enables Cloudflare SSL and caching)
3. Click **Save**

### 6.3 Add the custom domain to Railway

1. In Railway → app service → **Settings** → **Networking** → **Custom Domain**
2. Enter `stash.yourdomain.com`
3. Railway will verify the CNAME and provision an SSL certificate (takes 1–5 minutes)

Once Railway shows the domain as **Active**, the site is reachable. SSL is handled automatically by Cloudflare.

---

## Phase 7 — Initialise the production database schema

Run this from your local machine once — it creates all the tables on the Railway Postgres instance.

```bash
# Get your Railway DATABASE_URL from the Railway dashboard:
# Postgres service → Connect → copy the "Postgres Connection URL"

cd /path/to/Edu-Link-Hub/lib/db

DATABASE_URL="postgresql://postgres:xxxx@xxxx.railway.app:5432/railway" \
  pnpm drizzle-kit push
```

Confirm it prints each table being created without errors.

---

## Phase 8 — Seed production with your local data

This copies your local tags, resources, users, comments, and reactions to the Railway database.

### 8.1 Export from local dev database

Run from the repo root:

```bash
./scripts/export-seed-data.sh
```

This creates `scripts/seed-data.sql` (gitignored — stays local).

### 8.2 Import to Railway

```bash
psql "postgresql://postgres:xxxx@xxxx.railway.app:5432/railway" \
  < scripts/seed-data.sql
```

If you see foreign key constraint errors, it means a table was inserted in the wrong order. Run the tables individually in this order:

```bash
# Fallback — import table by table in FK-safe order
RAILWAY_URL="postgresql://postgres:xxxx@xxxx.railway.app:5432/railway"

pg_dump "$DATABASE_URL" --data-only --no-owner --no-acl --table=users | psql "$RAILWAY_URL"
pg_dump "$DATABASE_URL" --data-only --no-owner --no-acl --table=user_identities | psql "$RAILWAY_URL"
pg_dump "$DATABASE_URL" --data-only --no-owner --no-acl --table=tags | psql "$RAILWAY_URL"
pg_dump "$DATABASE_URL" --data-only --no-owner --no-acl --table=links | psql "$RAILWAY_URL"
pg_dump "$DATABASE_URL" --data-only --no-owner --no-acl --table=link_tags | psql "$RAILWAY_URL"
pg_dump "$DATABASE_URL" --data-only --no-owner --no-acl --table=reactions | psql "$RAILWAY_URL"
pg_dump "$DATABASE_URL" --data-only --no-owner --no-acl --table=comments | psql "$RAILWAY_URL"
pg_dump "$DATABASE_URL" --data-only --no-owner --no-acl --table=suggestions | psql "$RAILWAY_URL"
```

### 8.3 Verify the import

```bash
psql "postgresql://postgres:xxxx@xxxx.railway.app:5432/railway" \
  -c "SELECT COUNT(*) FROM links; SELECT COUNT(*) FROM tags; SELECT COUNT(*) FROM users;"
```

The counts should match your local database.

---

## Phase 9 — Smoke test the live site

Work through this checklist:

- [ ] `https://stash.yourdomain.com` loads (padlock icon = SSL working)
- [ ] Login page shows the Google button
- [ ] Clicking Google login redirects to Google and back correctly
- [ ] You arrive back as an admin (your user was seeded)
- [ ] Resources are visible and filterable
- [ ] Submitting a new resource works
- [ ] Admin panel at `/admin` is accessible
- [ ] Suggestion box (bottom right) submits successfully
- [ ] Thumbnail fetch (OG image) works on a resource edit

---

## Ongoing workflow — how to deploy changes

Railway auto-deploys every time you push to `main`. The workflow is:

```bash
# Make changes locally, test with pnpm dev
git add -A
git commit -m "describe your change"
git push origin main
# Railway picks it up automatically, builds the Docker image, and hot-swaps
```

**Schema changes** (adding/modifying database columns):

```bash
# After editing a file in lib/db/src/schema/:

# 1. Apply to local dev DB (as always)
cd lib/db && pnpm drizzle-kit push

# 2. Apply to production DB before or immediately after deploying
DATABASE_URL="<railway-url>" pnpm drizzle-kit push
```

> Always push the schema change to Railway _before_ or _with_ the code change that needs it. The reverse order (code first, schema second) causes errors in production.

---

## Troubleshooting

**Build fails on Railway with "Cannot find package"**
The Dockerfile builds the full monorepo. Check Railway's build logs — if a workspace package can't be found, it usually means the `COPY` in the Dockerfile missed a directory. Confirm `lib/` and `artifacts/` are both copied.

**OAuth redirects to wrong URL / "redirect_uri_mismatch"**
The `GOOGLE_CALLBACK_URL` env var in Railway must exactly match one of the Authorised Redirect URIs in Google Cloud Console. Copy-paste carefully — a trailing slash difference will break it.

**Site loads but API calls return 502**
The app health check is at `/api/healthz`. Check Railway service logs. Usually means the DB isn't connected — verify `DATABASE_URL` is set and the schema has been pushed (Phase 7).

**"relation does not exist" errors in Railway logs**
The schema hasn't been pushed to the production database. Run Phase 7 again.

**Foreign key errors during seed import**
Use the table-by-table fallback in Phase 8.2.

**DNS not resolving**
Check propagation at whatsmydns.net searching for `stash.yourdomain.com` CNAME records. Cloudflare propagates their own DNS quickly but your ISP's cache can take a few hours. Try on mobile data (different DNS resolver) to check sooner.

---

## Future hobby apps on the same domain

Each new project gets its own CNAME record in Cloudflare:

| Subdomain | CNAME target |
|---|---|
| `stash.yourdomain.com` | This app on Railway |
| `garden.yourdomain.com` | Some future app |
| `www.yourdomain.com` | A landing page if you want one |

In Railway, each project is independent. No changes needed at the domain registrar after the initial nameserver switch to Cloudflare.
