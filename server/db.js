import "./env.js";
import bcrypt from "bcryptjs";
import fs from "fs";

/**
 * Database layer.
 *  - Production / Vercel: Neon Postgres over HTTP (set DATABASE_URL).
 *  - Local dev without DATABASE_URL: embedded Postgres (PGlite) stored in ./data/pglite.
 */
export const ON_VERCEL = !!process.env.VERCEL;

export class ConfigError extends Error {
  constructor(msg) { super(msg); this.name = "ConfigError"; }
}

let driverPromise;
function driver() {
  if (!driverPromise) {
    driverPromise = (async () => {
      if (process.env.DATABASE_URL) {
        const { neon } = await import("@neondatabase/serverless");
        const sql = neon(process.env.DATABASE_URL);
        return (text, params = []) => sql.query(text, params);
      }
      if (ON_VERCEL) throw new ConfigError("DATABASE_URL is not set. In Vercel add a Neon Postgres database (Storage tab) and redeploy.");
      const mod = "@electric-sql/pglite";
      const { PGlite } = await import(mod);
      fs.mkdirSync("./data", { recursive: true });
      const pg = new PGlite("./data/pglite");
      await pg.waitReady;
      return async (text, params = []) => (await pg.query(text, params)).rows;
    })();
    driverPromise.catch(() => { driverPromise = null; });
  }
  return driverPromise;
}
export async function q(text, params = []) { return (await driver())(text, params); }

