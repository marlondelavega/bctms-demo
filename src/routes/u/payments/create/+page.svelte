<script lang="ts">
	import { resolve } from '$app/paths';
	import type Violator from '$lib/validation_schemas/Violators.zod.ts';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import Payment, { PAYMENT_METHODS } from '$lib/validation_schemas/Payments.zod.js';
	import { superForm, type SuperForm } from 'sveltekit-superforms/client';
	import { type SelectItems } from '$lib/types/T_select_options.js';
	import {
		calculateAge,
		date,
		getNumberOrdinal,
		parseName,
		parseSelectItemsV2
	} from '$lib/utilities/helper.js';
	import type Issuance from '$lib/validation_schemas/Issuances.zod.js';
	import type TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod.js';
	import type User from '$lib/validation_schemas/Users.zod.js';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import type Billing from '$lib/validation_schemas/Billing.zod.js';
	import { toast, Toaster } from 'svelte-sonner';
	import { Banknote, User as UserIcon, FileWarning, CircleAlert, FileText } from '@lucide/svelte';
	import Combobox from '$lib/ui/components/input/Combobox.svelte';

	const { data } = $props();

	let searching_trackingcode = $state(false);

	const super_form: SuperForm<Payment.Create, App.Superforms.Message> = superForm(data.form, {
		dataType: 'json',
		validators: zod4Client(Payment.CreateSchema),
		onResult: async ({ result }) => {
			if (result.type === 'success') {
				dialog.close();
				if (result.data) {
					const data = result.data.form.data;
					if (data) {
						$form.issuance = data._id;
						$form.tracking_code = data.tracking_code;

						const req = await fetch(resolve(`/api/billing/issuance/${data?.issuance}`));
						if (req.ok) {
							const { data } = await req.json();
							if (data) {
								selected_billing = data;
								$form.billing = data._id;
							}
						}

						selected_payments?.push(data as Payment.Base<string, string, string>);
					}
				}
			}
		}
	});

	const { form, errors, constraints, enhance, delayed, message } = super_form;

	let tracking_select_items: SelectItems[] = $state([]);
	let tracking_select_items_raw: Issuance.Base<TicketAssignment.Base, User.Base, Violator.Base>[] =
		$state([]);
	let selected = $state<Issuance.Base<TicketAssignment.Base, User.Base, Violator.Base>>();
	let selected_billing = $state<Billing.Base<string, string>>();
	let selected_payments = $state<Payment.Base<string, string, string>[]>();
	let dialog: HTMLDialogElement;
	let search: string = $state<string>('');

	function balanceTone(balance: number) {
		if (balance <= 0) return 'text-success';
		if (balance > 0) return 'text-error';
		return 'text-base-content';
	}

	function statusBadgeClass(status: string) {
		switch (status?.toLowerCase()) {
			case 'paid':
				return 'badge-success';
			case 'partial':
				return 'badge-warning';
			case 'overdue':
			case 'unpaid':
				return 'badge-error';
			default:
				return 'badge-ghost';
		}
	}

	const handleTrackingCodeSearch = async (val: string) => {
		if (val && val !== '') {
			searching_trackingcode = true;
			let req = await fetch(resolve(`/api/issuances/tracking_code/${val}`));
			let res = await req.json();

			if (res && res.length) {
				tracking_select_items_raw = res;
				tracking_select_items = parseSelectItemsV2(
					res,
					'$tracking_code - $recipient.firstname $recipient.lastname',
					'_id',
					'Apprehension: $apprehension_date | $apprehension_address, $apprehension_barangay'
				);
				searching_trackingcode = false;
			} else {
				tracking_select_items = [];
				searching_trackingcode = false;
			}
		}
	};

	const handleSelect = async (val: SelectItems) => {
		const found = tracking_select_items_raw.find((val2) => val2._id == val.value);
		if (found) {
			selected = found;
			$form.issuance = found._id;
			$form.tracking_code = found.tracking_code;

			let req = await fetch(resolve(`/api/billing/issuance/${found?._id}`));
			if (req.ok) {
				const { data } = await req.json();
				if (data) {
					selected_billing = data;
					$form.billing = data._id;
				}
			}

			req = await fetch(resolve(`/api/payments/issuance/${found._id}`));
			if (req.ok) {
				const { data } = await req.json();
				if (data) {
					selected_payments = data;
				}
			}
		}
	};

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

<Header title="Add Payment"></Header>

<div
	class="flex min-h-0 w-full grow flex-col gap-3 overflow-y-auto md:flex-row md:gap-4 md:overflow-hidden md:py-4 md:px-0 md:pb-4"
