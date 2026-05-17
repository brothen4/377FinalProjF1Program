# 🏎️ F1 Tracker

**INST 377 — Final Project**

---

## Title

**F1 Tracker** — Formula 1 Telemetry & Race Data Dashboard

---

## Description

F1 Tracker is a full stack web application for exploring Formula 1 race data and telemetry. The home page displays the  2025 Driver and Constructor Standings, an upcoming race countdown with start times in Eastern, Central, and Pacific US timezones. All sourced from the Jolpica F1 API. The core feature is the telemetry comparison tool pick any Grand Prix session from 2023–2025, select two drivers, choose their laps, and compare five channels of live car data — speed, throttle, brake, RPM, and gear —displayed as synchronized Chart.js line charts alongside S1 / S2 / S3 sector time pills.

**Pages:**
1. **Home** — hero, 2025 Driver Standings table, Next Race countdown with US timezones, Constructor Standings
2. **Telemetry** — session selector → driver selector → lap tables → Chart.js comparison
3. **About** — project description, usage guide, browser support, tech stack, API reference

---

## Target Browsers

| Browser      | Platform        
|-------------|------------------|
| Chrome      | Desktop,         |
| Safari.     | macOS, iOS 17+   |
| Edge        | Desktop          | 

No polyfills required. The app uses CSS Grid, CSS Custom Properties, Fetch API, and `async/await`, all natively supported in the browsers above.

---

## Live Demo

