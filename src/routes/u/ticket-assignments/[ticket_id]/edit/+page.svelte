<script lang="ts">
	import { resolve } from '$app/paths';
	import type { SelectItems } from '$lib/types/T_select_options.js';
	import Combo from '$lib/ui/components/input/Combo.svelte';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { date, parseName, parseSelectItems } from '$lib/utilities/helper.js';
	import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod.js';
	import type TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod.js';
	import type Ticket from '$lib/validation_schemas/Tickets.zod.js';
	import type User from '$lib/validation_schemas/Users.zod.js';
	import { ArrowLeft, CircleAlert, Lock, Pencil } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { fly } from 'svelte/transition';
	import { dateProxy, superForm, type SuperForm } from 'sveltekit-superforms/client';

	let { data } = $props();

	type AssignmentRow = TicketAssignment.Base<User.Base> & { is_locked: boolean };
	type UnassignedSegment = { from: number; to: number };
	let ticket: Ticket.Base<EnforcementGroup.Base, User.Base> = $state(data.ticket);
	let assignments: AssignmentRow[] = $state(data.assignments);
	let users_select = $state<SelectItems[]>([]);

	//#region forms
	const create_super_form: SuperForm<TicketAssignment.Create, App.Superforms.Message> = superForm(
		data.create_form,
		{
			dataType: 'json',
			resetForm: false,
			onResult: async ({ result, cancel }) => {
				if (result.type == 'success' && result.status === 200) {
					await refreshAssignments();
					$create_form.user = '';
					$create_form.status = 0;
					$create_form.date_assigned = new Date();
					users_select = [];
					cancel();
				}
			},
			invalidateAll: false
		}
	);
	const {
		form: create_form,
		errors: create_errors,
		enhance: create_enhance,
		message: create_message,
		delayed: create_delayed,
		constraints: create_constraints
	} = create_super_form;
	let create_date_proxy = dateProxy(create_form, 'date_assigned', { format: 'date' });

	const edit_super_form: SuperForm<TicketAssignment.Edit, App.Superforms.Message> = superForm(
		data.edit_form,
		{
			dataType: 'json',
			resetForm: false,
			onResult: async ({ result, cancel }) => {
				if (result.type == 'success' && result.status === 200) {
					await refreshAssignments();
					editing_id = null;
					cancel();
				}
				// on failure the row stays open so the user sees the rejection (e.g. now-locked, out of bounds)
			},
			invalidateAll: false
		}
	);
	const {
		form: edit_form,
		errors: edit_errors,
		enhance: edit_enhance,
		message: edit_message,
		delayed: edit_delayed,
		constraints: edit_constraints
	} = edit_super_form;
	let edit_date_proxy = dateProxy(edit_form, 'date_assigned', { format: 'date' });
	//#endregion

	let unassigned_segments = $derived(getUnassignedSegments(assignments, ticket));
	let selected_segment_index = $state(0);
	let current_segment = $derived<UnassignedSegment | undefined>(
		unassigned_segments[selected_segment_index]
	);
	let ticket_complete = $derived(unassigned_segments.length === 0);

	let total_series = $derived(ticket.ticket_num_to - ticket.ticket_num_from + 1);
	let unassigned_count = $derived(unassigned_segments.reduce((n, g) => n + (g.to - g.from + 1), 0));
	let assigned_count = $derived(total_series - unassigned_count);
	let sorted_assignments = $derived([...assignments].sort((a, b) => a.series_from - b.series_from));

	$effect(() => {
		void unassigned_segments; // dependency
		selected_segment_index = 0;
		if (unassigned_segments.length > 0) {
			applySegment(unassigned_segments[0]);
		}
	});

	let editing_id = $state<string | null>(null);

	function getUnassignedSegments(
		rows: AssignmentRow[],
		t: Ticket.Base<EnforcementGroup.Base, User.Base>
	): UnassignedSegment[] {
		const sorted = [...rows].sort((a, b) => a.series_from - b.series_from);
		const segments: UnassignedSegment[] = [];
		let cursor = t.ticket_num_from;

		for (const a of sorted) {
			if (a.series_from > cursor) {
				segments.push({ from: cursor, to: a.series_from - 1 });
			}
			cursor = Math.max(cursor, a.series_to + 1);
		}
		if (cursor <= t.ticket_num_to) {
			segments.push({ from: cursor, to: t.ticket_num_to });
		}
		return segments;
	}

	[edit_message, create_message].forEach((f) =>
		f.subscribe((m) => {
			if (m) {
				if (m.type == 'error') {
					toast.error(m.text);
				} else if (m?.type == 'success') {
					toast.success(m.text);
				}
			}
		})
	);

	function applySegment(seg: UnassignedSegment) {
		$create_form.ticket = ticket._id;
		$create_form.series_from = seg.from;
		$create_form.series_to = seg.from + 49 <= seg.to ? seg.from + 49 : seg.to;
	}

	function getEditBounds(row: AssignmentRow) {
		const sorted = [...assignments].sort((a, b) => a.series_from - b.series_from);
		const idx = sorted.findIndex((a) => a._id === row._id);
		const prev = idx > 0 ? sorted[idx - 1] : null;
		const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

		return {
			min_from: prev ? prev.series_to + 1 : ticket.ticket_num_from,
			max_to: next ? next.series_from - 1 : ticket.ticket_num_to
		};
	}

	function startEdit(row: AssignmentRow) {
		editing_id = row._id;
		$edit_form._id = row._id;
		$edit_form.ticket = ticket._id;
		$edit_form.user = typeof row.user == 'object' ? row.user._id : row.user;
		$edit_form.series_from = row.series_from;
		$edit_form.series_to = row.series_to;
		$edit_form.status = row.status;
		$edit_form.date_assigned = row.date_assigned;
		searchUsers('');
	}

	function cancelEdit() {
		editing_id = null;
	}

	const searchUsers = async (_s: string = '') => {
		const _rq = await fetch(
			resolve(`/api/users?page=1&size=5&search=${_s}&enforcement_group=${ticket.ticket_for._id}`)
		);
		const _rs = await _rq.json();
		users_select = _rs.data.length
			? parseSelectItems(_rs.data, ['firstname', 'lastname'], '_id', 'user_type.user_type')
			: [];
	};

	async function refreshAssignments() {
		const _rq = await fetch(resolve(`/api/ticket-assignments/ticket/${ticket._id}/is-locked`));
		const _rs = await _rq.json();
		assignments = _rs.data ?? [];
	}

	onMount(() => {
		searchUsers('');
	});
