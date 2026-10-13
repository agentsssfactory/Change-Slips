import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, money, fmtWhen } from "../../api.js";
import { StatusBadge, Flash } from "../../components/Common.jsx";

function Table({ rows, empty, role }) {
  const nav = useNavigate();
  if (!rows.length) return <section className="card"><p className="empty">{empty}</p></section>;
  return (
    <section className="card table-wrap">
      <table>
        <thead><tr><th>Slip</th><th>Amount</th><th>Status</th><th>{role === "pub" ? "Accepted by" : "Published by"}</th><th>Updated</th></tr></thead>
        <tbody>{rows.map((s) => (
          <tr key={s.id} className="click" onClick={() => nav(`/slips/${s.id}`)}>
            <td><Link to={`/slips/${s.id}`}>{s.title}</Link></td><td>{money(s.amount_cents, s.currency)}</td><td><StatusBadge status={s.status} /></td>
            <td>{role === "pub" ? (s.accepter?.name || "—") : s.creator.business}</td><td>{fmtWhen(s.updated_at)}</td>
          </tr>))}</tbody>
      </table>
    </section>
  );
}

export default function My() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("pub");
  const [err, setErr] = useState("");
  useEffect(() => {
    const load = () => api("/my").then(setD).catch((e) => setErr(e.message));
    load(); const t = setInterval(load, 20000); return () => clearInterval(t);
  }, []);
  const pub = d?.published || [], acc = d?.accepted || [];
  return (
    <>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div><h1>My slips</h1><p className="lede">Slips you published and slips you accepted.</p></div>
        <Link className="btn" to="/new">Publish a slip</Link>
      </div>
      <Flash>{err}</Flash>
      {d && <div className="stats">
        <div className="stat"><b>{pub.filter((s) => s.status === "open").length}</b><span>Published, waiting</span></div>
        <div className={`stat ${pub.filter((s) => s.status === "accepted").length ? "hot" : ""}`}><b>{pub.filter((s) => s.status === "accepted").length}</b><span>Accepted by others</span></div>
        <div className="stat"><b>{acc.filter((s) => s.status === "accepted").length}</b><span>I'm working on</span></div>
        <div className="stat"><b>{[...pub, ...acc].filter((s) => s.status === "completed").length}</b><span>Completed</span></div>
      </div>}
      <div className="filters" style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
        <button className={tab === "pub" ? "is-on" : ""} onClick={() => setTab("pub")}>Published ({pub.length})</button>
        <button className={tab === "acc" ? "is-on" : ""} onClick={() => setTab("acc")}>Accepted ({acc.length})</button>
      </div>
      {tab === "pub" ? <Table rows={pub} role="pub" empty="You haven't published a slip yet." /> : <Table rows={acc} role="acc" empty="You haven't accepted any slips. Browse the public feed." />}
    </>
  );
}
