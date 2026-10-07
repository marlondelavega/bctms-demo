<script lang="ts">
	import { resolve } from '$app/paths';
	import Can from '$lib/ui/components/Can.svelte';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import Filter from '$lib/ui/components/table/Filter.svelte';
	import RowActions, { type RowAction } from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { date, parseName, permissions } from '$lib/utilities/helper';
	import { issuance_status_data, issuance_status_select } from '$lib/data/static_data.js';
	import type Issuance from '$lib/validation_schemas/Issuances.zod.js';
	import Permission from '$lib/validation_schemas/Permissions.zod.js';
	import type TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod';
	import type Ticket from '$lib/validation_schemas/Tickets.zod';
	import User from '$lib/validation_schemas/Users.zod';
	import type Violation from '$lib/validation_schemas/Violations.zod';
	import type Violator from '$lib/validation_schemas/Violators.zod';
	import { CirclePlus, Plus, SquarePen } from '@lucide/svelte';

	let { data } = $props();
	let _dialog: HTMLDialogElement;
	const table_data: Issuance.Base<
		TicketAssignment.Base<string, Ticket.Base, string>,
		User.Base,
		Violator.Base
	>[] = $derived.by(() => {
		if (!data.issuances.data) return [];
		return data.issuances.data;
	});
	let view_violations: Violation.Snapshot[] | undefined = $state();

	let _p = permissions.get('issuance', data.user?.user_type.permissions);

	// no column at all for a role that can't manage tickets
	const show_actions = _p.edit !== 'none';

	const rowActions = (item: (typeof table_data)[number]): RowAction[] => [
		{
			tip: 'Manage',
			label: `Manage ${item.ticket_assignment.ticket.name} - ${item.ticket_series}`,
			icon: SquarePen,
			tone: 'info',
			href: resolve(`/u/issuance/${item._id}/status`)
		}
	];

	const statusMeta = (status: number) => issuance_status_data.find((s) => s.value === status);
	const statusLabel = (status: number) =>
		issuance_status_select.find((s) => s.value === status)?.label ?? 'Unknown';
</script>

<Header title="Issued Tickets">
	{#snippet PropFilter()}
		<Filter
			filters={['issuance_status', 'category', 'date_range', 'barangay']}
			date_label="Apprehension"
		/>
	{/snippet}
	{#snippet AddButtons()}
		<Can
			permissions={data.user?.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="issuance"
		>
			<a
				class="btn hidden h-10 w-20 border-0 capitalize shadow-none btn-sm btn-primary md:flex"
				href={resolve('/u/issuance/create')}
			>
				<CirclePlus class="size-4" />
				<span class="pr-0.5">Add</span>
			</a>

			<div class="fab bottom-24 block md:hidden">
				<a class="btn btn-circle size-12 p-0 btn-primary" href={resolve('/u/issuance/create')}>
					<Plus class="size-5" />
				</a>
			</div>
		</Can>
	{/snippet}
</Header>

{#key table_data}
	<Table>
		{#snippet table_header()}
			<th>Ticket</th>
			<th>Recipient</th>
			<th class="hidden md:table-cell">Issuer</th>
			<th>Apprehension</th>
			<th>Violations</th>
			<th>Status</th>
			{#if show_actions}
				<th class="w-0"><span class="sr-only">Actions</span></th>
			{/if}
		{/snippet}

		{#snippet table_body()}
			{#each table_data as item, index (index)}
				<tr class={[item.status === 6 && 'text-base-content/50']}>
					<td class="truncate">
						<div class="flex flex-col">
							<span class="truncate font-medium capitalize"
								>{item.ticket_assignment.ticket.name} - {item.ticket_series}</span
							>
							<span class="truncate font-mono text-xs text-base-content/50"
								>{item.tracking_code}</span
							>
						</div>
					</td>
					<td class="truncate font-medium capitalize">{parseName(item.recipient)}</td>
					<td class="hidden truncate text-base-content/70 capitalize md:table-cell"
						>{parseName(item.issuer)}</td
					>
					<td class="truncate">
						<div class="flex flex-col">
							<span class="truncate capitalize">{item.apprehension_barangay}</span>
							<span class="truncate text-xs text-base-content/50">
								{date.formatDate({ date: item.apprehension_date, format: 'MMM dd, yyyy' })} · {date.formatTime(
									item.apprehension_time
								)}
							</span>
						</div>
					</td>
					<td class="truncate">
						<button
							type="button"
							class="badge cursor-pointer badge-soft badge-sm badge-primary lowercase"
							onclick={() => {
								view_violations = item.violations;
								_dialog.showModal();
							}}
						>
							{item.violations.length > 1
								? `${item.violations.length} violations`
								: `${item.violations.length} violation`}
						</button>
					</td>
					<td class="truncate">
						<span
							class={['badge gap-1.5 badge-soft badge-sm', statusMeta(item.status)?.badge_color]}
						>
							<span class="size-1.5 rounded-full bg-current"></span>
							{statusLabel(item.status)}
						</span>
					</td>
					{#if show_actions}
						<td><RowActions actions={rowActions(item)} /></td>
					{/if}
				</tr>
			{:else}
				<tr>
					<td
						colspan={show_actions ? 7 : 6}
						class={[
							'py-10 text-center',
							data.authorized ? 'text-base-content/60' : 'text-error/80'
						]}
					>
						{!data.authorized ? `${data.message}` : `No tickets match these filters.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={Number(data.total_count)} />

<dialog id="issuance_view_violations" class="modal" bind:this={_dialog}>
	<div class="relative modal-box flex max-h-[90vh] w-11/12 min-w-6/12 flex-col gap-4 md:w-6/12">
		<h3 class="text-lg font-bold">Violations</h3>

		<div class="h-full min-h-0 grow overflow-auto">
			{#each view_violations as violation (violation)}
				<div class="collapse-arrow collapse mb-4 rounded border-1 border-primary/50">
					<input type="checkbox" class="h-full" name="my-accordion-2" />
					<div class="collapse-title flex flex-col justify-between md:flex-row">
						<div class="min-w-0 grow truncate text-sm font-bold">
							<span>{violation.code}</span>
						</div>

						<div class="text-xs font-light">
							<span>
								{violation.violation_category.name} - {violation.violation_sub_category.name}
							</span>
						</div>
					</div>

					<div class="collapse-content flex flex-col gap-4 text-xs">
						<p>DESCRIPTOR: {violation.descriptor}</p>
						<div>
							<p>DESCRIPTION:</p>
							<p>{violation.description}</p>
						</div>

						<p>
							PENALTY:
							{#if !violation.penalty.pecuniary && !violation.penalty.disciplinary}
								-
							{:else if violation.penalty.pecuniary && violation.penalty.disciplinary}
								PHP {violation.penalty.pecuniary} + {violation.penalty.disciplinary}
							{:else if violation.penalty.pecuniary}
								PHP {violation.penalty.pecuniary}
							{:else if violation.penalty.disciplinary}
								{violation.penalty.disciplinary}
							{/if}
						</p>
					</div>
				</div>
			{/each}
		</div>

		<div class="m-0 modal-action">
			<form method="dialog">
				<!-- if there is a button in form, it will close the modal -->
				<button class="btn">Close</button>
			</form>
		</div>
	</div>

	<form method="dialog" class="modal-backdrop h-dvh">
		<button>x</button>
	</form>
</dialog>
