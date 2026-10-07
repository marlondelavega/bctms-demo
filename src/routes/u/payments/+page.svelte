<script lang="ts">
	import { resolve } from '$app/paths';
	import Can from '$lib/ui/components/Can.svelte';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import Filter from '$lib/ui/components/table/Filter.svelte';
	import RowActions from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { date, permissions } from '$lib/utilities/helper.js';
	import type Billing from '$lib/validation_schemas/Billing.zod.js';
	import type Issuance from '$lib/validation_schemas/Issuances.zod.js';
	import Payment, { PAYMENT_METHODS } from '$lib/validation_schemas/Payments.zod.js';
	import Permission from '$lib/validation_schemas/Permissions.zod.js';
	import TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod.js';
	import type Ticket from '$lib/validation_schemas/Tickets.zod.js';
	import type User from '$lib/validation_schemas/Users.zod.js';
	import { CirclePlus, SquarePen } from '@lucide/svelte';

	const { data } = $props();

	const table_data: Payment.Base<
		Issuance.Base<TicketAssignment.Base<string, Ticket.Base, string>, string, string>,
		Billing.Base,
		User.Base
	>[] = $derived.by(() => {
		if (!data.payments.data) return [];
		return data.payments.data;
	});

	const _p = permissions.get('payments', data.user.user_type.permissions);
	// no column at all for a role that can't edit payments
	const show_actions = _p.edit !== 'none';

	const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
	const methodLabel = (value: string) =>
		PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
</script>

<Header title="Payments">
	{#snippet PropFilter()}
		<Filter filters={['date_range']} date_label="Payment" />
	{/snippet}
	{#snippet AddButtons()}
		<Can
			permissions={data.user.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="payments"
		>
			<a
				class="btn hidden h-10 w-20 border-0 capitalize shadow-none btn-sm btn-primary md:flex"
				href={resolve(`/u/payments/create`)}
			>
				<CirclePlus class="size-4" />
				<span class="pr-0.5">Add</span>
			</a>
		</Can>
	{/snippet}
</Header>

{#key table_data}
	<Table>
		{#snippet table_header()}
			<th>Tracking code</th>
			<th>Ticket - Series</th>
			<th>Payment date</th>
			<th class="text-right">Amount</th>
			<th>Method</th>
			<th>Reference no.</th>
			{#if show_actions}
				<th class="w-0"><span class="sr-only">Actions</span></th>
			{/if}
		{/snippet}

		{#snippet table_body()}
			{#each table_data as item, index (index)}
				<tr>
					<td class="font-mono text-xs font-medium whitespace-nowrap">{item.tracking_code}</td>
					<td class="whitespace-nowrap capitalize">
						{item.issuance?.ticket_assignment?.ticket?.name ?? 'N/A'} - {item.issuance
							?.ticket_series ?? 'N/A'}
					</td>
					<td class="whitespace-nowrap">
						{date.formatDate({ date: item.payment_date, format: 'MMM dd, yyyy' })}
					</td>
					<td class="text-right font-medium whitespace-nowrap tabular-nums">
						{peso.format(item.amount)}
					</td>
					<td class="whitespace-nowrap">{methodLabel(item.payment_method)}</td>
					<td class="max-w-40 truncate font-mono text-xs">{item.reference_number}</td>
					{#if show_actions}
						<td>
							<RowActions
								actions={[
									{
										tip: 'Edit',
										label: `Edit payment ${item.tracking_code}`,
										icon: SquarePen,
										tone: 'info',
										href: resolve(`/u/payments/${item._id}/edit`)
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
						{!data.authorized ? data.message : 'No payments match these filters.'}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={data.total_count} />