🔗 **[https://f1-tracker.vercel.app](https://f1-tracker.vercel.app)** *(update after deploying)*

---

## Link to Developer Manual

See **Developer Manual** below, starting at [1. How to Install](#1-how-to-install-the-application).

---

---

# Developer Manual

> **Audience:** Future developers taking over this project. You should know web development basics (Node.js, REST APIs, HTML/CSS/JS) but may not know this codebase.

---

## 1. How to Install the Application

### Prerequisites

- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **npm** (bundled with Node.js)
- A **Supabase** account and project — [supabase.com](https://supabase.com)
- **Git**

### Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/f1-tracker.git
cd f1-tracker
npm install
```

**Dependencies installed:**

| Package                  | Purpose                                        |
|-------------------------|------------------------------------------------|
| `express`               | HTTP server and routing                        |
| `body-parser`           | Parses incoming JSON request bodies            |
| `@supabase/supabase-js` | Supabase JS client for database access         |
| `usa-state-validator`   | Validates US state abbreviations (legacy)      |
| `nodemon`               | Auto-restarts server on file changes           |

### Supabase Credentials

Credentials are read from environment variables. For local development, create a `.env` file in the project root:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your_anon_public_key_here
```

Install dotenv and add it to the top of `index.js`:

```bash
npm install dotenv
```

```js
require('dotenv').config(); // add as first line of index.js
```

> Without a `.env` file, `index.js` falls back to hard-coded values for development. Never commit real keys to a public repo.

### Create the Supabase Tables

In your Supabase project → **SQL Editor**, run:

```sql
-- Favorite drivers table
CREATE TABLE favorite_drivers (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_name   TEXT NOT NULL,
  team          TEXT NOT NULL,
  nationality   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy template table (keep for compatibility)
CREATE TABLE customer (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_first_name TEXT,
  customer_last_name  TEXT,
  customer_state      CHAR(2)
);
```

---

## 2. How to Run the Application on a Server

### Local Development

```bash
npm start
```

Starts the server via **nodemon** — auto-restarts on any file change. Visit:

```
http://localhost:3000
```

> **Important:** Always open the app via `http://localhost:3000`, never by double-clicking the HTML files directly. The backend API calls will fail if opened as a `file://` URL.

### Production (Linux VPS / EC2)

```bash
npm install -g pm2
pm2 start index.js --name f1-tracker
pm2 save && pm2 startup
```

### Vercel Deployment

See [Section 5 — Deployment](#5-deploying-to-vercel).

---

## 3. How to Run Tests

No automated test suite is in place. Manual verification checklist:

1. `npm start` — server starts without errors
2. **Home page** — Driver Standings table populates, Next Race card shows countdown and US timezone times, Constructor Standings populate
3. **Telemetry page** — Year → GP → Session → Load Session → lap tables appear for both drivers
4. **Compare** — select a lap for each driver → Compare Telemetry → 5 charts + sector pills render
5. **About page** — renders correctly in Chrome, Firefox, Safari, Edge
6. **API smoke tests** — visit these URLs directly in the browser:
   - `http://localhost:3000/api/favorites` → returns `[]` or array of saved drivers
   - `http://localhost:3000/api/f1/results` → returns `{ session, results }`

### Adding Automated Tests (Future)

```bash
npm install --save-dev jest supertest
```

Example (`tests/api.test.js`):

```js
const request = require('supertest');
const app = require('../index');

test('GET /api/favorites returns array', async () => {
  const res = await request(app).get('/api/favorites');
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('GET /api/f1/results has session and results', async () => {
  const res = await request(app).get('/api/f1/results');
  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveProperty('session');
  expect(res.body).toHaveProperty('results');
});
```

---

## 4. API Endpoints

### Backend Endpoints

Base URL: `http://localhost:3000` (dev) or your Vercel URL (prod).

---

#### `GET /api/favorites`

Returns all saved favorite drivers from the `favorite_drivers` Supabase table.

**200 OK**
```json
[
  { "id": 1, "driver_name": "Max Verstappen", "team": "Red Bull Racing", "nationality": "Dutch", "created_at": "..." }
]
```

**500** — Supabase unreachable or table missing.

---

#### `POST /api/favorites`

Inserts a new favorite driver into Supabase.

**Request body**
```json
{ "driver_name": "Lando Norris", "team": "McLaren", "nationality": "British" }
```

`driver_name` and `team` are required. `nationality` is optional.

**201 Created** — returns the inserted row.  
**400** — missing required fields.  
**500** — Supabase insert error.

---

#### `GET /api/f1/results`

Fetches the most recent 2024 race session and top-10 finishers from the **OpenF1** public API. No API key needed. Used by the telemetry page backend.

**200 OK**
```json
{
  "session": { "name": "Race", "circuit": "Interlagos", "country": "Brazil", "date": "2024-11-03T18:00:00Z", "year": 2024 },
  "results": [
    { "position": 1, "driver_number": 1, "driver_name": "Max Verstappen", "team_name": "Red Bull Racing", "country_code": "NED", "name_acronym": "VER" }
  ]
}
```

**404** — OpenF1 returned no sessions.  
**500** — OpenF1 unreachable or bad response.

---

#### Legacy Endpoints

| Method | Path         | Description                                     |
|--------|-------------|-------------------------------------------------|
| GET    | `/customers` | Fetch all rows from `customer` table (Supabase) |
| POST   | `/customer`  | Insert customer; validates 2-letter US state    |

---

### Frontend (Client-Side) API Calls

The home page makes three additional fetch calls **directly from the browser** to the [Jolpica F1 API](https://api.jolpi.ca) (the modern successor to Ergast). These do not go through the Express backend.

| Call | URL | Used for |
|------|-----|----------|
| Driver Standings | `https://api.jolpi.ca/ergast/f1/2025/driverStandings/` | Standings table on home page |
| Constructor Standings | `https://api.jolpi.ca/ergast/f1/2025/constructorStandings/` | Constructor card on home page |
| Next Race | `https://api.jolpi.ca/ergast/f1/2025/next/` | Next race name, circuit, date/time, countdown |

No API key is required for Jolpica. The race date returned is converted client-side into Eastern, Central, and Pacific US timezones using the browser's built-in `Intl` / `toLocaleString` API.

---

## 5. Deploying to Vercel

1. Push your repo to GitHub — repository must be **public**.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo.
3. Settings:
   - Framework Preset: **Other**
   - Install Command: `npm install`
   - Build Command: *(leave blank)*
4. Under **Environment Variables**, add:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
5. Click **Deploy**.

The included `vercel.json` routes all traffic through `index.js`:

```json
{
  "version": 2,
  "builds": [{ "src": "index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/index.js" }]
}
```

---

## 6. Known Bugs & Roadmap

### Known Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | OpenF1 `/position` returns all intermediate position changes during a race, not just the final result. The backend deduplicates by taking the last entry per driver, which may be inaccurate for late DNFs or penalties. | Low |
| 2 | Laps without a `date_start` field (e.g. formation lap) cannot be telemetry-compared — clicking them raises an error. They are visible in the lap table but cannot be selected. | Low |
| 3 | Jolpica standings data only updates after each race weekend. Mid-weekend standings will not reflect sprint race points until the API is updated. | Low |
| 4 | No user authentication — all visitors share the same backend data. | Medium |

### Future Development Roadmap

- **Full race schedule page** — list all 2025 Grand Prix events with dates, circuits, and direct links to their telemetry sessions
- **Driver profile page** — lap time trends across a full season per driver, sourced from Jolpica
- **DELETE `/api/favorites/:id`** — allow removing a saved driver from the UI without going to the Supabase dashboard
- **PATCH `/api/favorites/:id`** — edit a saved driver's team or nationality
- **Automated tests** — Jest + Supertest covering the three core backend endpoints
- **Mobile telemetry layout** — dedicated responsive layout for the sidebar + chart area on small screens
- **User auth** — Supabase Auth so each visitor has their own private data

---

*Documentation written for INST 477 — May 2025*