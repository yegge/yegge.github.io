# Universal Music Vault — Administrator's Guide

> **Audience:** System administrators, developers, and operators who need to run, maintain, and troubleshoot this platform. No prior knowledge of the codebase is assumed, but familiarity with a terminal, Docker, and basic web concepts is expected.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Environment Variables](#4-environment-variables)
5. [Local Development Setup](#5-local-development-setup)
6. [Database Management](#6-database-management)
7. [Running the Worker Process](#7-running-the-worker-process)
8. [Production Deployment](#8-production-deployment)
9. [User Roles and Permissions](#9-user-roles-and-permissions)
10. [Artist and Domain Management](#10-artist-and-domain-management)
11. [Audio Upload Pipeline](#11-audio-upload-pipeline)
12. [Blog and Content Management](#12-blog-and-content-management)
13. [Media Library](#13-media-library)
14. [Review Queue](#14-review-queue)
15. [Duplicate Detection](#15-duplicate-detection)
16. [Cloudflare R2 Storage](#16-cloudflare-r2-storage)
17. [Data Model Reference](#17-data-model-reference)
18. [API Route Reference](#18-api-route-reference)
19. [Troubleshooting](#19-troubleshooting)
20. [Runbook: Common Operations](#20-runbook-common-operations)

---

## 1. System Overview

Universal Music Vault is a **multi-artist music streaming and publishing platform**. It serves three distinct public-facing artist websites from a single codebase, determined by the domain the visitor arrives on:

| Domain | Artist |
|---|---|
| `yegge.com` | Yegge |
| `angershade.com` | Angershade |
| `thecorruptive.com` | The Corruptive |
| `vault.yegge.com` | Admin panel (all artists) |

Each artist website provides:
- **Homepage** with latest release and blog posts
- **Albums / Discography** listing with cover art
- **Album pages** with track listings and an audio player
- **Blog** with cover images, tags, and rich text
- **Search** across albums, tracks, and posts

The **admin panel** at `vault.yegge.com` (or `/admin` on any domain for authenticated admins) provides:
- Artist, album, and track management
- Audio file upload and processing pipeline monitoring
- Blog post creation and editing
- Media library (images, assets)
- Review queue for Collaborator-submitted content
- Duplicate track detection queue
- User management and role assignment

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  yegge.com / angershade.com / thecorruptive.com     │
│  vault.yegge.com (admin)                            │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│  Next.js 14 App (Node.js)           port 3000       │
│                                                     │
│  Middleware: domain → x-artist-id header            │
│  (artist)/   public artist pages                    │
│  (admin)/    admin dashboard                        │
│  /api/       REST API routes                        │
│  /api/.../stream/audio  ← audio proxy (server-side) │
└──────┬─────────────────────┬───────────────────────-┘
       │ Prisma ORM           │ AWS SDK v3 (S3-compatible)
┌──────▼───────┐    ┌────────▼──────────────────────┐
│ PostgreSQL 16│    │  Cloudflare R2 (two buckets)  │
│              │    │                               │
│  Users       │    │  platform-masters (private)   │
│  Artists     │    │   FLAC masters                │
│  Albums      │    │   Embedded artwork            │
│  Tracks      │    │   Blog cover images           │
│  Jobs        │    │   Media library files         │
│  Blog Posts  │    │                               │
│  Media Files │    │  platform-streams (private)   │
│  Review Queue│    │   AAC-LC 256k  (.m4a)         │
│  ...         │    │   Opus 128k    (.opus)        │
└──────────────┘    └───────────────────────────────┘
                              ▲
┌─────────────────────────────┴─────────────────────┐
│  Background Worker (separate Node.js process)     │
│                                                   │
│  Poll loop (5s interval):                         │
│   1. IngestJob   — metadata, checksum, fingerprint│
│   2. TranscodeJob — FLAC → AAC + Opus via ffmpeg  │
│   3. WaveformJob  — FLAC → RMS peaks array        │
└───────────────────────────────────────────────────┘
```

### Technology stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.5 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 + custom CSS design system |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Auth | NextAuth v5 (JWT sessions) |
| Object storage | Cloudflare R2 (S3-compatible) |
| Audio processing | ffmpeg (transcode), fpcalc/Chromaprint (fingerprint) |
| Worker runtime | Node.js via `tsx` |
| Container | Docker + Docker Compose |

---

## 3. Prerequisites

### For local development

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 20.x | LTS recommended |
| npm | 10.x | Comes with Node 20 |
| PostgreSQL | 16 | Or run via Docker |
| ffmpeg | 6+ | Must be in `$PATH`; used by worker |
| fpcalc | Any | Chromaprint CLI; optional but needed for fingerprint dedup |
| Git | Any | |

Install ffmpeg on macOS:
```bash
brew install ffmpeg
```

Install Chromaprint (fpcalc) on macOS:
```bash
brew install chromaprint
```

### For production / Docker deployment

- Docker Engine 24+
- Docker Compose v2
- A domain with DNS configured for all artist domains + admin domain
- A Cloudflare account with two R2 buckets provisioned
- A Google Cloud project with OAuth credentials (for Collaborator/VIP login)

---

## 4. Environment Variables

Copy `.env.example` to `.env` and fill in every value before starting the app.

```bash
cp .env.example .env
```

### Complete variable reference

```
# ── Database ───────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://platform:platform_dev@localhost:5432/platform
# Full PostgreSQL connection string.
# In Docker Compose this is overridden to point at the db service container.

POSTGRES_PASSWORD=platform_dev
# Only used by docker-compose.yml to initialise the postgres container.
# Can be any string; must match the password in DATABASE_URL.

# ── NextAuth ───────────────────────────────────────────────────────────────────
NEXTAUTH_SECRET=<32-byte base64 string>
AUTH_SECRET=<same value as NEXTAUTH_SECRET>
# Generate with: openssl rand -base64 32
# NEXTAUTH_SECRET and AUTH_SECRET must be identical — NextAuth v5 reads AUTH_SECRET;
# some adapters still read NEXTAUTH_SECRET.

NEXTAUTH_URL=http://localhost:3000
# The canonical URL of the app.  In production set to https://vault.yegge.com
# (or whichever domain is the primary admin URL).

# ── Admin password ─────────────────────────────────────────────────────────────
ADMIN_PASSWORD=<strong password>
# Password for the built-in admin account.
# This account never touches the database — it has a hardcoded id of "admin"
# and always has the ADMIN role.  Keep this very secret.

# ── Google OAuth ───────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
# Used for Collaborator and VIP sign-in.
# Authorised redirect URI must include: https://vault.yegge.com/api/auth/callback/google
# (and http://localhost:3000/api/auth/callback/google for dev)

# ── Cloudflare R2 — Masters bucket ────────────────────────────────────────────
R2_MASTERS_ENDPOINT=https://<accountId>.r2.cloudflarestorage.com
R2_MASTERS_BUCKET=platform-masters
R2_MASTERS_ACCESS_KEY_ID=<R2 API token access key>
R2_MASTERS_SECRET_ACCESS_KEY=<R2 API token secret key>
# Stores: FLAC masters, embedded artwork, blog cover images, media library files.
# Must NEVER be public. No public bucket access allowed.

# ── Cloudflare R2 — Streams bucket ────────────────────────────────────────────
R2_STREAMS_ENDPOINT=https://<accountId>.r2.cloudflarestorage.com
R2_STREAMS_BUCKET=platform-streams
R2_STREAMS_ACCESS_KEY_ID=<R2 API token access key>
R2_STREAMS_SECRET_ACCESS_KEY=<R2 API token secret key>
# Stores: transcoded AAC (.m4a) and Opus (.opus) delivery files.
# Must NEVER be public. Audio is served through the server-side proxy only.

# ── Internal communication ─────────────────────────────────────────────────────
INTERNAL_SECRET=<any random string>
INTERNAL_BASE_URL=http://localhost:3000
# The middleware calls /api/internal/resolve-domain to map domains to artists.
# INTERNAL_SECRET protects this endpoint from external callers.
# In Docker Compose INTERNAL_BASE_URL is set to http://localhost:3000 (the app service).

# ── Admin domain ───────────────────────────────────────────────────────────────
ADMIN_DOMAIN=vault.yegge.com
# Requests arriving on this domain bypass artist resolution and go straight
# to the admin panel. Leave empty in development (access /admin directly).
```

### Generating secrets

```bash
# NEXTAUTH_SECRET / AUTH_SECRET
openssl rand -base64 32

# INTERNAL_SECRET (simpler is fine here)
openssl rand -hex 16
```

---

## 5. Local Development Setup

### Step 1 — Install dependencies

```bash
cd platform
npm install
```

### Step 2 — Start PostgreSQL

Using Docker (recommended — no local Postgres install needed):
```bash
docker compose up db -d
```

Or if you have Postgres running locally, create the database:
```bash
createdb platform
createuser platform
psql -c "ALTER USER platform WITH PASSWORD 'platform_dev';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE platform TO platform;"
```

### Step 3 — Configure environment

```bash
cp .env.example .env
# Edit .env and fill in at minimum:
#   DATABASE_URL
#   NEXTAUTH_SECRET and AUTH_SECRET (same value)
#   ADMIN_PASSWORD
#   INTERNAL_SECRET
# R2 variables are only needed if you want to test file uploads.
```

### Step 4 — Run database migrations

```bash
npm run db:migrate
```

This applies all pending Prisma migrations and generates the Prisma client.

### Step 5 — Seed the database

```bash
npm run db:seed
```

This creates:
- Artists: Yegge, Angershade, The Corruptive
- Domain mappings: `localhost` → Yegge, `yegge.com`, `angershade.com`, `thecorruptive.com`
- A sample album ("Debut EP") with 3 placeholder tracks for Yegge

### Step 6 — Start the web server

```bash
npm run dev
```

The app is now available at `http://localhost:3000`.

- The **artist site** (Yegge, since localhost resolves to Yegge) is at `/`
- The **admin panel** is at `/admin`

Sign in at `/auth/signin` using the password you set in `ADMIN_PASSWORD`.

### Step 7 — Start the worker (separate terminal)

The worker is required for audio processing. Without it, uploaded tracks will remain in `PENDING` state forever.

```bash
npm run worker
```

The worker polls the database every 5 seconds looking for new IngestJobs, TranscodeJobs, and WaveformJobs.

### Inspecting the database with Prisma Studio

```bash
npm run db:studio
```

Opens a visual database browser at `http://localhost:5555`.

---

## 6. Database Management

### Schema changes

The schema lives in `prisma/schema.prisma`. After editing it:

```bash
# Create and apply a new migration
npm run db:migrate
# Prompts for a migration name, e.g. "add_track_lyrics_field"

# Regenerate the Prisma client (also runs automatically in db:migrate)
npm run db:generate
```

**Never edit migration SQL files by hand** unless you need to add a backfill statement. If you do add SQL, add it immediately after the schema-change statements.

### Applying migrations in production

In production, use `migrate deploy` (not `migrate dev`) — it applies migrations without prompting:

```bash
npx prisma migrate deploy
```

The Docker Compose `app` service runs this automatically on startup:
```yaml
command: sh -c "npx prisma migrate deploy && npx tsx prisma/seed.ts && node server.js"
```

### Re-seeding

The seed script is idempotent (uses `upsert`), so it is safe to re-run at any time without duplicating data:

```bash
npm run db:seed
```

### Connecting directly to the database

```bash
# Docker Compose
docker compose exec db psql -U platform -d platform

# Or with any Postgres client using DATABASE_URL
psql $DATABASE_URL
```

### Useful diagnostic queries

```sql
-- Jobs currently being processed
SELECT id, status, "startedAt", "errorMessage"
FROM "IngestJob" WHERE status IN ('PENDING','PROCESSING','FAILED')
ORDER BY "enqueuedAt" DESC LIMIT 20;

SELECT id, status, "startedAt", "errorMessage"
FROM "TranscodeJob" WHERE status IN ('PENDING','PROCESSING','FAILED')
ORDER BY "enqueuedAt" DESC LIMIT 20;

-- Tracks with no stream files (never finished transcoding)
SELECT t.id, t.title, t."streamStatus"
FROM "Track" t
LEFT JOIN "TrackFile" tf ON tf."trackId" = t.id AND tf.role = 'STREAM'
WHERE tf.id IS NULL;

-- Pending review items
SELECT * FROM "ReviewQueueItem" WHERE status = 'PENDING';

-- Unresolved duplicate alerts
SELECT * FROM "DuplicateQueueItem" WHERE status = 'PENDING';
```

---

## 7. Running the Worker Process

The worker is a long-running Node.js process that handles all background audio processing. It is completely separate from the web server.

### What it does

The worker polls the database every **5 seconds** and processes jobs in priority order:

1. **IngestJob** (highest priority)
   - Downloads the FLAC master from R2 using `GetObjectCommand` directly
   - Extracts metadata (title, track number, year, ISRC, genre) via `music-metadata`
   - Computes SHA-256 checksum for exact duplicate detection
   - Extracts embedded cover art and stores it in R2
   - Runs `fpcalc` to generate a Chromaprint acoustic fingerprint
   - Runs three-pass duplicate detection (checksum → fingerprint → metadata+duration)
   - If duplicates found, creates a `DuplicateQueueItem` for admin review
   - Enqueues a `TranscodeJob` and `WaveformJob`

2. **TranscodeJob**
   - Downloads the FLAC from R2
   - Transcodes to **AAC-LC 256 kbps** `.m4a` (primary delivery format) using ffmpeg
   - Transcodes to **Opus 128 kbps** `.opus` (secondary, if libopus is available)
   - Uploads both files to the streams R2 bucket
   - Sets `streamStatus = ENABLED` if track `reviewStatus = APPROVED`
   - (Collaborator-uploaded tracks stay `DISABLED` until admin approves)

3. **WaveformJob**
   - Downloads the FLAC from R2
   - Pipes through ffmpeg to decode to raw PCM (44100 Hz, mono, f32)
   - Computes RMS peaks at 10 peaks/second
   - Normalises peaks so loudest = 1.0
   - Stores the result in `TrackWaveform.peaks` as JSON

### Starting the worker

```bash
# Development (with live TypeScript compilation via tsx)
npm run worker

# Production (same command — tsx handles TS transpilation)
npm run worker
```

### Worker requirements

- `ffmpeg` must be installed and in `$PATH`
- `fpcalc` (Chromaprint) must be in `$PATH` (optional — fingerprinting is skipped gracefully if absent)
- R2 credentials must be set in the environment
- `DATABASE_URL` must be set

### Worker logs

The worker writes structured logs to stdout:
```
[worker] Started. Polling for ingest / transcode / waveform jobs...
[worker] Ingesting track clxyz123
[ingest] Downloading FLAC: audio/masters/clxyz123.flac
[ingest] Extracting metadata
[ingest] Computing SHA-256
[ingest] Generating fingerprint (fpcalc)
[ingest] Checking for duplicates
[ingest] Queueing transcode + waveform
[worker] Ingest done: clxyz123
[worker] Transcoding track clxyz123
[transcode] Downloading master: audio/masters/clxyz123.flac
[transcode] AAC-LC 256k
[transcode] Uploading AAC → audio/streams/clxyz123-aac256.m4a
[transcode] Opus 128k
[transcode] Uploading Opus → audio/streams/clxyz123-opus128.opus
[transcode] Stream enabled: clxyz123
[worker] Transcode done: clxyz123
```

---

## 8. Production Deployment

### Option A — Docker Compose (recommended)

This is the simplest production deployment. All three services (database, web app, worker) run as Docker containers.

#### Build and start

```bash
# Clone / pull the repo, then:
cp .env.example .env
# Fill in all variables in .env

docker compose up --build -d
```

This starts:
- `db` — PostgreSQL 16 (data persisted to a Docker volume `pgdata`)
- `app` — Next.js web server on port 3000; runs migrations + seed on start
- `worker` — background worker; requires ffmpeg (installed in Dockerfile.worker)

#### Check service health

```bash
docker compose ps
docker compose logs app      # web server logs
docker compose logs worker   # audio processing logs
docker compose logs db       # postgres logs
```

#### Stop / restart

```bash
docker compose down          # stop without removing volumes
docker compose down -v       # stop AND wipe database (destructive!)
docker compose restart app   # restart just the web server
docker compose restart worker
```

#### Updating the app

```bash
git pull
docker compose up --build -d
```

Docker Compose will rebuild only changed images and restart the affected containers. The `app` service re-runs `prisma migrate deploy` on startup, so schema changes are applied automatically.

#### Nginx reverse proxy (recommended for production)

Run Nginx in front of the app to handle TLS, compression, and domain routing:

```nginx
# /etc/nginx/sites-available/platform

# Artist sites
server {
    listen 443 ssl;
    server_name yegge.com www.yegge.com
                angershade.com www.angershade.com
                thecorruptive.com www.thecorruptive.com
                vault.yegge.com;

    ssl_certificate     /etc/letsencrypt/live/yegge.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yegge.com/privkey.pem;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        # Needed for audio streaming (large responses, no buffering)
        proxy_buffering    off;
        proxy_read_timeout 300s;
    }
}

# HTTP redirect to HTTPS
server {
    listen 80;
    server_name yegge.com www.yegge.com angershade.com www.angershade.com
                thecorruptive.com www.thecorruptive.com vault.yegge.com;
    return 301 https://$host$request_uri;
}
```

#### TLS with Certbot

```bash
certbot --nginx -d yegge.com -d www.yegge.com \
  -d angershade.com -d www.angershade.com \
  -d thecorruptive.com -d www.thecorruptive.com \
  -d vault.yegge.com
```

### Option B — Manual (no Docker)

```bash
# Install deps
npm ci

# Generate Prisma client
npm run db:generate

# Build Next.js
npm run build

# Apply migrations
npx prisma migrate deploy

# Seed (only first time)
npm run db:seed

# Start web server
npm start                # listens on port 3000

# Start worker (separate terminal or process manager)
npm run worker
```

Use a process manager like `pm2` or `systemd` to keep both processes running:

```bash
# pm2 example
pm2 start "npm run start" --name platform-web
pm2 start "npm run worker" --name platform-worker
pm2 save
pm2 startup
```

### Environment variables in production

The Docker Compose `app` and `worker` services both load `.env` via `env_file`. Docker overrides `DATABASE_URL` to point to the internal `db` service.

In a non-Docker deployment, load `.env` before starting:
```bash
export $(cat .env | grep -v '#' | xargs)
npm start
```

Or use a tool like `dotenv-cli`:
```bash
npx dotenv -e .env -- npm start
```

---

## 9. User Roles and Permissions

The platform has four roles. Each user has exactly one role.

| Role | Description |
|---|---|
| `ADMIN` | Full access to everything. Manages artists, albums, tracks, users, and approves content. |
| `COLLABORATOR` | Can upload tracks and write blog posts for assigned artists. All content goes through the review queue before publishing. |
| `VIP` | Read-only elevated access. Can stream private/listed tracks for artists they have a VIP grant for. |
| `PUBLIC` | Unauthenticated visitors. Can only see PUBLIC+APPROVED content. |

### How roles are assigned

**Admin** — There is a single built-in admin account. Sign in at `/auth/signin` with the `ADMIN_PASSWORD` from `.env`. This account has the id `"admin"` and never touches the database.

**Collaborators and VIPs** sign in with Google OAuth. After their first sign-in their account is created with role `PUBLIC`. An admin must then:
1. Go to `vault.yegge.com/admin/users`
2. Find the user by email
3. Change their role to `COLLABORATOR` or `VIP`
4. For Collaborators, assign them to specific artists via the Collab Assignments section
5. For VIPs, grant them per-artist access (optionally with an expiry date) via VIP Grants

Role changes take effect the next time the user signs out and back in (JWT sessions are valid for 30 days).

### Streaming access rules

| Role | Can stream PUBLIC tracks | Can stream LISTED tracks | Can stream PRIVATE tracks |
|---|---|---|---|
| ADMIN | ✓ (even DISABLED) | ✓ | ✓ |
| VIP (granted) | ✓ | ✓ | ✓ |
| VIP (not granted) | ✓ | ✗ | ✗ |
| COLLABORATOR | ✓ (PUBLIC only) | ✗ | ✗ |
| PUBLIC | ✓ | ✗ | ✗ |

All streaming goes through the `/stream/audio` proxy — the R2 bucket URL is **never** sent to the browser.

### Visibility vs. streamStatus

These two flags are independent:

- **Visibility** (`PUBLIC` / `LISTED` / `PRIVATE`) — controls who sees the track in listings and search
- **streamStatus** (`ENABLED` / `DISABLED`) — controls whether the audio file is available to play. A track is `DISABLED` until transcoding finishes (or until admin approves a Collaborator submission).

A track must have both `visibility = PUBLIC` AND `streamStatus = ENABLED` for a public visitor to hear it.

---

## 10. Artist and Domain Management

### The domain routing system

When a request arrives, the middleware reads the `Host` header and calls `GET /api/internal/resolve-domain?domain=<host>`. This lookup is cached in-process for 5 minutes.

The resolved `artistId` is injected as the `x-artist-id` request header. Every Server Component in the `(artist)` route group reads this header to scope its database queries.

### Adding a new artist

1. Go to `vault.yegge.com/admin/artists/new`
2. Fill in: name, slug (URL-safe identifier), bio, avatar
3. Save. The artist now exists in the database.
4. Add domain mappings under the artist's settings page, e.g.:
   - `newartist.com` (primary)
   - `www.newartist.com`
5. Point DNS A records for those domains to your server
6. Add the domain to your Nginx config (or SSL cert)

### The ADMIN_DOMAIN bypass

Requests arriving on `vault.yegge.com` skip artist resolution entirely — the middleware lets them through directly to the `(admin)` route group, which handles its own auth. This means the admin panel is accessible regardless of which artist is "active" on that domain.

---

## 11. Audio Upload Pipeline

### Overview

```
Admin uploads FLAC file
        ↓
Browser gets presigned PUT URL  (/api/.../upload-master)
        ↓
Browser PUTs directly to R2 masters bucket
        ↓
Browser confirms upload  (/api/.../confirm-master)
        ↓
Server creates IngestJob (status: PENDING)
        ↓
Worker picks up IngestJob
   → extracts metadata → checksums → fingerprint → dup check
   → creates TranscodeJob + WaveformJob
        ↓
Worker picks up TranscodeJob
   → FLAC → AAC-LC 256k m4a (+ Opus 128k if libopus available)
   → uploads streams to R2
   → sets streamStatus = ENABLED (if reviewStatus = APPROVED)
        ↓
Worker picks up WaveformJob (in parallel with transcode)
   → FLAC → PCM → RMS peaks array
   → stores in TrackWaveform table
        ↓
Track is now streamable; waveform is visible in the player
```

### File storage layout in R2

```
platform-masters/
  audio/masters/{trackId}.flac          ← uploaded FLAC
  artwork/{artistId}/{trackId}.jpg       ← embedded cover art (extracted by ingest)
  blog-covers/{artistId}/{postId}.{ext}  ← blog post cover images
  media/{artistId}/{fileId}/{filename}   ← media library uploads

platform-streams/
  audio/streams/{trackId}-aac256.m4a    ← transcoded AAC delivery file
  audio/streams/{trackId}-opus128.opus  ← transcoded Opus delivery file (optional)
```

### Monitoring processing progress

Admin panel: `vault.yegge.com/admin/transcode-jobs`

Database:
```sql
-- Active jobs by status
SELECT status, COUNT(*) FROM "IngestJob" GROUP BY status;
SELECT status, COUNT(*) FROM "TranscodeJob" GROUP BY status;
SELECT status, COUNT(*) FROM "TrackWaveform" GROUP BY status;
```

### What happens if the worker is not running

Tracks will show status `processing` indefinitely. Their `streamStatus` stays `DISABLED` and they cannot be played. Start the worker to resume processing — jobs accumulate in the queue and will all be processed when the worker comes back up.

### Retrying failed jobs

The worker does not automatically retry failed jobs. To retry:

```sql
-- Retry all failed transcode jobs
UPDATE "TranscodeJob"
SET status = 'PENDING', "errorMessage" = NULL, "startedAt" = NULL
WHERE status = 'FAILED';

-- Retry a specific ingest job
UPDATE "IngestJob"
SET status = 'PENDING', "errorMessage" = NULL, "startedAt" = NULL
WHERE "trackId" = '<trackId>';
```

Then ensure the worker is running.

### Re-ingesting a track

If you need to re-process a track from scratch (e.g. the FLAC was replaced):
```sql
UPDATE "IngestJob"
SET status = 'PENDING', "errorMessage" = NULL, "startedAt" = NULL, "completedAt" = NULL
WHERE "trackId" = '<trackId>';

UPDATE "TranscodeJob"
SET status = 'PENDING', "errorMessage" = NULL, "startedAt" = NULL, "completedAt" = NULL
WHERE "trackId" = '<trackId>';

UPDATE "TrackWaveform"
SET status = 'PENDING', "startedAt" = NULL
WHERE "trackId" = '<trackId>';
```

---

## 12. Blog and Content Management

### Blog post lifecycle

1. **Draft** — visibility = `PRIVATE`, `publishedAt` = null. Not visible publicly.
2. **Published** — visibility = `PUBLIC` or `LISTED`, `reviewStatus` = `APPROVED`, `publishedAt` is set. Visible publicly.
3. **Collaborator submissions** — when a Collaborator creates/publishes a post, visibility is forced to `PRIVATE` and a `ReviewQueueItem` is created. The post doesn't appear publicly until an admin approves it.

### Backdating posts

Admins can set an explicit `publishedAt` date when creating or editing a post. This allows:
- Publishing old content with its original date
- Scheduling posts (set `publishedAt` in the future — post won't appear until then, since the public feed filters by `publishedAt <= NOW()`)

### Tags

Tags are global across all artists (a `BlogTag` has a unique `slug`). Tags are managed at `vault.yegge.com/admin/artists/[id]/blog`.

To create a new tag: POST to `/api/artists/[artistId]/blog/tags` with `{ name, slug }`. Tags upsert on slug.

### Embed URLs

A blog post can include one embedded media URL (`embedUrl`). Allowed hosts are:
```
youtube.com, youtu.be, www.youtube.com
vimeo.com, player.vimeo.com
spotify.com, open.spotify.com
soundcloud.com
```

Embed URLs are validated server-side. Invalid domains are rejected with a 400 error.

### Blog cover images

Cover images are stored in R2 at `blog-covers/{artistId}/{postId}.{ext}`. The upload flow:
1. POST `/api/artists/[id]/blog/[postId]/upload-cover` → returns a presigned PUT URL
2. Browser PUTs the image file directly to R2
3. Server updates `BlogPost.coverKey`

Cover images are served via signed URLs (60-minute expiry) generated server-side. They are never exposed directly from R2.

---

## 13. Media Library

The media library is a per-artist store of images and assets that can be referenced in blog posts.

### Upload flow

1. POST `/api/artists/[id]/media/upload-url` with `{ filename, contentType }` → returns `{ uploadUrl, objectKey, fileId }`
2. Browser PUTs the file directly to R2 using the presigned URL
3. POST `/api/artists/[id]/media/confirm` with `{ fileId, objectKey, filename, mimeType, sizeBytes }` → creates the `MediaFile` record

### Accessing files

GET `/api/artists/[id]/media/[mediaId]/url` → returns a short-lived signed URL for the file.

### Deleting files

DELETE `/api/artists/[id]/media/[mediaId]` — deletes the R2 object and the database record.

---

## 14. Review Queue

The review queue holds content submitted by Collaborators that needs admin approval before going public.

Entities that go through review:
- **Tracks** — when a Collaborator uploads a track with visibility `PUBLIC` or `LISTED`
- **Albums** — when a Collaborator creates/publishes an album
- **Blog posts** — when a Collaborator creates/publishes a post
- **Media files** — when a Collaborator uploads to the media library

### Reviewing items

Admin panel: `vault.yegge.com/admin/review-queue`

Each item shows:
- Entity type (Track, Album, Blog Post, Media File)
- Artist
- Submitter and submission date
- Requested visibility

**Approving** an item:
- Sets the entity's `reviewStatus = APPROVED`
- Sets `visibility` to the `targetVisibility` stored in the queue item
- For tracks: sets `streamStatus = ENABLED` (if transcoding is complete)

**Rejecting** an item:
- Sets the entity's `reviewStatus = REJECTED`
- Entity stays `PRIVATE`
- Optional rejection notes are stored

### API endpoints

```
GET  /api/admin/review-queue                — list all PENDING items
POST /api/admin/review-queue/[itemId]/approve  — body: { targetVisibility? }
POST /api/admin/review-queue/[itemId]/reject   — body: { notes? }
```

---

## 15. Duplicate Detection

When a track is ingested, the worker compares it against every other track for the same artist using three passes:

| Pass | Method | Confidence |
|---|---|---|
| 1 | SHA-256 checksum match | 1.0 — bit-identical files |
| 2 | Chromaprint cross-correlation | 0.85+ — acoustically identical audio |
| 3 | Title + duration within 3 seconds | 0.70–0.79 — metadata fallback |

If any pass exceeds its threshold, a `DuplicateQueueItem` is created.

### Resolving duplicates

Admin panel: `vault.yegge.com/admin/duplicates`

For each pair, the admin chooses a resolution:

| Resolution | Meaning |
|---|---|
| `CONFIRMED_DUPLICATE` | Track A is a duplicate → delete it |
| `KEEP_BOTH` | Different enough to coexist |
| `ALTERNATE_VERSION` | Same song, different recording/mix |
| `REMIX` | A is a deliberate remix of B |
| `REJECT_UPLOAD` | Reject A's upload (wrong file, poor quality) |

---

## 16. Cloudflare R2 Storage

### Bucket setup

Create two buckets in the Cloudflare dashboard:

| Bucket name | Visibility | Purpose |
|---|---|---|
| `platform-masters` | **Private** (no public access) | FLAC masters, artwork, blog covers, media files |
| `platform-streams` | **Private** (no public access) | Transcoded AAC and Opus delivery files |

**Important:** Both buckets must have public access disabled. The application uses signed URLs and server-side proxying exclusively — R2 URLs are never sent to browsers.

### Creating R2 API tokens

In the Cloudflare dashboard → R2 → Manage R2 API Tokens:

Create **two separate tokens** (one per bucket) with **Object Read & Write** permission scoped to each bucket. Copy the Access Key ID and Secret Access Key into your `.env`.

The endpoint format is:
```
https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
```

Find your Account ID in the Cloudflare dashboard sidebar.

### CORS configuration

If you upload files directly from the browser to R2 (the presigned PUT URL flow), you must configure CORS on both buckets. In the Cloudflare dashboard → bucket → Settings → CORS:

```json
[
  {
    "AllowedOrigins": ["https://vault.yegge.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

### Storage growth

Each audio track occupies roughly:
- Masters: ~40 MB per 4-minute FLAC
- Streams: ~8 MB AAC + ~4 MB Opus per 4-minute track

Monitor usage in the Cloudflare dashboard. R2 charges $0.015/GB/month with 10 GB free.

---

## 17. Data Model Reference

### Core entities

**Artist** — Top-level entity. Has a slug (URL path), name, bio, and optional avatar image key. Owns albums, blog posts, media files, and review items.

**Album** — Belongs to an artist. Has a slug, title, cover image, visibility, and release year. Contains tracks.

**Track** — Belongs to an album. Has a slug, title, duration, track number, visibility, and stream status. Goes through the ingest → transcode → waveform pipeline.

**TrackFile** — A file associated with a track. Roles:
- `MASTER` — the original FLAC upload
- `STREAM` — transcoded AAC-LC .m4a for delivery
- `STREAM_OPUS` — transcoded Opus .opus for delivery (optional)

**TrackWaveform** — Separate table storing the waveform peaks JSON. Kept separate to avoid bloating track list queries.

### User/permission entities

**User** — Anyone who has signed in via Google OAuth. Has a role (`PUBLIC` by default).

**CollabAssignment** — Links a `COLLABORATOR` user to a specific artist, granting write access to that artist's content.

**VipGrant** — Links a `VIP` user to a specific artist with optional expiry date, granting streaming access to private/listed tracks.

### Job entities

**IngestJob** — Created when a FLAC is uploaded. Worker processes metadata, checksums, fingerprints, and duplicate detection.

**TranscodeJob** — Created by the ingest worker. Transcodes FLAC to AAC + Opus.

**TrackWaveform** (also used as a job) — Created with `status = PENDING` by ingest. Worker fills in peaks and sets `status = READY`.

**DuplicateQueueItem** — Created by ingest when a potential duplicate is detected. Admin reviews and resolves.

**ReviewQueueItem** — Created when a Collaborator submits content for publishing. Admin approves or rejects.

### Visibility and review

Visibility and reviewStatus are **independent**:

```
Track.visibility    = PUBLIC | LISTED | PRIVATE
Track.reviewStatus  = PENDING | APPROVED | REJECTED
Track.streamStatus  = ENABLED | DISABLED
```

A track must have:
- `visibility = PUBLIC` for public visitors to see it
- `streamStatus = ENABLED` for the play button to work
- `reviewStatus = APPROVED` for Collaborator-submitted content to become visible

---

## 18. API Route Reference

All API routes require authentication unless noted as **public**. Routes under `/api/artists/[artistId]/` require the caller to have at least "read" access for the artist's content.

### Artist routes

```
GET    /api/artists                        — list all artists (admin only)
POST   /api/artists                        — create artist (admin only)
GET    /api/artists/[artistId]             — get artist details
PATCH  /api/artists/[artistId]             — update artist (admin only)
DELETE /api/artists/[artistId]             — delete artist (admin only)
```

### Album routes

```
GET    /api/artists/[artistId]/albums              — list albums (visibility-filtered)
POST   /api/artists/[artistId]/albums              — create album (write access)
GET    /api/artists/[artistId]/albums/[albumId]    — get album + tracks
PATCH  /api/artists/[artistId]/albums/[albumId]    — update album
DELETE /api/artists/[artistId]/albums/[albumId]    — delete album (admin only)
```

### Track routes

```
GET    /api/artists/[artistId]/albums/[albumId]/tracks              — list tracks
POST   /api/artists/[artistId]/albums/[albumId]/tracks              — create track
GET    /api/artists/[artistId]/albums/[albumId]/tracks/[trackId]    — get track
PATCH  /api/artists/[artistId]/albums/[albumId]/tracks/[trackId]    — update track
DELETE /api/artists/[artistId]/albums/[albumId]/tracks/[trackId]    — delete track + R2 files
POST   /api/artists/[artistId]/albums/[albumId]/tracks/[trackId]/upload-master   — get presigned PUT URL
POST   /api/artists/[artistId]/albums/[albumId]/tracks/[trackId]/confirm-master  — confirm upload + enqueue ingest
GET    /api/artists/[artistId]/albums/[albumId]/tracks/[trackId]/stream/audio    — audio proxy (Range-aware)
GET    /api/artists/[artistId]/albums/[albumId]/tracks/[trackId]/waveform        — get waveform peaks
```

### Blog routes

```
GET    /api/artists/[artistId]/blog                    — list posts (visibility-filtered, public)
POST   /api/artists/[artistId]/blog                    — create post (write access)
GET    /api/artists/[artistId]/blog/[postId]           — get post
PATCH  /api/artists/[artistId]/blog/[postId]           — update post
DELETE /api/artists/[artistId]/blog/[postId]           — delete post + cover from R2
POST   /api/artists/[artistId]/blog/[postId]/publish   — publish/unpublish post
POST   /api/artists/[artistId]/blog/[postId]/upload-cover — get presigned PUT URL for cover
GET    /api/artists/[artistId]/blog/tags               — list all tags (public)
POST   /api/artists/[artistId]/blog/tags               — create/upsert tag (admin only)
```

### Media library routes

```
GET    /api/artists/[artistId]/media                   — list media files (write access)
POST   /api/artists/[artistId]/media/upload-url        — get presigned PUT URL
POST   /api/artists/[artistId]/media/confirm           — confirm upload + create record
GET    /api/artists/[artistId]/media/[mediaId]/url     — get short-lived signed URL
DELETE /api/artists/[artistId]/media/[mediaId]         — delete file + R2 object
```

### Admin routes

```
GET    /api/admin/review-queue                           — list PENDING items
POST   /api/admin/review-queue/[itemId]/approve          — approve content
POST   /api/admin/review-queue/[itemId]/reject           — reject content
GET    /api/admin/duplicates                             — list PENDING duplicates
POST   /api/admin/duplicates/[itemId]/resolve            — resolve duplicate pair
```

### User management

```
GET    /api/users                                         — list users (admin)
PATCH  /api/users/[userId]                                — update role (admin)
GET    /api/users/[userId]/collab-assignments             — list assignments (admin)
POST   /api/users/[userId]/collab-assignments             — assign to artist (admin)
DELETE /api/users/[userId]/collab-assignments/[artistId]  — remove assignment (admin)
GET    /api/users/[userId]/vip-grants                     — list grants (admin)
POST   /api/users/[userId]/vip-grants                     — grant VIP access (admin)
DELETE /api/users/[userId]/vip-grants/[artistId]          — revoke grant (admin)
```

### Internal

```
GET /api/internal/resolve-domain?domain=<host>
  — Maps a hostname to an artistId. Called by the middleware.
  — Protected by x-internal-secret header. Never call this externally.
```

---

## 19. Troubleshooting

### The app won't start

**Symptom:** `npm run dev` crashes immediately.

1. Check that PostgreSQL is running:
   ```bash
   docker compose ps db
   # or
   pg_isready -h localhost -p 5432
   ```

2. Check that `DATABASE_URL` is correct:
   ```bash
   npx prisma db pull 2>&1 | head -5
   ```

3. Check that migrations have been applied:
   ```bash
   npm run db:migrate
   ```

4. Check for missing environment variables — the app will fail with a descriptive error if any required variable is missing.

---

### Domain resolves to wrong artist / "Unknown domain" page

**Symptom:** Visiting `localhost:3000` shows the "unknown domain" error page.

1. The database seed was not run. Run:
   ```bash
   npm run db:seed
   ```

2. Localhost is not mapped to an artist. Check `ArtistDomain` table:
   ```sql
   SELECT * FROM "ArtistDomain" WHERE domain = 'localhost';
   ```
   If missing, add it:
   ```sql
   INSERT INTO "ArtistDomain" (id, domain, "artistId", "isPrimary", "createdAt")
   VALUES (gen_random_uuid()::text, 'localhost', '<yegge artistId>', true, now());
   ```

3. The middleware cache is stale (5-minute TTL). Restart the dev server.

---

### Audio player shows "processing" but the worker is running

**Symptom:** Tracks show a spinner or "processing" state indefinitely.

1. Check the worker logs for errors:
   ```bash
   docker compose logs worker --tail=50
   # or
   npm run worker  # and watch stdout
   ```

2. Check for failed jobs:
   ```sql
   SELECT id, "trackId", status, "errorMessage"
   FROM "TranscodeJob" WHERE status = 'FAILED' ORDER BY "enqueuedAt" DESC LIMIT 10;
   ```

3. Common worker failures:
   - **ffmpeg not found** — install ffmpeg and ensure it's in `$PATH`
   - **R2 credentials wrong** — verify `R2_MASTERS_*` variables
   - **No MASTER TrackFile found** — the FLAC was never confirmed after upload; the confirm-master endpoint was not called. Re-upload the track.
   - **Out of disk space** — the worker writes temp files to `/tmp`; check disk usage

4. Retry failed jobs (see §11 Retrying failed jobs).

---

### Audio proxy returns 503

**Symptom:** Playing a track returns `{"error":"not_ready","message":"Audio is still being processed"}`.

The track has no `STREAM` or `STREAM_OPUS` `TrackFile` yet. Transcoding hasn't completed (or failed). See above.

---

### Audio proxy returns 403

**Symptom:** Clicking play shows a forbidden error.

1. The user is not authenticated and the track is `PRIVATE` or `LISTED`.
2. The track's `streamStatus` is `DISABLED` (transcoding not complete, or Collaborator content awaiting approval).
3. Check `Track.streamStatus` and `Track.visibility` in the database.

---

### Sign-in fails with "Configuration" error

**Symptom:** Visiting `/auth/signin` and attempting to sign in results in an error page.

1. **For admin password login:** Check that `ADMIN_PASSWORD` is set in `.env`.

2. **For Google OAuth:**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set correctly.
   - Verify the OAuth consent screen is configured in Google Cloud Console.
   - Verify the Authorised Redirect URI includes your domain:
     ```
     https://vault.yegge.com/api/auth/callback/google
     http://localhost:3000/api/auth/callback/google  (for dev)
     ```
   - Verify `NEXTAUTH_URL` / `NEXTAUTH_SECRET` / `AUTH_SECRET` are set.

---

### New user signs in but has no access

**Symptom:** User can sign in via Google but sees the public site only.

This is expected. New Google OAuth users get role `PUBLIC` by default. An admin must:
1. Go to `vault.yegge.com/admin/users`
2. Find the user and change their role
3. For Collaborators, add a Collab Assignment for the relevant artist

The user must sign out and sign back in for the role change to appear in their session.

---

### Blog posts not appearing on the public site

**Symptom:** A post was created but doesn't show on `/blog`.

Check all of these:
1. `visibility` must be `PUBLIC` or `LISTED` (not `PRIVATE`)
2. `reviewStatus` must be `APPROVED`
3. `publishedAt` must be set and not in the future

```sql
SELECT id, title, visibility, "reviewStatus", "publishedAt"
FROM "BlogPost"
WHERE "artistId" = '<artistId>';
```

---

### R2 uploads fail with CORS error

**Symptom:** The browser console shows a CORS error when uploading files directly to R2.

Add a CORS rule to both R2 buckets (see §16 CORS configuration). The allowed origin must exactly match the domain the user is uploading from.

---

### `prisma migrate dev` fails with "drift detected"

**Symptom:**
```
Error: P3005 — The database schema is not empty. Read more about how to baseline migrations.
```

This happens when the database has schema that doesn't match the migration history (e.g., the DB was created with `db push` and then you switched to migrations).

Fix:
```bash
# Mark the current state as the baseline
npx prisma migrate resolve --applied "0001_initial"

# Then try migrating again
npx prisma migrate dev
```

---

### Worker processes a job but it re-appears as PENDING

**Symptom:** The same job keeps being picked up repeatedly.

The job was set to `PROCESSING` but the worker crashed before completing it. On restart the worker won't re-claim a `PROCESSING` job (it only picks up `PENDING`). Fix by resetting it:

```sql
UPDATE "TranscodeJob"
SET status = 'PENDING', "startedAt" = NULL
WHERE status = 'PROCESSING';
```

---

### "Prisma Client is not yet initialized" at runtime

**Symptom:** `Error: PrismaClient is not yet initialized — PrismaClient is not exported from generated client`.

Run:
```bash
npm run db:generate
# or
npx prisma generate
```

In Docker, this is handled automatically during the image build. If you see this in Docker, the image needs to be rebuilt:
```bash
docker compose up --build
```

---

### Out of memory — worker crashes on large FLAC files

**Symptom:** Worker process kills itself (exit code 137 in Docker) when processing large files.

The waveform job loads the entire decoded PCM into memory. A 30-minute FLAC decoded to 44100 Hz mono f32 uses ~1.1 GB of RAM. In production:
- Give the worker container at least 2 GB of RAM
- Docker Compose: `mem_limit: 2g` under the worker service
- Or set the Node.js heap limit: `NODE_OPTIONS=--max-old-space-size=2048 npm run worker`

---

## 20. Runbook: Common Operations

### Adding a new artist website

1. **Create the artist** in the admin panel: `vault.yegge.com/admin/artists/new`
   - Set slug, name, bio
   - Upload avatar (optional)
2. **Add domain mappings** under the artist's settings: e.g. `newartist.com`, `www.newartist.com`
3. **Point DNS** — create A records pointing `newartist.com` to your server's IP
4. **Update Nginx** to include the new domain in the `server_name` directive
5. **Obtain TLS certificate**: `certbot --nginx -d newartist.com -d www.newartist.com`
6. **Add R2 CORS rule** — add the new domain to the AllowedOrigins list on both buckets
7. Verify by visiting `http://newartist.com` — you should see the artist homepage

---

### Uploading an album

1. Go to `vault.yegge.com/admin/artists/[id]`
2. Click **New Album** → fill in title, slug, release year, visibility → Save
3. On the album page, click **Add Track** for each track
4. For each track:
   - Fill in title and track number
   - Click **Upload FLAC** and select the master audio file
   - Wait for the upload to complete (the browser uploads directly to R2)
   - Click **Confirm Upload**
5. The track now shows "Processing" — the worker will handle transcoding and waveform generation
6. Once processing completes, set visibility to `PUBLIC` if desired

---

### Promoting a Collaborator submission

1. Go to `vault.yegge.com/admin/review-queue`
2. Find the pending item (track, album, or blog post)
3. Click **Review** to see the content
4. Click **Approve** (optionally adjusting the target visibility) or **Reject** (with notes)
5. Approved content immediately becomes visible to the public

---

### Granting VIP access to a listener

1. Have the user sign in with Google OAuth at any artist site
2. Go to `vault.yegge.com/admin/users` and find them by email
3. Change their role to `VIP` (Save)
4. Go to the VIP Grants section for that user
5. Click **Add Grant** → select the artist → optionally set an expiry date
6. The user must sign out and back in to activate the new access

---

### Rotating the admin password

1. Set a new `ADMIN_PASSWORD` in `.env`
2. Restart the web server:
   ```bash
   docker compose restart app
   # or
   pm2 restart platform-web
   ```
3. There is no database record to update — the password is checked directly against the env var on every login attempt.
4. Existing admin sessions remain valid until their 30-day JWT expiry. To invalidate all sessions immediately, also rotate `AUTH_SECRET` / `NEXTAUTH_SECRET` and restart.

---

### Backing up the database

```bash
# Docker Compose
docker compose exec db pg_dump -U platform platform \
  | gzip > platform_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore
gunzip -c platform_backup_20260420_120000.sql.gz \
  | docker compose exec -T db psql -U platform -d platform
```

R2 objects are stored durably by Cloudflare (11 nines). The database is the only thing that needs regular backups.

---

### Checking which version is deployed

```bash
# Docker
docker compose exec app node -e "console.log(process.version)"

# Check Next.js version
docker compose exec app node -e "const p=require('./package.json'); console.log(p.dependencies.next)"

# Git commit (if built from a git repo)
git log --oneline -1
```

---

*Last updated: 2026-04-20*
