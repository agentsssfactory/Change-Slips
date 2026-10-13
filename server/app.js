import "./env.js";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  q, ready, ConfigError, ON_VERCEL, demoEnabled, STATUSES, CURRENCIES, nowIso,
  createSlip, acceptSlip, releaseSlip, completeSlip, cancelSlip,
} from "./db.js";

const BRAND = process.env.BUSINESS_NAME || "ChangeSlip";
const SECRET = process.env.JWT_SECRET || (ON_VERCEL ? "" : crypto.randomBytes(32).toString("hex"));
if (!process.env.JWT_SECRET && !ON_VERCEL) console.warn("[warn] JWT_SECRET not set — using a random one; everyone is logged out on restart.");
const DEFAULT_CURRENCY = CURRENCIES.includes(process.env.DEFAULT_CURRENCY) ? process.env.DEFAULT_CURRENCY : "USD";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
app.use("/api", ah(async (_req, _res, next) => { await ready(); next(); }));

// ---- auth: separate user and admin logins -----------------------------------------
const publicUser = (u) => ({ id: u.id, name: u.name, business: u.business, email: u.email, phone: u.phone, address: u.address, role: u.role });
const userById = async (id) => (await q("SELECT * FROM users WHERE id = $1", [id]))[0];
function issueCookie(req, res, user) {
  const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: "7d" });
  res.cookie("cs_token", token, { httpOnly: true, sameSite: "lax", secure: req.secure, maxAge: 7 * 864e5 });
}
async function viewer(req) {
  try { const { id } = jwt.verify(req.cookies.cs_token, SECRET); return (await userById(id)) || null; } catch { return null; }
}
const auth = ah(async (req, res, next) => {
  const u = await viewer(req);
  if (!u) return res.status(401).json({ error: "Please sign in." });
  req.user = u; next();
});
const requireRole = (role) => (req, res, next) => (req.user.role === role ? next() : res.status(403).json({ error: "You don't have access to this." }));

const WINDOW = 15 * 60e3;
async function throttled(key) { const [r] = await q("SELECT COUNT(*)::int AS n FROM login_attempts WHERE key = $1 AND at > $2", [key, Date.now() - WINDOW]); return r.n >= 10; }
async function noteFail(key) {
  await q("INSERT INTO login_attempts (key, at) VALUES ($1,$2)", [key, Date.now()]);
  if (Math.random() < 0.05) await q("DELETE FROM login_attempts WHERE at < $1", [Date.now() - WINDOW]);
}
const login = (role) => ah(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const key = req.ip + "|" + email;
  if (await throttled(key)) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  const user = (await q("SELECT * FROM users WHERE email = $1", [email]))[0];
  if (!user || user.role !== role || !bcrypt.compareSync(password, user.password_hash)) { await noteFail(key); return res.status(401).json({ error: "Invalid email or password." }); }
  issueCookie(req, res, user);
  res.json({ user: publicUser(user) });
});
app.post("/api/auth/login", login("user"));
app.post("/api/auth/admin/login", login("admin"));

function cleanPhone(v) {
  const p = String(v || "").trim();
  if (!p) return "";
  return /^[+()\d][\d\s().-]{4,19}$/.test(p) ? p : false;
}
const okEmail = (e) => /^\S+@\S+\.\S+$/.test(e);

app.post("/api/auth/register", ah(async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 100);
  const business = String(req.body.business || "").trim().slice(0, 120) || name;
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const phone = cleanPhone(req.body.phone);
  const address = String(req.body.address || "").trim().slice(0, 300);
  if (phone === false) return res.status(400).json({ error: "That phone number doesn't look right." });
  if (!name || !okEmail(email)) return res.status(400).json({ error: "Enter your name and a valid email." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  const rows = await q(
    "INSERT INTO users (name, business, email, phone, address, password_hash, role, created_at) VALUES ($1,$2,$3,$4,$5,$6,'user',$7) ON CONFLICT (email) DO NOTHING RETURNING *",
    [name, business, email, phone || null, address || null, bcrypt.hashSync(password, 10), nowIso()]);
  if (!rows.length) return res.status(409).json({ error: "An account with that email already exists." });
  issueCookie(req, res, rows[0]);
  res.status(201).json({ user: publicUser(rows[0]) });
}));
app.post("/api/auth/logout", (_req, res) => { res.clearCookie("cs_token"); res.json({ ok: true }); });
app.get("/api/auth/me", ah(async (req, res) => {
  const u = await viewer(req);
  res.json({ user: u ? publicUser(u) : null, brand: BRAND, demo: demoEnabled(), currencies: CURRENCIES, defaultCurrency: DEFAULT_CURRENCY });
}));

