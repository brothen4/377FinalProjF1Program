const express    = require('express');
const bodyParser = require('body-parser');
const supabase   = require('@supabase/supabase-js');
const { isValidStateAbbreviation } = require('usa-state-validator');
const path       = require('path');

const app  = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Explicit routes for Vercel
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/telemetry.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'telemetry.html'));
});

app.get('/about.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'about.html'));
});

// Client
const sb = supabase.createClient(
  process.env.SUPABASE_URL || 'https://ekrqvjzsegifqcsupijl.supabase.co',
  process.env.SUPABASE_KEY || 'sb_publishable_DtHjbqJgka32HCVvQ-EvJQ_cIUK3KkE'
);

// ENDPOINT 1 — GET api favorites
// Reads all saved drivers from Supabase 
app.get('/api/favorites', async (req, res) => {
  console.log('[GET] /api/favorites');
  const { data, error } = await sb.from('favorite_drivers').select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ENDPOINT 2 — POST api favorites
// Saves a new favourite driver to Supabase
app.post('/api/favorites', async (req, res) => {
  const { driver_name, team, nationality } = req.body;
  console.log(`[POST] /api/favorites — ${driver_name}`);
  if (!driver_name || !team)
    return res.status(400).json({ error: 'driver_name and team are required.' });

  const { data, error } = await sb
    .from('favorite_drivers')
    .insert({ driver_name, team, nationality })
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ENDPOINT 3 — GET api f1 results
// Fetches latest race results from OpenF1 (external API)
app.get('/api/f1/results', async (req, res) => {
  console.log('[GET] /api/f1/results — fetching from OpenF1');
  try {
    // Step 1 get all 2024 race sessions, filter out Sprints, sort newest first
    const sessionsRes = await fetch('https://api.openf1.org/v1/sessions?session_type=Race&year=2024');
    if (!sessionsRes.ok) throw new Error(`OpenF1 sessions: HTTP ${sessionsRes.status}`);
    const sessions = await sessionsRes.json();

    const races = sessions
      .filter(s => s.session_name === 'Race')
      .sort((a, b) => new Date(b.date_start) - new Date(a.date_start));

    if (!races.length) return res.status(404).json({ error: 'No sessions found.' });

    // Walk from most recent race backwards until we find one with position data
    let chosenSession = null;
    let positions = [];
    let driverList = [];

    for (const session of races) {
      const sk = session.session_key;
      const [posRes, drvRes] = await Promise.all([
        fetch(`https://api.openf1.org/v1/position?session_key=${sk}`),
        fetch(`https://api.openf1.org/v1/drivers?session_key=${sk}`),
      ]);
      if (!posRes.ok || !drvRes.ok) continue;

      const posData = await posRes.json();
      const drvData = await drvRes.json();

      if (posData.length > 10 && drvData.length > 0) {
        positions     = posData;
        driverList    = drvData;
        chosenSession = session;
        break;
      }
    }

    if (!chosenSession) return res.status(404).json({ error: 'Could not find a race with position data.' });

    // Build driver lookup map
    const dMap = {};
    for (const d of driverList) dMap[d.driver_number] = d;

    // Deduplicate keep last recorded position per driver
    const final = {};
    for (const p of positions) final[p.driver_number] = p;

    const results = Object.values(final)
      .sort((a, b) => a.position - b.position)
      .slice(0, 10)
      .map(p => ({
        position:      p.position,
        driver_number: p.driver_number,
        driver_name:   dMap[p.driver_number]?.full_name    || `Driver #${p.driver_number}`,
        team_name:     dMap[p.driver_number]?.team_name    || 'Unknown',
        country_code:  dMap[p.driver_number]?.country_code || '',
        name_acronym:  dMap[p.driver_number]?.name_acronym || '',
      }));

    res.json({
      session: {
        name:    chosenSession.session_name,
        circuit: chosenSession.circuit_short_name,
        country: chosenSession.country_name,
        date:    chosenSession.date_start,
        year:    chosenSession.year,
      },
      results,
    });
  } catch (err) {
    console.error('OpenF1 error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Week 13 endpoints
app.get('/customers', async (req, res) => {
  const { data, error } = await sb.from('customer').select();
  if (error) return res.status(500).send(error);
  res.json(data);
});

app.post('/customer', async (req, res) => {
  const { firstName, lastName, state } = req.body;
  if (!isValidStateAbbreviation(state))
    return res.status(400).json({ message: `${state} is not a valid 2-letter state abbreviation.` });
  const { data, error } = await sb
    .from('customer')
    .insert({ customer_first_name: firstName, customer_last_name: lastName, customer_state: state })
    .select();
  if (error) return res.status(500).send(error);
  res.json(data);
});

app.listen(port, () => console.log(`F1 Tracker running on http://localhost:${port}`));