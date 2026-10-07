# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Staff of a local government unit (the fictional City Government of Dalisay in this demo), across four roles that share one app:

- **Enforcement officers/issuers** issue citation tickets from assigned ticket pads.
- **Cashier / treasury staff** look up billings and record payments against citations.
- **Admin / office in-charge** manage users, ticket booklets, assignments, and liquidation of pads.
- **Auditors / management** review reports, dashboard stats, and the audit log.

Usage is mixed desktop and phone: office PCs for most back-office work, phones for field use.

## Product Purpose

CiteTicket manages the full lifecycle of traffic/ordinance citations for a local government: ticket issuance, billing, payments, reporting, and audit logging. Success is accurate, auditable records of every ticket, from booklet to payment. This repository is a portfolio demo running on generated data.

## Operating Context

Ticket booklets are sliced into assignments (pads) handed to officers. Issued citations generate billings that are paid down by payments. Office staff liquidate pads by checking each ticket's outcome, and printed reports (e.g. the ticket liquidation sheet) are part of the paper workflow. Most mutations are mirrored in an audit log.

## Capabilities and Constraints

- Served under base path `/citeticket` (configurable with `BASE_PATH`).
- Role-based access control by permission strings (`action:scope:resource`).
- Issuance statuses: Issued, Notice of Settlement, Paid, Filed Case, Case Closed, Cancelled.
- Stack is fixed: SvelteKit 2 / Svelte 5, Tailwind v4 + daisyUI, lucide icons. Keep it.
- Pages must stay light for low-end hardware and slow networks.
- Printable outputs must print cleanly on paper.

## Brand Commitments

The demo is branded as the fictional City Government of Dalisay: a placeholder seal and name appear on printed documents. No real LGU names, seals or places. Tone is government-appropriate. The product name is "CiteTicket".

## Evidence on Hand

Placeholder seal at `src/lib/assets/lgu_seal.svg`; LGU naming in `src/lib/data/lgu.ts`. All data is generated. No testimonials, benchmarks, or usage metrics exist; do not invent them.

## Product Principles

- Records are legal and financial: accuracy and traceability beat convenience.
- Scanability first: staff work through long lists of tickets, so status and totals must read at a glance.
- Works on paper as well as on screen.
- Serve office desktop and field phone without separate products.
- Permission-aware: never show actions a role cannot perform.
