<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		issuance_status,
		issuance_status_data,
		issuance_status_select,
		getAllowedIssuanceStatusTransitions
	} from '$lib/data/static_data.js';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { date, getNumberOrdinal, parseName } from '$lib/utilities/helper.js';
	import Issuance from '$lib/validation_schemas/Issuances.zod.js';
	import TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod.js';
	import Ticket from '$lib/validation_schemas/Tickets.zod.js';
	import type TicketTracking from '$lib/validation_schemas/TicketsTracking.zod.js';
	import User from '$lib/validation_schemas/Users.zod.js';
	import Violator from '$lib/validation_schemas/Violators.zod.js';
	import { CircleAlert, TicketCheck, X } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { superForm, type SuperForm } from 'sveltekit-superforms';

	const { data } = $props();
	const issuance_data: Issuance.Base<
		TicketAssignment.Base<string, Ticket.Base, string>,
		User.Base,
		Violator.Base
	> = $derived(data.issuance);

	const tracking_data: TicketTracking.Base<Issuance.Base, User.Base>[] = $derived(
		[...data.tracking].reverse()
	);

	const statusMeta = (status: number) => issuance_status_data.find((s) => s.value === status);
	const statusLabel = (status: number) =>
		issuance_status_select.find((s) => s.value === status)?.label ?? 'Unknown';

	const allowed_transitions = $derived(
		getAllowedIssuanceStatusTransitions(issuance_data.status).filter(
			(status) => status !== issuance_status.PAID || data.balance_settled
		)
	);
	const balance_blocks_paid = $derived(
		!data.balance_settled &&
			getAllowedIssuanceStatusTransitions(issuance_data.status).includes(issuance_status.PAID)
	);
	const can_reissue = $derived(
		issuance_data.status === issuance_status.CANCELLED ||
			issuance_data.status === issuance_status['CASE CLOSED']
	);

	let dialog: HTMLDialogElement;

	//@ts-expect-error - superForm types are being weird with the data from the server, but it works fine
	const change_status_superform: SuperForm<Issuance.ChangeStatus, App.Superforms.Message> =
		superForm(data.forms.change_status, {
			dataType: 'json',
			onResult: ({ result }) => {
				if (result.type == 'success' && result.data) {
					if (result.data.form.data.status == issuance_status.CANCELLED) {
						setTimeout(() => {
							dialog.showModal();
						}, 1000);
					}
				}
			}
		});

	const { form, errors, message, enhance, constraints } = change_status_superform;

	message.subscribe((m) => {
		if (m) {
			if (m.type == 'error') {
				toast.error(m.text);
			} else if (m.type == 'success') {
				toast.success(m.text);
			}
		}
	});

	onMount(() => {
		$form.issuance_id = issuance_data._id;
	});
</script>

