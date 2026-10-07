<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { modules } from '$lib/store/modules';
	import MultiSelect from '$lib/ui/components/input/MultiSelect.svelte';
	import { hrefWithout } from '$lib/utilities/filter_links';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { date } from '$lib/utilities/helper';
	import { ChevronRight, RotateCcw, X } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';

	type LogRow = {
		_id: string;
		level: 'INFO' | 'NOTICE' | 'ERROR';
		type: string;
		message?: string;
		source: string;
		metadata?: unknown;
		affected_collection?: { collection_name: string; document_id: string[] };
		user?: {
			user_id: string;
			// rows written before the schema cleanup hold the full user document here
			user_data?: {
				name?: string;
				username?: string;
				user_type?: string;
				firstname?: string;
				lastname?: string;
			};
		};
		created_at: string;
	};

	let { data } = $props();

	const rows = $derived(data.logs.data as LogRow[]);
	const applied = $derived(data.applied);

	const expanded = new SvelteSet<string>();
	const toggle = (id: string) => (expanded.has(id) ? expanded.delete(id) : expanded.add(id));

	const levelBadge: Record<string, string> = {
		INFO: 'badge-info',
		NOTICE: 'badge-warning',
		ERROR: 'badge-error'
	};

	const typeBadge: Record<string, string> = {
		CREATE: 'badge-success',
		EDIT: 'badge-info',
		ARCHIVE: 'badge-warning',
		RESTORE: 'badge-accent',
		LOGIN: 'badge-primary',
		REQUEST: 'badge-neutral'
	};

	const legacyCollections: Record<string, string> = {
		enforcement_group: 'enforcement_groups',
		code_provision: 'code_provisions'
	};

	const moduleName = (collection?: string) => {
		if (!collection) return '—';
		const normalized = legacyCollections[collection] ?? collection;
		return (
			modules.find((m) => m.collection === normalized)?.name ?? normalized.replaceAll('_', ' ')
		);
	};

	const actorName = (log: LogRow) => {
		const u = log.user?.user_data;
		if (u?.name) return u.name;
		const legacy = [u?.firstname, u?.lastname].filter(Boolean).join(' ');
		return legacy || log.user?.user_id || 'System';
	};

	// ---- filter options, in the { value, label } shape the multi-select takes -----------------
	const level_options = $derived(data.levels.map((l) => ({ value: l, label: l })));
	const type_options = $derived(data.types.map((t) => ({ value: t, label: t })));
	const module_options = modules.map((m) => ({ value: m.collection, label: m.name }));

	// ---- applied filters, shown as removable chips ---------------------------------------------
	const chips = $derived([
		...applied.level.map((v) => ({ key: 'level', value: v, group: 'Level', text: v })),
		...applied.type.map((v) => ({ key: 'type', value: v, group: 'Action', text: v })),
		...applied.collection.map((v) => ({
			key: 'collection',
			value: v,
			group: 'Module',
			text: module_options.find((m) => m.value === v)?.label ?? v
		}))
	]);

	const scopeLabels: Record<string, string> = {
		own: 'Showing your activity only',
		office: "Showing your office's activity",
		all: 'Showing all activity'
	};
</script>

