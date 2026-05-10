# teenager.my

A **study commons** web app for Malaysian secondary students: browse and upload learning materials, **fork** PDF-based resources with annotations, discuss in a **forum**, follow other users, and get **notifications** when something relevant happens. The UI is built for long reading sessions—editorial layout, light/dark mode, and layouts tuned for phones and desktops.

Backend and auth are provided by **[Supabase](https://supabase.com)** (Postgres, Row Level Security, Auth, Storage).

---

## Features (overview)

| Area | What it does |
|------|----------------|
| **Resources** | Search and filter materials (notes, trial papers, past years, etc.). Resource detail with markdown, embedded PDFs, stars/bookmarks. |
| **Forks** | Personal forks of a resource with drawing/text annotations on PDFs; community fork listing. |
| **Forum** | Markdown posts and threaded comments; attachments via Supabase Storage when configured. |
| **Profiles & social** | Public profiles, follows; display names resolved from `profiles` so renames show in the forum. |
| **Notifications** | In-app feed (follows, forks, comments, mentions, followed-activity, announcements). Backed by Postgres triggers—run the SQL migration in Supabase. |
| **AI tutor** | Floating Gemini-powered chat (bottom-right). Requires a Google AI API key in env—see below. |
| **Leaderboard** | Shown when implemented in the app (if your branch includes it). |

---

## Tech stack

- **Framework:** [Next.js](https://nextjs.org) **16** (App Router).
- **UI:** React 19, Tailwind CSS 4, Radix Slot, Lucide icons.
- **Data:** `@supabase/supabase-js`, typed tables in `src/types/database.ts`.
- **Rich content:** `react-markdown`, `react-pdf` / PDF.js (worker URL configurable—see env below), Fabric for canvas annotations.
- **AI:** `@google/generative-ai` (Google Gemini) for the floating study tutor.

---

## Prerequisites

- **Node.js** 20+ (recommended; matches `package.json` types).
- A **Supabase project** (URL + anon key at minimum).
- **npm** (or pnpm/yarn) to install dependencies.

---

## Environment variables

Create **`.env.local`** in the project root (never commit secrets):

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes* | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes* | Supabase anon/public key (client-safe). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | No | Alternative name some setups use instead of anon key. |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | No | Storage bucket for uploads (default `resource-attachments`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/admin only | Service role—**do not** expose to the browser; only for scripts/admin tooling. |
| `NEXT_PUBLIC_PDF_WORKER_URL` | No | Override PDF.js worker URL if the default CDN is blocked on your network. |
| `GEMINI_API_KEY` | Tutor on Node/Vercel | Server-only key for `POST /api/tutor/`. |
| `GEMINI_MODEL` | No | Server model id (default `gemini-2.0-flash`). |
| `NEXT_PUBLIC_GEMINI_API_KEY` | Tutor on GitHub Pages | Browser fallback when `/api/tutor/` is missing (**embedded in JS** — restrict by referrer). GitHub Actions: add as repository secret; workflow passes it into the build. |
| `NEXT_PUBLIC_GEMINI_MODEL` | No | Browser fallback model id. |

\*The app runs without Supabase for static-looking pages, but **login, forum, uploads, and data features need Supabase configured.**

**Production vs local:** Variables in **`.env.local`** apply only on your machine. The live site reads env vars from **Vercel / Netlify / Cloudflare / etc.** After adding `GEMINI_API_KEY` there, **trigger a new deploy** so the serverless/API routes pick it up.

---

## Database (Supabase)

Schema and policies live under **`supabase/`**:

- `supabase/schema.sql` — baseline tables and RLS.
- `supabase/resource_schema_migration.sql` — resource/fork-related deltas (if you maintain that file).
- `supabase/notifications_migration.sql` — notifications + announcements + triggers (if you use that feature).

Apply the SQL you need in the Supabase **SQL Editor** (or via the Supabase CLI) so the client matches `src/types/database.ts`. Enable **Realtime** on `notifications` if you want live unread badges in the navbar.

---

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). After changing `.env.local`, restart the dev server.

```bash
npm run lint
```

---

## Production build

```bash
npm run build
npm run start
```

Use **`npm run start`** for a production Node server (needed for **API routes** such as `/api/tutor`). Platforms like **Vercel** run this for you automatically.

---

## Deployment

### Recommended: Vercel (or similar Next.js host)

1. Connect the repo and use the default Next.js preset.
2. In **Project → Settings → Environment Variables**, add at least:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`GEMINI_API_KEY`** (same key you use in `.env.local` for local tutor tests)
3. Redeploy after changing secrets.

The AI tutor calls **`POST /api/tutor/`** (trailing slash matches `next.config`) on the same origin, so the Gemini key stays on the server.

**If the tutor returns HTTP 405 in production:** the deployment is almost certainly still **static-only** (no Next server). Deploy with **`next start`** or Vercel’s Next preset (do **not** set `GITHUB_PAGES` / `STATIC_EXPORT` there), and ensure **`GEMINI_API_KEY`** is set in the host env.

### GitHub Pages (static)

The workflow **`.github/workflows/deploy-pages.yml`** sets **`GITHUB_PAGES=true`** during `npm run build`, which enables **`output: "export"`** and produces **`out/`** for `upload-pages-artifact`.

GitHub Pages cannot run **`/api/tutor`**. The tutor **detects 404/405/503** and falls back to calling Gemini **from the browser** if you add repository secrets **`NEXT_PUBLIC_GEMINI_API_KEY`** (and optionally **`NEXT_PUBLIC_GEMINI_MODEL`**). That key is embedded in the JS bundle—**restrict it by HTTP referrer** in Google AI Studio / Cloud Console.

For production without exposing any key, deploy on **Vercel** with **`GEMINI_API_KEY`** only (server route).

### Other hosts

Any setup that runs **`next build`** and **`next start`** (or the platform’s Next.js integration) works—leave **`GITHUB_PAGES`** unset so static export stays off.

### Supabase in production

Point `NEXT_PUBLIC_SUPABASE_URL` and keys at your project. Add your **deployed site URL** to Supabase **Authentication → URL configuration** (redirect URLs / site URL) so magic links and OAuth work.

---

## Project layout (short)

| Path | Role |
|------|------|
| `src/app/` | Routes (App Router), global layout, pages. |
| `src/components/` | UI: layout, forum, resources, profile, notifications, etc. |
| `src/lib/` | Supabase clients, helpers (e.g. `pdfjs-worker`, materials, `gemini-tutor`). |
| `src/app/api/tutor/` | Server route: Gemini tutor (uses `GEMINI_API_KEY`). |
| `src/types/database.ts` | Generated or hand-maintained Supabase types. |
| `public/` | Static assets served as-is. |
| `supabase/` | SQL migrations / reference schema. |

---

## Agent / contributor notes

- Next.js in this repo may differ from older docs; see `AGENTS.md` / `CLAUDE.md` if present.
- Follow existing patterns: small, focused changes; match file style and types.

---

## License

Private project unless you add an explicit license file.
