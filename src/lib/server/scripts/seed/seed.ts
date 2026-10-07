/**
 * Builds the demo database: wipes it, then recreates offices, roles, users, ordinances, ticket
 * booklets, ~4 months of citations with their billings, payments and status timelines, an audit
 * trail and a few incentive reports.
 *
 * Everything goes through the app's own services (and the issuance form's penalty resolver) so the
 * balances, offense levels and statuses follow the real business rules. Only the payment balance
 * update is repeated here, because the app keeps that inside the payment form action
 * (`routes/u/payments/create/+page.server.ts`); keep the two in step.
 *
 * Services stamp "now" on what they write, so afterwards each record is moved back to the date
 * the event happened. Dates are relative to the run, so a nightly re-run keeps the dashboard's
 * 30-day windows full.
 *
 * Loaded through Vite (see run.mjs) so `$lib` and `$env` resolve; do not import it from the app.
 */
import mongoose from 'mongoose';
import argon2, { argon2id } from 'argon2';
import { customAlphabet } from 'nanoid';

import { connectDB } from '$lib/server/db/mongo';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '$lib/server/demo/accounts';
import { city_barangays, issuance_status } from '$lib/data/static_data';
import { lgu } from '$lib/data/lgu';
import { isDemoMode } from '$lib/server/demo/guards';

import UsersModel from '$lib/server/models/Users.model';
import UserTypesModel from '$lib/server/models/UserTypes.model';
import EnforcementGroupsModel from '$lib/server/models/EnforcementGroups.model';
import ViolationCategoryModel from '$lib/server/models/ViolationCategories.model';
import CodeProvisionsModel from '$lib/server/models/CodeProvision.model';
import TicketsModel from '$lib/server/models/Tickets.model';
import TicketAssignmentsModel from '$lib/server/models/TicketAssignments.model';
import ViolatorsModel from '$lib/server/models/Violators.model';
import IssuanceModel from '$lib/server/models/Issuance.model';
import ViolationModel from '$lib/server/models/Violations.model';
import BillingModel from '$lib/server/models/Billing.model';
import PaymentModel from '$lib/server/models/Payments.model';
import TicketTrackingModel from '$lib/server/models/TicketTracking.model';
import LogsModel, { type T_Log_C } from '$lib/server/models/Logs.model';
import SessionsModel from '$lib/server/models/Sessions.model';
import IncentiveReportsModel from '$lib/server/models/IncentiveReports.model';
import IncentiveReportItemsModel from '$lib/server/models/IncentiveReportItems.model';

import {
	createEnforcementGroup,
	updateIncentiveSettings
} from '$lib/server/services/EnforcementGroup.service';
import { createUserType } from '$lib/server/services/UserTypes.service';
import { archiveUsers, createUser } from '$lib/server/services/Users.service';
import { createViolationCategory } from '$lib/server/services/ViolationCategories.service';
import { createCodeProvision } from '$lib/server/services/CodeProvisions.service';
import { createTicket, updateManyTickets } from '$lib/server/services/Tickets.service';
import { createTicketAssignment } from '$lib/server/services/TicketAssignments.service';
import { createViolator } from '$lib/server/services/Violators.service';
import {
	changeIssuanceStatus,
	createIssuance,
	flagOverdueIssuances
} from '$lib/server/services/Issuances.service';
import { createPayment } from '$lib/server/services/Payment.service';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import {
	generateIncentiveReport,
	voidIncentiveReport
} from '$lib/server/services/Incentives.service';
import {
	_mapProvisionToViolationSnapshot,
	_resolveAllViolationPenalties
} from '../../../../routes/u/issuance/create/+page.server';

import {
	CATEGORIES,
	FIRST_NAMES_F,
	FIRST_NAMES_M,
	GROUPS,
	LAST_NAMES,
	MIDDLE_NAMES,
	REMARKS,
	STREETS,
	USER_TYPES,
	type GroupKey,
	type UserTypeKey
} from './data';

// ---- small helpers --------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const MANILA_OFFSET = 8 * HOUR;

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// fixed seed: the same people and citations every run; only the dates move with "today".
// Both are reset at the start of runSeed(), because the nightly reset re-runs it inside a long-lived server.
const SEED = 20260101;
let rnd = mulberry32(SEED);
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const chance = (p: number) => rnd() < p;
const pick = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
const round50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);

/** Midnight (Manila time) of today, as a UTC timestamp. */
function manilaMidnight(): number {
	const t = Date.now() + MANILA_OFFSET;
	return t - (t % DAY) - MANILA_OFFSET;
}

let NOW = Date.now();
const daysAgo = (d: number) => new Date(NOW - d * DAY);
const clampToPast = (ms: number) => new Date(Math.min(ms, NOW - 5 * MINUTE));

type AnyModel = mongoose.Model<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Id = mongoose.Types.ObjectId | string;

