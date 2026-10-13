import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Flash, SlipCard } from "../components/Common.jsx";
import { useAuth } from "../auth.jsx";

/** The public feed. Anyone can browse; contact details never appear here. */
export default function Slips() {
  const { user } = useAuth();
  const [slips, setSlips] = useState(null);
  const [more, setMore] = useState(false);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("open");
  const [sort, setSort] = useState("new");
  const [err, setErr] = useState("");
  const load = (offset = 0) => {
    const p = new URLSearchParams({ q: term, status, sort, offset });
    return api(`/slips?${p}`).then((d) => { setSlips((s) => (offset ? [...(s || []), ...d.slips] : d.slips)); setMore(d.more); }).catch((e) => setErr(e.message));
  };
  useEffect(() => {
    const t = setTimeout(() => load(0), 200);
    return () => clearTimeout(t);
  }, [term, status, sort]); // eslint-disable-line
  useEffect(() => { const t = setInterval(() => load(0), 30000); return () => clearInterval(t); }); // live refresh
  return (
    <>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div><h1>Public slips</h1><p className="lede">Published by users, open to everyone. Sign in to accept one.</p></div>
        {user?.role === "user" && <Link className="btn" to="/new">Publish a slip</Link>}
        {!user && <Link className="btn" to="/register">Create account to accept</Link>}
      </div>
      <Flash>{err}</Flash>
      <div className="filters" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <input className="search" placeholder="Search title, details, job ref, place…" value={term} onChange={(e) => setTerm(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="open">Available</option><option value="accepted">Accepted</option><option value="completed">Completed</option><option value="">All</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="new">Newest</option><option value="amount">Highest amount</option>
        </select>
      </div>
      {slips && !slips.length ? <section className="card"><p className="empty">No slips match.</p></section> : (
        <div className="slip-grid">{slips?.map((s) => <SlipCard key={s.id} slip={s} to={`/slips/${s.id}`} />)}</div>
      )}
      {more && <p style={{ textAlign: "center" }}><button className="btn btn-quiet" onClick={() => load(slips.length)}>Load more</button></p>}
    </>
  );
}
