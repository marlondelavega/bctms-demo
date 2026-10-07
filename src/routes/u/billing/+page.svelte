<script lang="ts">
	import { resolve } from '$app/paths';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import RowActions from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { capitalize, parseName } from '$lib/utilities/helper.js';
	import type Billing from '$lib/validation_schemas/Billing.zod.js';
	import type Issuance from '$lib/validation_schemas/Issuances.zod.js';
	import type Violator from '$lib/validation_schemas/Violators.zod.js';
	import { Eye } from '@lucide/svelte';
	const { data } = $props();

	const billings: Billing.Base<Issuance.Base, Violator.Base>[] = $derived(data.billings);
</script>

<Header title="Billing" />

{#key billings}
	<Table>
		{#snippet table_header()}
			<th>Ticket - Series</th>
			<th>Tracking code</th>
			<th>Recipient</th>
			<th class="text-right">Amount due</th>
			<th class="text-right">Amount paid</th>
			<th class="text-right">Balance</th>
			<th>Payment status</th>
			<th class="w-0"><span class="sr-only">Actions</span></th>
		{/snippet}

		{#snippet table_body()}
			{#each billings as item, index (index)}
				<tr
					class={[
						'capitalize',
						item.cancelled
							? 'text-base-content/50'
							: [
									['UNPAID', 'OVERDUE'].includes(item.payment_status) && 'bg-error/8',
									item.payment_status == 'PAID' && 'bg-success/8',
									item.payment_status == 'PARTIALLY_PAID' && 'bg-warning/8'
								]
					]}
				>
					<td class="truncate"
						>{`${item.issuance?.ticket_assignment?.ticket?.name ?? 'N/A'} - ${item.issuance?.ticket_series ?? 'N/A'}`}</td
					>
					<td class="truncate">{item.issuance?.tracking_code ?? 'N/A'}</td>
					<td class="truncate">{item.recipient ? parseName(item.recipient) : 'Not specified'}</td>
					<td class="truncate text-right">{item.violations_total_amount}</td>
					<td class="truncate text-right">{item.amount_paid}</td>
					<td class="truncate text-right">{item.balance}</td>
					<td
						class={[
							'truncate',
							!item.cancelled && [
								['UNPAID', 'OVERDUE'].includes(item.payment_status) && 'text-error',
								item.payment_status == 'PAID' && 'text-success',
								item.payment_status == 'PARTIALLY_PAID' && 'text-warning'
							]
						]}
					>
						{#if item.cancelled}
							Cancelled
						{:else}
							{capitalize(item.payment_status.replaceAll('_', ' '))}
						{/if}
					</td>
					<td>
						<RowActions
							actions={[
								{
									tip: 'View',
									label: `View billing for ${item.issuance?.tracking_code ?? 'ticket'}`,
									icon: Eye,
									tone: 'info',
									href: resolve(`/u/billing/${item._id}/view`)
								}
							]}
						/>
					</td>
				</tr>
			{:else}
				<tr>
					<td
						colspan="8"
						class={[
							'py-10 text-center',
							data.authorized ? 'text-base-content/60' : 'text-error/80'
						]}
					>
						{!data.authorized ? `${data.message}` : `No billings match these filters.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={data.total_count} />
