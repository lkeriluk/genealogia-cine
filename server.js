// ENV CHECK — logged before anything else to diagnose Railway injection
console.log('ENV CHECK:', {
  HAS_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
  HAS_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
  HAS_SESSION_SECRET: !!process.env.SESSION_SECRET,
  HAS_DATABASE_URL: !!process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── BASE DE DATOS ──
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS picture TEXT
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{"fields":[]}'::jsonb,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session (
      sid VARCHAR NOT NULL COLLATE "default",
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL,
      CONSTRAINT session_pkey PRIMARY KEY (sid)
    )
  `);
}
initDB().catch(console.error);

// ── SESIONES ──
app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 días
}));

// ── PASSPORT / GOOGLE AUTH ──
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const name = profile.displayName;
    const googleId = profile.id;
    const picture = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
    const result = await pool.query(
      `INSERT INTO users (google_id, email, name, picture)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE SET name = $3, picture = $4
       RETURNING *`,
      [googleId, email, name, picture]
    );
    done(null, result.rows[0]);
  } catch (e) {
    done(e);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const r = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, r.rows[0] || null);
  } catch (e) {
    done(e);
  }
});

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json({ limit: '20mb' }));

// ── RUTAS DE AUTH ──
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'none' })
);

// Ruta alternativa cuando el usuario hace click en el botón por primera vez (sin sesión Google activa)
app.get('/auth/google/select',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  (req, res, next) => {
    passport.authenticate('google', (err, user) => {
      if (err && err.message && err.message.includes('immediate')) {
        // prompt:none falló — no hay sesión Google activa, redirigir a flujo normal
        return res.redirect('/auth/google/select');
      }
      if (!user) return res.redirect('/login.html');
      req.logIn(user, (e) => { if (e) return next(e); res.redirect('/'); });
    })(req, res, next);
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/login.html'));
});

app.get('/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, picture: req.user.picture });
});

// ── MIDDLEWARE DE AUTH ──
function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autenticado' });
  res.redirect('/login.html');
}

// ── API DE ESTADO (por usuario) ──
app.get('/api/state', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT data FROM app_state WHERE user_id = $1', [req.user.id]);
    res.json(r.rows[0]?.data || { fields: [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/state', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO app_state (user_id, data) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = NOW()`,
      [req.user.id, req.body]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ARCHIVOS ESTÁTICOS ──
// login.html es público, el resto requiere auth
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.use(requireAuth, express.static(path.join(__dirname, '.')));

app.get('*', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
