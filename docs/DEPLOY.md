# Deploying the demo

The demo is one Node server (SvelteKit, adapter-node) plus a MongoDB database. The steps below use Render and MongoDB Atlas, both with free tiers; any Node host works the same way.

## 1. Database (MongoDB Atlas)

1. Create a free cluster and a database user.
2. Network access: allow the host's addresses. Free hosts have changing addresses, so this usually means `0.0.0.0/0`. The data is fictional, but use a strong database password.
3. Copy the connection string and put the database name in it: `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/citeticket_demo`. The seed and reset refuse to run unless the database name contains `demo`.

## 2. Web service (Render)

1. New → Blueprint, pick this repository. `render.yaml` defines the service.
2. Fill the two values it asks for:
   - `MONGO_URL`: the string from step 1.
   - `ORIGIN`: the service's public URL, for example `https://citeticket-demo.onrender.com`. Without it, form posts fail SvelteKit's origin check.
3. `SESSION_SECRET` and `DEMO_RESET_TOKEN` are generated for you. Never reuse values from any other environment.
4. `MONGO_URL` and `SESSION_SECRET` are read at build time, so they must be set before the first build (the blueprint does this).

The app is then at `ORIGIN/citeticket`. To serve it under a different path, set `BASE_PATH` (for example `/app`) in the build environment; it is applied at build time. The nightly workflow's `DEMO_URL` and the health check path in `render.yaml` must match.

Notes:

- The session cookie is `Secure`, so the site must be served over HTTPS (hosts do this for you).
- Behind a proxy, `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH=1` (already in the blueprint) make the login rate limiter see each visitor's address instead of the proxy's. If you change hosts, check how many proxies sit in front of the app.
- The free tier sleeps when idle, so the first visit after a quiet spell takes about a minute.

## 3. First data load

Either run the seed from your machine against Atlas:

```sh
MONGO_URL="mongodb+srv://…/citeticket_demo" SESSION_SECRET=x DEMO_MODE=true npm run seed
```

or call the reset endpoint once the service is up (it does the same thing, inside the server):

```sh
curl -X POST -H "Authorization: Bearer $DEMO_RESET_TOKEN" https://YOUR-SERVICE.onrender.com/citeticket/api/demo/reset
```

Seeding takes under a minute. It also builds the indexes the schemas declare (unique usernames, the sessions TTL, the one-live-report-per-ticket guard), because `autoIndex` is off in production. To confirm: in Atlas, check the `users` collection has a unique `username_1` index and `sessions` has a `purge_at_1` TTL index.

## 4. Nightly reset

`.github/workflows/nightly-reset.yml` calls the reset endpoint at 03:00 Manila time. In the GitHub repository settings add:

- variable `DEMO_URL`: `https://YOUR-SERVICE.onrender.com/citeticket`
- secret `DEMO_RESET_TOKEN`: the token from Render

A reset wipes every collection, re-seeds, and signs everyone out. Dates are relative to the run, so the dashboard's 30-day windows stay full.

## 5. Smoke test

After each deploy, sign in with the one-click buttons on the login page and check:

- [ ] Login page shows the four demo roles, and each button signs in.
- [ ] **Administrator:** dashboard shows numbers and charts for the last 30 days.
- [ ] **Administrator:** Issuance list has about 430 tickets across several statuses; open one and see its status history.
- [ ] **Officer:** Issuance → issue a new ticket for an existing violator (pick a pad, a barangay and a provision). A receipt with a tracking code appears. The officer's own list shows only their tickets.
- [ ] **Cashier:** Payments → add a payment against an unpaid billing. The balance drops, and the ticket moves to Paid when it reaches zero.
- [ ] **Administrator:** Reports → run a report and open the print preview. Letterhead says City Government of Dalisay.
- [ ] **Administrator:** Incentives → generate a report for a month, then void it with a reason. The tickets can be used in a new report afterwards.
- [ ] **Auditor:** Logs shows the audit trail; no create or edit buttons appear.
- [ ] Demo guards: changing a demo account's password, resetting it, archiving it, or editing a built-in user type each shows an explanatory message.
- [ ] Wrong password nine times in a row shows "Too many failed attempts".
- [ ] `POST /api/demo/reset` without the token returns 401; with it, 202.
- [ ] `/api/test-clear` returns 404.

## Things to know

- Photo uploads are off (no file service). Avatars show initials.
- Local development: `npm run dev` serves on `https://localhost:6460/citeticket` with a self-signed certificate. Set `DEMO_MODE=true` in `.env` to see the demo login buttons and banner.