>
	<div class="flex h-full min-h-0 grow flex-col gap-3 md:flex-row md:gap-4">
		<section class="flex flex-col gap-3 md:min-h-0 md:flex-1">
			<Combobox
				label="Tracking code or name"
				name="tracking_code"
				placeholder="Enter tracking code or name"
				options={tracking_select_items}
				on_search={(search: string) => handleTrackingCodeSearch(search)}
				allow_errors={false}
				on_select={(selectedItem: SelectItems) => handleSelect(selectedItem)}
				width="full"
				errors={[]}
				bind:value={search}
				multiple={false}
				searching={searching_trackingcode}
			/>

			{#if selected}
				<!-- Compact violator + apprehension summary -->
				<div
					class="rounded-box border border-base-300 bg-base-100 p-2.5 flex flex-col gap-2 text-xs shrink-0"
				>
					<div class="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
						<fieldset class="col-span-2 sm:col-span-1 flex flex-col gap-0 min-w-0">
							<span class="label text-[10px] text-base-content/50">Fullname</span>
							<span class="font-medium truncate">{parseName(selected.recipient)}</span>
						</fieldset>

						<fieldset class="col-span-1 flex flex-col gap-0 min-w-0">
							<span class="label text-[10px] text-base-content/50">Birthdate</span>
							<span class="font-medium truncate">
								{date.formatDate({ date: selected.recipient.birthdate, format: 'MM/dd/yy' })}
								<span class="text-base-content/50"
									>({calculateAge(selected.recipient.birthdate)}y)</span
								>
							</span>
						</fieldset>

						<fieldset class="col-span-1 flex flex-col gap-0 min-w-0">
							<span class="label text-[10px] text-base-content/50">Apprehended by</span>
							<span class="font-medium truncate">{parseName(selected.issuer)}</span>
						</fieldset>
					</div>

					<div class="divider my-0"></div>

					<div class="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
						<fieldset class="col-span-1 flex flex-col gap-0 min-w-0">
							<span class="label text-[10px] text-base-content/50">Date</span>
							<span class="font-medium truncate">
								{date.formatDate({ date: selected.apprehension_date, format: 'MM/dd/yy' })}
							</span>
						</fieldset>

						<fieldset class="col-span-1 flex flex-col gap-0 min-w-0">
							<span class="label text-[10px] text-base-content/50">Time</span>
							<span class="font-medium truncate">{date.formatTime(selected.apprehension_time)}</span
							>
						</fieldset>

						<fieldset class="col-span-2 flex flex-col gap-0 min-w-0">
							<span class="label text-[10px] text-base-content/50">Location</span>
							<span class="font-medium truncate">
								{selected.apprehension_address}, {selected.apprehension_barangay}
							</span>
						</fieldset>
					</div>
				</div>
			{:else}
				<div
					class="rounded-box border border-dashed border-base-300 p-4 flex flex-col items-center justify-center gap-1.5 text-center shrink-0"
				>
					<UserIcon class="size-6 text-base-content/30" />
					<p class="text-xs text-base-content/60">
						Search a tracking code or name to view citation details
					</p>
				</div>
			{/if}

			<!-- Violations: capped/scrollable height on mobile, fills remaining space on md+ -->
			<div
				class="flex flex-col rounded-box border border-base-300 max-h-[50vh] min-h-[240px] overflow-hidden md:max-h-none md:min-h-0 md:grow"
			>
				<div class="flex items-center gap-2 px-3 pt-3 pb-1 text-xs font-bold shrink-0">
					<FileWarning class="size-4" /> Violation/s
					{#if selected}<span class="badge badge-sm badge-ghost">{selected.violations.length}</span
						>{/if}
				</div>

				<div class="overflow-y-auto grow">
					<table class="table table-xs table-pin-rows">
						<thead class="text-xs">
							<tr>
								<th class="w-8"></th>
								<th>Code</th>
								<th>Description</th>
								<th>Offense</th>
								<th class="text-right">Amount</th>
							</tr>
						</thead>
						<tbody>
							{#if selected}
								{#each selected.violations as violation, index (index)}
									<tr>
										<td>{index + 1}</td>
										<td class="whitespace-nowrap font-mono">{violation.code}</td>
										<td class="line-clamp-3 overflow-hidden">{violation.description}</td>
										<td class="whitespace-nowrap">
											<span class="badge badge-sm badge-outline"
												>{getNumberOrdinal(violation.level)}</span
											>
										</td>
										<td class="text-right whitespace-nowrap font-medium">
											&#8369;{violation.penalty.pecuniary}
										</td>
									</tr>
								{/each}
							{:else}
								<tr>
									<td colspan="5" class="text-center text-base-content/40 py-6"
										>No citation selected</td
									>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<section class="flex flex-col gap-3 md:min-h-0 md:flex-1 md:gap-4">
			<div class="rounded-box border border-base-300 bg-base-100 p-3 md:p-4 shrink-0">
				<div class="flex items-center gap-2 text-sm font-bold mb-2 md:mb-3">
					<FileText class="size-4" /> Billing
				</div>

				{#if selected_billing}
					<div class="flex items-center justify-between">
						<div class="flex flex-col gap-0.5 min-w-0">
							<span class="label text-xs">Status</span>
							<span class="badge {statusBadgeClass(selected_billing.payment_status)}">
								{selected_billing.payment_status}
							</span>
						</div>
						<div class="flex flex-col gap-0.5 items-end min-w-0">
							<span class="label text-xs">Outstanding balance</span>
							<span
								class="text-lg md:text-xl font-bold truncate {balanceTone(
									selected_billing.balance
								)}"
							>
								&#8369;{selected_billing.balance}
							</span>
						</div>
					</div>
				{:else}
					<p class="text-sm text-base-content/40">No billing record yet</p>
				{/if}
			</div>

			<!-- Payments: capped/scrollable height on mobile, fills remaining space on md+ -->
			<div
				class="flex flex-col gap-2 rounded-box border border-base-300 p-3 max-h-[45vh] min-h-50 overflow-hidden md:max-h-none md:min-h-0 md:grow"
			>
				<div class="flex items-center gap-2 text-sm font-bold shrink-0">
					<FileText class="size-4" /> Payments
				</div>

				<div class="overflow-y-auto grow">
					<table class="table table-xs table-pin-rows">
						<thead class="text-xs">
							<tr>
								<th class="w-8"></th>
								<th>Reference code</th>
								<th class="text-right">Amount</th>
								<th>Method</th>
								<th>Date paid</th>
							</tr>
						</thead>
						<tbody>
							{#each selected_payments as payment, index (index)}
								<tr>
									<td>{index + 1}</td>
									<td
										class="whitespace-nowrap truncate overflow-hidden max-w-32 sm:max-w-44 font-mono text-xs"
									>
										{payment.reference_number}
									</td>
									<td class="text-right whitespace-nowrap font-medium">&#8369;{payment.amount}</td>
									<td class="whitespace-nowrap">{payment.payment_method}</td>
									<td class="whitespace-nowrap">
										{date.formatDate({ date: payment.payment_date, format: 'MMM dd, yyyy' })}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="5" class="text-center py-6">
										{#if selected}
											<div class="flex flex-col items-center gap-1 text-base-content/40">
												<CircleAlert class="size-5" />
												<span>No payments recorded yet</span>
											</div>
										{:else}
											<span class="text-base-content/30">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- New payment button: sticky to viewport bottom on mobile, inline on md+ -->
			<div
				class="sticky inset-x-0 bottom-0 z-20 border-t border-base-300 bg-base-100 p-3 md:static md:z-auto md:border-0 md:bg-transparent md:p-0"
			>
				<button
					class="btn btn-primary w-full"
					type="button"
					onclick={() => dialog.showModal()}
					disabled={!selected}
				>
					<Banknote class="size-5" /> New payment
				</button>
			</div>
		</section>
	</div>
</div>

<dialog class="modal p-2 backdrop-blur-xs" bind:this={dialog}>
	<Toaster position="top-center" richColors />

	<form
		class="grid grid-cols-2 gap-x-2 gap-y-0.5 modal-box md:w-5/12 relative"
		method="POST"
		action="?/create"
		novalidate
		use:enhance
		id="form"
	>
		<fieldset class="fieldset col-span-2">
			<legend class="fieldset-legend">Reference number<span class="text-error">*</span></legend>
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
				{:else}
					<option disabled selected>Select ticket first</option>
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
				class={['input w-full']}
				class:border-error={$errors.payment_method_other}
				placeholder="Other payment method"
				name="payment_method_other"
				bind:value={$form.payment_method_other}
				{...$constraints.payment_method_other}
				required={$constraints.payment_method_other?.required || $form.payment_method == 'other'}
				aria-invalid={$errors.payment_method_other ? true : undefined}
				disabled={$form.payment_method !== 'other'}
			/>
			<InputError>
				{$errors.payment_method_other && $errors?.payment_method_other[0]}
			</InputError>
		</fieldset>

		<fieldset class="fieldset col-span-2">
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

		<fieldset class="fieldset col-span-2">
			<legend class="fieldset-legend">Notes</legend>

			<textarea
				name="notes"
				class="textarea max-h-24 w-full"
				class:border-error={$errors.notes}
				bind:value={$form.notes}
				{...$constraints.notes}
				aria-invalid={$errors.notes ? true : undefined}
			>
			</textarea>
			<InputError>
				{$errors.notes && $errors.notes}
			</InputError>
		</fieldset>

		<div class="mt-0 flex w-full flex-row justify-end col-span-2 gap-2">
			<button
				class="btn btn-ghost btn-sm"
				type="reset"
				onclick={() => {
					dialog.close();
				}}>Cancel</button
			>

			<button class="btn btn-sm btn-primary" type="submit" form="form">
				{#if $delayed}
					<span class="loading loading-spinner loading-sm"></span>
					Processing
				{:else}
					Submit
				{/if}
			</button>
		</div>
	</form>
</dialog>
