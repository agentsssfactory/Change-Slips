import { useState } from "react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { Flash } from "../../components/Common.jsx";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const save = async (e) => {
    e.preventDefault(); setErr(""); setOk("");
    try { const d = await api("/profile", { method: "PUT", body: Object.fromEntries(new FormData(e.target)) }); setUser(d.user); setOk("Saved."); }
    catch (ex) { setErr(ex.message); }
  };
  return (
    <>
      <div className="page-head"><h1>Profile</h1><p className="lede">Your contact details are shared only with the other person on a slip, after it's accepted.</p></div>
      <section className="card">
        <form className="stack" onSubmit={save}>
          <Flash>{err}</Flash><Flash kind="ok">{ok}</Flash>
          <label>Name<input name="name" required defaultValue={user.name} /></label>
          <label>Business<input name="business" defaultValue={user.business || ""} /></label>
          <div className="row2">
            <label>Phone<input name="phone" type="tel" defaultValue={user.phone || ""} /></label>
            <label>Location<input name="address" defaultValue={user.address || ""} /></label>
          </div>
          <p className="hint" style={{ margin: 0 }}>Email: {user.email}</p>
          <div className="btn-row"><button className="btn">Save</button></div>
        </form>
      </section>
    </>
  );
}
