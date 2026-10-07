import type { Actions } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { resolve } from '$app/paths';
import { redirect } from 'sveltekit-flash-message/server';
import Payment from '$lib/validation_schemas/Payments.zod';
import PaymentModel from '$lib/server/models/Payments.model';
import BillingModel from '$lib/server/models/Billing.model';
import { updatePayment } from '$lib/server/services/Payment.service';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';

export const actions: Actions = {
	edit: async ({ request, cookies, params, locals }) => {
		const form = await superValidate(request, zod4(Payment.EditSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		} else if (!params.id) {
			return message(
				form,
				{ type: 'error', text: 'Payment data is required. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'payments', 'edit');

		const existing = await PaymentModel.findById(params.id).lean<
			Payment.Base<string, string, string>
		>();
		await assertOwnership(locals.user, scope, existing, { ownField: 'created_by' });

		if (!existing) {
			return message(form, { type: 'error', text: 'Payment not found.' }, { status: 404 });
		}

		const billing = await BillingModel.findById(existing.billing);
		if (!billing) {
			return message(
				form,
				{ type: 'error', text: 'Billing record was not found.' },
				{ status: 404 }
			);
		}

		if (billing.cancelled) {
			return message(
				form,
				{ type: 'error', text: 'Cannot edit a payment on a cancelled billing.' },
				{ status: 400 }
			);
		}

		const duplicate_reference = await PaymentModel.findOne({
			_id: { $ne: existing._id },
			reference_number: form.data.reference_number,
			issuance: existing.issuance
		});
		if (duplicate_reference) {
			form.errors.reference_number = ['Reference number already exists.'];
			return message(
				form,
				{ type: 'error', text: 'Reference number already exists for this ticket.' },
				{ status: 400 }
			);
		}

		// Reverse this payment's old effect on the billing balance before reapplying the new amount.
		const oldAmount = Number(existing.amount);
		const newAmount = Number(form.data.amount);
		const balanceBeforeThisPayment = Number(billing.balance) + oldAmount;

		if (newAmount > balanceBeforeThisPayment) {
			form.errors.amount = ['Amount exceeds outstanding balance.'];
			return message(
				form,
				{ type: 'error', text: 'Entered amount exceeds outstanding balance.' },
				{ status: 400 }
			);
		}

		const updatedBalance = Math.max(0, balanceBeforeThisPayment - newAmount);
		const updatedAmountPaid = Number(billing.amount_paid) - oldAmount + newAmount;
		const updatedStatus = updatedBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

		const _u = await updatePayment(params.id, {
			amount: newAmount,
			payment_date: form.data.payment_date,
			payment_method: form.data.payment_method,
			payment_method_other: form.data.payment_method_other,
			reference_number: form.data.reference_number,
			notes: form.data.notes
		});

		if (!_u) {
			return message(
				form,
				{ type: 'error', text: 'Cannot process your request. Please try again.' },
				{ status: 400 }
			);
		}

		await BillingModel.findByIdAndUpdate(billing._id, {
			$set: {
				balance: updatedBalance,
				amount_paid: updatedAmountPaid,
				payment_status: updatedStatus
			}
		});

		const log_data: T_Log_C = {
			level: 'INFO',
			type: 'EDIT',
			message: 'edited payment',
			source: 'payments form action - edit',
			affected_collection: {
				collection_name: 'payments',
				document_id: [_u._id.toString()]
			},
			user: logActor(locals.user),
			metadata: { from: existing, to: _u }
		};

		await createLog(log_data);

		redirect(
			resolve('/u/payments?page=1&size=10'),
			{ type: 'success', message: 'Payment updated successfully.' },
			cookies
		);
	}
};
