<script lang="ts">
	import { resolve } from '$app/paths';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { parseName } from '$lib/utilities/helper.js';
	import { PAYMENT_METHODS } from '$lib/validation_schemas/Payments.zod.js';
	import { ArrowLeft, FileText } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { dateProxy, superForm } from 'sveltekit-superforms';

	let { data } = $props();

	const { form, errors, enhance, constraints, message, delayed } = superForm(data.form, {
		dataType: 'json',
		delayMs: 500,
		timeoutMs: 8000
	});

	// 'date-local' (not 'date', which is UTC-based) — payment_date is stored as a full timestamp
	// with a real time-of-day (Date.now() at creation), so a UTC day slice can land on the wrong
	// calendar day for anything recorded before ~8 AM Philippine time, silently shifting the date
	// back a day the moment the form is saved, even if this field was never touched.
	let payment_date_proxy = dateProxy(form, 'payment_date', { format: 'date-local' });

	const payment = $derived(data.payment);

	function balanceTone(balance: number) {
		if (balance <= 0) return 'text-success';
		if (balance > 0) return 'text-error';
		return 'text-base-content';
	}

	message.subscribe((m) => {
		if (m) {
			if (m.type == 'error') {
				toast.error(m.text);
			} else if (m.type == 'success') {
				toast.success(m.text);
			}
		}
	});
</script>

<Header title="Edit Payment"></Header>