app.put("/api/profile", auth, requireRole("user"), ah(async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 100);
  const business = String(req.body.business || "").trim().slice(0, 120) || name;
  const phone = cleanPhone(req.body.phone);
  const address = String(req.body.address || "").trim().slice(0, 300);
  if (!name) return res.status(400).json({ error: "Your name is required." });
  if (phone === false) return res.status(400).json({ error: "That phone number doesn't look right." });
  const [u] = await q("UPDATE users SET name=$1, business=$2, phone=$3, address=$4 WHERE id=$5 RETURNING *", [name, business, phone || null, address || null, req.user.id]);
  res.json({ user: publicUser(u) });
}));

// ---- slips ----------------------------------------------------------------------------
const SLIP_SQL = `SELECT s.*, u.name AS creator_name, u.business AS creator_business, u.email AS creator_email, u.phone AS creator_phone, u.address AS creator_address
                  FROM slips s JOIN users u ON u.id = s.user_id`;
const idParam = (req) => { const n = Number(req.params.id); return Number.isInteger(n) && n > 0 ? n : 0; };
const slipRow = async (id) => (await q(`${SLIP_SQL} WHERE s.id = $1`, [id]))[0];

/**
 * What a given viewer may see. Public fields are visible to everyone. Contact details are visible only to the
 * two participants once the slip has been accepted.
 */
function present(r, v) {
  const rel = !v ? "visitor" : v.role === "admin" ? "admin" : v.id === r.user_id ? "creator" : v.id === r.accepter_id ? "accepter" : "visitor";
  const out = {
    id: r.id, title: r.title, job_ref: r.job_ref, details: r.details, location: r.location, amount_cents: Number(r.amount_cents), currency: r.currency,
    status: r.status, created_at: r.created_at, updated_at: r.updated_at, accepted_at: r.accepted_at, completed_at: r.completed_at,
    creator: { name: r.creator_name, business: r.creator_business || r.creator_name },
    has_accepter: !!r.accepter_id, relation: rel,
    can_accept: !!v && v.role === "user" && v.id !== r.user_id && r.status === "open",
  };
  // Admins monitor overall activity only: they never see contact details and never act on slips.
  const participant = rel === "creator" || rel === "accepter";
  if (participant && r.accepter_id) {
    if (rel !== "accepter") out.accepter = { name: r.accepter_name, email: r.accepter_email, phone: r.accepter_phone, note: r.accepter_note };
    if (rel !== "creator") out.creator_contact = { name: r.creator_name, business: r.creator_business || r.creator_name, email: r.creator_email, phone: r.creator_phone, address: r.creator_address };
    if (rel === "accepter") out.shared = { name: r.accepter_name, email: r.accepter_email, phone: r.accepter_phone, note: r.accepter_note };
  }
  return out;
}

