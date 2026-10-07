<script lang="ts">
	import Can from '$lib/ui/components/Can.svelte';
	import RowActions from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { date, parseName, parseSelectItemsV2, permissions } from '$lib/utilities/helper';
	import EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
	import type TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod.js';
	import type Ticket from '$lib/validation_schemas/Tickets.zod.js';
	import type User from '$lib/validation_schemas/Users.zod.js';
	import UserType from '$lib/validation_schemas/UserTypes.zod';
	import { CirclePlus, Plus, SquarePen } from '@lucide/svelte';
	import Permission from '$lib/validation_schemas/Permissions.zod';
	import { resolve } from '$app/paths';
	import Combo from '$lib/ui/components/input/Combo.svelte';
	import type { SelectItems } from '$lib/types/T_select_options.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';

	let { data } = $props();

	const assignment_status = { ACTIVE: 0, INACTIVE: 1 };
	let assignments_data: TicketAssignment.Base<User.Base, Ticket.Base, string>[] = $derived(
		data.tickets.data
	);

	const _p = permissions.get('ticket_assignments', data.user.user_type.permissions);
	// no column at all for a role that can't edit assignments
	const show_actions = _p.edit !== 'none';

	let tickets_select: SelectItems[] = $state<SelectItems[]>([]);
	let selected_ticket: SelectItems = $state<SelectItems>({ value: '', label: '' });

	const searchTickets = async (_s: string = '') => {
		let _rq = await fetch(resolve(`/api/tickets/withdrawn?page=1&size=5&search=${_s}`));
		let _rs = await _rq.json();

		if (_rs.data.length) {
			tickets_select = parseSelectItemsV2(
				_rs.data,
				'$name ($ticket_num_from-$ticket_num_to)',
				'_id'
			);
		} else {
			tickets_select = [];
		}
	};

	let dialog: HTMLDialogElement;

	// #endregion

	onMount(() => {
		searchTickets();
	});
</script>

<Header title="Assigned Tickets">
	{#snippet AddButtons()}
		<Can
			permissions={data.user.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="ticket_assignments"
		>
			<button
				class="btn hidden h-10 w-20 border-0 capitalize shadow-none btn-sm btn-primary md:flex"
				onclick={() => dialog.showModal()}
			>
				<CirclePlus class="size-4" />
				<span class="pr-0.5">Add</span>
			</button>

			<div class="fab bottom-24 block md:hidden">
				<button class="btn btn-circle size-12 p-0 btn-primary" onclick={() => dialog.showModal()}>
					<Plus class="size-5" />
				</button>
			</div>
		</Can>
	{/snippet}
</Header>

{#key data}
	<Table>
		{#snippet table_header()}
			<th>Assigned to</th>
			<th>Ticket assigned</th>
			<th colspan="2">Ticket series</th>
			<th>Date assigned</th>
			<th>Status</th>
			{#if show_actions}
				<th class="w-0"><span class="sr-only">Actions</span></th>
			{/if}
		{/snippet}

		{#snippet table_subHeader()}
			<tr class="text-xs">
				<th></th>
				<th></th>
				<th>From</th>
				<th>To</th>
				<th></th>
				<th></th>
				{#if show_actions}
					<th></th>
				{/if}
			</tr>
		{/snippet}

		{#snippet table_body()}
			{#each assignments_data as item, index (index)}
				<tr class={[item.archived && 'text-base-content/50']}>
					<td>{parseName(item.user)}</td>
					<td>{item.ticket.name}</td>
					<td>{item.series_from}</td>
					<td>{item.series_to}</td>
					<td>{date.formatDate({ date: item.date_assigned, format: 'MMM d, yyyy' })}</td>
					<td>
						{#if item.status === assignment_status.ACTIVE}
							<span class="badge badge-soft badge-sm badge-success">Active</span>
						{:else}
							<span class="badge badge-ghost badge-sm">Inactive</span>
						{/if}
					</td>
					{#if show_actions}
						<td>
							<RowActions
								actions={[
									{
										tip: 'Edit',
										label: `Edit assignment of ${item.ticket.name} to ${parseName(item.user)}`,
										icon: SquarePen,
										tone: 'info',
										href: resolve(`/u/ticket-assignments/${item.ticket._id}/edit`)
									}
								]}
							/>
						</td>
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
						{!data.authorized ? `${data.message}` : `No assignments match these filters.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={data.total_count} />

<dialog id="assignment_modal" class="modal p-2 backdrop-blur-xs" bind:this={dialog}>
	<div class="relative modal-box flex w-full flex-col gap-4 md:w-5/12">
		<h3 class="font-bold text-sm">Select ticket for assignment</h3>

		<Combo
			label="Select ticket"
			name="ticket_search"
			placeholder="Search withdrawn tickets..."
			options={tickets_select}
			empty_error="No withdrawn ticket found..."
			on_search={(search: string) => searchTickets(search)}
			on_select={(selected: SelectItems) => (selected_ticket = selected)}
			width="full"
			errors={[]}
			value={undefined}
		/>

		<button
			class="btn btn-sm btn-primary"
			disabled={!selected_ticket.value}
			onclick={() => goto(resolve(`/u/ticket-assignments/${selected_ticket.value}/edit`))}
		>
			Assign
		</button>
	</div>

	<form method="dialog" class="modal-backdrop h-dvh">
		<button>_</button>
	</form>
</dialog>