/** Moves a record back to when it really happened (the services stamp "now"). Native write, so timestamps stay put. */
async function stamp(
	model: AnyModel,
	filter: Record<string, unknown>,
	at: Date,
	only_created = false
) {
	await model.collection.updateMany(filter, {
		$set: only_created ? { created_at: at } : { created_at: at, updated_at: at }
	});
}

type Actor = {
	_id: string;
	firstname: string;
	lastname: string;
	username: string;
	user_type: string;
	group: GroupKey;
	type_key: UserTypeKey;
	created_days_ago: number;
};

// what the services accept as the signed-in user; the seed's actors carry the same fields they read
type ServiceUser = Parameters<typeof createTicket>[1];
const asUser = (a: Actor) => ({ _id: a._id }) as unknown as ServiceUser;

async function log(
	at: Date,
	actor: Actor | undefined,
	type: T_Log_C['type'],
	message: string,
	source: string,
	collection?: string,
	ids?: Id[]
) {
	const doc = await createLog({
		level: 'INFO',
		type,
		message,
		source,
		affected_collection:
			collection && ids?.length
				? { collection_name: collection, document_id: ids.map(String) }
				: undefined,
		user: logActor(actor)
	});
	if (doc) await stamp(LogsModel, { _id: doc._id }, at);
}

const progress = (msg: string) => console.log(`  ${msg}`);

// ---- wipe -----------------------------------------------------------------------------------

async function wipe() {
	const db = mongoose.connection.db!;
	const collections = await db.listCollections().toArray();
	let removed = 0;
	for (const c of collections) {
		if (c.name.startsWith('system.')) continue;
		const res = await db.collection(c.name).deleteMany({});
		removed += res.deletedCount;
	}
	progress(`cleared ${removed} documents from ${collections.length} collections`);
}

// ---- main -----------------------------------------------------------------------------------