export const nowIso = () => new Date().toISOString();
export const STATUSES = ["open", "accepted", "completed", "cancelled"];
export const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD", "CAD"];
export const demoEnabled = () => (ON_VERCEL ? process.env.SEED_DEMO === "1" : process.env.SEED_DEMO !== "0");

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    business TEXT,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    address TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user','admin')),
    created_at TEXT NOT NULL
  )`,
  // A slip is public from the moment it is published. open -> accepted -> completed, or cancelled.
  `CREATE TABLE IF NOT EXISTS slips (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    job_ref TEXT,
    details TEXT,
    location TEXT,
    amount_cents BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','completed','cancelled')),
    accepter_id INTEGER REFERENCES users(id),
    accepter_name TEXT,
    accepter_email TEXT,
    accepter_phone TEXT,
    accepter_note TEXT,
    accepted_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS slip_events (
    id SERIAL PRIMARY KEY,
    slip_id INTEGER NOT NULL REFERENCES slips(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    slip_id INTEGER REFERENCES slips(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    seen BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (key TEXT NOT NULL, at BIGINT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_slips_user ON slips(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_slips_accepter ON slips(accepter_id)`,
  `CREATE INDEX IF NOT EXISTS idx_slips_status ON slips(status, id)`,
  `CREATE INDEX IF NOT EXISTS idx_events_slip ON slip_events(slip_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, seen)`,
  `CREATE INDEX IF NOT EXISTS idx_attempts_key ON login_attempts(key, at)`,
];

async function log(slipId, kind, detail, now) {
  await q("INSERT INTO slip_events (slip_id, kind, detail, created_at) VALUES ($1,$2,$3,$4)", [slipId, kind, detail, now]);
}
export async function notify(userId, slipId, text, now = nowIso()) {
  if (userId) await q("INSERT INTO notifications (user_id, slip_id, text, created_at) VALUES ($1,$2,$3,$4)", [userId, slipId, text, now]);
}

export async function createSlip(userId, d, now = nowIso()) {
  const [row] = await q(
    `INSERT INTO slips (user_id, title, job_ref, details, location, amount_cents, currency, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8::text,$8::text) RETURNING id`,
    [userId, d.title, d.job_ref || null, d.details || null, d.location || null, d.amount_cents, d.currency, now]
  );
  await log(row.id, "published", "Slip published to the public feed", now);
  return row.id;
}

/**
 * Accept: ONE conditional UPDATE decides the winner. If two people click at the same moment, exactly one
 * row update succeeds; the other gets zero rows. Creators cannot accept their own slips.
 * Returns the slip row, or null if it was no longer available.
 */
export async function acceptSlip(slipId, user, info, now = nowIso()) {
  const rows = await q(
    `UPDATE slips SET status = 'accepted', accepter_id = $2, accepter_name = $3, accepter_email = $4, accepter_phone = $5,
            accepter_note = $6, accepted_at = $7::text, updated_at = $7::text
     WHERE id = $1 AND status = 'open' AND user_id <> $2 RETURNING id, user_id, title`,
    [slipId, user.id, info.name, info.email || null, info.phone || null, info.note || null, now]
  );
  if (!rows.length) return null;
  await log(slipId, "accepted", `Accepted by ${info.name}`, now);
  await notify(rows[0].user_id, slipId, `${info.name} accepted your slip "${rows[0].title}". Their contact details are on the slip.`, now);
  return rows[0];
}

/** The accepter steps back: slip returns to the open feed. */
export async function releaseSlip(slipId, userId, now = nowIso()) {
  const rows = await q(
    `UPDATE slips SET status = 'open', accepter_id = NULL, accepter_name = NULL, accepter_email = NULL, accepter_phone = NULL,
            accepter_note = NULL, accepted_at = NULL, updated_at = $3::text
     WHERE id = $1 AND status = 'accepted' AND accepter_id = $2 RETURNING id, user_id, title`,
    [slipId, userId, now]
  );
  if (!rows.length) return null;
  await log(slipId, "released", "The accepter stepped back; the slip is open again", now);
  await notify(rows[0].user_id, slipId, `The accepter released "${rows[0].title}". It is open in the feed again.`, now);
  return rows[0];
}

export async function completeSlip(slipId, userId, now = nowIso()) {
  const rows = await q(
    `UPDATE slips SET status = 'completed', completed_at = $3::text, updated_at = $3::text
     WHERE id = $1 AND status = 'accepted' AND user_id = $2 RETURNING id, accepter_id, title`,
    [slipId, userId, now]
  );
  if (!rows.length) return null;
  await log(slipId, "completed", "Marked complete by the publisher", now);
  await notify(rows[0].accepter_id, slipId, `"${rows[0].title}" was marked complete.`, now);
  return rows[0];
}

/** Cancel by the publisher. */
export async function cancelSlip(slipId, userId, now = nowIso()) {
  const rows = await q(
    `UPDATE slips SET status = 'cancelled', cancelled_at = $3::text, updated_at = $3::text
     WHERE id = $1 AND status IN ('open','accepted') AND user_id = $2 RETURNING id, user_id, accepter_id, title`,
    [slipId, userId, now]
  );
  if (!rows.length) return null;
  await log(slipId, "cancelled", "Cancelled by the publisher", now);
  if (rows[0].accepter_id) await notify(rows[0].accepter_id, slipId, `"${rows[0].title}" was cancelled.`, now);
  return rows[0];
}

let readyPromise;
export function ready() {
  if (!readyPromise) {
    readyPromise = (async () => {
      if (ON_VERCEL) {
        if (!process.env.JWT_SECRET) throw new ConfigError("JWT_SECRET is not set. Add it in Vercel → Settings → Environment Variables.");
        if (!process.env.ADMIN_PASSWORD) throw new ConfigError("ADMIN_PASSWORD is not set. Add it in Vercel → Settings → Environment Variables.");
      }
      for (const stmt of SCHEMA) await q(stmt);
      await seed();
    })();
    readyPromise.catch(() => { readyPromise = null; });
  }
  return readyPromise;
}

const ago = (mins) => new Date(Date.now() - mins * 60e3).toISOString();

async function seed() {
  const clean = (v) => String(v ?? "").trim();
  const adminEmail = clean(process.env.ADMIN_EMAIL || "admin@changeslip.com").toLowerCase();
  const adminPass = clean(process.env.ADMIN_PASSWORD || "admin123");
  const [existing] = await q("SELECT * FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
  const [clash] = await q("SELECT 1 FROM users WHERE email = $1 AND role <> 'admin'", [adminEmail]);
  if (clash) console.warn(`[seed] ADMIN_EMAIL ${adminEmail} is already a user account: pick another admin email.`);
  else if (!existing) {
    await q("INSERT INTO users (name, business, email, password_hash, role, created_at) VALUES ('ChangeSlip Admin','ChangeSlip',$1,$2,'admin',$3) ON CONFLICT (email) DO NOTHING",
      [adminEmail, bcrypt.hashSync(adminPass, 10), nowIso()]);
    console.log(`[seed] admin created: ${adminEmail}`);
  } else if (existing.email !== adminEmail || !bcrypt.compareSync(adminPass, existing.password_hash)) {
    await q("UPDATE users SET email = $1, password_hash = $2 WHERE id = $3", [adminEmail, bcrypt.hashSync(adminPass, 10), existing.id]);
    console.log(`[seed] admin login updated from env: ${adminEmail}`);
  }

  if (!demoEnabled()) return;
  const [anyUser] = await q("SELECT 1 FROM users WHERE role = 'user' LIMIT 1");
  if (anyUser) return;
  const mk = async (name, business, email, phone, address) =>
    (await q("INSERT INTO users (name, business, email, phone, address, password_hash, role, created_at) VALUES ($1,$2,$3,$4,$5,$6,'user',$7) ON CONFLICT (email) DO NOTHING RETURNING id",
      [name, business, email, phone, address, bcrypt.hashSync("demo123", 10), ago(60 * 24 * 7)]))[0];
  const a = await mk("Harbor Owner", "Harbor HVAC", "demo@changeslip.com", "+1 555 0100", "12 Dock St, Portland");
  const b = await mk("Sam Carter", "Bright Electric", "demo2@changeslip.com", "+1 555 0142", "88 Elm Ave, Portland");
  if (!a || !b) return;
  const s1 = await createSlip(a.id, { title: "Replace condenser fan motor (extra scope)", job_ref: "HV-2041", details: "Customer asked to swap the failing fan motor during the tune-up. Parts and 2 hours labour.", location: "Portland, OR", amount_cents: 48000, currency: "USD" }, ago(300));
  await createSlip(a.id, { title: "Add second thermostat zone", job_ref: "HV-2050", details: "Extra wiring and a smart thermostat in the upstairs hall.", location: "Portland, OR", amount_cents: 62500, currency: "USD" }, ago(120));
  const s3 = await createSlip(b.id, { title: "Extra outlets in garage", job_ref: "EL-778", details: "Four additional 20A outlets, GFCI protected.", location: "Beaverton, OR", amount_cents: 39000, currency: "USD" }, ago(200));
  await createSlip(b.id, { title: "Panel label and surge protector", job_ref: "EL-779", details: "Relabel the panel and fit a whole-home surge protector.", location: "Beaverton, OR", amount_cents: 21000, currency: "USD" }, ago(60));
  await acceptSlip(s3, { id: a.id }, { name: "Harbor Owner", email: "demo@changeslip.com", phone: "+1 555 0100", note: "Can start Thursday." }, ago(30));
  void s1;
  console.log("[seed] demo users: demo@changeslip.com and demo2@changeslip.com (password demo123)");
}
