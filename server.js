const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '.')));

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL DEFAULT '{"fields":[]}'::jsonb,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    INSERT INTO app_state (id, data) VALUES (1, '{"fields":[]}')
    ON CONFLICT DO NOTHING
  `);
}
initDB().catch(console.error);

app.get('/api/state', async (req, res) => {
  try {
    const r = await pool.query('SELECT data FROM app_state WHERE id = 1');
    res.json(r.rows[0]?.data || { fields: [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO app_state (id, data) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
      [req.body]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
