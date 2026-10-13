import { useState } from "react";
import { Link } from "react-router-dom";
import { fmtWhen, fmtDay, money } from "../api.js";

export const STATUS_LABEL = { open: "Available", accepted: "Accepted", completed: "Completed", cancelled: "Cancelled" };
export const StatusBadge = ({ status }) => <span className={`badge badge-s-${status}`}>{STATUS_LABEL[status] || status}</span>;

export function Flash({ kind = "error", children }) {
  if (!children) return null;
  return <div className={`flash flash-${kind === "ok" ? "ok" : "error"}`} role={kind === "ok" ? "status" : "alert"}>{children}</div>;
}

export function CopyButton({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); }
    catch { window.prompt("Copy this:", text); }
  };
  return <button type="button" className="btn btn-quiet" onClick={copy}>{done ? "Copied ✓" : label}</button>;
}

const ICON = { published: "＋", accepted: "✓", released: "↩", completed: "★", cancelled: "⊘" };
export function Activity({ events }) {
  if (!events?.length) return <p className="empty">No activity yet.</p>;
  return (
    <ul className="activity">
      {events.map((e, i) => (
        <li key={i}><span className={`ic ${e.kind}`} aria-hidden="true">{ICON[e.kind] || "•"}</span>
          <div><div>{e.detail}</div><div className="when">{fmtWhen(e.created_at)}</div></div></li>
      ))}
    </ul>
  );
}

/** A slip card as shown in the public feed. */
export function SlipCard({ slip, to }) {
  return (
    <Link className="slip-card" to={to}>
      <div className="top-row"><StatusBadge status={slip.status} />{slip.job_ref && <span className="mono">{slip.job_ref}</span>}</div>
      <h3>{slip.title}</h3>
      <p className="amount">{money(slip.amount_cents, slip.currency)}</p>
      {slip.details && <p className="clip2">{slip.details}</p>}
      <p className="hint" style={{ margin: 0 }}>{slip.creator.business}{slip.location ? ` · ${slip.location}` : ""} · {fmtDay(slip.created_at)}</p>
    </Link>
  );
}

const mapLink = (a) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
const tel = (p) => `tel:${String(p).replace(/[^\d+]/g, "")}`;
export function ContactCard({ title, hint, c }) {
  return (
    <section className="card contact-card">
      <h2>{title}</h2>
      <p className="hint" style={{ marginTop: 0 }}>{hint}</p>
      <dl className="facts" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div><dt>Name</dt><dd>{c.business && c.business !== c.name ? `${c.name} · ${c.business}` : c.name}</dd></div>
        <div><dt>Phone</dt><dd>{c.phone ? <a href={tel(c.phone)}>{c.phone}</a> : <span className="hint">Not shared</span>}</dd></div>
        <div><dt>Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : <span className="hint">Not shared</span>}</dd></div>
        {"address" in c && <div><dt>Location</dt><dd>{c.address ? <>{c.address} · <a href={mapLink(c.address)} target="_blank" rel="noreferrer">Maps</a></> : <span className="hint">Not shared</span>}</dd></div>}
        {c.note && <div style={{ gridColumn: "1 / -1" }}><dt>Note</dt><dd>{c.note}</dd></div>}
      </dl>
    </section>
  );
}
