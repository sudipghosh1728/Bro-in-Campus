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

To create the developer admin, register the chosen account normally, then use Prisma Studio (`npm run db:studio`) with the intended `DATABASE_URL` and change that account's `User.role` to `ADMIN`. There is intentionally no public self-promotion flow. Admins can manage user roles and college listings; support impersonation is limited to active standard-user accounts, is recorded in `AdminImpersonation`, and can be ended from the in-app banner.

Admins can clear non-admin accounts from **Admin → Danger zone**. This permanently deletes non-admin accounts and their authored/account-linked data in that deployment's configured database while retaining every admin account and session; shared catalogs are kept. Back up the database first. The action requires typing `DELETE NON-ADMIN USERS`.

After deploying the impersonation audit model, apply the Prisma schema to each intended database with `npm run db:push` before using the admin panel.

Active pages refresh persisted data every 30 seconds and when the browser reconnects or becomes visible. This works across Vercel instances without a persistent SSE connection. The legacy `/api/realtime` endpoint is only a process-local event stream; deployed clients do not depend on it. Request throttling remains process-local, so it is not a distributed abuse limit.

After deployment, verify registration, sign-in/sign-out, a question and answer, campus membership, notifications, and password-reset email on the production URL. A successful build alone does not verify database network access or email delivery from Vercel.

## Learning and member-reviewed campus data

College listings can select discipline groups from the database catalog. Listing owners, moderators and admins can maintain those groups; they are not a verified catalog of every degree offered. Students can save private learning milestones and resume them under **Learn → My learning**. Completion is self-reported and validated against the current curriculum, not a qualification or certification.

The campus consensus board covers **location and placement/recruitment details**. Each campus member has one changeable vote per review. A proposal needs more than 50% of participating votes and at least three voters to become the accepted result. A tie or insufficient participation preserves the last accepted result. Suspended accounts are excluded, and support impersonation cannot submit votes. Public responses do not expose voter identities. Votes persist after leaving a campus until withdrawn; membership is required for new votes. This is account-based community agreement, not independently verified identity or official recruitment confirmation. Admin edits cannot bypass location consensus.

The community screen uses a responsive channel-and-conversation layout. These are public discussions, not private or end-to-end-encrypted messages. Anonymous campus issue reports remain a separate feature.

## Performance and verification

- The homepage reads small projections instead of full feeds and profiles.
- Discussion queries fetch at most one page plus a cursor sentinel, without loading every answer. Author/profile/topic and personal-state reads are batched in parallel for the visible page only. Recommended ranking is applied within each chronological page. Filtering and pagination skip unchanged sidebar data.
- Public learning and department catalogs are cached for five minutes. Briefing refresh invalidates that catalog cache. Account progress, votes, likes and notification counts stay outside shared caches.
- The header fetches only an unread count. Member searches do not reload the entire admin dashboard. Route loading states and lazy avatar decoding improve navigation feedback.
- Fonts are served by the application through `next/font` instead of a render-blocking external CSS import; the original font families and supplied logo are retained.

```powershell
npm test
npm run lint
npm run test:integration
npm run build
npm run start -- --port 3001
# In another terminal, with other database tests stopped:
node scripts/benchmark-pages.mjs http://127.0.0.1:3001
```

The integration script creates a randomly named `bic_verify_*` MongoDB database on the configured server; it never seeds or resets the application database. It removes fixture documents when finished. The empty test database/indexes can remain because Atlas credentials may not permit dropping databases. Interrupted runs may require fixture cleanup. The benchmark reports three warm local full-response timings per route, not a Lighthouse score or a production latency guarantee.

Verification on 6 November 2026: production build/typecheck, eight unit tests and the isolated integration suite passed. Browser checks passed for desktop/mobile channels, search/empty states, the learning guest view and placement-review tab, with no page runtime errors or external Google font requests. The final local smoke run measured `/learn` at a 104 ms warm median; uncached routes were variable (including a 7.3 s feed API median). Host load and remote database latency changed substantially between runs, so these results do not establish an overall before/after speedup. Production-region and database performance still need measurement after deployment access is restored.

A same-session, alternating comparison on 7 November isolated the feed data loader: batching independent reads reduced the guest feed-only median from 61 ms to 40 ms, and the full feed median from 59 ms to 41 ms (three warm samples per variant on the current small dataset). The old and new guest responses were compared for equality. These are loader timings, not whole-page or production measurements.

For `broincampus.in`, retain the existing Vercel project and GoDaddy registration. The authenticated Vercel account must have access to the linked project before attaching the domain. Use that project's exact DNS instructions; preserve unrelated GoDaddy mail and verification records. Application changes are not live until the owning project is successfully deployed and its database-backed routes are verified.
