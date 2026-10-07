import type mongoose from 'mongoose';
import IssuanceModel from '../models/Issuance.model';
import BillingModel from '../models/Billing.model';
import PaymentModel from '../models/Payments.model';
import IncentiveReportsModel from '../models/IncentiveReports.model';
import IncentiveReportItemsModel from '../models/IncentiveReportItems.model';

/**
 * Builds the indexes the incentives module depends on. `autoIndex` is off in production, so
 * schema-declared indexes are never built there on their own — and the unique index on
 * incentive_report_items is what guarantees a ticket can't be paid twice, so it can't be left
 * to chance. Existing-collection indexes are created one by one (not via Model.createIndexes)
 * so a pre-existing data problem in an unrelated unique index can't block these.
 */
async function ensureIncentiveIndexes() {
	await Promise.all([
		IncentiveReportsModel.createIndexes(),
		IncentiveReportItemsModel.createIndexes(),
		IssuanceModel.collection.createIndex({ enforcement_group: 1, apprehension_date: 1 }),
		IssuanceModel.collection.createIndex({ reissued_from: 1 }),
		BillingModel.collection.createIndex({ issuance: 1 }),
		PaymentModel.collection.createIndex({ issuance: 1 }),
		PaymentModel.collection.createIndex({ payment_date: 1 })
	]);
}

/**
 * Fills `issuances.enforcement_group` for tickets issued before it was recorded: the group the
 * ticket booklet was registered for, falling back to the issuer's current group. Only touches
 * issuances that have no group yet, so it is a no-op once everything resolvable is filled in.
 */
async function backfillIssuanceGroups() {
	const rows = await IssuanceModel.aggregate<{
		_id: mongoose.Types.ObjectId;
		enforcement_group: mongoose.Types.ObjectId | null;
	}>([
		{ $match: { enforcement_group: null } },
		{ $project: { ticket_assignment: 1, issuer: 1 } },
		{
			$lookup: {
				from: 'ticket_assignments',
				localField: 'ticket_assignment',
				foreignField: '_id',
				as: 'ta'
			}
		},
		{
			$lookup: {
				from: 'tickets',
				localField: 'ta.ticket',
				foreignField: '_id',
				as: 'booklet'
			}
		},
		{ $lookup: { from: 'users', localField: 'issuer', foreignField: '_id', as: 'user' } },
		{
			$project: {
				enforcement_group: {
					$ifNull: [
						{ $arrayElemAt: ['$booklet.ticket_for', 0] },
						{ $arrayElemAt: ['$user.enforcement_group', 0] }
					]
				}
			}
		},
		{ $match: { enforcement_group: { $ne: null } } }
	]);

	if (!rows.length) return 0;

	// straight to the collection, not through the model: a dev server that was running before
	// `enforcement_group` was added keeps the old compiled schema, and mongoose's strict mode
	// silently drops a $set on a path that schema doesn't know
	const result = await IssuanceModel.collection.bulkWrite(
		rows.map((r) => ({
			updateOne: {
				filter: { _id: r._id, enforcement_group: null },
				update: { $set: { enforcement_group: r.enforcement_group } }
			}
		})),
		{ ordered: false }
	);
	return result.modifiedCount;
}

export async function prepareIncentives() {
	try {
		await ensureIncentiveIndexes();
		const filled = await backfillIssuanceGroups();
		if (filled) console.log(`Backfilled the enforcement group on ${filled} issuances`);
	} catch (err) {
		// never block startup over this — but say so loudly, since incentives rely on it
		console.error('Incentives setup failed', err);
	}
}
