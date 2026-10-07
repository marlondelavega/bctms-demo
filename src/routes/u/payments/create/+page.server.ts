import Payment from '$lib/validation_schemas/Payments.zod';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import PaymentModel from '$lib/server/models/Payments.model';
import BillingModel from '$lib/server/models/Billing.model';
import IssuanceModel from '$lib/server/models/Issuance.model';
import { createPayment } from '$lib/server/services/Payment.service';
import { requireAccess } from '$lib/server/utilities/permissions.server';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import { issuance_status } from '$lib/data/static_data';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(Payment.CreateSchema));
	return { form };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAccess(locals.user, 'payments', 'create');

		const form = await superValidate(request, zod4(Payment.CreateSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const issuance = await IssuanceModel.findById(form.data.issuance);
		if (!issuance) {
			return message(form, { type: 'error', text: 'Issuance was not found.' }, { status: 404 });
		}
		if (issuance.status === issuance_status.CANCELLED) {
			return message(
				form,
				{
					type: 'error',
					text: 'This ticket has been cancelled and can no longer accept payments.'
				},
				{ status: 400 }
			);
		}

		const existingPayment = await PaymentModel.findOne({
			reference_number: form.data.reference_number,
			issuance: form.data.issuance
		});
		if (existingPayment) {
			form.errors.reference_number = ['Reference number already exists.'];
			return message(
				form,
				{ type: 'error', text: 'Reference number already exists for this ticket.' },
				{ status: 400 }
			);
		}

		const billing = await BillingModel.findById(form.data.billing);
		if (!billing) {
			return message(
				form,
				{ type: 'error', text: 'Billing record was not found.' },
				{ status: 404 }
			);
		}

		const paymentAmount = Number(form.data.amount);
		const currentBalance = Number(billing.balance ?? billing.violations_total_amount ?? 0);
		const currentAmountPaid = Number(billing.amount_paid ?? 0);

		if (currentBalance < paymentAmount) {
			form.errors.amount = ['Amount exceeds outstanding balance.'];

			return message(
				form,
				{ type: 'error', text: 'Entered amount exceeds outstanding balance.' },
				{ status: 400 }
			);
		}

		const updatedBalance = currentBalance - paymentAmount;
		const updatedAmountPaid = currentAmountPaid + paymentAmount;
		const updatedStatus = updatedBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

		const _f = await createPayment(form.data, locals.user);

		await BillingModel.findByIdAndUpdate(form.data.billing, {
			$set: {
				balance: updatedBalance,
				amount_paid: updatedAmountPaid,
				payment_status: updatedStatus
			}
		});

		if (_f) {
			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'CREATE',
				message: 'created payment',
				source: 'payments form action - create',
				affected_collection: {
					collection_name: 'payments',
					document_id: [_f._id.toString()]
				},
				user: logActor(locals.user)
			};

			await createLog(log_data);
		}

		return message(form, { type: 'success', text: 'Payment successfully recorded.' });
	}
};