<Header>
	{#snippet PropFilter()}{/snippet}
	{#snippet Title()}
		<div class="flex flex-row flex-wrap items-center gap-2">
			<span class="font-mono! text-sm font-semibold"
				>{issuance_data.ticket_assignment.ticket.name}</span
			>
			<span class="badge badge-soft badge-xs badge-primary"
				>Series <strong>{issuance_data.ticket_series}</strong></span
			>
			<span
				class={['badge gap-1.5 badge-soft badge-xs', statusMeta(issuance_data.status)?.badge_color]}
			>
				<span class="size-1.5 rounded-full bg-current"></span>
				{statusLabel(issuance_data.status)}
			</span>
		</div>
	{/snippet}
</Header>

<div
	class="grid min-h-0 w-full grow grid-cols-1 items-start gap-6 overflow-y-auto md:grid-cols-[minmax(0,1fr)_26rem] md:overflow-hidden"
>
	<div class="flex h-fit w-full min-w-0 flex-col gap-4 md:h-full md:min-h-0 md:overflow-y-auto">
		<!-- Apprehension details -->
		<div class="card rounded-xl bg-base-200 px-6 py-4">
			<div class="mb-3 flex flex-row flex-wrap items-center justify-between gap-3">
				<p class="text-xs font-medium tracking-wide text-primary uppercase">Apprehension details</p>

				<div class="flex items-center gap-2">
					<div class="avatar avatar-placeholder">
						<div class="w-6 rounded-full bg-neutral text-neutral-content">
							<span class="text-xs">{issuance_data.issuer.firstname.charAt(0).toUpperCase()}</span>
						</div>
					</div>
					<div class="leading-tight">
						<div class="text-xs font-medium">
							{issuance_data.issuer.firstname}
							{issuance_data.issuer.lastname}
						</div>
						<div class="text-[0.65rem] text-info">@{issuance_data.issuer.username}</div>
					</div>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
				<fieldset>
					<legend class="label text-xs">Date</legend>
					<div class="text-sm font-semibold">
						{date.formatDate({
							date: issuance_data.apprehension_date,
							format: 'MMMM dd, yyyy (wk)'
						})}
					</div>
				</fieldset>

				<fieldset>
					<legend class="label text-xs">Time</legend>
					<div class="text-sm font-semibold">
						{date.formatTime(issuance_data.apprehension_time)}
					</div>
				</fieldset>

				<fieldset>
					<legend class="label text-xs">Barangay</legend>
					<div class="text-sm font-semibold">{issuance_data.apprehension_barangay}</div>
				</fieldset>

				<fieldset>
					<legend class="label text-xs">Address</legend>
					<div class="text-sm font-semibold">{issuance_data.apprehension_address}</div>
				</fieldset>
			</div>
			{#if issuance_data.remarks}
				<div class="mt-3 border-t pt-3">
					<fieldset>
						<legend class="label text-xs">Remarks</legend>
						<div class="text-sm">{issuance_data.remarks}</div>
					</fieldset>
				</div>
			{/if}
		</div>

		<!-- Violations -->
		<div class="card rounded-xl bg-base-200 px-6 py-4">
			<p class="mb-3 text-xs font-medium tracking-wide text-primary uppercase">
				Violations
				<span class="badge badge-soft badge-xs badge-primary">
					{issuance_data.violations.length}
				</span>
			</p>
			<div class="flex flex-col divide-y">
				{#each issuance_data.violations as v, index (index)}
					<div class="py-3 first:pt-0 last:pb-0">
						<div class="flex flex-wrap items-center gap-2">
							<span class="font-mono! text-sm font-semibold">{v.code}</span>
							<span class="badge badge-soft badge-sm badge-error"
								>{getNumberOrdinal(v.level)} offense</span
							>
						</div>

						<p class="label mt-0.5 text-xs">{v.descriptor}</p>

						<p class="mt-1 text-sm">{v.description}</p>

						<div class="mt-2 flex flex-wrap gap-3 text-xs">
							<span>
								<span class="label">Category:</span>
								<span>{v.violation_category.name}</span>
							</span>
							<span>·</span>
							<span>
								<span class="label">Sub-category:</span>
								<span>{v.violation_sub_category.name}</span>
							</span>
						</div>

						<fieldset
							class="mt-2 fieldset flex flex-wrap gap-4 rounded bg-base-300 px-3 py-2 text-sm"
						>
							<legend class="fieldset-legend text-xs">Penalty</legend>

							<strong>
								₱{v.penalty.pecuniary.toLocaleString()}
							</strong>

							<span>· {v.penalty.disciplinary}</span>
						</fieldset>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="flex h-fit w-full min-w-0 flex-col gap-4 md:h-full md:min-h-0">
		{#if allowed_transitions.length === 0}
			<div class="card flex flex-row items-start gap-3 rounded-xl bg-error/10 px-6 py-4">
				<CircleAlert class="mt-0.5 size-4 shrink-0 stroke-error" />
				<div class="text-sm">
					{#if issuance_data.status === issuance_status.CANCELLED}
						<p class="font-medium text-error">This ticket has been cancelled.</p>
						<p class="mt-0.5 text-xs text-base-content/70">
							Its status can no longer be changed. Reissue it to start a new ticket with the same
							details.
						</p>
					{:else}
						<p class="font-medium text-error">This ticket has been paid in full.</p>
						<p class="mt-0.5 text-xs text-base-content/70">Its status can no longer be changed.</p>
					{/if}
				</div>
			</div>
		{:else}
			<form
				action="?/change_status"
				method="POST"
				class="grid w-full grid-cols-4"
				use:enhance
				novalidate
			>
				<fieldset class="col-span-2 fieldset">
					<legend class="fieldset-legend">Change status to</legend>

					<select
						name="status"
						id="status"
						class="select w-full"
						bind:value={$form.status}
						{...$constraints.status}
					>
						<option selected disabled value={0}>Select status</option>

						{#each issuance_status_select.filter( (status) => allowed_transitions.includes(status.value) ) as status_option, i (i)}
							<option value={status_option.value}>{status_option.label}</option>
						{/each}
					</select>

					<InputError>
						{$errors.status && $errors.status}
					</InputError>

					{#if balance_blocks_paid}
						<p class="mt-1 text-xs text-base-content/50">
							"Paid" isn't available yet — this ticket still has an outstanding balance, or no
							payments have been recorded against it.
						</p>
					{/if}
				</fieldset>

				<fieldset class="col-span-4 fieldset">
					<legend class="fieldset-legend">Remarks</legend>
					<textarea
						bind:value={$form.remarks}
						name="remarks"
						id="remarks"
						class="textarea max-h-40 w-full"
						{...$constraints.remarks}
					></textarea>

					<InputError>
						{$errors.remarks && $errors.remarks}
					</InputError>
				</fieldset>

				<div class="col-span-4 flex flex-row items-center justify-end gap-2">
					<button type="reset" class="btn btn-ghost btn-sm">Clear</button>
					<button type="submit" class="btn w-24 btn-sm btn-primary">Change</button>
				</div>
			</form>
		{/if}

		{#if can_reissue && issuance_data.status !== issuance_status.CANCELLED}
			<div
				class="card flex flex-row items-center justify-between gap-3 rounded-xl bg-base-200 px-6 py-4"
			>
				<div class="text-sm">
					<p class="font-medium">Reissue this ticket?</p>
					<p class="mt-0.5 text-xs text-base-content/70">
						Start a new ticket copying this case's details, with different violations.
					</p>
				</div>
				<button
					type="button"
					class="btn shrink-0 btn-soft btn-sm btn-primary"
					onclick={() => dialog.showModal()}
				>
					<TicketCheck class="size-4" />
					Reissue
				</button>
			</div>
		{/if}

		<div class="flex min-h-0 grow flex-col overflow-y-auto">
			<p class="mb-3 text-xs font-medium tracking-wide text-primary uppercase">Status history</p>

			{#if tracking_data.length === 0}
				<p class="text-sm text-base-content/50">No status changes recorded yet.</p>
			{:else}
				<ol class="relative flex flex-col gap-5 border-l-2 border-base-300 pl-6">
					{#each tracking_data as tracking, i (i)}
						<li class="relative">
							<span
								class={[
									'absolute top-1 -left-6 size-3 -translate-x-1/2 rounded-full ring-4 ring-base-100',
									statusMeta(tracking.status)?.dot_color ?? 'bg-base-300'
								]}
							></span>

							<div class="card flex flex-col gap-3 rounded-xl bg-base-200 px-6 py-4">
								<div class="flex flex-row flex-wrap items-center justify-between gap-2">
									<div class="flex flex-row items-center gap-2">
										<span class="font-mono! font-semibold">{tracking.label}</span>
										{#if i === 0}
											<span class="badge badge-soft badge-xs badge-primary">Current</span>
										{/if}
									</div>

									<div class="text-xs font-semibold text-base-content/70">
										{date.formatDate({ date: tracking.created_at, format: 'MMMM dd, yyyy' })}
									</div>
								</div>

								<div class="flex flex-col">
									<span class="label text-xs">Changed by</span>
									<span class="text-sm">
										{tracking.changed_by ? parseName(tracking.changed_by) : 'System (automated)'}
									</span>
								</div>

								{#if tracking.remarks}
									<div class="flex flex-col">
										<span class="label text-xs">Remarks</span>
										<div class="text-sm">
											{tracking.remarks}
										</div>
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	</div>
</div>

<dialog id="reissuance_dialog" class="modal p-2 backdrop-blur-xs" bind:this={dialog}>
	<div class="relative modal-box flex w-full flex-col gap-4 md:w-5/12">
		<div class="flex flex-row items-center gap-4">
			<TicketCheck class=" size-6 stroke-primary" />

			<h3 class="font-bold text-primary">Reissue a Ticket?</h3>
		</div>

		<div>
			<div class="mb-4 flex flex-col gap-2 text-xs">
				<p>Would you like to reissue this ticket as a new one?</p>
				<p>Reissuing will copy all applicable data from this ticket.</p>
			</div>

			<div class="modal-action mt-0">
				<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>No</button>
				<a
					class="btn btn-soft btn-primary"
					href={resolve(`/u/issuance/create?reissue=${issuance_data._id}`)}>Reissue</a
				>

				<button
					class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
					type="button"
					onclick={() => dialog.close()}><X class="size-4" /></button
				>
			</div>
		</div>
	</div>

	<form method="dialog" class="modal-backdrop h-dvh">
		<button>x</button>
	</form>
</dialog>
