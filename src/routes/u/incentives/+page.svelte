<script lang="ts">
	import { resolve } from '$app/paths';
	import Can from '$lib/ui/components/Can.svelte';
	import MultiSelect from '$lib/ui/components/input/MultiSelect.svelte';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import Permission from '$lib/validation_schemas/Permissions.zod';
	import { FilePlus, RotateCcw } from '@lucide/svelte';

	let { data } = $props();

	const list = $derived(data.list);
	const applied = $derived(data.applied);

	const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
	const formatDate = (date: string) =>
		new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

	const status_options = [
		{ value: 'generated', label: 'Generated' },
		{ value: 'voided', label: 'Voided' }
	];
	const group_options = $derived(data.groups.map((g) => ({ value: g._id, label: g.name })));

	const scopeNote: Record<string, string> = {
		own: 'Showing reports that include your tickets, with your share only.',
		office: 'Showing reports that include your office, with your office’s share only.'
	};
</script>

<Header title="Incentives">
	{#snippet PropFilter()}{/snippet}
	{#snippet AddButtons()}
		<Can
			permissions={data.user.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="incentives"
		>
			<a href={resolve('/u/incentives/generate')} class="btn gap-1 btn-sm btn-primary">
				<FilePlus class="size-4" /> Generate
			</a>
		</Can>
	{/snippet}
</Header>

<div class="flex min-h-0 w-full grow flex-col gap-3 overflow-auto py-4">
	<form method="GET" class="mx-6 flex flex-col gap-3 rounded-box border border-base-300 p-4">
		<div class="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
			<fieldset class="fieldset col-span-2 sm:col-span-1">
				<legend class="fieldset-legend text-xs">Reference no.</legend>
				<input
					type="search"
					name="search"
					class="input input-sm w-full"
					placeholder="INC2026-…"
					value={applied.search}
				/>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend text-xs">Period from</legend>
				<input
					type="date"
					name="date_from"
					class="input input-sm w-full"
					value={applied.date_from}
				/>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend text-xs">Period to</legend>
				<input type="date" name="date_to" class="input input-sm w-full" value={applied.date_to} />
			</fieldset>
			{#if list.scope === 'all'}
				<MultiSelect
					name="enforcement_group"
					label="Enforcement group"
					all_label="All groups"
					options={group_options}
					selected={applied.enforcement_group}
				/>
			{/if}
			<MultiSelect
				name="status"
				label="Status"
				all_label="All statuses"
				options={status_options}
				selected={applied.status}
			/>
		</div>
		<input type="hidden" name="page" value="1" />
		<input type="hidden" name="size" value="10" />
		<div class="flex justify-end gap-2">
			<a href={resolve('/u/incentives')} class="btn gap-1 btn-ghost btn-sm">
				<RotateCcw class="size-3.5" /> Reset
			</a>
			<button type="submit" class="btn btn-sm btn-primary">Apply filters</button>
		</div>
	</form>

	{#if scopeNote[list.scope]}
		<p class="px-6 text-xs text-base-content/60">{scopeNote[list.scope]}</p>
	{/if}

	<Table>
		{#snippet table_header()}
			<th>Reference no.</th>
			<th>Period</th>
			<th class="hidden md:table-cell">Groups</th>
			<th class="text-right">Tickets</th>
			<th class="text-right">Incentive</th>
			<th class="hidden lg:table-cell">Generated</th>
			<th>Status</th>
		{/snippet}

		{#snippet table_body()}
			{#each list.rows as r (r._id)}
				<tr class={['hover:bg-base-200/50', r.status === 'voided' && 'text-base-content/50']}>
					<td>
						<a
							class="link font-mono font-medium link-hover"
							href={resolve('/u/incentives/[id]', { id: r._id })}>{r.reference_no}</a
						>
					</td>
					<td class="whitespace-nowrap">
						{formatDate(r.period.from)} – {formatDate(r.period.to)}
					</td>
					<td class="hidden max-w-64 truncate md:table-cell" title={r.group_names.join(', ')}>
						{r.group_names.join(', ') || '—'}
					</td>
					<td class="text-right">{r.totals.ticket_count.toLocaleString('en-PH')}</td>
					<td class="text-right font-medium">{peso.format(r.totals.incentive_amount)}</td>
					<td class="hidden lg:table-cell">
						{formatDate(r.created_at)}
						<span class="block text-xs text-base-content/60">{r.generated_by_name}</span>
					</td>
					<td>
						{#if r.status === 'voided'}
							<span class="badge badge-ghost badge-sm">Voided</span>
						{:else}
							<span class="badge badge-soft badge-sm badge-success">Generated</span>
						{/if}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="7" class="py-10 text-center text-base-content/60">
						No incentive reports yet.
						<Can
							permissions={data.user.user_type.permissions}
							action={Permission.Actions.CREATE}
							route="incentives"
						>
							<a class="link" href={resolve('/u/incentives/generate')}>Generate one</a>
						</Can>
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
</div>

<Pagination total={list.total} />
