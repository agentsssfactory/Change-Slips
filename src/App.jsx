import { Routes, Route, Link } from "react-router-dom";
import { Layout, RequireRole } from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Slips from "./pages/Slips.jsx";
import SlipDetail from "./pages/SlipDetail.jsx";
import { UserLogin, Register, AdminLogin } from "./pages/Auth.jsx";
import My from "./pages/user/My.jsx";
import NewSlip from "./pages/user/NewSlip.jsx";
import Profile from "./pages/user/Profile.jsx";
import Notifications from "./pages/user/Notifications.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import AdminSlips from "./pages/admin/AdminSlips.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="slips" element={<Slips />} />
        <Route path="slips/:id" element={<SlipDetail />} />
        <Route path="login" element={<UserLogin />} />
        <Route path="register" element={<Register />} />
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="my" element={<RequireRole role="user"><My /></RequireRole>} />
        <Route path="new" element={<RequireRole role="user"><NewSlip /></RequireRole>} />
        <Route path="profile" element={<RequireRole role="user"><Profile /></RequireRole>} />
        <Route path="notifications" element={<RequireRole role="user"><Notifications /></RequireRole>} />
        <Route path="admin" element={<RequireRole role="admin"><Dashboard /></RequireRole>} />
        <Route path="admin/slips" element={<RequireRole role="admin"><AdminSlips /></RequireRole>} />
        <Route path="admin/users" element={<RequireRole role="admin"><AdminUsers /></RequireRole>} />
        <Route path="*" element={<section className="card"><h1>Page not found</h1><p><Link to="/">Back home</Link></p></section>} />
      </Route>
    </Routes>
  );
}
