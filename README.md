# ChangeSlip (React): public change-order slips

Users **publish** change slips (extra work + price). Slips are **public** the moment they're published. Any signed-in user can **accept** one, with no admin approval, and the two sides exchange contact details.

**Stack:** React 18 + React Router (Vite) · Vercel serverless API (Express) · Postgres (Neon) · cookie JWT auth (bcrypt)

## Logins (separate pages per role)
| Role | URL | Local demo login |
|---|---|---|
| User | `/login` (register at `/register`) | demo@changeslip.com / demo123, demo2@changeslip.com / demo123 |
| Admin | `/admin/login` | admin@changeslip.com / admin123 (from `.env`) |

Each login page rejects the other role's credentials, and the API enforces roles server-side.

## How it works
- **Public feed** (`/slips`): anyone, even signed out, can browse and search slips. Contact details never appear in the feed.
- **Publish** (`/new`): title, amount, job ref, area, details. Live immediately.
- **Accept**: a signed-in user other than the publisher opens the slip, chooses which contact details to share (name, email/phone, note) and confirms. One conditional database update decides the winner, so two people clicking at once can't both get it. Single assignee, first come first served.
- **Contact exchange**: after acceptance the publisher sees the accepter's shared details, and the accepter sees the publisher's profile contact (name, phone, email, location). Nobody else sees them (admins can't either).
- **Lifecycle**: Available → Accepted → Completed (publisher marks done) or Cancelled. The accepter can release a slip back to the feed. Everyone involved gets an in-app alert.
- **Admin (monitor only)**: a read-only dashboard with totals, a list of all slips and statuses, and a user list. The admin can't approve, accept, edit or remove slips, and never sees contact details.

## Run locally (VS Code)
```bash
npm install
cp .env.example .env     # Windows: copy .env.example .env
npm run dev              # web http://localhost:5173, API :4000
```
No database install needed: without `DATABASE_URL` it uses an embedded Postgres in `./data/pglite`.

## Deploy to Vercel
1. Push to GitHub, then Vercel → Add New → Project → import the repo. Don't deploy yet.
2. Storage tab → Create Database → **Neon (Postgres)** → connect it (adds `DATABASE_URL`).
3. Settings → Environment Variables: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (optional `SEED_DEMO=1`).
4. Deploy. Tables and the admin account are created on the first request. Sign in at `/admin/login`.

## Notes
- The original upload was a Next.js + SQLite app (private magic-link slips for a single owner). It was rebuilt as the public, multi-user version above, in the same architecture as the other projects. The old customer accept/decline link and printable receipt are not included.
- Tested locally against embedded Postgres, including a Playwright run: public browsing with no contact leak, sign-in redirect back to the slip, publish, accept, contact exchange, privacy for third parties, complete, admin read-only monitoring, and role separation. A concurrent double-accept was checked at the API (exactly one wins). Not tested against a real Vercel/Neon deployment.
