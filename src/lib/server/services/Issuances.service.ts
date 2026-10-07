import { escapeRegex, multiParam, parseDateRange, parseSearchParams } from '$lib/utilities/helper';
import type Issuance from '$lib/validation_schemas/Issuances.zod';
import type User from '$lib/validation_schemas/Users.zod';
import type { PipelineStage } from 'mongoose';
import IssuanceModel from '../models/Issuance.model';
import ViolationModel from '../models/Violations.model';
import BillingModel from '../models/Billing.model';
import PaymentModel from '../models/Payments.model';
import Violation from '$lib/validation_schemas/Violations.zod';
import mongoose from 'mongoose';
import TicketTrackingModel from '../models/TicketTracking.model';
import UsersModel from '../models/Users.model';
import {
	issuance_status,
	issuance_status_data,
	getAllowedIssuanceStatusTransitions
} from '$lib/data/static_data';
import { createLog, logActor } from './Logs.service';

export async function getIssuances(_q: URLSearchParams, scopeFilter: Record<string, unknown> = {}) {
	const { skip, limit, search } = parseSearchParams(_q);

	const match: Record<string, unknown> = { ...scopeFilter };

	// repeatable filter: ?status=1&status=3 matches either status
	const statuses = [...new Set(_q.getAll('status'))].map(Number).filter(Number.isInteger);
	if (statuses.length) match.status = { $in: statuses };

	// violation category names are snapshotted onto each embedded violation
	const categories = multiParam(_q, 'category');
	if (categories.length) match['violations.violation_category.name'] = { $in: categories };

	const barangay = _q.get('barangay')?.trim();
	if (barangay) {
		match.apprehension_barangay = { $regex: escapeRegex(barangay), $options: 'i' };
	}

	const apprehended = parseDateRange(_q);
	if (apprehended) match.apprehension_date = apprehended;

	const pipeline: PipelineStage[] = [];

	// 1. Cheap filter FIRST, before any joins.
	if (Object.keys(match).length) {
		pipeline.push({ $match: match });
	}

	// 2. Only join ticket/violator data if we actually need it to search.
	//    If there's no search term, skip this entirely at this stage.
	if (search) {
		pipeline.push(
			{
				$lookup: {
					from: 'ticket_assignments',
					localField: 'ticket_assignment',
					foreignField: '_id',
					as: 'ticket_assignment'
				}
			},
			{ $unwind: { path: '$ticket_assignment', preserveNullAndEmptyArrays: true } },
			{
				$lookup: {
					from: 'tickets',
					localField: 'ticket_assignment.ticket',
					foreignField: '_id',
					as: 'ticket_assignment.ticket'
				}
			},
			{ $unwind: { path: '$ticket_assignment.ticket', preserveNullAndEmptyArrays: true } },
			{
				$lookup: {
					from: 'violators',
					localField: 'recipient',
					foreignField: '_id',
					as: 'recipient'
				}
			},
			{ $unwind: { path: '$recipient', preserveNullAndEmptyArrays: true } },
			{
				$match: {
					$or: [
						{ 'ticket_assignment.ticket.name': { $regex: search, $options: 'i' } },
						{ ticket_series: { $regex: search, $options: 'i' } },
						{ 'recipient.firstname': { $regex: search, $options: 'i' } },
						{ 'recipient.lastname': { $regex: search, $options: 'i' } }
					]
				}
			}
		);
	}

	pipeline.push(
		{ $sort: { _id: -1 } },
		{
			$facet: {
				count: [{ $count: 'total' }],
				data: [
					{ $skip: skip },
					{ $limit: limit },
					// 3. Expensive display-only joins now run on `limit` docs, not 13k.
					//    Skip re-joining ticket/recipient if search already did it above.
					...(search
						? []
						: [
								{
									$lookup: {
										from: 'ticket_assignments',
										localField: 'ticket_assignment',
										foreignField: '_id',
										as: 'ticket_assignment'
									}
								},
								{ $unwind: { path: '$ticket_assignment', preserveNullAndEmptyArrays: true } },
								{
									$lookup: {
										from: 'tickets',
										localField: 'ticket_assignment.ticket',
										foreignField: '_id',
										as: 'ticket_assignment.ticket'
									}
								},
								{
									$unwind: { path: '$ticket_assignment.ticket', preserveNullAndEmptyArrays: true }
								},
								{
									$lookup: {
										from: 'violators',
										localField: 'recipient',
										foreignField: '_id',
										as: 'recipient'
									}
								},
								{ $unwind: { path: '$recipient', preserveNullAndEmptyArrays: true } }
							]),
					{
						$lookup: {
							from: 'users',
							localField: 'issuer',
							foreignField: '_id',
							as: 'issuer'
						}
					},
					{ $unwind: { path: '$issuer', preserveNullAndEmptyArrays: true } }
				]
			}
		},
		{
			$project: {
				count: { $first: '$count.total' },
				data: 1
			}
		}
	);

	const res = await IssuanceModel.aggregate<{
		count: { total: number };
		data: Issuance.Base[];
	}>(pipeline).exec();

	const result = res[0] ?? { count: 0, data: [] };

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getIssuanceById(_id: string): Promise<Issuance.Base | undefined> {
	const issuance = await IssuanceModel.aggregate([
		{ $match: { _id: new mongoose.Types.ObjectId(_id) } },
		{
			$lookup: {
				from: 'ticket_assignments',
				localField: 'ticket_assignment',
				foreignField: '_id',
				as: 'ticket_assignment'
			}
		},
		{ $unwind: { path: '$ticket_assignment', preserveNullAndEmptyArrays: true } },

		{
			$lookup: {
				from: 'tickets',
				localField: 'ticket_assignment.ticket',
				foreignField: '_id',
				as: 'ticket_assignment.ticket'
			}
		},
		{ $unwind: { path: '$ticket_assignment.ticket', preserveNullAndEmptyArrays: true } },

		{
			$lookup: {
				from: 'users',
				localField: 'issuer',
				foreignField: '_id',
				as: 'issuer'
			}
		},
		{ $unwind: { path: '$issuer', preserveNullAndEmptyArrays: true } },

		{
			$lookup: {
				from: 'violators',
				localField: 'recipient',
				foreignField: '_id',
				as: 'recipient'
			}
		},
		{ $unwind: { path: '$recipient', preserveNullAndEmptyArrays: true } }
	]).exec();

	return issuance?.[0] ?? null;
}

export async function getIssuanceById_Raw(_id: string): Promise<Issuance.Base> {
	const issuance = await IssuanceModel.findOne({ _id });
	return issuance;
}

export async function getIssuance_byAssignmentIds(
	_ids: string[]
): Promise<Issuance.Base[] | undefined> {
	const object_ids = _ids.map((d) => new mongoose.Types.ObjectId(d));
	const issuance = await IssuanceModel.aggregate([
		{ $match: { ticket_assignment: { $in: object_ids } } },
		{
			$lookup: {
				from: 'ticket_assignments',
				localField: 'ticket_assignment',
				foreignField: '_id',
				as: 'ticket_assignment'
			}
		},
		{ $unwind: { path: '$ticket_assignment', preserveNullAndEmptyArrays: true } },

		{
			$lookup: {
				from: 'tickets',
				localField: 'ticket_assignment.ticket',
				foreignField: '_id',
				as: 'ticket_assignment.ticket'
			}
		},
		{ $unwind: { path: '$ticket_assignment.ticket', preserveNullAndEmptyArrays: true } },

		{
			$lookup: {
				from: 'users',
				localField: 'issuer',
				foreignField: '_id',
				as: 'issuer'
			}
		},
		{ $unwind: { path: '$issuer', preserveNullAndEmptyArrays: true } },

		{
			$lookup: {
				from: 'violators',
				localField: 'recipient',
				foreignField: '_id',
				as: 'recipient'
			}
		},
		{ $unwind: { path: '$recipient', preserveNullAndEmptyArrays: true } }
	]).exec();

	return issuance;
}

export async function getIssuance_byTrackingCode(
	search: string
): Promise<Issuance.Base[] | undefined> {
	if (!search) return [];

	const escaped = escapeRegex(search);

	const issuance = await IssuanceModel.aggregate([
		{
			$lookup: {
				from: 'violators',
				localField: 'recipient',
				foreignField: '_id',
				as: 'recipient'
			}
		},
		{ $unwind: { path: '$recipient', preserveNullAndEmptyArrays: true } },

		{
			$match: {
				$or: [
					// Fast path: anchored, can use the collation index on tracking_code
					{ tracking_code: { $regex: `^${escaped}`, $options: 'i' } },
					// Slow path: still an unindexed scan, but scoped to fields that need it
					{ 'recipient.firstname': { $regex: escaped, $options: 'i' } },
					{ 'recipient.lastname': { $regex: escaped, $options: 'i' } }
				]
			}
		},

		{ $sort: { _id: -1 } },
		{ $limit: 10 },

		{
			$lookup: {
				from: 'ticket_assignments',
				localField: 'ticket_assignment',
				foreignField: '_id',
				as: 'ticket_assignment'
			}
		},
		{ $unwind: { path: '$ticket_assignment', preserveNullAndEmptyArrays: true } },
		{
			$lookup: {
				from: 'tickets',
				localField: 'ticket_assignment.ticket',
				foreignField: '_id',
				as: 'ticket_assignment.ticket'
			}
		},
		{ $unwind: { path: '$ticket_assignment.ticket', preserveNullAndEmptyArrays: true } },
		{
			$lookup: {
				from: 'users',
				localField: 'issuer',
				foreignField: '_id',
				as: 'issuer'
			}
		},
		{ $unwind: { path: '$issuer', preserveNullAndEmptyArrays: true } }
	]).exec();

	return issuance;
}

export async function createIssuance(
	data: Issuance.Create,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	violations: Violation.BillingSnapshot[],
	user_id: string | undefined
): Promise<Issuance.Base | undefined> {
	let _issuance_id: string = '';

	try {
		const parsed_violations = Violation.List.safeParse(violations);
		if (!parsed_violations.success) {
			console.error('createIssuance: invalid violation snapshots', parsed_violations.error.issues);
			return;
		}

		// the issuer's group at issuance time, so incentives stay with the office the ticket was issued under
		const issuer = await UsersModel.findById(user_id, { enforcement_group: 1 }).lean<{
			enforcement_group?: mongoose.Types.ObjectId | null;
		}>();

		const issuance: Issuance.Base = await IssuanceModel.create({
			...data,
			violations: parsed_violations.data,
			issuer: user_id,
			enforcement_group: issuer?.enforcement_group ?? null
		});

		_issuance_id = issuance._id;

		const issuedViolations = issuance.violations.map((v) => ({
			// parent refs
			issuance: issuance._id,
			ticket_assignment: issuance.ticket_assignment,
			ticket_series: issuance.ticket_series,
			issuer: issuance.issuer,
			recipient: issuance.recipient,

			// snapshot — pull from the saved issuance, not body
			code_provision: v.code_provision,
			level: v.level,
			code: v.code,
			description: v.description,
			descriptor: v.descriptor,
			penalty: v.penalty,
			violation_category: v.violation_category,
			violation_sub_category: v.violation_sub_category,
			enforcement_group: v.enforcement_group,

			// apprehension context
			apprehension_barangay: issuance.apprehension_barangay,
			apprehension_address: issuance.apprehension_address,
			apprehension_date: issuance.apprehension_date,
			apprehension_time: issuance.apprehension_time
		}));

		await ViolationModel.insertMany(issuedViolations);
		await TicketTrackingModel.create({
			issuance: _issuance_id,
			status: issuance_status.ISSUED,
			label: 'Issued',
			remarks: 'Issuance',
			changed_by: user_id
		});

		const total = violations.reduce((accumulator, currentItem) => {
			const amount = currentItem.penalty?.pecuniary || 0;
			return accumulator + amount;
		}, 0);

		const billing_data = {
			issuance: _issuance_id,
			recipient: data.recipient,
			violations: violations,
			violations_total_amount: total
		};

		await BillingModel.create(billing_data);

		return issuance;
	} catch (error) {
		if (error) {
			if (_issuance_id && _issuance_id.toString().trim() !== '') {
				await IssuanceModel.findByIdAndDelete(_issuance_id);
				return;
			}
		}
	}
}

/**
 * Whether an issuance's billing is actually settled — used to gate the manual Issued/Notice ->
 * Paid transition, so "Paid" reflects recorded payments rather than a staff member's say-so.
 * Checks both that at least one Payment row exists for this issuance (payments were actually
 * recorded, not just a balance edited some other way) and that the accrued payments bring the
 * billing balance to zero (or below, e.g. a rounding-safe overpayment).
 */
export async function isIssuanceBalanceSettled(
	issuance_id: string
): Promise<{ settled: boolean; reason?: string }> {
	const billing = await BillingModel.findOne({ issuance: issuance_id });
	if (!billing) return { settled: false, reason: 'No billing record was found for this ticket.' };

	const payment_count = await PaymentModel.countDocuments({ issuance: issuance_id });
	if (payment_count === 0) {
		return { settled: false, reason: 'No payments have been recorded against this ticket yet.' };
	}

	if (billing.balance > 0) {
		return {
			settled: false,
			reason: 'The recorded payments do not cover the full billing balance yet.'
		};
	}

	return { settled: true };
}

/**
 * Applies a manual status change, gated by `issuance_status_transitions` — the definitive set of
 * allowed moves. Returns null (rather than throwing) when the issuance doesn't exist, the
 * transition isn't allowed, or (for a transition into Paid) the billing balance isn't actually
 * settled — so callers can turn that into a normal form error.
 */
export async function changeIssuanceStatus(
	data: Issuance.ChangeStatus,
	user: User.Base
): Promise<Issuance.Base | null> {
	const current = await IssuanceModel.findById(data.issuance_id);
	if (!current) return null;

	const allowed = getAllowedIssuanceStatusTransitions(current.status);
	if (!allowed.includes(data.status as issuance_status)) return null;

	if (data.status === issuance_status.PAID) {
		const { settled } = await isIssuanceBalanceSettled(data.issuance_id);
		if (!settled) return null;
	}

	const query = await IssuanceModel.findOneAndUpdate(
		{ _id: data.issuance_id },
		{ status: data.status },
		{ returnDocument: 'after' }
	);

	await TicketTrackingModel.create({
		issuance: data.issuance_id,
		status: query.status,
		label: issuance_status_data.find((s) => s.value === query.status)?.label ?? 'Status changed',
		remarks: data.remarks,
		changed_by: user?._id
	});

	if (query.status === issuance_status.CANCELLED) {
		await BillingModel.findOneAndUpdate(
			{ issuance: data.issuance_id },
			{ cancelled: true, cancelled_date: new Date(), cancellation_reason: data.remarks }
		);
	}

	return query;
}

/**
 * Scans for issuances whose billing is unpaid and past the 15-day grace period (the same window
 * quoted on the billing statement, billing/[id]/view/+page.svelte). Meant to run on an interval
 * from hooks.server.ts, not per-request.
 *
 * Two independent things happen here for anything overdue:
 *  - Billing.payment_status is corrected to OVERDUE (a pre-existing enum value nothing else set).
 *  - An issuance still sitting at ISSUED is escalated to NOTICE OF SETTLEMENT, with its own
 *    TicketTracking entry (changed_by left unset — there's no staff actor for an automated move).
 * Escalation only applies to ISSUED tickets; Filed Case / Case Closed tickets stay overdue-flagged
 * on the billing side without their issuance status being touched.
 */
export async function flagOverdueIssuances(): Promise<{ overdue: number; escalated: number }> {
	const GRACE_PERIOD_DAYS = 15;
	const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

	const overdueBillings = await BillingModel.find({
		cancelled: { $ne: true },
		balance: { $gt: 0 },
		payment_status: { $nin: ['OVERDUE', 'PAID', 'CANCELLED'] }
	}).populate('issuance');

	let overdue = 0;
	let escalated = 0;

	for (const billing of overdueBillings) {
		const linked_issuance = billing.issuance as unknown as
			| (mongoose.Document & {
					_id: mongoose.Types.ObjectId;
					status: number;
					apprehension_date: Date;
			  })
			| null;

		if (!linked_issuance || linked_issuance.apprehension_date > cutoff) continue;

		await BillingModel.findByIdAndUpdate(billing._id, { payment_status: 'OVERDUE' });
		overdue++;

		if (linked_issuance.status !== issuance_status.ISSUED) continue;

		await IssuanceModel.findByIdAndUpdate(linked_issuance._id, {
			status: issuance_status['NOTICE OF SETTLEMENT']
		});

		await TicketTrackingModel.create({
			issuance: linked_issuance._id,
			status: issuance_status['NOTICE OF SETTLEMENT'],
			label: 'Notice of Settlement',
			remarks: `Automatically flagged after the ${GRACE_PERIOD_DAYS}-day grace period lapsed unpaid.`,
			changed_by: null
		});

		await createLog({
			level: 'INFO',
			type: 'EDIT',
			message: 'automatically escalated overdue issuance to Notice of Settlement',
			source: 'Issuances.service - flagOverdueIssuances',
			affected_collection: {
				collection_name: 'issuances',
				document_id: [linked_issuance._id.toString()]
			},
			user: logActor({ _id: 'system', firstname: 'System', username: 'system' })
		});

		escalated++;
	}

	return { overdue, escalated };
}

export async function getViolationLevel(
	violator_id: string,
	provision_id: string
): Promise<number> {
	const prior_count = await IssuanceModel.countDocuments({
		recipient: new mongoose.Types.ObjectId(violator_id),
		status: { $ne: issuance_status.CANCELLED },
		'violations.code_provision': new mongoose.Types.ObjectId(provision_id)
	});

	return prior_count + 1;
}