export async function runSeed() {
	if (!isDemoMode()) throw new Error('Refusing to seed: DEMO_MODE is not true.');
	await connectDB();
	const db_name = mongoose.connection.name;
	// this wipes every collection, so only ever run it against a database that is clearly the demo's
	if (!/demo/i.test(db_name) || /^bctms$/i.test(db_name)) {
		throw new Error(`Refusing to seed database "${db_name}": its name must contain "demo".`);
	}
	rnd = mulberry32(SEED);
	NOW = Date.now();
	console.log(`Seeding "${db_name}"`);
	await wipe();

	const password_hash = await argon2.hash(DEMO_PASSWORD, { type: argon2id });
	const tracking_alphabet = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 8);

	// ---- offices -------------------------------------------------------------------------
	const group_id = {} as Record<GroupKey, string>;
	for (const g of GROUPS) {
		const doc = await createEnforcementGroup(
			{ name: g.name, description: g.description },
			undefined
		);
		group_id[g.key] = String(doc._id);
		await stamp(EnforcementGroupsModel, { _id: doc._id }, daysAgo(160));
	}
	progress(`${GROUPS.length} enforcement groups`);

	// ---- roles ---------------------------------------------------------------------------
	const type_id = {} as Record<UserTypeKey, string>;
	for (const t of USER_TYPES) {
		const doc = await createUserType(
			{
				user_type: t.user_type,
				role: t.role,
				permissions: [...t.permissions],
				access_level: t.access_level
			},
			undefined
		);
		type_id[t.key] = String(doc._id);
		await stamp(UserTypesModel, { _id: doc._id }, daysAgo(160));
	}
	progress(`${USER_TYPES.length} user types`);

	// ---- users ---------------------------------------------------------------------------
	const used_names = new Set<string>();
	const used_usernames = new Set<string>(DEMO_ACCOUNTS.map((a) => a.username));
	const people: { firstname: string; lastname: string }[] = [];
	function newPerson() {
		for (;;) {
			const firstname = pick(chance(0.5) ? FIRST_NAMES_F : FIRST_NAMES_M);
			const lastname = pick(LAST_NAMES);
			const key = `${firstname} ${lastname}`;
			if (!used_names.has(key)) {
				used_names.add(key);
				return { firstname, lastname };
			}
		}
	}
	DEMO_ACCOUNTS.forEach((a) => used_names.add(`${a.firstname} ${a.lastname}`));
	const usernameFor = (firstname: string, lastname: string) => {
		const base = `${firstname[0]}.${lastname}`.toLowerCase().replace(/[^a-z.]/g, '');
		let username = base;
		for (let i = 2; used_usernames.has(username); i++) username = `${base}${i}`;
		used_usernames.add(username);
		return username;
	};

	const roster: {
		firstname: string;
		lastname: string;
		username: string;
		group: GroupKey;
		type_key: UserTypeKey;
		days: number;
	}[] = [];
	const demo = (key: string) => DEMO_ACCOUNTS.find((a) => a.key === key)!;
	roster.push({ ...demo('admin'), group: 'admin', type_key: 'admin', days: 160 });
	roster.push({ ...demo('auditor'), group: 'admin', type_key: 'auditor', days: 150 });
	roster.push({ ...demo('cashier'), group: 'treasury', type_key: 'cashier', days: 150 });
	{
		const p = newPerson();
		roster.push({
			...p,
			username: usernameFor(p.firstname, p.lastname),
			group: 'treasury',
			type_key: 'cashier',
			days: 148
		});
	}
	for (const g of ['traffic', 'environment', 'order'] as const) {
		const p = newPerson();
		roster.push({
			...p,
			username: usernameFor(p.firstname, p.lastname),
			group: g,
			type_key: 'supervisor',
			days: 148
		});
	}
	roster.push({ ...demo('officer'), group: 'traffic', type_key: 'officer', days: 145 });
	const officer_counts: Record<string, number> = { traffic: 3, environment: 3, order: 3 };
	for (const g of ['traffic', 'environment', 'order'] as const) {
		for (let i = 0; i < officer_counts[g]; i++) {
			const p = newPerson();
			roster.push({
				...p,
				username: usernameFor(p.firstname, p.lastname),
				group: g,
				type_key: 'officer',
				days: int(138, 145)
			});
		}
	}
	// a former officer: has old tickets, is archived at the end
	const former = newPerson();
	roster.push({
		...former,
		username: usernameFor(former.firstname, former.lastname),
		group: 'traffic',
		type_key: 'officer',
		days: 145
	});
	void people;

	const actors: Actor[] = [];
	let admin!: Actor;
	for (const r of roster) {
		const created = await createUser(
			{
				enforcement_group: group_id[r.group],
				user_type: type_id[r.type_key],
				username: r.username,
				firstname: r.firstname,
				middlename: '',
				lastname: r.lastname
			},
			admin ? asUser(admin) : undefined
		);
		if (!created.success) throw new Error(`createUser ${r.username}: ${created.message}`);
		const id = String(created.data.user._id);
		await UsersModel.collection.updateOne(
			{ _id: new mongoose.Types.ObjectId(id) },
			{
				$set: {
					password: password_hash,
					password_change: false,
					last_password_change_date: daysAgo(r.days),
					created_at: daysAgo(r.days),
					updated_at: daysAgo(r.days)
				}
			}
		);
		const actor: Actor = {
			_id: id,
			firstname: r.firstname,
			lastname: r.lastname,
			username: r.username,
			user_type: USER_TYPES.find((t) => t.key === r.type_key)!.user_type,
			group: r.group,
			type_key: r.type_key,
			created_days_ago: r.days
		};
		actors.push(actor);
		if (!admin) admin = actor;
		await log(
			daysAgo(r.days),
			admin,
			'CREATE',
			'created user',
			'users form action - create',
			'users',
			[id]
		);
	}
	const byUsername = (u: string) => actors.find((a) => a.username === u)!;
	const former_actor = actors[actors.length - 1];
	const cashiers = actors.filter((a) => a.type_key === 'cashier');
	const supervisorOf = (g: GroupKey) =>
		actors.find((a) => a.type_key === 'supervisor' && a.group === g)!;
	const officersOf = (g: GroupKey) =>
		actors.filter((a) => a.type_key === 'officer' && a.group === g);
	progress(
		`${actors.length} users (demo logins: ${DEMO_ACCOUNTS.map((a) => a.username).join(', ')})`
	);

	// ---- ordinances ----------------------------------------------------------------------
	type Provision = { _id: string; group: GroupKey };
	const provisions_by_group: Record<GroupKey, Provision[]> = {
		admin: [],
		treasury: [],
		traffic: [],
		environment: [],
		order: []
	};
	let provision_count = 0;
	for (const c of CATEGORIES) {
		const cat = await createViolationCategory(
			{
				name: c.name,
				description: c.description,
				sub_categories: c.subs.map((name) => ({ name }))
			},
			asUser(admin)
		);
		await stamp(ViolationCategoryModel, { _id: cat._id }, daysAgo(158));
		const subs = cat.sub_categories as { _id: Id }[];
		for (const p of c.provisions) {
			const doc = await createCodeProvision(
				{
					code: p.code,
					description: p.description,
					descriptor: p.descriptor,
					violation_category: String(cat._id),
					violation_sub_category: String(subs[p.sub]._id),
					enforcement_group: group_id[c.group],
					penalty: p.penalty.map((o) => ({
						pecuniary: o.pecuniary,
						disciplinary: o.disciplinary ?? '',
						...(o.surcharge
							? {
									surcharge: {
										type: o.surcharge.type,
										value: o.surcharge.value,
										applied_after_days: o.surcharge.days,
										applied_every_after: o.surcharge.every
									}
								}
							: {})
					}))
				},
				asUser(admin)
			);
			await stamp(CodeProvisionsModel, { _id: doc._id }, daysAgo(158));
			provisions_by_group[c.group].push({ _id: String(doc._id), group: c.group });
			provision_count++;
		}
	}
	await log(
		daysAgo(158),
		admin,
		'CREATE',
		'created code provisions',
		'code provisions form action - create'
	);
	progress(`${CATEGORIES.length} violation categories, ${provision_count} code provisions`);

	// ---- ticket booklets and pads --------------------------------------------------------
	type Pad = {
		_id: string;
		from: number;
		to: number;
		next: number;
		assigned: Date;
		officer: Actor;
	};
	const pads_by_officer = new Map<string, Pad[]>();
	let series_cursor = 1001;
	const enforcement = ['traffic', 'environment', 'order'] as const;
	const prefixes: Record<string, string> = { traffic: 'TRF', environment: 'ENV', order: 'POS' };
	const PAD_SIZE = 30;

	async function booklet(name: string, size: number, created_ago: number) {
		const from = series_cursor;
		const to = from + size - 1;
		series_cursor = to + 1;
		const doc = await createTicket(
			{
				name,
				date_created: daysAgo(created_ago),
				ticket_num_from: from,
				ticket_num_to: to,
				withdraw: false
			},
			asUser(admin)
		);
		await stamp(TicketsModel, { _id: doc._id }, daysAgo(created_ago));
		await log(
			daysAgo(created_ago),
			admin,
			'CREATE',
			'created ticket',
			'ticket form action - create',
			'tickets',
			[doc._id]
		);
		return { id: String(doc._id), from, to };
	}

	async function withdraw(ids: string[], group: GroupKey, ago: number) {
		await updateManyTickets({
			_ids: ids,
			ticket_for: group_id[group],
			in_charge: supervisorOf(group)._id,
			withdraw: true,
			date_withdrawn: daysAgo(ago)
		});
		await log(
			daysAgo(ago),
			admin,
			'EDIT',
			'withdrawn ticket',
			'ticket form action - withdrawn',
			'tickets',
			ids
		);
	}

	for (const g of enforcement) {
		const officers = officersOf(g);
		const main = await booklet(`${prefixes[g]}-2026-A`, officers.length * PAD_SIZE * 2, 150);
		await withdraw([main.id], g, 135);
		let cursor = main.from;
		for (const [round, assigned_ago] of [
			[0, 130],
			[1, 78]
		] as const) {
			void round;
			for (const officer of officers) {
				// the former officer only ever worked the first pad
				if (officer === former_actor && assigned_ago === 78) {
					cursor += PAD_SIZE;
					continue;
				}
				const from = cursor;
				const to = from + PAD_SIZE - 1;
				cursor = to + 1;
				const date_assigned = daysAgo(assigned_ago);
				const doc = await createTicketAssignment(
					{
						ticket: main.id,
						user: officer._id,
						series_from: from,
						series_to: to,
						status: 0,
						date_assigned
					},
					asUser(supervisorOf(g))
				);
				await stamp(TicketAssignmentsModel, { _id: doc._id }, date_assigned);
				await log(
					date_assigned,
					supervisorOf(g),
					'CREATE',
					'created ticket assignment',
					'ticket assignment form action - create',
					'ticket_assignments',
					[doc._id]
				);
				const list = pads_by_officer.get(officer._id) ?? [];
				list.push({ _id: String(doc._id), from, to, next: from, assigned: date_assigned, officer });
				pads_by_officer.set(officer._id, list);
			}
		}
		// a second booklet that is withdrawn but not yet sliced into pads
		const reserve = await booklet(`${prefixes[g]}-2026-B`, 100, 70);
		await withdraw([reserve.id], g, 55);
	}
	await booklet('STK-2026-A', 100, 20);
	progress('ticket booklets and pads');

	// ---- violators -----------------------------------------------------------------------
	const used_licenses = new Set<string>();
	let phone_seq = 1000;
	const violators: { _id: string; firstname: string; used: boolean }[] = [];
	for (let i = 0; i < 130; i++) {
		const female = chance(0.45);
		const firstname = pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
		const lastname = pick(LAST_NAMES);
		let license_number = '';
		if (chance(0.7)) {
			do {
				license_number = `D${int(10, 29)}-${int(10, 24)}-${int(100000, 999999)}`;
			} while (used_licenses.has(license_number));
			used_licenses.add(license_number);
		}
		const birth = new Date(NOW - int(19, 68) * 365 * DAY - int(0, 364) * DAY);
		const doc = await createViolator(
			{
				firstname,
				middlename: pick(MIDDLE_NAMES),
				lastname,
				suffix: chance(0.06) ? 'Jr.' : '',
				sex: female ? 'female' : 'male',
				birthdate: birth,
				license_number,
				// obviously fake, sequential numbers
				contact_number: chance(0.4) ? `+63900${String(phone_seq++).padStart(7, '0')}` : null,
				address_province: lgu.province,
				address_city: lgu.city,
				address_barangay: pick(city_barangays),
				address_line: pick(STREETS),
				address_house_number: chance(0.7) ? int(1, 320) : null
			},
			asUser(admin)
		);
		violators.push({ _id: String(doc._id), firstname, used: false });
	}
	progress(`${violators.length} violators`);

	// ---- citations -----------------------------------------------------------------------
	type Plan = { days_ago: number; group: GroupKey };
	const TOTAL = 430;
	const plans: Plan[] = [];
	for (let i = 0; i < TOTAL; i++) {
		const r = rnd();
		plans.push({
			days_ago: Math.floor(118 * Math.pow(rnd(), 1.35)),
			group: r < 0.5 ? 'traffic' : r < 0.76 ? 'environment' : 'order'
		});
	}

	function apprehensionTime(days_ago: number): Date {
		const base = manilaMidnight() - days_ago * DAY;
		const minutes = int(6 * 60, 20 * 60 + 30);
		let at = base + minutes * MINUTE;
		if (at > NOW - 30 * MINUTE) at = NOW - int(40, 240) * MINUTE;
		return new Date(at);
	}

	const events = plans
		.map((p) => ({ ...p, at: apprehensionTime(p.days_ago) }))
		.sort((a, b) => a.at.getTime() - b.at.getTime());

	const methods = ['cash', 'cash', 'cash', 'gcash', 'gcash', 'bank_transfer', 'paymaya'] as const;
	let or_seq = 4100;
	let ref_seq = 880000;
	const referenceFor = (method: string) =>
		method === 'cash'
			? `OR-${String(or_seq++).padStart(6, '0')}`
			: `${method.slice(0, 2).toUpperCase()}${ref_seq++}`;

	/** Mirrors the payment form action: payment row, then the billing's balance, paid total and status. */
	async function recordPayment(
		issuance_id: string,
		tracking_code: string,
		amount: number,
		at: Date,
		cashier: Actor,
		method: string = pick(methods),
		notes = ''
	) {
		const billing = await BillingModel.findOne({ issuance: issuance_id });
		if (!billing) throw new Error('billing missing for ' + issuance_id);
		const balance = Number(billing.balance);
		if (amount > balance) amount = balance;
		const pay = await createPayment(
			{
				issuance: issuance_id,
				billing: String(billing._id),
				tracking_code,
				amount,
				payment_date: at,
				payment_method: method,
				reference_number: referenceFor(method),
				notes
			} as Parameters<typeof createPayment>[0],
			asUser(cashier)
		);
		const new_balance = balance - amount;
		await BillingModel.findByIdAndUpdate(billing._id, {
			$set: {
				balance: new_balance,
				amount_paid: Number(billing.amount_paid ?? 0) + amount,
				payment_status: new_balance === 0 ? 'PAID' : 'PARTIALLY_PAID'
			}
		});
		await stamp(PaymentModel, { _id: pay._id }, at);
		await log(
			at,
			cashier,
			'CREATE',
			'created payment',
			'payments form action - create',
			'payments',
			[pay._id]
		);
		return new_balance;
	}

	async function setStatus(
		issuance_id: string,
		status: number,
		remarks: string,
		by: Actor,
		at: Date
	) {
		const res = await changeIssuanceStatus(
			{ issuance_id, status, remarks } as Parameters<typeof changeIssuanceStatus>[0],
			{ _id: by._id } as unknown as Parameters<typeof changeIssuanceStatus>[1]
		);
		if (!res) throw new Error(`status ${status} refused for ${issuance_id}`);
		await log(
			at,
			by,
			'EDIT',
			'changed issuance status',
			'issuance status form action - change_status',
			'issuances',
			[issuance_id]
		);
	}

	const tally: Record<string, number> = {};
	const issued_at = new Map<string, Date>();
	let created = 0;
	let skipped = 0;

	for (const ev of events) {
		const days_old = (NOW - ev.at.getTime()) / DAY;

		// who issued it: someone in the office with a pad that is open on that date and has series left
		const candidates = officersOf(ev.group).filter((o) => o !== former_actor || days_old > 55);
		const order = [...candidates].sort(() => rnd() - 0.5);
		let officer: Actor | undefined;
		let pad: Pad | undefined;
		for (const o of order) {
			const open = (pads_by_officer.get(o._id) ?? []).find(
				(p) => p.assigned.getTime() <= ev.at.getTime() && p.next <= p.to
			);
			if (open) {
				officer = o;
				pad = open;
				break;
			}
		}
		if (!officer || !pad) {
			skipped++;
			continue;
		}

		// what is being cited
		const pool = provisions_by_group[ev.group];
		const how_many = chance(0.7) ? 1 : chance(0.83) ? 2 : 3;
		const chosen = new Set<string>();
		while (chosen.size < Math.min(how_many, pool.length)) chosen.add(pick(pool)._id);

		const provisions = await CodeProvisionsModel.find({ _id: { $in: [...chosen] } })
			.populate('violation_category')
			.populate('enforcement_group');

		// repeat offenders: low indexes are cited more often, which also drives the offense level
		const violator = violators[Math.floor(violators.length * Math.pow(rnd(), 1.6))];

		const resolved = await _resolveAllViolationPenalties(provisions as never, violator._id);
		const snapshots = resolved.map(({ provision, penalty, level }) =>
			_mapProvisionToViolationSnapshot(provision, penalty, level)
		);

		const series = pad.next++;
		const tracking_code = `I${ev.at.getUTCFullYear()}-${tracking_alphabet()}`;
		const issuance = await createIssuance(
			{
				ticket_assignment: pad._id,
				ticket_series: series,
				issuer: officer._id,
				recipient: violator._id,
				status: issuance_status.ISSUED,
				remarks: pick(REMARKS),
				violations: [...chosen],
				apprehension_barangay: pick(city_barangays),
				apprehension_address: pick(STREETS),
				apprehension_date: ev.at,
				apprehension_time: ev.at,
				tracking_code
			} as Parameters<typeof createIssuance>[0],
			snapshots as never,
			officer._id
		);
		if (!issuance) throw new Error(`createIssuance failed (series ${series})`);
		const id = String(issuance._id);
		issued_at.set(id, ev.at);
		created++;

		if (!violator.used) {
			violator.used = true;
			const when = new Date(ev.at.getTime() - 25 * MINUTE);
			await stamp(ViolatorsModel, { _id: new mongoose.Types.ObjectId(violator._id) }, when);
			await log(
				when,
				officer,
				'CREATE',
				'created violator',
				'violators form action - create',
				'violators',
				[violator._id]
			);
		}
		await log(
			ev.at,
			officer,
			'CREATE',
			'created issuance',
			'issuance form action - create',
			'issuances',
			[id]
		);

		// ---- what happened to it afterwards -----------------------------------------------
		const supervisor = supervisorOf(ev.group);
		const cashier = pick(cashiers);
		const total = snapshots.reduce((sum, s) => sum + (s.penalty.pecuniary ?? 0), 0);

		const timeline: { status: number; at: Date }[] = [
			{ status: issuance_status.ISSUED, at: ev.at }
		];
		const payments: Date[] = [];
		let last_event = ev.at;

		const r = rnd();
		let outcome: string;
		if (days_old < 15)
			outcome = r < 0.52 ? 'unpaid' : r < 0.9 ? 'paid' : r < 0.96 ? 'partial' : 'cancelled';
		else
			outcome =
				r < 0.52
					? 'paid'
					: r < 0.61
						? 'partial'
						: r < 0.83
							? 'unpaid'
							: r < 0.91
								? 'filed'
								: r < 0.96
									? 'closed'
									: 'cancelled';
		if ((outcome === 'filed' || outcome === 'closed') && days_old < 28) outcome = 'unpaid';
		if (outcome === 'closed' && days_old < 50) outcome = 'filed';
		// a warning-only citation (no fine) has nothing to pay or file
		if (total <= 0 && outcome !== 'cancelled') outcome = 'unpaid';
		if (outcome === 'partial' && total < 400) outcome = 'paid';

		const within = (min_ms: number, max_ms: number) =>
			clampToPast(ev.at.getTime() + int(min_ms, Math.max(min_ms, max_ms)));

		if (outcome === 'paid') {
			const first_at = within(2 * HOUR, Math.min(days_old * DAY, 20 * DAY));
			if (total >= 1000 && chance(0.25) && NOW - first_at.getTime() > 3 * DAY) {
				const part = round50(total * (0.4 + rnd() * 0.2));
				await recordPayment(id, tracking_code, part, first_at, cashier);
				payments.push(first_at);
				const second_at = clampToPast(first_at.getTime() + int(1, 9) * DAY);
				await recordPayment(id, tracking_code, total - part, second_at, cashier);
				payments.push(second_at);
			} else {
				await recordPayment(id, tracking_code, total, first_at, cashier);
				payments.push(first_at);
			}
			last_event = new Date(
				Math.min(payments[payments.length - 1].getTime() + 10 * MINUTE, NOW - MINUTE)
			);
			await setStatus(
				id,
				issuance_status.PAID,
				'Fully paid at the City Treasury.',
				supervisor,
				last_event
			);
			timeline.push({ status: issuance_status.PAID, at: last_event });
		} else if (outcome === 'partial') {
			const at = within(3 * HOUR, Math.min(days_old * DAY, 12 * DAY));
			await recordPayment(id, tracking_code, round50(total * (0.3 + rnd() * 0.4)), at, cashier);
			payments.push(at);
			last_event = at;
		} else if (outcome === 'cancelled') {
			last_event = within(3 * HOUR, 3 * DAY);
			await setStatus(
				id,
				issuance_status.CANCELLED,
				pick([
					'Issued in error: the plate number was recorded wrongly.',
					'Duplicate of another citation issued the same day.',
					'The person cited was identified as someone else.'
				]),
				supervisor,
				last_event
			);
			timeline.push({ status: issuance_status.CANCELLED, at: last_event });
		} else if (outcome === 'filed' || outcome === 'closed') {
			const filed_at = within(20 * DAY, Math.min(days_old * DAY - DAY, 40 * DAY));
			await setStatus(
				id,
				issuance_status['FILED CASE'],
				'Referred to the City Legal Office for filing of a case.',
				supervisor,
				filed_at
			);
			timeline.push({ status: issuance_status['FILED CASE'], at: filed_at });
			last_event = filed_at;
			if (outcome === 'closed') {
				const closed_at = clampToPast(filed_at.getTime() + int(12, 35) * DAY);
				await recordPayment(
					id,
					tracking_code,
					total,
					closed_at,
					cashier,
					'cash',
					'Fine settled through the court.'
				);
				payments.push(closed_at);
				const status_at = new Date(Math.min(closed_at.getTime() + 20 * MINUTE, NOW - MINUTE));
				await setStatus(
					id,
					issuance_status['CASE CLOSED'],
					'Case closed. Fine settled in court.',
					supervisor,
					status_at
				);
				timeline.push({ status: issuance_status['CASE CLOSED'], at: status_at });
				last_event = status_at;
			}
		}
		tally[outcome] = (tally[outcome] ?? 0) + 1;

		// move the records the services stamped "now" back to when it happened
		const oid = new mongoose.Types.ObjectId(id);
		await stamp(IssuanceModel, { _id: oid }, ev.at, true);
		await IssuanceModel.collection.updateOne({ _id: oid }, { $set: { updated_at: last_event } });
		await stamp(ViolationModel, { issuance: oid }, ev.at);
		await stamp(BillingModel, { issuance: oid }, ev.at, true);
		await BillingModel.collection.updateOne(
			{ issuance: oid },
			{ $set: { updated_at: last_event } }
		);
		const trackings = await TicketTrackingModel.find({ issuance: oid })
			.sort({ _id: 1 })
			.lean<{ _id: Id }[]>();
		if (trackings.length !== timeline.length) {
			throw new Error(
				`timeline mismatch for ${id}: ${trackings.length} rows, ${timeline.length} events`
			);
		}
		for (let i = 0; i < trackings.length; i++) {
			await stamp(TicketTrackingModel, { _id: trackings[i]._id }, timeline[i].at, true);
		}
	}
	progress(`${created} citations (${skipped} skipped): ${JSON.stringify(tally)}`);

	// unpaid tickets past the grace period: the app's own overdue scan
	const scan = await flagOverdueIssuances();
	progress(`overdue scan flagged ${scan.overdue} billings, escalated ${scan.escalated} tickets`);
	const notices = await TicketTrackingModel.find({
		status: issuance_status['NOTICE OF SETTLEMENT']
	}).lean<{ _id: Id; issuance: Id }[]>();
	for (const n of notices) {
		const base = issued_at.get(String(n.issuance));
		if (!base) continue;
		const at = clampToPast(base.getTime() + 15 * DAY + int(1, 8) * HOUR);
		await stamp(TicketTrackingModel, { _id: n._id }, at, true);
		await IssuanceModel.collection.updateOne(
			{ _id: new mongoose.Types.ObjectId(String(n.issuance)) },
			{ $set: { updated_at: at } }
		);
		await stamp(
			LogsModel,
			{
				message: { $regex: '^automatically escalated' },
				'affected_collection.document_id': String(n.issuance)
			},
			at
		);
	}

	// ---- sign-ins ------------------------------------------------------------------------
	const logins: unknown[] = [];
	for (const a of actors) {
		const first_day = Math.min(a.created_days_ago - 1, 110);
		for (let d = 0; d < first_day; d++) {
			if (!chance(d < 35 ? 0.6 : 0.3)) continue;
			const at = new Date(manilaMidnight() - d * DAY + int(7 * 60, 17 * 60) * MINUTE);
			if (at.getTime() > NOW - 10 * MINUTE) continue;
			logins.push({
				level: 'INFO',
				type: 'LOGIN',
				message: 'login user',
				source: 'login page',
				user: logActor(a),
				created_at: at,
				updated_at: at
			});
		}
	}
	await LogsModel.insertMany(logins, { ordered: false });
	progress(`${logins.length} sign-in log entries`);

	// the former officer has left
	await archiveUsers([former_actor._id], admin._id);
	await log(
		daysAgo(40),
		admin,
		'ARCHIVE',
		'archived user',
		'users form action - archive',
		'users',
		[former_actor._id]
	);

	// ---- incentives ----------------------------------------------------------------------
	for (const g of GROUPS) {
		if (!('incentive' in g)) continue;
		await updateIncentiveSettings(
			{ _id: group_id[g.key], enabled: true, ...g.incentive },
			admin._id
		);
		await log(
			daysAgo(30),
			admin,
			'EDIT',
			'updated incentive settings',
			'enforcement groups form action - incentive',
			'enforcement_groups',
			[group_id[g.key]]
		);
	}

	const admin_user = JSON.parse(
		JSON.stringify(
			await UsersModel.findById(admin._id)
				.populate('user_type')
				.populate('enforcement_group')
				.lean()
		)
	);
	const manila = new Date(NOW + MANILA_OFFSET);
	const ymd = (y: number, m: number, d: number) =>
		`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	const month = (offset: number) => {
		const first = new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth() + offset, 1));
		const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
		return {
			from: ymd(first.getUTCFullYear(), first.getUTCMonth(), 1),
			to: ymd(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()),
			label: first.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
		};
	};
	const settingFor = (g: (typeof GROUPS)[number], amount_override?: number) => {
		if (!('incentive' in g)) throw new Error('no incentive');
		return {
			group: group_id[g.key],
			include: true,
			rate_type: g.incentive.rate_type,
			amount: amount_override ?? g.incentive.amount,
			basis: g.incentive.basis,
			override_reason: amount_override
				? 'Rate agreed for this period was lower than the office default.'
				: ''
		};
	};
	const withIncentive = GROUPS.filter((g) => 'incentive' in g);
	const base_input = {
		enforcement_group: [] as string[],
		issuer: [] as string[],
		user_type: [] as string[],
		violation_category: [] as string[],
		code_provision: [] as string[],
		barangay: '',
		exclude_legacy: false,
		excluded: [] as { issuance: string; reason: string }[]
	};

	const last = month(-1);
	const before = month(-2);
	const traffic = GROUPS.find((g) => g.key === 'traffic')!;
	const reports: { label: string; ok: boolean; note: string }[] = [];
	async function generate(label: string, input: Parameters<typeof generateIncentiveReport>[1]) {
		const res = await generateIncentiveReport(admin_user, input);
		reports.push({
			label,
			ok: res.ok,
			note: res.ok ? res.reference_no : ((res as { message?: string }).message ?? 'failed')
		});
		return res;
	}

	// a report that was entered with the wrong rate, voided, then redone correctly
	const wrong = await generate(`${before.label} (wrong rate)`, {
		...base_input,
		date_from: before.from,
		date_to: before.to,
		settings: [settingFor(traffic, 5)],
		remarks: 'Traffic Management, first draft.'
	});
	if (wrong.ok) {
		await voidIncentiveReport(admin_user, {
			_id: wrong._id,
			reason: 'Entered with the wrong rate; regenerated at the office default.'
		});
	}
	await generate(`${before.label} (traffic)`, {
		...base_input,
		date_from: before.from,
		date_to: before.to,
		settings: [settingFor(traffic)],
		remarks: 'Traffic Management incentives.'
	});
	await generate(`${last.label} (all offices)`, {
		...base_input,
		date_from: last.from,
		date_to: last.to,
		settings: withIncentive.map((g) => settingFor(g)),
		remarks: 'Monthly incentives for all enforcement offices.'
	});
	for (const r of reports)
		progress(`incentive report ${r.label}: ${r.ok ? r.note : 'NOT CREATED - ' + r.note}`);

	// ---- indexes -------------------------------------------------------------------------
	// autoIndex is off in production, so build what the schemas declare (unique usernames, the
	// session TTL, the one-live-report-per-ticket guard) once here
	const models: AnyModel[] = [
		UsersModel,
		UserTypesModel,
		EnforcementGroupsModel,
		ViolationCategoryModel,
		CodeProvisionsModel,
		TicketsModel,
		TicketAssignmentsModel,
		ViolatorsModel,
		IssuanceModel,
		ViolationModel,
		BillingModel,
		PaymentModel,
		TicketTrackingModel,
		LogsModel,
		SessionsModel,
		IncentiveReportsModel,
		IncentiveReportItemsModel
	];
	for (const m of models) {
		try {
			await m.createIndexes();
		} catch (err) {
			console.warn(`  index build skipped for ${m.modelName}:`, (err as Error).message);
		}
	}
	progress('indexes built');

	console.log('Done.');
	void byUsername;
}
