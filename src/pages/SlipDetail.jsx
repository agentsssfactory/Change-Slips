import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { api, money, fmtWhen } from "../api.js";
import { useAuth } from "../auth.jsx";
import { StatusBadge, Flash, Activity, ContactCard } from "../components/Common.jsx";

export default function SlipDetail() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const load = () => api(`/slips/${id}`).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id, user?.id]); // eslint-disable-line

  const act = async (what, body) => {
    setErr(""); setOk(""); setBusy(true);
    try {
      const r = await api(`/slips/${id}/${what}`, { method: "POST", body });
      setAccepting(false);
      setOk({ accept: "You accepted this slip. Contact details are now shared with the publisher.", release: "You released this slip.", complete: "Marked complete.", cancel: "Slip cancelled." }[what]);
      setD((x) => ({ ...x, slip: r.slip }));
      load();
      window.dispatchEvent(new Event("notifs-changed"));
    } catch (e) { setErr(e.message); if (e.status === 409) load(); }
    setBusy(false);
  };

  if (!d) return <><Flash>{err}</Flash>{!err && <p className="hint">Loading…</p>}</>;
  const s = d.slip;
  const rel = s.relation;
  const next = encodeURIComponent(pathname);
  return (
    <>
      <p className="crumb"><Link to="/slips">← All slips</Link></p>
      <div className="page-head"><h1>{s.title}</h1>
        <p className="lede"><StatusBadge status={s.status} /> {s.job_ref && <span className="mono">{s.job_ref} · </span>}Published by {s.creator.business}{s.location ? ` · ${s.location}` : ""} · {fmtWhen(s.created_at)}</p></div>
      <Flash>{err}</Flash><Flash kind="ok">{ok}</Flash>
      <div className="two-col">
        <div>
          <section className="card doc">
            <p className="amount-big">{money(s.amount_cents, s.currency)}</p>
            {s.details ? <p className="body">{s.details}</p> : <p className="hint">No extra details.</p>}
          </section>
          {rel === "creator" && s.accepter && <ContactCard title={`Accepted by ${s.accepter.name}`} hint="Get in touch to confirm the work. This is what they chose to share." c={s.accepter} />}
          {rel === "accepter" && s.creator_contact && <ContactCard title={`Contact ${s.creator_contact.business}`} hint="The publisher's contact details, shared because you accepted." c={s.creator_contact} />}
          {rel === "accepter" && s.shared && <p className="hint">You shared: {[s.shared.name, s.shared.phone, s.shared.email].filter(Boolean).join(" · ")}</p>}
          {d.events?.length > 0 && <section className="card"><h2>Activity</h2><Activity events={d.events} /></section>}
        </div>
        <div>
          <section className="card">
            <h2>{s.status === "open" ? "Accept this slip" : "Status"}</h2>
            {s.status === "open" && !user && (
              <><p className="hint">Anyone can read this slip. To accept it, sign in first.</p>
                <div className="btn-row"><Link className="btn" to={`/login?next=${next}`}>Sign in to accept</Link><Link className="btn btn-quiet" to={`/register?next=${next}`}>Create account</Link></div></>
            )}
            {s.status === "open" && s.can_accept && !accepting && (
              <><p className="hint">One person can accept a slip, first come first served. No admin approval needed. You'll choose which contact details to share with the publisher.</p>
                <button className="btn" onClick={() => setAccepting(true)}>Accept this slip</button></>
            )}
            {s.status === "open" && s.can_accept && accepting && (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); act("accept", Object.fromEntries(new FormData(e.target))); }}>
                <p className="hint" style={{ margin: 0 }}>The publisher will see only what you enter here.</p>
                <label>Name<input name="name" required defaultValue={user.name} /></label>
                <label>Email<input name="email" type="email" defaultValue={user.email} /></label>
                <label>Phone<input name="phone" type="tel" defaultValue={user.phone || ""} /></label>
                <p className="hint" style={{ margin: 0 }}>Share at least an email or a phone number.</p>
                <label>Note (optional)<textarea name="note" rows={2} maxLength={500} placeholder="When you can start, questions…" /></label>
                <div className="btn-row"><button className="btn" disabled={busy}>{busy ? "Accepting…" : "Confirm and share"}</button>
                  <button type="button" className="btn btn-quiet" onClick={() => setAccepting(false)}>Cancel</button></div>
              </form>
            )}
            {s.status === "open" && rel === "creator" && <p className="hint">Your slip is live in the public feed. It will show as accepted when someone takes it.</p>}
            {s.status === "open" && user?.role === "admin" && <p className="hint">Admins only monitor. Slips are published and accepted by users.</p>}
            {s.status === "accepted" && rel === "visitor" && <p className="hint">Someone has already accepted this slip.</p>}
            {s.status === "accepted" && rel === "accepter" && <><p className="hint">You accepted this on {fmtWhen(s.accepted_at)}. Contact the publisher, then they will mark it complete.</p>
              <button className="btn btn-quiet" disabled={busy} onClick={() => window.confirm("Release this slip back to the public feed?") && act("release")}>Release slip</button></>}
            {s.status === "accepted" && rel === "creator" && <div className="btn-row">
              <button className="btn" disabled={busy} onClick={() => act("complete")}>Mark complete</button>
              <button className="btn btn-quiet" disabled={busy} onClick={() => window.confirm("Cancel this slip?") && act("cancel")}>Cancel slip</button></div>}
            {s.status === "open" && rel === "creator" && <button className="btn btn-quiet" disabled={busy} onClick={() => window.confirm("Cancel this slip?") && act("cancel")}>Cancel slip</button>}
            {s.status === "completed" && <p className="hint">Completed {fmtWhen(s.completed_at)}.</p>}
            {s.status === "cancelled" && <p className="hint">This slip was cancelled.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