</script>

{#snippet assignmentSummary(row: AssignmentRow)}
	<span class="font-mono text-sm font-semibold tabular-nums"
		>#{row.series_from} – {row.series_to}</span
	>
	<span class="text-xs text-base-content/60 tabular-nums">
		{row.series_to - row.series_from + 1} tickets
	</span>
	<span class="min-w-0 grow truncate text-sm">
		{typeof row.user == 'object' ? parseName(row.user) : 'Unknown user'}
	</span>
	<span class="text-xs text-base-content/60">
		{date.formatDate({ date: row.date_assigned, format: 'MMM dd, yyyy' })}
	</span>
{/snippet}

<Header title="Manage Ticket Assignments" />

<div class="box-border flex min-h-0 w-full max-w-2xl grow flex-col gap-6 p-4">
	<a
		class="flex w-fit flex-row items-center gap-2 text-xs"
		href={resolve('/u/ticket-assignments?page=1&size=10')}
	>
		<ArrowLeft class="size-3" /> Back
	</a>

	<!-- Ticket context -->
	<section class="flex flex-col gap-4 rounded-xl bg-base-200 p-4" aria-labelledby="ticket-h">
		<div class="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
			<div class="col-span-2">
				<p class="text-xs text-base-content/60">Ticket</p>
				<h2 id="ticket-h" class="truncate font-mono text-sm font-semibold">{ticket.name}</h2>
			</div>
			<div class="col-span-1">
				<p class="text-xs text-base-content/60">Series</p>
				<p class="font-mono text-sm tabular-nums">
					{ticket.ticket_num_from} – {ticket.ticket_num_to}
				</p>
			</div>
			<div class="col-span-1">
				<p class="text-xs text-base-content/60">Ticket for</p>
				<p class="truncate text-sm">{ticket.ticket_for.name}</p>
			</div>
		</div>

		<div class="flex flex-col gap-1.5">
			<div class="flex flex-row items-baseline justify-between gap-3 text-xs tabular-nums">
				<span>
					<span class="font-semibold">{assigned_count}</span> of {total_series} assigned
				</span>
				{#if unassigned_count}
					<span class="text-error">{unassigned_count} still unassigned</span>
				{:else}
					<span class="text-success">Fully assigned</span>
				{/if}
			</div>
			<progress
				class="progress h-1.5 w-full progress-primary"
				value={assigned_count}
				max={total_series}
				aria-label="Share of the ticket series that is assigned"
			></progress>
		</div>
	</section>

	<div class="flex min-w-0 grow flex-col gap-8 overflow-auto">
		<!-- Create / fill-gap panel -->
		<div class="flex flex-col gap-2">
			<h2 class="text-sm font-semibold">Add assignment</h2>

			{#if !ticket_complete}
				<form
					class="grid grid-cols-2 gap-2 rounded-lg border border-primary/50 p-4 pt-2 md:grid-cols-4"
					method="POST"
					action="?/create"
					use:create_enhance
					novalidate
				>
					{#if unassigned_segments.length > 1}
						<div class="col-span-full">
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Fill gap</legend>
								<select
									class="input w-full"
									bind:value={selected_segment_index}
									onchange={() => {
										const seg = unassigned_segments[selected_segment_index];
										if (seg) applySegment(seg);
									}}
								>
									{#each unassigned_segments as seg, i (i)}
										<option value={i}>
											#{seg.from} - {seg.to} ({seg.to - seg.from + 1} tickets)
										</option>
									{/each}
								</select>
							</fieldset>
						</div>
					{/if}

					<div class="col-span-2">
						<Combo
							label="Assign to"
							name="user"
							options={users_select}
							on_search={(search: string) => searchUsers(search)}
							width="full"
							errors={$create_errors.user ? $create_errors.user : []}
							constraints={$create_constraints?.user ? $create_constraints?.user : {}}
							bind:value={$create_form.user}
						/>
					</div>

					<fieldset class="col-span-1 fieldset">
						<legend class="fieldset-legend">Ticket from<span class="text-error">*</span></legend>
						<input
							name="series_from"
							type="number"
							class="input w-full"
							class:border-error={$create_errors.series_from?.length}
							bind:value={$create_form.series_from}
							{...$create_constraints.series_from}
							min={current_segment?.from}
							max={current_segment?.to ?? 0}
							readonly
						/>
						<InputError>{$create_errors.series_from && $create_errors.series_from}</InputError>
					</fieldset>

					<fieldset class="col-span-1 fieldset">
						<legend class="fieldset-legend">Ticket to<span class="text-error">*</span></legend>
						<input
							name="series_to"
							type="number"
							class="input w-full"
							class:border-error={$create_errors.series_to?.length}
							bind:value={$create_form.series_to}
							{...$create_constraints.series_to}
							min={$create_form.series_from}
							max={current_segment?.to}
							onfocusout={(e) => {
								if (Number(e.currentTarget.value) > Number(e.currentTarget.max)) {
									e.currentTarget.value = e.currentTarget.max;
								} else if (Number(e.currentTarget.value) < Number(e.currentTarget.min)) {
									e.currentTarget.value = e.currentTarget.min;
								}
							}}
							readonly={current_segment?.from == current_segment?.to}
						/>
						<InputError>{$create_errors.series_to && $create_errors.series_to}</InputError>
					</fieldset>

					<fieldset class="col-span-1 fieldset">
						<legend class="fieldset-legend">Status<span class="text-error">*</span></legend>
						<select
							name="status"
							class="input w-full"
							bind:value={$create_form.status}
							{...$create_constraints.status}
						>
							<option value={0}>Active</option>
							<option value={1}>Inactive</option>
						</select>
					</fieldset>

					<fieldset class="col-span-1 fieldset">
						<legend class="fieldset-legend">Date assigned<span class="text-error">*</span></legend>
						<input
							name="date_assigned"
							type="date"
							class="input w-full"
							bind:value={$create_date_proxy}
							{...$create_constraints.date_assigned}
						/>

						<InputError>{$create_errors.date_assigned && $create_errors.date_assigned}</InputError>
					</fieldset>

					<div class="col-span-full flex justify-end">
						<button
							class="btn w-24 btn-sm btn-primary"
							type={$create_delayed ? 'button' : 'submit'}
							disabled={$create_delayed}
						>
							{#if $create_delayed}
								<span class="loading loading-xs loading-spinner"></span>
							{:else}
								Assign
							{/if}
						</button>
					</div>
				</form>
			{:else}
				<div
					class="flex flex-row items-center gap-2 rounded-lg border border-success/50 bg-success/5 p-4"
				>
					<CircleAlert class="size-5 text-success" />
					<span class="text-sm">Every series in this ticket is assigned.</span>
				</div>
			{/if}
		</div>

		<!-- Existing assignments -->
		<div class="flex flex-col gap-4">
			<h2 class="text-sm font-semibold">
				{assignments.length} ticket assignment{assignments.length == 1 ? '' : 's'}
				{#if assignments.some((a) => a.is_locked)}
					<span class="font-normal text-base-content/60">
						· {assignments.filter((a) => a.is_locked).length} locked
					</span>
				{/if}
			</h2>

			{#if !assignments.length}
				<p class="text-sm text-base-content/70">
					Nothing is assigned yet. Add the first assignment above.
				</p>
			{/if}

			{#each sorted_assignments as row (row._id)}
				{#if row.is_locked}
					<div
						class="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-error/30 bg-error/5 px-4 py-3"
					>
						{@render assignmentSummary(row)}
						<span class="flex items-center gap-1 text-xs text-error">
							<Lock class="size-3" /> Locked · tickets issued
						</span>
					</div>
				{:else if editing_id === row._id}
					{@const bounds = getEditBounds(row)}
					<form
						class="grid grid-cols-2 gap-2 rounded-lg border border-primary/50 p-4 pt-2 md:grid-cols-4"
						method="POST"
						action="?/edit"
						use:edit_enhance
						novalidate
						in:fly
					>
						<input type="hidden" name="_id" bind:value={$edit_form._id} />
						<input type="hidden" name="ticket" bind:value={$edit_form.ticket} />

						<div class="col-span-2">
							<Combo
								label="Assign to"
								name="user"
								options={users_select}
								on_search={(search: string) => searchUsers(search)}
								width="full"
								errors={$edit_errors.user ? $edit_errors.user : []}
								constraints={$edit_constraints?.user ? $edit_constraints?.user : {}}
								bind:value={$edit_form.user}
							/>
						</div>

						<fieldset class="col-span-1 fieldset">
							<legend class="fieldset-legend">Ticket from<span class="text-error">*</span></legend>
							<input
								name="series_from"
								type="number"
								class="input w-full"
								class:border-error={$edit_errors.series_from?.length}
								bind:value={$edit_form.series_from}
								{...$edit_constraints.series_from}
								min={bounds.min_from}
								max={$edit_form.series_to}
								onfocusout={(e) => {
									if (Number(e.currentTarget.value) < Number(e.currentTarget.min)) {
										e.currentTarget.value = e.currentTarget.min;
									} else if (Number(e.currentTarget.value) > Number(e.currentTarget.max)) {
										e.currentTarget.value = e.currentTarget.max;
									}
								}}
							/>
							<InputError>{$edit_errors.series_from && $edit_errors.series_from}</InputError>
							<p class="text-xs text-base-content/50">Min #{bounds.min_from}</p>
						</fieldset>

						<fieldset class="col-span-1 fieldset">
							<legend class="fieldset-legend">Ticket to<span class="text-error">*</span></legend>
							<input
								name="series_to"
								type="number"
								class="input w-full"
								class:border-error={$edit_errors.series_to?.length}
								bind:value={$edit_form.series_to}
								{...$edit_constraints.series_to}
								min={$edit_form.series_from}
								max={bounds.max_to}
								onfocusout={(e) => {
									if (Number(e.currentTarget.value) > Number(e.currentTarget.max)) {
										e.currentTarget.value = e.currentTarget.max;
									} else if (Number(e.currentTarget.value) < Number(e.currentTarget.min)) {
										e.currentTarget.value = e.currentTarget.min;
									}
								}}
							/>
							<InputError>{$edit_errors.series_to && $edit_errors.series_to}</InputError>
							<p class="text-xs text-base-content/50">Max #{bounds.max_to}</p>
						</fieldset>

						<fieldset class="col-span-1 fieldset">
							<legend class="fieldset-legend">Status<span class="text-error">*</span></legend>
							<select
								name="status"
								class="input w-full"
								bind:value={$edit_form.status}
								{...$edit_constraints.status}
							>
								<option value={0}>Active</option>
								<option value={1}>Inactive</option>
							</select>
						</fieldset>

						<fieldset class="col-span-1 fieldset">
							<legend class="fieldset-legend">Date assigned<span class="text-error">*</span></legend
							>
							<input
								name="date_assigned"
								type="date"
								class="input w-full"
								bind:value={$edit_date_proxy}
								{...$edit_constraints.date_assigned}
							/>

							<InputError>{$edit_errors.date_assigned && $edit_errors.date_assigned}</InputError>
						</fieldset>

						<div class="col-span-full flex justify-end gap-2">
							<button class="btn btn-ghost btn-sm" type="button" onclick={cancelEdit}>
								Cancel
							</button>
							<button
								class="btn w-24 btn-sm btn-primary"
								type={$edit_delayed ? 'button' : 'submit'}
								disabled={$edit_delayed}
							>
								{#if $edit_delayed}
									<span class="loading loading-xs loading-spinner"></span>
								{:else}
									Save
								{/if}
							</button>
						</div>
					</form>
				{:else}
					<div
						class="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-base-200 px-4 py-3"
					>
						{@render assignmentSummary(row)}
						<span
							class={[
								'badge badge-sm',
								row.status === 0 ? 'badge-success badge-soft' : 'badge-ghost'
							]}
						>
							{row.status === 0 ? 'Active' : 'Inactive'}
						</span>
						<button
							class="btn btn-ghost btn-xs"
							type="button"
							onclick={() => startEdit(row)}
							aria-label={`Edit assignment #${row.series_from} to #${row.series_to}`}
						>
							<Pencil class="size-3" /> Edit
						</button>
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>