<Header title="Logs">
	{#snippet PropFilter()}{/snippet}
</Header>

<div class="flex min-h-0 w-full grow flex-col gap-4">
	<div class="p-4">
		<form method="GET" class="flex flex-col gap-3 rounded-box border border-base-300 p-4">
			<input type="hidden" name="page" value="1" />
			<input type="hidden" name="size" value={applied.size ?? 10} />

			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
				<fieldset class="fieldset col-span-2 sm:col-span-3 lg:col-span-2">
					<legend class="fieldset-legend text-xs">Keyword</legend>
					<input
						type="search"
						name="search"
						class="input input-sm w-full"
						placeholder="Message, source, or user"
						value={applied.search ?? ''}
					/>
				</fieldset>
				<MultiSelect
					name="level"
					label="Level"
					all_label="All levels"
					options={level_options}
					selected={applied.level}
				/>
				<MultiSelect
					name="type"
					label="Action"
					all_label="All actions"
					options={type_options}
					selected={applied.type}
				/>
				<div class="col-span-2 sm:col-span-1 lg:col-span-2">
					<MultiSelect
						name="collection"
						label="Module"
						all_label="All modules"
						options={module_options}
						selected={applied.collection}
						searchable
					/>
				</div>
				<fieldset class="fieldset">
					<legend class="fieldset-legend text-xs">From</legend>
					<input
						type="date"
						name="date_from"
						class="input input-sm w-full"
						value={applied.date_from ?? ''}
					/>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend text-xs">To</legend>
					<input
						type="date"
						name="date_to"
						class="input input-sm w-full"
						value={applied.date_to ?? ''}
					/>
				</fieldset>
			</div>

			<div class="flex flex-wrap items-center justify-between gap-2">
				<span class="text-xs text-base-content/60">{scopeLabels[data.logs.scope]}</span>
				<div class="flex gap-2">
					<a href={resolve('/u/logs?page=1&size=10')} class="btn gap-1 btn-ghost btn-sm">
						<RotateCcw class="size-3.5" /> Reset
					</a>
					<button type="submit" class="btn btn-sm btn-primary">Apply filters</button>
				</div>
			</div>
		</form>
	</div>

	{#if chips.length}
		<ul class="flex flex-wrap items-center gap-1.5" aria-label="Applied filters">
			{#each chips as c (c.key + c.value)}
				<li>
					<a
						class="badge gap-1 badge-outline badge-md hover:border-error hover:text-error"
						href={hrefWithout(page.url, c.key, c.value)}
						aria-label={`Remove filter ${c.group}: ${c.text}`}
					>
						<span class="text-base-content/60">{c.group}:</span>
						{c.text}
						<X class="size-3" />
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<Table>
		{#snippet table_header()}
			<th class="w-4"></th>
			<th>Date</th>
			<th>Level</th>
			<th>Action</th>
			<th>Module</th>
			<th>Message</th>
			<th>User</th>
		{/snippet}

		{#snippet table_body()}
			{#each rows as log (log._id)}
				{@const open = expanded.has(log._id)}
				<tr class="cursor-pointer text-xs hover:bg-base-200/50" onclick={() => toggle(log._id)}>
					<td>
						<ChevronRight
							class="size-3.5 text-base-content/50 transition-transform {open ? 'rotate-90' : ''}"
						/>
					</td>
					<td class="whitespace-nowrap">
						{date.formatDate({ date: log.created_at, format: 'MMM dd, yyyy hh:mm aa' })}
					</td>
					<td>
						<span class="badge badge-soft badge-xs {levelBadge[log.level]}">{log.level}</span>
					</td>
					<td>
						<span class="badge badge-soft badge-xs {typeBadge[log.type] ?? 'badge-neutral'}">
							{log.type}
						</span>
					</td>
					<td class="capitalize">{moduleName(log.affected_collection?.collection_name)}</td>
					<td class="first-letter:uppercase">{log.message || '—'}</td>
					<td>
						<div class="flex flex-col leading-tight">
							<span>{actorName(log)}</span>
							{#if log.user?.user_data?.username}
								<span class="text-[11px] text-base-content/50">@{log.user.user_data.username}</span>
							{/if}
						</div>
					</td>
				</tr>

				{#if open}
					<tr class="bg-base-200/40 text-xs">
						<td></td>
						<td colspan="6">
							<dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 py-1">
								<dt class="text-base-content/60">Source</dt>
								<dd>{log.source}</dd>

								{#if log.user?.user_data?.user_type}
									<dt class="text-base-content/60">User type</dt>
									<dd>{log.user.user_data.user_type}</dd>
								{/if}

								{#if log.affected_collection?.document_id?.length}
									<dt class="text-base-content/60">Record IDs</dt>
									<dd class="font-mono break-all">
										{log.affected_collection.document_id.join(', ')}
									</dd>
								{/if}

								{#if log.metadata}
									<dt class="text-base-content/60">Details</dt>
									<dd>
										<pre
											class="max-h-72 overflow-auto rounded-field bg-base-300/60 p-2 font-mono text-[11px] whitespace-pre-wrap">{JSON.stringify(
												log.metadata,
												null,
												2
											)}</pre>
									</dd>
								{/if}
							</dl>
						</td>
					</tr>
				{/if}
			{:else}
				<tr>
					<td colspan="7" class="py-8 text-center text-xs text-base-content/50">
						No logs match the selected filters.
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
</div>

<Pagination total={data.logs.total} />
