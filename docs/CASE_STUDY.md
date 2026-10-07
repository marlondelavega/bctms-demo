# CiteTicket: citation ticket management for a local government

CiteTicket manages the whole life of a traffic or ordinance citation for a Philippine city government: the paper ticket booklet, the officer who issues it, the bill it creates, the payments that settle it, and the audit trail behind all of it. It replaced a legacy system and was rebuilt as a SvelteKit and MongoDB application.

This repository is a public demo. It is branded as a fictional city ("Dalisay") and runs on generated data. Nothing in it comes from the real deployment.

**Try it:** _(live demo link)_ · one-click logins for administrator, officer, cashier and auditor.

## The problem

Citations are a paper-and-money workflow with legal weight. Ticket booklets are printed with numbered series. A supervisor hands pads of series numbers to officers. An officer cites a person for one or more ordinance provisions, the fine depends on how many times that person has been cited for the same thing, the fine has to be collected, unpaid tickets escalate, and at the end of a pad someone has to account for every number. Records are legal and financial, so they have to be accurate and traceable, and they have to work on an office PC and on an officer's phone.

## What it does

- **Issuance.** An officer picks a violator and the provisions cited. The system works out the offense level from the violator's history, so a second offense is charged at the second-offense penalty, and snapshots the provision text and penalty onto the ticket so later edits to the ordinance never rewrite history.
- **Billing and payments.** Every ticket creates a billing. Payments are partial or full and can never exceed the balance. Tickets move through Issued, Notice of Settlement, Paid, Filed Case, Case Closed or Cancelled, and every change is stamped into a status timeline. An hourly job flags unpaid tickets past the 15-day grace period and escalates them.
- **Ticket booklets and liquidation.** Booklets are registered, withdrawn for an office, and sliced into assignments (pads) for officers. Liquidation checks every series number against what happened to it and prints a sheet.
- **Reports and dashboard.** Collections, issuance by status and period, and a 30-day dashboard, scoped to what the signed-in role may see. Reports print cleanly on paper.
- **Incentive reports.** Officers are paid an incentive for their tickets. Each office has a default rate (a percentage or a fixed amount, counted on issued or on paid tickets). A report is generated for a period, shows its working, and can only be voided with a reason, never edited. A ticket can sit in only one live report, which is enforced by a unique partial index rather than by hoping the UI prevents it.
- **Audit log.** Most changes write a log entry with who did it and what it touched.

## How it is built

**Stack.** SvelteKit 2 and Svelte 5 on adapter-node, MongoDB through Mongoose, `sveltekit-superforms` with zod for forms, Tailwind 4 and daisyUI, TypeScript throughout.

**Data model.** Enforcement groups (offices) own users, who hold a user type (role plus permissions). Users register ticket booklets, which are sliced into assignments, which are used to create issuances against a violator. An issuance carries snapshots of its violations and generates a billing, which payments pay down.

```
EnforcementGroups ← Users/UserTypes
                      │ issue
                      ▼
Tickets (booklets) → TicketAssignments → Issuance ──▶ Violations (snapshots)
                                            │
                                            ▼
                                        Billing ← Payments        Logs (audit trail)
```

**Access control.** Permissions are strings of the form `action:scope:resource`, for example `access:office:billing`. Scope is `own`, `office` or `all`, and list queries are built from the scope, so an officer asking for issuances gets only their own and the cashier gets all of them. Permissions are checked in every route and re-read from the database on every request.

**Sessions.** Auth is custom, with no library. The cookie holds only a session id and expiry, signed with an HMAC. Each session is also a document on the server with an idle timeout, an absolute cap and a limit on concurrent sessions, so a password reset or an archived user ends live sessions immediately instead of waiting for a cookie to expire. Passwords are hashed with argon2. Login is rate limited per username and per address, and the failure message is the same whether or not the username exists.

**Money and consistency.** Fines are snapshotted at issuance, balances are recomputed from payments, and overpayment is rejected. The multi-collection issuance write has no transaction yet because the target deployment is a standalone MongoDB; the code rolls back what it can, and moving to a replica set is the documented next step.

## Making the demo

The real system holds personal data, so the demo is a separate copy with its history dropped, and everything identifying was replaced: a fictional city, seal and ordinances, generated people, and no photos.

- **Seed through the real code.** The seed script builds about 430 citations over four months by calling the application's own services, so offense levels, balances and status timelines follow the same rules as production. It then moves each record back to the date the event happened. Dates are relative to the run, so a nightly re-seed keeps the dashboard's 30-day windows full.
- **Demo mode.** A flag turns on role login buttons, a notice, and a small set of guards so visitors sharing an account cannot lock each other out or strip the roles the demo needs.
- **Nightly reset.** A scheduled call wipes and re-seeds the database from inside the running server.

## What I would do next

- Run MongoDB as a replica set and wrap the issuance write and incentive generation in transactions.
- Add automated tests around the balance and offense-level logic, which currently rely on clicking through flows.
- Replace the per-route error handling that returns messages in `statusText` with structured errors.
- Add CI to run the type check and lint.
