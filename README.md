# Bro in Campus

Bro in Campus is a MongoDB-backed shared-living network for colleges, hostels, campuses, housing societies and apartment communities. It combines a Quora-style community, useful campus/career tools and a practical place hub for the people who live together.

It includes authenticated Q&A, answers, votes, follows, bookmarks and notifications; real event RSVPs and support requests; plus company reviews, live opportunities and saved roles. A place can be listed by a resident, joined by its people, supplied with a building count and location, and used for shared local-living information:

- Nearby market discovery from OpenStreetMap/Overpass data, with distance calculated from the listed place.
- Resident-added markets when map data is incomplete.
- Timestamped fruit, vegetable and grocery availability reports from people who actually visited a market.
- A shared issue board: one resident reports water, safety, electricity, noise or maintenance problems; other members can support it and everyone sees the same priority.

## Connect a live MongoDB server

Create a free MongoDB Atlas cluster (or use another hosted MongoDB deployment), create a database user, and allow your development IP in its network-access settings. Then:

```powershell
Copy-Item .env.example .env
# Paste the MongoDB Atlas `mongodb+srv://...` connection string into DATABASE_URL in .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

Then open `http://localhost:3000`.

The seed includes a working demo account: `meera@broincampus.dev` / `Campus123!`.

MongoDB Atlas supports the transactions used by RSVPs, votes and follows. Do not add your real database URL to source control.

## Location data and market availability

The “Use my location” action in the place listing form uses the browser's permission prompt and stores only the submitted place coordinates. The server queries the Overpass API for nearby markets; configure `LOCATION_USER_AGENT` with a real deployment contact and respect the provider's usage policy.

Map data identifies locations and distance, not live shop inventory. Availability and price notes are intentionally resident-reported and timestamped, so the app does not pretend that fruit or vegetable stock is known when it is not.

## Brand asset

The supplied Bro in Campus logo lives at `public/brand/bro-in-campus-logo.png`. The shared `BrandLogo` component presents this original file consistently across the interface without redrawing it.

## Deploy to Vercel

Import this repository into Vercel with the **Next.js** preset and the repository root as the root directory. Use `npm install` and `npm run build`; Prisma Client is generated automatically. Alternatively, run `vercel login`, `vercel link`, and `vercel --prod` from this directory.

Before deploying, add these values in the project's **Settings → Environment Variables** for Production (and separately for Preview if needed):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MongoDB Atlas connection string with a database name; allow connections from the deployment in Atlas network settings. |
| `AUTH_SECRET` | Private random value of at least 32 characters. Keep the same value across production instances. |
| `GMAIL_USER` | Gmail account used to send password-reset codes. |
| `GMAIL_APP_PASSWORD` | That account's Google App Password; required for password recovery. |
| `GMAIL_FROM` | Optional sender; defaults to `GMAIL_USER`. |
| `LOCATION_USER_AGENT` | Application name and a real contact address for market discovery. |
| `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` | Optional browser-restricted key; OpenStreetMap works without it. |

Local `.env` files are excluded from deployment uploads. Never paste secret values into source files or commit them. Redeploy after changing environment variables.

For a new database, run `npm run db:push` with its `DATABASE_URL` configured to create the schema/indexes. MongoDB uses `db push`, not Prisma Migrate. Do not run the demo seed against production: it creates a publicly documented demo login. Schema changes are deliberately separate from builds.

Active pages refresh persisted data every 30 seconds and when the browser reconnects or becomes visible. This works across Vercel instances without a persistent SSE connection. The legacy `/api/realtime` endpoint is only a process-local event stream; deployed clients do not depend on it. Request throttling remains process-local, so it is not a distributed abuse limit.

After deployment, verify registration, sign-in/sign-out, a question and answer, campus membership, notifications, and password-reset email on the production URL. A successful build alone does not verify database network access or email delivery from Vercel.
