<script lang="ts">
	import lgu_seal from '$lib/assets/lgu_seal.svg';
	import { lgu } from '$lib/data/lgu';
	import { issuance_status_data, issuance_status_swatch } from '$lib/data/static_data.js';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { date, parseName } from '$lib/utilities/helper.js';
	import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod.js';
	import type TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod';
	import type Ticket from '$lib/validation_schemas/Tickets.zod.js';
	import type User from '$lib/validation_schemas/Users.zod.js';
	import {
		ArrowLeft,
		Lock,
		NotepadText,
		Printer,
		Ticket as TicketIcon,
		User as UserIcon,
		X
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';

	const { data } = $props();
	const ticket: Ticket.Base<EnforcementGroup.Base, User.Base, User.Base> = $derived(data.ticket);

	type AssignmentRow = TicketAssignment.Base<User.Base, Ticket.Base, User.Base> & {
		is_locked?: boolean;
	};
	const assignments: AssignmentRow[] = $derived(data.ticket_assignments);

	const series_rows: Ticket.SeriesRow[] = $derived(data.series_row);

	const sorted_assignments = $derived(
		[...assignments].sort((a, b) => a.series_from - b.series_from)
	);

	let total_tickets = $derived(ticket?._id ? ticket.ticket_num_to - ticket.ticket_num_from + 1 : 0);

	type PadGroup =
		| {
				kind: 'assignment';
				assignment: AssignmentRow;
				from: number;
				to: number;
				tickets: Ticket.SeriesRow[];
		  }
		| { kind: 'gap'; from: number; to: number; tickets: Ticket.SeriesRow[] };

	let pad_groups: PadGroup[] = $derived.by(() => {
		if (!ticket?._id) return [];

		const rows_by_series = new Map(series_rows.map((r) => [r.series, r]));
		const rangeRows = (from: number, to: number) => {
			const out: Ticket.SeriesRow[] = [];
			for (let s = from; s <= to; s++) {
				const row = rows_by_series.get(s);
				if (row) out.push(row);
			}
			return out;
		};

		const groups: PadGroup[] = [];
		let cursor = ticket.ticket_num_from;

		for (const a of sorted_assignments) {
			if (a.series_from > cursor) {
				groups.push({
					kind: 'gap',
					from: cursor,
					to: a.series_from - 1,
					tickets: rangeRows(cursor, a.series_from - 1)
				});
			}
			groups.push({
				kind: 'assignment',
				assignment: a,
				from: a.series_from,
				to: a.series_to,
				tickets: rangeRows(a.series_from, a.series_to)
			});
			cursor = Math.max(cursor, a.series_to + 1);
		}
		if (cursor <= ticket.ticket_num_to) {
			groups.push({
				kind: 'gap',
				from: cursor,
				to: ticket.ticket_num_to,
				tickets: rangeRows(cursor, ticket.ticket_num_to)
			});
		}
		return groups;
	});

	// ---- Summary -------------------------------------------------------------------------
	// Each series number lands in exactly one bucket: an issuance status, "not issued"
	// (assigned but unused so far) or "unassigned". Filed Case / Case Closed share a hue with
	// Issued / Paid in the status palette, so the bar tints them lighter to keep segments apart.
	type FilterKey = number | 'not_issued' | 'unassigned';
	type Bucket = { key: FilterKey; label: string; count: number; swatch: string };

	const summary = $derived.by(() => {
		const by_status = new SvelteMap<number, number>();
		let not_issued = 0;
		let unassigned = 0;
		for (const r of series_rows) {
			if (!r.assignment) unassigned++;
			else if (!r.issuance) not_issued++;
			else by_status.set(r.issuance.status, (by_status.get(r.issuance.status) ?? 0) + 1);
		}

		const buckets: Bucket[] = [
			...issuance_status_data.map((st) => ({
				key: st.value as FilterKey,
				label: st.label,
				count: by_status.get(st.value) ?? 0,
				swatch: issuance_status_swatch[st.value] ?? st.dot_color
			})),
			{ key: 'not_issued', label: 'Not issued', count: not_issued, swatch: 'bg-base-content/25' },
			{ key: 'unassigned', label: 'Unassigned', count: unassigned, swatch: 'bg-error/30' }
		];

		return {
			buckets,
			issued_total: series_rows.length - not_issued - unassigned,
			total: series_rows.length
		};
	});

	const pct = (n: number) => (summary.total ? Math.round((n / summary.total) * 100) : 0);

	// ---- Filter --------------------------------------------------------------------------
	let filter = $state<FilterKey | null>(null);

	const rowMatches = (r: Ticket.SeriesRow) => {
		if (filter === null) return true;
		if (filter === 'unassigned') return !r.assignment;
		if (filter === 'not_issued') return !!r.assignment && !r.issuance;
		return r.issuance?.status === filter;
	};

	const filter_label = $derived(
		filter === null ? '' : (summary.buckets.find((b) => b.key === filter)?.label ?? '')
	);

	const filtered_rows = $derived(series_rows.filter(rowMatches));

	// Pad view keeps pad order and drops pads with no matching ticket. Unassigned gaps only
	// survive when nothing is filtered, or the filter is "Unassigned".
	// `idx` is the group's position in pad_groups: it is the unique key and the `#pad-N` anchor
	// (two assignments, e.g. an inactive one, can share the same series_from).
	const visible_groups = $derived.by(() => {
		const indexed = pad_groups.map((g, idx) => ({ ...g, idx }));
		if (filter === null) return indexed;
		return indexed
			.map((g) => ({ ...g, tickets: g.tickets.filter(rowMatches) }))
			.filter((g) => (g.kind === 'gap' ? filter === 'unassigned' : g.tickets.length > 0));
	});

	function pickFilter(key: FilterKey) {
		filter = filter === key ? null : key;
		if (filter !== null && view === 1) view = 2;
	}

	let view: 1 | 2 | 3 = $state(3);

	let ticket_exists = $derived(!!ticket?._id);

	let hoveredIndex = $state<number | null>(null);
	let hoveredGroup = $derived(hoveredIndex !== null ? pad_groups[hoveredIndex] : null);

	const views = $derived([
		{ value: 1 as const, label: 'By assignment', icon: UserIcon, count: sorted_assignments.length },
		{ value: 2 as const, label: 'By ticket', icon: TicketIcon, count: summary.total },
		{
			value: 3 as const,
			label: 'By pad',
			icon: NotepadText,
			count: pad_groups.filter((g) => g.kind === 'assignment').length
		}
	]);
</script>

{#snippet statusBadge(row: Ticket.SeriesRow)}
	{#if row.issuance}
		{@const st = issuance_status_data.find((s) => s.value === row.issuance?.status)}
		<span class={['badge truncate badge-sm', st?.badge_color]}>{st?.label ?? 'Unknown'}</span>
	{:else if row.assignment}
		<span class="badge truncate badge-ghost badge-sm">Not issued</span>
	{/if}
{/snippet}

{#snippet assignmentHead(a: AssignmentRow, prefix: string)}
	<div class="flex min-w-0 flex-row flex-wrap items-center gap-x-3 gap-y-1">
		<span class="font-mono text-sm font-semibold tabular-nums"
			>{prefix}{a.series_from} – {a.series_to}</span
		>
		<span class="truncate text-sm text-base-content/70">{parseName(a.user)}</span>
		{#if a.status === 1}
			<span class="badge badge-ghost badge-xs">Inactive</span>
		{/if}
		{#if a.is_locked}
			<span class="badge flex items-center gap-1 badge-error badge-xs">
				<Lock class="size-2.5" /> Locked
			</span>
		{/if}
	</div>
	<span class="shrink-0 text-xs text-base-content/60">
		{date.formatDate({ date: a.date_assigned, format: 'MMM dd' })}
	</span>
{/snippet}

{#snippet ticketTable(rows: Ticket.SeriesRow[], mode: 'all' | 'pad', size: 'sm' | 'xs')}
	<table
		class={[
			'table-pin-rows table-pin-cols table tabular-nums',
			size === 'xs' ? 'table-xs' : 'table-sm'
		]}
	>
		<thead class="text-xs">
			<tr>
				<th>Series</th>
				{#if mode === 'all'}<td>Assigned to</td>{/if}
				<td>Status</td>
				<td>Recipient</td>
				<td>Issuer</td>
				{#if mode === 'pad'}<td>Issued on</td>{/if}
				<td>Violations</td>
			</tr>
		</thead>
		<tbody>
			{#each rows as s (s.series)}
				{#if mode === 'all' && !s.assignment}
					<tr class="text-base-content/50">
						<th class="text-center font-mono">#{s.series}</th>
						<td colspan="5" class="text-center">Unassigned</td>
					</tr>
				{:else}
					<tr>
						<th class="text-center font-mono">#{s.series}</th>
						{#if mode === 'all'}<td>{s.assignment ? parseName(s.assignment.user) : ''}</td>{/if}
						<td>{@render statusBadge(s)}</td>
						<td>{s.issuance ? parseName(s.issuance.recipient) : ''}</td>
						<td>{s.issuance ? parseName(s.issuance.issuer) : ''}</td>
						{#if mode === 'pad'}
							<td>
								{s.issuance
									? date.formatDate({ date: s.issuance.apprehension_date, format: 'MMM dd, yyyy' })
									: ''}
							</td>
						{/if}
						<td>{s.issuance ? s.issuance.violations.length : ''}</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
{/snippet}

{#snippet emptyFilter()}
	<div class="flex flex-col items-start gap-2 py-6 text-sm">
		<p>No tickets are marked “{filter_label}”.</p>
		<button class="btn btn-ghost btn-xs" onclick={() => (filter = null)}>Show all tickets</button>
	</div>
{/snippet}

<Header title="Ticket Liquidation" />

{#if !ticket_exists}
	<div class="flex w-full grow flex-col items-center justify-center gap-2 p-8">
		<p class="text-lg font-semibold">Ticket not found</p>
		<p class="text-sm text-base-content/60">
			This ticket may have been deleted, or the link is no longer valid.
		</p>
		<a class="btn mt-2 btn-ghost btn-sm" href={resolve('/u/ticket-liquidation')}>
			<ArrowLeft class="size-4" /> Back to ticket liquidation
		</a>
	</div>
{:else}
	<div
		class="flex min-h-0 w-full grow flex-col items-start justify-start gap-4 overflow-y-auto md:flex-row md:overflow-hidden md:p-4 print:hidden print:overflow-visible"
	>
		<!-- Left: what this ticket is, where it stands, how its numbers are laid out -->
		<div
			class="flex h-fit w-full grow flex-col gap-4 overflow-clip md:h-full md:min-h-0 md:max-w-120 md:overflow-auto"
		>
			<section class="card gap-4 rounded-xl bg-base-200 px-6 py-5">
				<div class="flex flex-row items-start justify-between gap-4">
					<div class="min-w-0">
						<a
							class="mb-2 inline-flex items-center gap-1 text-xs text-base-content/60 hover:text-base-content"
							href={resolve('/u/ticket-liquidation')}
						>
							<ArrowLeft class="size-3" /> All tickets
						</a>
						<h1 class="truncate font-mono text-lg font-semibold">{ticket.name}</h1>
						<p class="text-sm text-base-content/70">{ticket.ticket_for.name}</p>
					</div>
					<div class="shrink-0 text-right">
						<p class="text-xs text-base-content/60">Series</p>
						<p class="font-mono font-semibold tabular-nums">
							{ticket.ticket_num_from} – {ticket.ticket_num_to}
						</p>
					</div>
				</div>

				<dl class="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-base-300 pt-4 text-sm">
					<div>
						<dt class="text-xs text-base-content/60">Date created</dt>
						<dd>{date.formatDate({ date: ticket.date_created, format: 'MMMM dd, yyyy' })}</dd>
					</div>
					<div>
						<dt class="text-xs text-base-content/60">Date withdrawn</dt>
						<dd>{date.formatDate({ date: ticket.date_withdrawn, format: 'MMMM dd, yyyy' })}</dd>
					</div>
					<div class="col-span-2">
						<dt class="text-xs text-base-content/60">In-charge</dt>
						<dd>{parseName(ticket.in_charge)}</dd>
					</div>
				</dl>
			</section>

			<section class="card gap-4 rounded-xl bg-base-200 px-6 py-5" aria-labelledby="summary-h">
				<div class="flex flex-row items-baseline justify-between gap-3">
					<h2 id="summary-h" class="font-semibold">Ticket summary</h2>
					<p class="text-sm text-base-content/70 tabular-nums">
						<span class="font-semibold text-base-content">{summary.issued_total}</span>
						of {summary.total} issued
						<span class="text-base-content/50">({pct(summary.issued_total)}%)</span>
					</p>
				</div>

				<!-- Every series number, colored by where it stands -->
				<div
					class="summary-bar flex h-3 w-full gap-px overflow-hidden rounded-full bg-base-300"
					role="img"
					aria-label={summary.buckets
						.filter((b) => b.count)
						.map((b) => `${b.count} ${b.label}`)
						.join(', ')}
				>
					{#each summary.buckets as b (b.key)}
						{#if b.count}
							<div class={b.swatch} style={`flex: ${b.count} 1 0;`}></div>
						{/if}
					{/each}
				</div>

				<ul class="flex flex-col">
					{#each summary.buckets as b (b.key)}
						<li>
							<button
								type="button"
								class={[
									'group flex w-full flex-row items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
									'hover:bg-base-300 focus-visible:outline-2 focus-visible:outline-primary',
									filter === b.key && 'bg-base-300',
									!b.count && 'opacity-50'
								]}
								aria-pressed={filter === b.key}
								disabled={!b.count}
								onclick={() => pickFilter(b.key)}
							>
								<span class={['size-2.5 shrink-0 rounded-full', b.swatch]}></span>
								<span class="grow">{b.label}</span>
								<span class="text-xs text-base-content/50 tabular-nums">{pct(b.count)}%</span>
								<span class="w-10 text-right font-semibold tabular-nums">{b.count}</span>
							</button>
						</li>
					{/each}
				</ul>
				<p class="text-xs text-base-content/60">Select a row to filter the ticket list to it.</p>
			</section>

			<section class="card gap-3 rounded-xl bg-base-200 px-6 py-5" aria-labelledby="pads-h">
				<h2 id="pads-h" class="font-semibold">Pad layout</h2>
				<div
					class="flex max-h-120 min-h-7 w-full flex-row flex-wrap gap-1 overflow-auto rounded-lg bg-neutral p-1 text-xs font-semibold"
				>
					{#each pad_groups as g, i (i)}
						{@const size = g.to - g.from + 1}
						<a
							class={[
								'flex h-12 min-w-18 cursor-pointer items-center justify-center rounded-sm p-2 tabular-nums transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
								g.kind === 'assignment' ? 'bg-primary text-primary-content' : 'bg-base-300'
							]}
							href={`#pad-${i}`}
							onclick={() => (view = 3)}
							style={`anchor-name: --pad-${i}; width: ${(size / total_tickets) * 100}%;`}
							onpointerenter={() => (hoveredIndex = i)}
							onpointerleave={() => (hoveredIndex = null)}
						>
							<span class="block w-full truncate text-center">
								{g.kind === 'assignment' ? `${g.from} – ${g.to}` : 'Not allocated'}
							</span>
						</a>
					{/each}
				</div>
			</section>
		</div>

		<!-- Right: the ledger -->
		<div
			class="card flex h-fit w-full grow flex-col gap-4 overflow-clip bg-base-200 px-6 py-5 md:h-full md:max-h-full md:min-h-0 md:max-w-[54rem] md:overflow-auto"
		>
			<div class="flex flex-row flex-wrap items-center justify-between gap-3">
				<div role="tablist" class="tabs-box tabs tabs-sm">
					{#each views as v (v.value)}
						<button
							type="button"
							role="tab"
							aria-selected={view === v.value}
							class={['tab gap-1.5', view === v.value && 'tab-active']}
							onclick={() => (view = v.value)}
						>
							<v.icon class="size-4" />
							{v.label}
							<span class="text-xs opacity-60 tabular-nums">{v.count}</span>
						</button>
					{/each}
				</div>

				<div class="flex flex-row items-center gap-2">
					{#if filter !== null}
						<button
							type="button"
							class="badge gap-1 badge-outline badge-md"
							onclick={() => (filter = null)}
							aria-label={`Clear filter: ${filter_label}`}
						>
							{filter_label}
							<X class="size-3" />
						</button>
					{/if}
					<button class="btn btn-sm btn-primary" onclick={() => window.print()}>
						<Printer class="size-4" /> Print
					</button>
				</div>
			</div>

			{#key view}
				{#if view == 1}
					<h2 class="text-sm font-semibold">Assignments</h2>
					{#if sorted_assignments.length > 0}
						<ul class="flex flex-col gap-2">
							{#each sorted_assignments as a (a._id)}
								<li
									class="flex w-full flex-row items-center justify-between gap-3 rounded-lg bg-base-300 px-4 py-2.5"
								>
									{@render assignmentHead(a, '#')}
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-base-content/70">No assignments yet.</p>
					{/if}
				{/if}

				{#if view == 2}
					<h2 class="text-sm font-semibold">
						Tickets
						{#if filter !== null}
							<span class="font-normal text-base-content/60">
								· {filtered_rows.length} of {summary.total}
							</span>
						{/if}
					</h2>
					{#if filtered_rows.length}
						<div class="min-h-0 w-full grow overflow-auto">
							{@render ticketTable(filtered_rows, 'all', 'sm')}
						</div>
					{:else}
						{@render emptyFilter()}
					{/if}
				{/if}

				{#if view == 3}
					<h2 class="text-sm font-semibold">Pads</h2>

					{#if visible_groups.length > 0}
						<div class="flex flex-col divide-y divide-base-300">
							{#each visible_groups as g (g.idx)}
								{@const i = g.idx}
								{#if g.kind === 'assignment'}
									<div class="flex scroll-mt-2 flex-col gap-2 py-4 first:pt-0" id={`pad-${i}`}>
										<div class="flex w-full flex-row items-center justify-between gap-3">
											{@render assignmentHead(g.assignment, '#')}
										</div>
										<div class="max-h-96 min-h-0 w-full overflow-auto">
											{@render ticketTable(g.tickets, 'all', 'sm')}
										</div>
									</div>
								{:else}
									<div
										class="flex scroll-mt-2 flex-row items-center justify-between gap-3 py-3 text-sm font-semibold text-error"
										id={`pad-${i}`}
									>
										<span class="font-mono tabular-nums">#{g.from} – {g.to}</span>
										<span>
											{g.to - g.from + 1} unassigned ticket{g.to - g.from + 1 == 1 ? '' : 's'}
										</span>
									</div>
								{/if}
							{/each}
						</div>
					{:else if filter !== null}
						{@render emptyFilter()}
					{:else}
						<p class="text-sm text-base-content/70">No tickets assigned yet.</p>
					{/if}
				{/if}
			{/key}
		</div>
	</div>

	<!-- for print -->
	<div class="hidden w-full print:block">
		<div class="flex">
			<div class="flex w-full flex-row items-center gap-4">
				<div>
					{#await lgu_seal then seal}
						<img src={seal} alt="LGU Seal" class="h-16 w-16" />
					{/await}
				</div>
				<div class="leading-4">
					<h1 class="font-bold">{lgu.name}</h1>
					<p class="text-sm">{lgu.province}, Philippines</p>
				</div>
			</div>

			<div class="flex h-auto flex-col items-end justify-center leading-4">
				<p class="text-sm text-nowrap">CiteTicket - Citation Ticket Management System</p>
				<h1 class=" text-lg font-bold text-nowrap uppercase">Ticket Liquidation</h1>
			</div>
		</div>

		<div class="my-4 grid w-full grid-cols-2 gap-y-2 text-sm leading-4">
			<div>
				<span class="text-xs">Ticket</span>
				<p>{ticket.name}</p>
			</div>
			<div>
				<span class="text-xs">Series</span>
				<p>{ticket.ticket_num_from} – {ticket.ticket_num_to}</p>
			</div>
			<div>
				<span class="text-xs">Date created / withdrawn</span>
				<p>
					{date.formatDate({ date: ticket.date_created, format: 'MMMM dd, yyyy' })} /
					{date.formatDate({ date: ticket.date_withdrawn, format: 'MMMM dd, yyyy' })}
				</p>
			</div>
			<div>
				<span class="text-xs">In-charge</span>
				<p>{parseName(ticket.in_charge)}</p>
			</div>
			<div>
				<span class="text-xs">Ticket for</span>
				<p>{ticket.ticket_for.name}</p>
			</div>
		</div>

		<table class="table mb-4 table-xs tabular-nums">
			<thead>
				<tr>
					<th colspan={summary.buckets.length}>
						Summary — {summary.issued_total} of {summary.total} tickets issued
					</th>
				</tr>
				<tr class="text-xs">
					{#each summary.buckets as b (b.key)}<td>{b.label}</td>{/each}
				</tr>
			</thead>
			<tbody>
				<tr class="font-semibold">
					{#each summary.buckets as b (b.key)}<td>{b.count}</td>{/each}
				</tr>
			</tbody>
		</table>

		{#if filter !== null}
			<p class="mb-2 text-xs">Filtered to: {filter_label}</p>
		{/if}

		{#if view == 1}
			<h2 class="mb-1 text-xs font-bold">Assignments</h2>
			<ul class="flex flex-col gap-2">
				{#each sorted_assignments as a (a._id)}
					<li
						class="flex w-full flex-row items-center justify-between gap-3 border-b border-base-300 py-1"
					>
						{@render assignmentHead(a, '')}
					</li>
				{/each}
			</ul>
		{/if}

		{#if view == 2}
			<h2 class="mb-1 text-xs font-bold">Tickets</h2>
			{@render ticketTable(filtered_rows, 'all', 'xs')}
		{/if}

		{#if view == 3}
			<h2 class="mb-1 text-xs font-bold">Ticket liquidation - By ticket pad</h2>
			<div class="flex flex-col gap-4">
				{#each visible_groups as g (g.idx)}
					{#if g.kind === 'assignment'}
						<div class="flex flex-col gap-2">
							<div class="flex w-full flex-row items-center justify-between gap-3">
								{@render assignmentHead(g.assignment, '')}
							</div>
							{@render ticketTable(g.tickets, 'pad', 'xs')}
						</div>
					{:else}
						<div class="flex flex-row justify-between text-sm font-bold">
							<span>{g.from} – {g.to}</span>
							<span>{g.to - g.from + 1} unassigned ticket{g.to - g.from + 1 == 1 ? '' : 's'}</span>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/if}

{#if hoveredGroup}
	{@const g = hoveredGroup}
	{@const size = g.to - g.from + 1}

	<div
		class="hover-card card pointer-events-none w-64 border border-base-300 bg-base-100 p-3 text-xs shadow-xl"
		style={`position-anchor: --pad-${hoveredIndex};`}
	>
		<div class="card-body gap-1 p-0">
			<h3 class="text-sm font-bold">
				{g.kind === 'assignment' ? parseName(g.assignment.user) : 'Not allocated'}
			</h3>
			<div class="flex justify-between">
				<span class="opacity-60">Series range</span>
				<span class="font-mono">{g.from} – {g.to}</span>
			</div>
			<div class="flex justify-between">
				<span class="opacity-60">Total count</span>
				<span class="font-mono">{size}</span>
			</div>
			<div class="flex justify-between">
				<span class="opacity-60">Share from overall</span>
				<span class="font-mono">{((size / total_tickets) * 100).toFixed(1)}%</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.hover-card {
		position: fixed;
		z-index: 9999;

		/* default placement: centered above the anchor, 8px gap */
		position-area: top;
		position-try-fallbacks:
			flip-block,
			flip-inline,
			flip-block flip-inline;
		margin-bottom: 6px;

		/* keep it from touching the viewport edge when it does have to flip/shift */
		position-try-order: most-height;
		inset: auto;
	}

	/* The one authored moment: the summary bar draws in from the left on load. */
	@media (prefers-reduced-motion: no-preference) {
		.summary-bar {
			animation: bar-draw 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
			transform-origin: left;
		}
	}

	@keyframes bar-draw {
		from {
			clip-path: inset(0 100% 0 0 round 9999px);
		}
		to {
			clip-path: inset(0 0 0 0 round 9999px);
		}
	}
</style>
