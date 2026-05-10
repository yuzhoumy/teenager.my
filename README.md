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

- **Framework:** [Next.js](https://nextjs.org) **16** (App Router), **static export** (`output: "export"`).
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
| `NEXT_PUBLIC_GEMINI_API_KEY` | For AI tutor | Google AI Studio / Gemini API key. Loaded in the browser for this static-export app—**restrict the key** (HTTP referrer / bundle restrictions in Google Cloud) and rotate if leaked. |
| `NEXT_PUBLIC_GEMINI_MODEL` | No | Gemini model id (default `gemini-2.0-flash`). |

\*The app runs without them for static pages, but **login, forum, uploads, and data features need Supabase configured.**

The project uses **`output: "export"`**, so there is **no server-side API route** for Gemini—the tutor calls the API from the client. To hide the key entirely you would need a proxy (e.g. Supabase Edge Function or a small backend) and to remove static export or host the API separately.

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

This project uses **static HTML export** (`next.config.ts` → `output: "export"`).

```bash
npm run build
```

Outputs a static site in the **`out/`** directory (trailing slashes enabled). There is **no Node server requirement** in production—you can host `out/` on any static file host.

**Note:** `npm run start` runs the Next production server, which is aimed at **non-export** deployments. For this static-export setup, serve **`out/`** instead (see below).

---

## Deployment

### General (static hosting)

1. Set the same **`NEXT_PUBLIC_*`** variables in your host’s build environment (Vercel, Netlify, Cloudflare Pages, GitHub Actions → S3, etc.).
2. Run **`npm ci`** (or `npm install`) then **`npm run build`**.
3. Publish the **`out/`** folder as the site root.

Configure the host to:

- Serve **`index.html`** for directory routes if needed (many static hosts do this automatically for rewritten paths).
- Use **HTTPS** so auth cookies and mixed content behave correctly.

### Example: Netlify

- Build command: `npm run build`
- Publish directory: `out`
- Add the same env vars as in `.env.local`.

### Example: Cloudflare Pages

- Framework preset: None or Next (static export)
- Build command: `npm run build`
- Output directory: `out`

### Preview locally after build

```bash
npx --yes serve out
```

Or any static server pointed at `out/`.

### Supabase outside production

Point `NEXT_PUBLIC_SUPABASE_URL` and keys at your project. Add your **deployed site URL** to Supabase **Authentication → URL configuration** (redirect URLs / site URL) so magic links and OAuth work.

---

## Project layout (short)

| Path | Role |
|------|------|
| `src/app/` | Routes (App Router), global layout, pages. |
| `src/components/` | UI: layout, forum, resources, profile, notifications, etc. |
| `src/lib/` | Supabase clients, helpers (e.g. `pdfjs-worker`, materials). |
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
