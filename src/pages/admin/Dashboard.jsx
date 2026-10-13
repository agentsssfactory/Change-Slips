import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, money, fmtWhen } from "../../api.js";
import { StatusBadge, Flash } from "../../components/Common.jsx";

export default function Dashboard() {
  const nav = useNavigate();
  const [stats, setStats] = useState(null); const [recent, setRecent] = useState([]); const [err, setErr] = useState("");
  useEffect(() => { Promise.all([api("/admin/stats"), api("/admin/slips")]).then(([s, l]) => { setStats(s); setRecent(l.slips.slice(0, 8)); }).catch((e) => setErr(e.message)); }, []);
  const c = stats?.counts || {};
  return (
    <>
      <div className="page-head"><h1>Admin dashboard</h1><p className="lede">Read-only monitoring. Users publish and accept slips on their own; the admin only watches overall activity.</p></div>
      <Flash>{err}</Flash>
      {stats && <div className="stats">
        <div className="stat"><b>{stats.total}</b><span>Slips</span></div><div className="stat"><b>{c.open}</b><span>Available</span></div>
        <div className="stat"><b>{c.accepted}</b><span>Accepted</span></div><div className="stat"><b>{stats.users}</b><span>Users</span></div></div>}
      <section className="card table-wrap">
        <div className="seq-head" style={{ marginBottom: 0 }}><h2>Latest slips</h2><Link to="/admin/slips">View all →</Link></div>
        {!recent.length ? <p className="empty">No slips yet.</p> : (
          <table><thead><tr><th>Slip</th><th>Publisher</th><th>Amount</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>{recent.map((s) => (<tr key={s.id} className="click" onClick={() => nav(`/slips/${s.id}`)}>
              <td><Link to={`/slips/${s.id}`}>{s.title}</Link></td><td>{s.creator.business}</td><td>{money(s.amount_cents, s.currency)}</td><td><StatusBadge status={s.status} /></td><td>{fmtWhen(s.updated_at)}</td></tr>))}</tbody></table>
        )}
      </section>
      {stats && <p className="hint">Completed: {c.completed} · Cancelled: {c.cancelled}</p>}
    </>
  );
}