// Public feed: anyone can browse; no contact details are ever included here.
app.get("/api/slips", ah(async (req, res) => {
  const v = await viewer(req);
  const status = String(req.query.status || "open");
  const term = String(req.query.q || "").trim().slice(0, 100);
  const sort = String(req.query.sort || "new");
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const where = ["s.status <> 'cancelled'"];
  const args = [];
  if (STATUSES.includes(status) && status !== "cancelled") { args.push(status); where.push(`s.status = $${args.length}`); }
  if (term) {
    args.push(`%${term}%`);
    const p = `$${args.length}`;
    where.push(`(s.title ILIKE ${p} OR s.details ILIKE ${p} OR s.job_ref ILIKE ${p} OR s.location ILIKE ${p} OR u.business ILIKE ${p})`);
  }
  const order = sort === "amount" ? "s.amount_cents DESC, s.id DESC" : "s.id DESC";
  args.push(limit + 1, offset);
  const rows = await q(`${SLIP_SQL} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT $${args.length - 1} OFFSET $${args.length}`, args);
  res.setHeader("Cache-Control", "no-store");
  res.json({ slips: rows.slice(0, limit).map((r) => present(r, v)), more: rows.length > limit });
}));

app.get("/api/slips/:id", ah(async (req, res) => {
  const v = await viewer(req);
  const r = await slipRow(idParam(req));
  const rel = r && v && (v.role === "admin" || v.id === r.user_id || v.id === r.accepter_id);
  if (!r || (r.status === "cancelled" && !rel)) return res.status(404).json({ error: "Slip not found." });
  const events = rel ? await q("SELECT kind, detail, created_at FROM slip_events WHERE slip_id = $1 ORDER BY id DESC", [r.id]) : [];
  res.setHeader("Cache-Control", "no-store");
  res.json({ slip: present(r, v), events });
}));

app.post("/api/slips", auth, requireRole("user"), ah(async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || "").trim().slice(0, 200);
  const amount = Number(b.amount);
  const currency = CURRENCIES.includes(b.currency) ? b.currency : DEFAULT_CURRENCY;
  if (!title) return res.status(400).json({ error: "A title is required." });
  if (!(amount >= 0 && amount <= 10_000_000)) return res.status(400).json({ error: "Enter an amount between 0 and 10,000,000." });
  const [{ n }] = await q("SELECT COUNT(*)::int AS n FROM slips WHERE user_id = $1 AND created_at > $2", [req.user.id, new Date(Date.now() - 36e5).toISOString()]);
  if (n >= 20) return res.status(429).json({ error: "You've published a lot of slips in the last hour. Try again later." });
  const id = await createSlip(req.user.id, {
    title, job_ref: String(b.job_ref || "").trim().slice(0, 60), details: String(b.details || "").trim().slice(0, 3000),
    location: String(b.location || "").trim().slice(0, 150), amount_cents: Math.round(amount * 100), currency,
  });
  res.status(201).json({ id });
}));

app.post("/api/slips/:id/accept", auth, requireRole("user"), ah(async (req, res) => {
  const r = await slipRow(idParam(req));
  if (!r || r.status === "cancelled") return res.status(404).json({ error: "Slip not found." });
  if (r.user_id === req.user.id) return res.status(403).json({ error: "You can't accept your own slip." });
  // The accepter chooses what to share (defaults come from their profile, they can edit or clear any of it).
  const b = req.body || {};
  const name = String(b.name || "").trim().slice(0, 120);
  const email = String(b.email || "").trim().slice(0, 200);
  const phone = cleanPhone(b.phone);
  const note = String(b.note || "").trim().slice(0, 500);
  if (!name) return res.status(400).json({ error: "Enter the name you want to share." });
  if (phone === false) return res.status(400).json({ error: "That phone number doesn't look right." });
  if (email && !okEmail(email)) return res.status(400).json({ error: "That email doesn't look right." });
  if (!email && !phone) return res.status(400).json({ error: "Share an email or phone so the publisher can reach you." });
  if (!(await acceptSlip(r.id, req.user, { name, email, phone, note }))) return res.status(409).json({ error: r.status === "open" ? "This slip is no longer available." : `This slip is already ${r.status}.` });
  res.json({ slip: present(await slipRow(r.id), req.user) });
}));

