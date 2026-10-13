import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtWhen } from "../../api.js";
import { Flash } from "../../components/Common.jsx";

export default function Notifications() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api("/notifications").then(async (x) => {
      setD(x);
      if (x.unread) { await api("/notifications/read", { method: "POST" }); window.dispatchEvent(new Event("notifs-changed")); }
    }).catch((e) => setErr(e.message));
  }, []);
  return (
    <>
      <div className="page-head"><h1>Alerts</h1><p className="lede">Accepted, released, completed and cancelled slips.</p></div>
      <Flash>{err}</Flash>
      <section className="card">
        {d && !d.notifications.length ? <p className="empty">Nothing yet.</p> : (
          <ul className="activity">{d?.notifications.map((n) => (
            <li key={n.id}><span className={`ic ${n.seen ? "" : "accepted"}`}>{n.seen ? "•" : "●"}</span>
              <div><div><Link to={`/slips/${n.slip_id}`}>{n.text}</Link></div><div className="when">{fmtWhen(n.created_at)}</div></div></li>))}</ul>
        )}
      </section>
    </>
  );
}
