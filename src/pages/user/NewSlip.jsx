import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { Flash } from "../../components/Common.jsx";

export default function NewSlip() {
  const nav = useNavigate();
  const { currencies = ["USD"], defaultCurrency = "USD" } = useAuth();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const d = await api("/slips", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }); nav(`/slips/${d.id}`); }
    catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return (
    <>
      <div className="page-head"><h1>Publish a slip</h1><p className="lede">It goes live in the public feed immediately. No approval step.</p></div>
      <section className="card">
        <form className="stack" onSubmit={submit}>
          <Flash>{err}</Flash>
          <label>What is the extra work? (title)<input name="title" required maxLength={200} placeholder="e.g. Replace condenser fan motor" /></label>
          <div className="row2">
            <label>Amount<input name="amount" type="number" min="0" step="0.01" required /></label>
            <label>Currency<select name="currency" defaultValue={defaultCurrency}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          <div className="row2">
            <label>Job reference (optional)<input name="job_ref" maxLength={60} /></label>
            <label>Area / location (optional)<input name="location" maxLength={150} placeholder="City or neighbourhood" /></label>
          </div>
          <label>Details<textarea name="details" rows={5} maxLength={3000} placeholder="Scope, materials, timing, anything the person accepting should know" /></label>
          <p className="hint" style={{ margin: 0 }}>Slips are public. Your phone, email and address are <b>not</b> shown. They're shared only with the person who accepts.</p>
          <div className="btn-row"><button className="btn" disabled={busy}>{busy ? "Publishing…" : "Publish slip"}</button></div>
        </form>
      </section>
    </>
  );
}
