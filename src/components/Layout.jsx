import { useEffect, useState } from "react";
import { NavLink, Link, Outlet, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { api } from "../api.js";

function Bell() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () => api("/notifications").then((d) => live && setUnread(d.unread)).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    window.addEventListener("notifs-changed", load);
    return () => { live = false; clearInterval(t); window.removeEventListener("notifs-changed", load); };
  }, []);
  useEffect(() => { document.title = unread ? `(${unread}) ChangeSlip` : "ChangeSlip"; }, [unread]);
  return <NavLink to="/notifications" className="bell">Alerts{unread > 0 && <span className="count">{unread}</span>}</NavLink>;
}

export function Layout() {
  const { user, brand, signOut } = useAuth();
  const nav = useNavigate();
  const out = async () => { await signOut(); nav("/"); };
  return (
    <>
      <header className="top">
        <Link className="brand" to="/">{brand}</Link>
        <p className="tagline">Public change slips, published and accepted by people like you</p>
        <nav className="top-nav">
          <NavLink to="/slips">Slips</NavLink>
          {!user && (<><NavLink to="/login">Sign in</NavLink><NavLink to="/admin/login">Admin</NavLink></>)}
          {user?.role === "user" && (<>
            <NavLink to="/my">My slips</NavLink>
            <NavLink to="/new">Publish</NavLink>
            <Bell />
            <NavLink to="/profile">Profile</NavLink>
          </>)}
          {user?.role === "admin" && (<>
            <NavLink to="/admin" end>Dashboard</NavLink>
            <NavLink to="/admin/slips">All slips</NavLink>
            <NavLink to="/admin/users">Users</NavLink>
          </>)}
          {user && (<>
            <span className="who">{user.name}</span>
            <span className={`pill ${user.role === "admin" ? "pill-admin" : ""}`}>{user.role}</span>
            <button className="link" onClick={out}>Sign out</button>
          </>)}
        </nav>
      </header>
      <main><Outlet /></main>
    </>
  );
}

export function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="hint">Loading…</p>;
  if (!user) return <Navigate to={role === "admin" ? "/admin/login" : "/login"} replace />;
  if (user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/my"} replace />;
  return children;
}
