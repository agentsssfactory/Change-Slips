import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Home() {
  const { user } = useAuth();
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/slips"} replace />;
  return (
    <>
      <section className="hero">
        <h1>Change slips, out in the open.</h1>
        <p className="lede">Publish a change-order slip for extra work. Anyone can see it, any signed-in user can accept it, and the two of you swap contact details to get it done. No admin approval.</p>
        <ol className="steps4">
          <li><b>Publish</b><span>Describe the extra work and the price.</span></li>
          <li><b>Public feed</b><span>Everyone can browse it straight away.</span></li>
          <li><b>Someone accepts</b><span>First signed-in user to accept gets it.</span></li>
          <li><b>Swap contacts</b><span>Both sides see each other's details.</span></li>
        </ol>
        <div className="btn-row" style={{ marginTop: "1rem" }}><Link className="btn" to="/slips">Browse public slips</Link><Link className="btn btn-quiet" to="/register">Create account</Link></div>
      </section>
      <div className="portals">
        <section className="card"><h2>Users</h2><p className="hint">Publish slips and accept slips from others.</p>
          <div className="btn-row"><Link className="btn" to="/login">Sign in</Link><Link className="btn btn-quiet" to="/register">Create account</Link></div></section>
        <section className="card"><h2>Admin</h2><p className="hint">Monitor overall activity: slips, statuses and users. Read-only.</p>
          <div className="btn-row"><Link className="btn btn-quiet" to="/admin/login">Admin login</Link></div></section>
      </div>
    </>
  );
}
