<script lang="ts">
	import { resolve } from '$app/paths';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { date, parseName } from '$lib/utilities/helper.js';
	import { Eye } from '@lucide/svelte';

	const { data } = $props();
</script>

<Header title="Ticket Liquidation" />

{#key data.tickets}
	<Table>
		{#snippet table_header()}
			<th>Ticket name</th>
			<th colspan="2">Ticket series</th>
			<th>Date created</th>
			<th>Ticket for</th>
			<th>Person in-charge</th>
			<th>Date withdrawn</th>
			<th class="w-px"><span class="sr-only">Actions</span></th>
		{/snippet}

		{#snippet table_subHeader()}
			<tr class="text-xs">
				<th></th>
				<th>From</th>
				<th>To</th>
				<th></th>
				<th></th>
				<th></th>
				<th></th>
				<th></th>
			</tr>
		{/snippet}

		{#snippet table_body()}
			{#each data.tickets.data as item, index (index)}
				<tr class={item.archived ? 'bg-base-200/70 text-error/60' : ''}>
					<td>{item.name}</td>
					<td>{item.ticket_num_from}</td>
					<td>{item.ticket_num_to}</td>
					<td>{date.formatDate({ date: item.date_created, format: 'MMM d, yyyy' })}</td>
					<td>{item.ticket_for ? item.ticket_for?.name : '-'}</td>
					<td>{item.in_charge ? parseName(item.in_charge, true) : '-'}</td>
					<td
						>{item.date_withdrawn
							? date.formatDate({ date: item.date_withdrawn, format: 'MMM d, yyyy' })
							: '-'}</td
					>
					<td>
						<a
							class="btn capitalize btn-soft btn-xs btn-info"
							href={resolve(`/u/ticket-liquidation/${item._id}`)}
							aria-label={`View liquidation for ${item.name}`}
						>
							<Eye class="size-4" />view
						</a>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="8" class="text-center text-error/70">
						{!data.authorized ? `${data.message}` : `No data found.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={data.total_count} />