<div class="box-border flex min-h-0 w-full max-w-[36rem] grow flex-col gap-6 pt-4">
	<form
		class="flex min-h-0 grow flex-col gap-4"
		method="POST"
		action="?/edit"
		use:enhance
		novalidate
		id="form"
	>
		<a
			class="flex flex-row items-center gap-2 text-xs"
			href={resolve('/u/payments?page=1&size=10')}
		>
			<ArrowLeft class="size-3" /> Back
		</a>

		<div class="min-h-0 grow overflow-auto">
			<div class="flex flex-col gap-4">
				<!-- Read-only context: which citation/billing this payment belongs to -->
				<div class="rounded-box border border-base-300 bg-base-100 p-3">
					<div class="mb-2 flex items-center gap-2 text-sm font-bold">
						<FileText class="size-4" /> Citation details
					</div>

					<div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-4">
						<fieldset class="col-span-2 flex min-w-0 flex-col gap-0 sm:col-span-1">
							<span class="label text-[10px] text-base-content/50">Tracking code</span>
							<span class="truncate font-mono font-medium">{payment?.tracking_code ?? 'N/A'}</span>
						</fieldset>

						<fieldset class="col-span-1 flex min-w-0 flex-col gap-0">
							<span class="label text-[10px] text-base-content/50">Ticket - Series</span>
							<span class="truncate font-medium">
								{payment?.issuance?.ticket_assignment?.ticket?.name ?? 'N/A'} - {payment?.issuance
									?.ticket_series ?? 'N/A'}
							</span>
						</fieldset>

						<fieldset class="col-span-2 flex min-w-0 flex-col gap-0 sm:col-span-1">
							<span class="label text-[10px] text-base-content/50">Recipient</span>
							<span class="truncate font-medium capitalize">
								{payment?.issuance?.recipient ? parseName(payment.issuance.recipient) : 'N/A'}
							</span>
						</fieldset>

						<fieldset class="col-span-1 flex min-w-0 flex-col gap-0">
							<span class="label text-[10px] text-base-content/50">Billing status</span>
							<span class="truncate font-medium capitalize">
								{payment?.billing?.cancelled
									? 'Cancelled'
									: (payment?.billing?.payment_status?.toLowerCase().replaceAll('_', ' ') ?? 'N/A')}
							</span>
						</fieldset>
					</div>

					<div class="divider my-2"></div>

					<div class="flex items-center justify-between">
						<span class="label text-xs">Outstanding balance</span>
						<span class="text-lg font-bold {balanceTone(payment?.billing?.balance)}">
							&#8369;{payment?.billing?.balance ?? 0}
						</span>
					</div>
				</div>

				<div class="divider divider-start">Payment details</div>

				<div class="grid grid-cols-2 gap-2">
					<fieldset class="fieldset col-span-2">
						<legend class="fieldset-legend"
							>Reference number<span class="text-error">*</span></legend
						>
						<input
							type="text"
							class="input w-full"
							class:border-error={$errors.reference_number}
							placeholder="Enter reference number"
							name="reference_number"
							bind:value={$form.reference_number}
							{...$constraints.reference_number}
							aria-invalid={$errors.reference_number ? true : undefined}
						/>
						<InputError>{$errors.reference_number && $errors?.reference_number[0]}</InputError>
					</fieldset>

					<fieldset class="fieldset col-span-1">
						<legend class="fieldset-legend">Payment method<span class="text-error">*</span></legend>
						<select
							name="payment_method"
							class="select w-full"
							class:border-error={$errors.payment_method}
							bind:value={$form.payment_method}
							{...$constraints.payment_method}
							aria-invalid={$errors.payment_method ? true : undefined}
						>
							{#each PAYMENT_METHODS as method (method.value)}
								<option value={method.value}>{method.label}</option>
							{/each}
						</select>
						<InputError>
							{$errors.payment_method && $errors.payment_method}
						</InputError>
					</fieldset>

					<fieldset class="fieldset col-span-1">
						<legend class="fieldset-legend">
							Other payment method
							{#if $form.payment_method === 'other'}
								<span class="text-error">*</span>
							{/if}
						</legend>
						<input
							type="text"
							class="input w-full"
							class:border-error={$errors.payment_method_other}
							placeholder="Other payment method"
							name="payment_method_other"
							bind:value={$form.payment_method_other}
							{...$constraints.payment_method_other}
							required={$constraints.payment_method_other?.required ||
								$form.payment_method == 'other'}
							aria-invalid={$errors.payment_method_other ? true : undefined}
							disabled={$form.payment_method !== 'other'}
						/>
						<InputError>
							{$errors.payment_method_other && $errors?.payment_method_other[0]}
						</InputError>
					</fieldset>

					<fieldset class="fieldset col-span-1">
						<legend class="fieldset-legend">Amount<span class="text-error">*</span></legend>
						<input
							type="number"
							class="input w-full"
							class:border-error={$errors.amount}
							placeholder="1500.00"
							name="amount"
							bind:value={$form.amount}
							{...$constraints.amount}
							aria-invalid={$errors.amount ? true : undefined}
						/>
						<InputError>{$errors.amount && $errors?.amount[0]}</InputError>
					</fieldset>

					<fieldset class="fieldset col-span-1">
						<legend class="fieldset-legend">Payment date<span class="text-error">*</span></legend>
						<input
							type="date"
							class="input w-full"
							class:border-error={$errors.payment_date}
							name="payment_date"
							bind:value={$payment_date_proxy}
							{...$constraints.payment_date}
							aria-invalid={$errors.payment_date ? true : undefined}
						/>
						<InputError>{$errors.payment_date && $errors?.payment_date[0]}</InputError>
					</fieldset>

					<fieldset class="fieldset col-span-2">
						<legend class="fieldset-legend">Notes</legend>
						<textarea
							name="notes"
							class="textarea max-h-24 w-full"
							class:border-error={$errors.notes}
							bind:value={$form.notes}
							{...$constraints.notes}
							aria-invalid={$errors.notes ? true : undefined}
						></textarea>
						<InputError>
							{$errors.notes && $errors.notes}
						</InputError>
					</fieldset>
				</div>
			</div>
		</div>
	</form>

	<div class="mt-0 flex w-full flex-row justify-end gap-2">
		<a class="btn btn-ghost" href={resolve('/u/payments?page=1&size=10')}>Cancel</a>
		<button class="btn w-32 btn-primary" type="submit" form="form">
			{#if $delayed}
				<span class="loading loading-spinner loading-sm"></span>
				Saving
			{:else}
				Save
			{/if}
		</button>
	</div>
</div>
