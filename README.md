# CiteTicket (demo)

CiteTicket is a citation ticket management system for a local government: ticket issuance, billing, payments, reporting and audit logging. This repository is a portfolio demo, branded as the fictional **City Government of Dalisay** and filled with generated data. It contains no real people, tickets or credentials.

## What it does

Offices (enforcement groups) have users with role-based permissions. Ticket booklets are sliced into assignments (pads) handed to officers. An officer issues a citation against a violator, citing one or more code provisions. Each citation generates a billing, which payments pay down. Most changes are written to an audit log.

On top of that:

- **Dashboard and reports** (collections, issuance by status, printable reports)
- **Ticket liquidation** of pads, with a printable sheet
- **Incentive reports** that pay officers for their tickets, with per-office rates, auditable and voidable
- **Role-based access control** by `action:scope:resource` permission strings, re-checked on every request
- **Server-side sessions** that are signed, revocable, idle-timed and capped per user

## Stack

SvelteKit 2 / Svelte 5, Vite, TypeScript, MongoDB with Mongoose, Tailwind v4 with daisyUI, sveltekit-superforms with zod. Passwords are hashed with argon2. Auth is custom (no library).

## Running it locally

You need Node 22+ and a MongoDB instance (local or Atlas).

```sh
npm install
cp .env.example .env     # then edit the values
npm run dev
```

The app is served under the base path `/citeticket`. Set `BASE_PATH` to change it.

## Demo data

`DEMO_MODE=true` in `.env` shows the demo notice and one-click role logins. `npm run seed` fills an empty (or existing) demo database with about 430 citations, their billings, payments and audit trail. It wipes the database first and only runs when the database name contains "demo". See [docs/DEPLOY.md](docs/DEPLOY.md) for hosting and the nightly reset.

## Environment

See `.env.example`. `SESSION_SECRET` signs the session cookie: generate a fresh random value per environment and never commit it.

## Scripts

- `npm run dev` / `build` / `preview`: Vite
- `npm run seed`: rebuild the demo data (see above)
- `npm run check`: type and Svelte checks
- `npm run lint`: Prettier and ESLint

## Notes

- Photo uploads are disabled: the demo has no file service.
- There is no automated test suite. Verify changes with `npm run check`, `npm run lint` and by clicking through the main flows.
