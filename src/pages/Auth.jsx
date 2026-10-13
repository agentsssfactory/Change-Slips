import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Flash } from "../components/Common.jsx";

function useSubmit(fn) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await fn(new FormData(e.target)); } catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return { err, busy, run };
}
const home = (u) => (u.role === "admin" ? "/admin" : "/my");

const safeNext = (n) => (n && /^\/[a-z]/i.test(n) && !n.startsWith("//") ? n : "/my");

export function UserLogin() {
  const { user, signIn, demo } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get("next"));
  const { err, busy, run } = useSubmit(async (f) => {
    await signIn("/auth/login", { email: f.get("email"), password: f.get("password") });
    nav(next, { replace: true });
  });
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : next} replace />;
  return (
    <div className="auth-wrap">
      <section className="card">
        <h1>Sign in</h1>
        <p className="lede" style={{ marginBottom: "1rem" }}>Publish change slips and accept the ones others post.</p>
        <form className="stack" onSubmit={run}>
          <Flash>{err}</Flash>
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="swap" style={{ marginTop: "1rem" }}>New here? <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link></p>
        {demo && <p className="demo-box">Demo user: <code>demo@changeslip.com</code> / <code>demo123</code></p>}
      </section>
      <p className="swap">Staff? <Link to="/admin/login">Admin login</Link></p>
    </div>
  );
}

export function Register() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get("next"));
  const { err, busy, run } = useSubmit(async (f) => {
    await signIn("/auth/register", { name: f.get("name"), business: f.get("business"), phone: f.get("phone"), address: f.get("address"), email: f.get("email"), password: f.get("password") });
    nav(next, { replace: true });
  });
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : next} replace />;
  return (
    <div className="auth-wrap">
      <section className="card">
        <h1>Create account</h1>
        <form className="stack" onSubmit={run} style={{ marginTop: "0.8rem" }}>
          <Flash>{err}</Flash>
          <label>Your name<input name="name" required autoComplete="name" /></label>
          <label>Business name (shown on your slips)<input name="business" autoComplete="organization" /></label>
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <div className="row2">
            <label>Phone<input name="phone" type="tel" maxLength={20} autoComplete="tel" /></label>
            <label>Location<input name="address" maxLength={300} autoComplete="street-address" placeholder="Shop / city" /></label>
          </div>
          <p className="hint" style={{ margin: 0 }}>Your phone and location are shared only with the other person on a slip, after it is accepted.</p>
          <label>Password (min 6 characters)<input name="password" type="password" minLength={6} required autoComplete="new-password" /></label>
          <button className="btn" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </form>
        <p className="swap" style={{ marginTop: "1rem" }}>Already registered? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
      </section>
    </div>
  );
}

export function AdminLogin() {
  const { user, signIn, demo } = useAuth();
  const nav = useNavigate();
  const { err, busy, run } = useSubmit(async (f) => {
    await signIn("/auth/admin/login", { email: f.get("email"), password: f.get("password") });
    nav("/admin", { replace: true });
  });
  if (user) return <Navigate to={home(user)} replace />;
  return (
    <div className="auth-wrap admin">
      <section className="card">
        <p className="hint" style={{ margin: 0 }}><span className="pill pill-admin">admin</span></p>
        <h1 style={{ marginTop: "0.4rem" }}>Admin sign in</h1>
        <p className="lede" style={{ marginBottom: "1rem" }}>Monitor overall slip activity.</p>
        <form className="stack" onSubmit={run}>
          <Flash>{err}</Flash>
          <label>Admin email<input name="email" type="email" required autoComplete="username" /></label>
          <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="btn btn-danger" disabled={busy}>{busy ? "Signing in…" : "Sign in as admin"}</button>
        </form>
        {demo && <p className="demo-box">Default admin: <code>admin@changeslip.com</code> / <code>admin123</code> unless you set ADMIN_EMAIL / ADMIN_PASSWORD</p>}
      </section>
      <p className="swap">Business user? <Link to="/login">Sign in</Link></p>
    </div>
  );
}