const action = (fn, errMsg, who) => ah(async (req, res) => {
  const r = await slipRow(idParam(req));
  if (!r || (r.user_id !== req.user.id && r.accepter_id !== req.user.id)) return res.status(404).json({ error: "Slip not found." });
  if (who === "creator" && r.user_id !== req.user.id) return res.status(403).json({ error: "Only the publisher can do that." });
  if (who === "accepter" && r.accepter_id !== req.user.id) return res.status(403).json({ error: "Only the person who accepted can do that." });
  if (!(await fn(r.id, req.user.id))) return res.status(409).json({ error: errMsg(r) });
  res.json({ slip: present(await slipRow(r.id), req.user) });
});
app.post("/api/slips/:id/release", auth, requireRole("user"), action(releaseSlip, (r) => `This slip is ${r.status}, so it can't be released.`, "accepter"));
app.post("/api/slips/:id/complete", auth, requireRole("user"), action(completeSlip, (r) => r.status === "open" ? "Nobody has accepted this slip yet." : `This slip is ${r.status}.`, "creator"));
app.post("/api/slips/:id/cancel", auth, requireRole("user"), action(cancelSlip, (r) => `This slip is ${r.status}, so it can't be cancelled.`, "creator"));

app.get("/api/my", auth, requireRole("user"), ah(async (req, res) => {
  const published = await q(`${SLIP_SQL} WHERE s.user_id = $1 ORDER BY s.id DESC`, [req.user.id]);
  const accepted = await q(`${SLIP_SQL} WHERE s.accepter_id = $1 ORDER BY s.id DESC`, [req.user.id]);
  res.json({ published: published.map((r) => present(r, req.user)), accepted: accepted.map((r) => present(r, req.user)) });
}));

app.get("/api/notifications", auth, requireRole("user"), ah(async (req, res) => {
  const rows = await q("SELECT id, slip_id, text, seen, created_at FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 50", [req.user.id]);
  res.json({ notifications: rows, unread: rows.filter((n) => !n.seen).length });
}));
app.post("/api/notifications/read", auth, requireRole("user"), ah(async (req, res) => {
  await q("UPDATE notifications SET seen = TRUE WHERE user_id = $1 AND seen = FALSE", [req.user.id]);
  res.json({ ok: true });
}));

// ---- admin: read-only monitoring. Admins never approve, accept, edit or remove slips. ----
const admin = express.Router();
admin.use(auth, requireRole("admin"));
admin.get("/stats", ah(async (_req, res) => {
  const counts = Object.fromEntries(STATUSES.map((k) => [k, 0]));
  for (const r of await q("SELECT status, COUNT(*)::int AS n FROM slips GROUP BY status")) counts[r.status] = r.n;
  const [{ n: users }] = await q("SELECT COUNT(*)::int AS n FROM users WHERE role = 'user'");
  res.json({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0), users });
}));
admin.get("/slips", ah(async (req, res) => {
  const status = String(req.query.status || "");
  const term = String(req.query.q || "").trim();
  const where = []; const args = [];
  if (STATUSES.includes(status)) { args.push(status); where.push(`s.status = $${args.length}`); }
  if (term) { args.push(`%${term}%`); const p = `$${args.length}`; where.push(`(s.title ILIKE ${p} OR s.job_ref ILIKE ${p} OR u.name ILIKE ${p} OR u.business ILIKE ${p} OR s.accepter_name ILIKE ${p})`); }
  const rows = await q(`${SLIP_SQL} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY s.id DESC LIMIT 500`, args);
  res.json({ slips: rows.map((r) => ({ ...present(r, req.user), accepter_name: r.accepter_name })) });
}));
admin.get("/users", ah(async (_req, res) => {
  const users = await q(
    `SELECT u.id, u.name, u.business, u.email, u.created_at,
            (SELECT COUNT(*)::int FROM slips s WHERE s.user_id = u.id) AS published,
            (SELECT COUNT(*)::int FROM slips s WHERE s.accepter_id = u.id) AS accepted
     FROM users u WHERE u.role = 'user' ORDER BY u.id DESC`);
  res.json({ users });
}));
app.use("/api/admin", admin);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof ConfigError) return res.status(500).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Server error. Check the server logs." });
});
export default app;
