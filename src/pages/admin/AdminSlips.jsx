import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money, fmtWhen } from "../../api.js";
import { StatusBadge, Flash } from "../../components/Common.jsx";

export default function AdminSlips() {
  const [slips, setSlips] = useState(null); const [term, setTerm] = useState(""); const [status, setStatus] = useState(""); const [err, setErr] = useState("");
  const load = () => api(`/admin/slips?${new URLSearchParams({ q: term, status })}`).then((d) => setSlips(d.slips)).catch((e) => setErr(e.message));
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [term, status]); // eslint-disable-line
  return (
    <>
      <div className="page-head"><h1>All slips</h1><p className="lede">Read-only overview of every slip on the platform.</p></div>
      <Flash>{err}</Flash>
      <div className="filters" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <input className="search" placeholder="Search title, publisher, accepter…" value={term} onChange={(e) => setTerm(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All</option><option value="open">Available</option><option value="accepted">Accepted</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
      </div>
      <section className="card table-wrap">
        {slips && !slips.length ? <p className="empty">No slips match.</p> : (
          <table><thead><tr><th>Slip</th><th>Publisher</th><th>Accepted by</th><th>Amount</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>{slips?.map((s) => (<tr key={s.id}>
              <td><Link to={`/slips/${s.id}`}>{s.title}</Link></td><td>{s.creator.business}</td><td>{s.accepter_name || "—"}</td><td>{money(s.amount_cents, s.currency)}</td>
              <td><StatusBadge status={s.status} /></td><td>{fmtWhen(s.updated_at)}</td></tr>))}</tbody></table>
        )}
      </section>
    </>
  );
}
