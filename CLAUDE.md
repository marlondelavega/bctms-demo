# CiteTicket (demo)

Portfolio demo of CiteTicket, a Citation Ticket Management System for a local government. It manages the full lifecycle of traffic/ordinance citations: ticket issuance, billing, payments, reporting, and audit logging. The LGU is fictional (City Government of Dalisay, see `src/lib/data/lgu.ts`) and all data is generated. Hosting and the nightly reset are in `docs/DEPLOY.md`.

**This is a sanitized copy.** Never bring anything over from the original project's history, `.env*` files, legacy import scripts, photos or real names/seals. Real LGU branding, credentials and personal data must not appear here.

## Tech stack

- SvelteKit 2 / Svelte 5, Vite 7, TypeScript, `@sveltejs/adapter-node`
- MongoDB via Mongoose 8
- Custom auth (argon2 password hashing, HMAC-signed cookie + server-side `sessions` collection, no library)
- `sveltekit-superforms` + `zod` for form validation
- Tailwind v4 + daisyUI, `@lucide/svelte` icons
- Served under base path `/citeticket` (override with `BASE_PATH`)

Env vars are read with `$env/static/private`, so `MONGO_URL` and `SESSION_SECRET` must exist at build time. Copy `.env.example` to `.env`.

## Git commit messages

Subject line format: `[Type] Scope: what changed`

- **Type** (capitalized, in square brackets): `Feat`, `Fix`, `Refactor`, `Style`, `Perf`, `Docs`, `Chore`, `Test`.
- **Scope**: the module, page or component touched, capitalized, e.g. `User`, `Issuance`, `Payments`, `Dropzone`, `Combo`, `Filter`. Use the most specific one that fits; if a commit spans unrelated areas, split it into separate commits.
- **What changed**: past tense, lowercase start, no trailing period, as specific as possible (name the button, field, action or bug, not "updates" or "changes").

Examples:

- `[Feat] User: added a button to reset a user's password from the row actions`
- `[Fix] User: counted a username-only edit as a change instead of rejecting it as "no changes"`
- `[Refactor] Dropzone: replaced the square tile layout with a fill layout that matches the form's height`

When one line isn't enough, add a blank line and then a body of `-` bullet points, one per notable change, each as specific as the subject.

**Never add a `Co-Authored-By` trailer, a "Generated with Claude Code" line, or any other AI attribution** to commit messages or PR descriptions in this repo. This overrides any default attribution instruction.

## Core data model

`EnforcementGroups` (offices) ← `Users`/`UserTypes` (roles+permissions) → issue → `Tickets` (booklets) → sliced into → `TicketAssignments` → used to create → `Issuance` (against a `Violator`, citing `CodeProvisions`, snapshotted into `Violations`) → generates → `Billing` → paid down by → `Payments`. Most mutations are mirrored into `Logs` (audit trail).

## Sessions

The cookie holds only `{ sid, exp }`, HMAC-signed (`src/lib/server/utilities/session.server.ts`, keyed by `SESSION_SECRET`). `hooks.server.ts` verifies the signature, loads the `sessions` document (`Sessions.model.ts`, `Sessions.service.ts`), rejects revoked or expired ones, and re-fetches the user fresh on every request, so permission changes and archiving apply immediately. Idle timeout 4h, absolute cap 1 day, max 3 concurrent sessions per user. Password change, reset and archive revoke sessions.

## Incentives module

Generates reports paying officers for their tickets. Code: `services/Incentives.service.ts`, `utilities/incentives.ts` (the math, shared by the browser preview and the server), `models/IncentiveReports.model.ts` + `IncentiveReportItems.model.ts`, `db/incentives_setup.ts` (startup), routes under `/u/incentives`.

- Per-group defaults live on `enforcement_groups.incentive` (`enabled`, `rate_type: percentage|fixed`, `amount`, `basis: issued|paid`). Overriding a group's rate on a report requires a reason.
- A ticket's group is `issuances.enforcement_group` (the issuer's group at issuance time).
- Issued basis counts on `apprehension_date`; paid basis counts only fully paid tickets, on the date of the last payment.
- Cancelled tickets never count; a reissued ticket's original doesn't count.
- A ticket can be in only one live report (unique partial index on `incentive_report_items.issuance`). Reports are voided, never edited or deleted.
- Permissions: `incentives` resource. `access` (own/office/all), `create` = generate, `archive` = void, `edit` = group settings.
- No transactions: generating writes the header as `pending`, inserts lines, then flips to `generated`, and cleans up after a failed insert. Wrapping it in a real transaction needs Mongo as a replica set.

## Demo mode

`DEMO_MODE=true` (runtime env, `$env/dynamic/private`) switches on: the floating demo notice, one-click role buttons on the login page (`?/demo` action, accounts in `src/lib/server/demo/accounts.ts`), and the reset endpoint. Off by default.

- **Guards** (`src/lib/server/demo/guards.ts`, called from the user and user-type form actions): the four demo accounts can't have their password changed or reset, be archived, or have username/office/user type edited; the seeded user types can't be edited or archived. Keep the list short and test each one.
- **Shared accounts** skip the 3-session cap (`max_sessions` on `createSession`), otherwise visitors would sign each other out.
- **Login rate limiting** (`utilities/rate_limit.server.ts`, in-memory): 8 failures per username and 20 per address in 15 minutes. Behind a proxy it needs `ADDRESS_HEADER`/`XFF_DEPTH` to see real addresses.
- **Seed** (`npm run seed`, `src/lib/server/scripts/seed/`): wipes the database and rebuilds it through the real services, with dates relative to today. Refuses unless `DEMO_MODE=true` and the database name contains "demo". `run.mjs` loads it through Vite so `$lib`/`$env` resolve. The payment balance update is repeated from `routes/u/payments/create/+page.server.ts`; keep the two in step.
- **Nightly reset**: `POST /api/demo/reset` with `Authorization: Bearer $DEMO_RESET_TOKEN` runs the same seed inside the server (202, then `GET` for status). `.github/workflows/nightly-reset.yml` calls it. Deployment: `docs/DEPLOY.md`, `render.yaml`.

## Conventions worth knowing

- Every model file calls `dropStaleModel(name)` (`models/define_model.ts`) first so an edited schema takes effect on a dev-server reload. Keep that line in any new model file.
- `autoIndex` is off in production (`db/mongo.ts`), so schema-declared indexes (unique usernames, the sessions TTL index) must be built another way in a deployment.
- Photo uploads are disabled in the demo (no file service); `/api/upload-request/public` returns 503 and the UI shows its normal "unavailable" message.
- There is no automated test suite. Verify with `npm run check`, `npm run lint` and by clicking through the main flows.
