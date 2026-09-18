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
