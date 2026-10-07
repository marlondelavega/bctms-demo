<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		issuance_status_data,
		issuance_status_select,
		issuance_status_swatch
	} from '$lib/data/static_data';
	import MultiSelect from '$lib/ui/components/input/MultiSelect.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { parseName } from '$lib/utilities/helper';
	import IssuanceReportPrint from './IssuanceReportPrint.svelte';
	import { CircleAlert, FileBarChart2, Printer, Receipt, RotateCcw, X } from '@lucide/svelte';
	import { hrefToggle, hrefWithout, summarizeChips } from '$lib/utilities/filter_links';

	let { data } = $props();

	const report = $derived(data.report);
	const options = $derived(data.filter_options);
	const applied = $derived(data.applied);

	const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
	const count = (v: number) => v.toLocaleString('en-PH');
	const formatDate = (date: string) =>
		new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

	const statusOf = (value: number) => issuance_status_data.find((s) => s.value === value);

	const scopeLabels: Record<string, string> = {
		own: 'Your issuances',
		office: 'Your office',
		all: 'All offices'
	};
	const scopeLabel = $derived(scopeLabels[report.scope]);

	// ---- filter options, in the { value, label } shape the multi-select takes -----------------
	const status_options = issuance_status_select.map((s) => ({
		value: String(s.value),
		label: s.label
	}));
	const group_options = $derived(
		options.enforcement_groups.map((g) => ({ value: g._id, label: g.name }))
	);
	const issuer_options = $derived(
		options.issuers.map((u) => ({ value: u._id, label: `${u.lastname}, ${u.firstname}` }))
	);
	const category_options = $derived(
		options.violation_categories.map((c) => ({ value: c._id, label: c.name }))
	);
	const provision_options = $derived(
		options.code_provisions.map((c) => ({
			value: c._id,
			label: `${c.code} — ${c.description.slice(0, 60)}`
		}))
	);

	// ---- applied filters, shown as removable chips and repeated on the printout ---------------
	type Chip = { key: string; value?: string; group: string; text: string };

	const chips = $derived.by(() => {
		const out: Chip[] = [];
		const from = (key: string, group: string, values: string[], text: (v: string) => string) =>
			values.forEach((v) => out.push({ key, value: v, group, text: text(v) }));

		from('status', 'Status', applied.status, (v) => statusOf(Number(v))?.label ?? v);
		from('enforcement_group', 'Group', applied.enforcement_group, (v) => nameIn(group_options, v));
		from('issuer', 'Issuer', applied.issuer, (v) => nameIn(issuer_options, v));
		from('violation_category', 'Category', applied.violation_category, (v) =>
			nameIn(category_options, v)
		);
		from('code_provision', 'Violation', applied.code_provision, (v) =>
			nameIn(provision_options, v)
		);
		if (applied.barangay) out.push({ key: 'barangay', group: 'Barangay', text: applied.barangay });
		return out;
	});

	const nameIn = (list: { value: string; label: string }[], v: string) =>
		list.find((o) => o.value === v)?.label ?? 'Unknown';

	const printFilters = $derived(summarizeChips(chips));
	const period = $derived(`${formatDate(applied.date_from)} – ${formatDate(applied.date_to)}`);
	const prepared_by = $derived({
		name: parseName(data.user),
		role: [data.user.user_type?.user_type, data.user.enforcement_group?.name]
			.filter(Boolean)
			.join(', ')
	});

	// share of the current result, for the status bars
	const share = (n: number) =>
		report.summary.ticket_count ? (n / report.summary.ticket_count) * 100 : 0;
</script>

<Header title="Reports">
	{#snippet PropFilter()}{/snippet}
	{#snippet AddButtons()}
		<button type="button" class="btn gap-1 btn-sm btn-primary" onclick={() => window.print()}>
			<Printer class="size-4" /> Print
		</button>
	{/snippet}
</Header>

<div class="flex min-h-0 w-full grow flex-col gap-4 overflow-auto p-4 print:hidden">
	<div class="tabs tabs-box w-fit">
		<a href={resolve('/u/reports')} class="tab gap-1.5 tab-active" aria-current="page">
			<FileBarChart2 class="size-3.5" /> Issuances
		</a>
		<a href={resolve('/u/reports/payments')} class="tab gap-1.5">
			<Receipt class="size-3.5" /> Payments
		</a>
	</div>

	<!-- filters -->
	<form method="GET" class="flex flex-col gap-3 rounded-box border border-base-300 p-4">
		<div class="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
			<fieldset class="fieldset">
				<legend class="fieldset-legend text-xs">From</legend>
				<input
					type="date"
					name="date_from"
					class="input input-sm w-full"
					value={applied.date_from}
				/>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend text-xs">To</legend>
				<input type="date" name="date_to" class="input input-sm w-full" value={applied.date_to} />
			</fieldset>
			<MultiSelect
				name="status"
				label="Status"
				all_label="All statuses"
				options={status_options}
				selected={applied.status}
			/>
			<fieldset class="fieldset">
				<legend class="fieldset-legend text-xs">Barangay</legend>
				<input
					type="text"
					name="barangay"
					class="input input-sm w-full"
					placeholder="e.g. Poblacion"
					value={applied.barangay}
				/>
			</fieldset>
			<MultiSelect
				name="enforcement_group"
				label="Enforcement group"
				all_label="All groups"
				options={group_options}
				selected={applied.enforcement_group}
			/>
			<MultiSelect
				name="issuer"
				label="Issuer"
				all_label="All issuers"
				options={issuer_options}
				selected={applied.issuer}
			/>
			<MultiSelect
				name="violation_category"
				label="Violation category"
				all_label="All categories"
				options={category_options}
				selected={applied.violation_category}
			/>
			<MultiSelect
				name="code_provision"
				label="Specific violation"
				all_label="All violations"
				options={provision_options}
				selected={applied.code_provision}
				searchable
			/>
		</div>

		<div class="flex justify-end gap-2">
			<a href={resolve('/u/reports')} class="btn gap-1 btn-ghost btn-sm">
				<RotateCcw class="size-3.5" /> Reset
			</a>
			<button type="submit" class="btn btn-sm btn-primary">Apply filters</button>
		</div>
	</form>

	{#if chips.length}
		<ul class="flex flex-wrap items-center gap-1.5" aria-label="Applied filters">
			{#each chips as c (c.key + (c.value ?? ''))}
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

	<!-- summary -->
	<dl
		class="grid grid-cols-1 divide-y divide-base-300 rounded-box border border-base-300 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
	>
		<div class="flex flex-col gap-0.5 px-4 py-3">
			<dt class="text-xs text-base-content/60">Tickets issued</dt>
			<dd class="text-xl font-semibold tabular-nums">{count(report.summary.ticket_count)}</dd>
		</div>
		<div class="flex flex-col gap-0.5 px-4 py-3">
			<dt class="text-xs text-base-content/60">Violations recorded</dt>
			<dd class="text-xl font-semibold tabular-nums">{count(report.summary.violation_count)}</dd>
		</div>
		<div class="flex flex-col gap-0.5 px-4 py-3">
			<dt class="text-xs text-base-content/60">Total pecuniary amount</dt>
			<dd class="text-xl font-semibold tabular-nums">{peso.format(report.summary.total_amount)}</dd>
		</div>
	</dl>

	<!-- breakdowns -->
	<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
		<section class="flex flex-col gap-2 rounded-box border border-base-300 p-4">
			<h2 class="text-sm font-semibold">By status</h2>
			{#if report.by_status.length}
				<ul class="flex flex-col text-xs">
					{#each [...report.by_status].sort((a, b) => a._id - b._id) as s (s._id)}
						{@const info = statusOf(s._id)}
						{@const active = applied.status.includes(String(s._id))}
						<li>
							<a
								class={[
									'flex flex-col gap-1 rounded-field px-2 py-1.5 hover:bg-base-200',
									active && 'bg-base-200'
								]}
								href={hrefToggle(page.url, 'status', String(s._id))}
								aria-current={active ? 'true' : undefined}
								title={active
									? 'Remove this status from the filter'
									: 'Add this status to the filter'}
							>
								<span class="flex items-center justify-between gap-2">
									<span class="flex items-center gap-1.5">
										<span class={['size-2 rounded-full', issuance_status_swatch[s._id]]}></span>
										{info?.label ?? 'Unknown'}
									</span>
									<span class="font-semibold tabular-nums">{count(s.count)}</span>
								</span>
								<span class="h-1 w-full overflow-hidden rounded-full bg-base-300">
									<span
										class={['block h-full rounded-full', issuance_status_swatch[s._id]]}
										style={`width: ${share(s.count)}%`}
									></span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-xs text-base-content/60">No data for this period.</p>
			{/if}
		</section>

		<section class="flex flex-col gap-2 rounded-box border border-base-300 p-4">
			<h2 class="text-sm font-semibold">Top barangays</h2>
			{#if report.by_barangay.length}
				<ul class="flex flex-col gap-1.5 text-xs">
					{#each report.by_barangay as b (b._id)}
						<li class="flex items-center justify-between gap-2">
							<span class="truncate">{b._id || 'Unspecified'}</span>
							<span class="font-semibold tabular-nums">{count(b.count)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-xs text-base-content/60">No data for this period.</p>
			{/if}
		</section>

		<section class="flex flex-col gap-2 rounded-box border border-base-300 p-4">
			<h2 class="text-sm font-semibold">By violation category</h2>
			{#if report.by_category.length}
				<ul class="flex flex-col gap-1.5 text-xs">
					{#each report.by_category as c (c._id)}
						<li class="flex items-center justify-between gap-2">
							<span class="truncate">{c._id || 'Unspecified'}</span>
							<span class="font-semibold whitespace-nowrap tabular-nums">
								{count(c.count)} · {peso.format(c.amount)}
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-xs text-base-content/60">No data for this period.</p>
			{/if}
		</section>

		{#if report.scope !== 'own'}
			<section class="flex flex-col gap-2 rounded-box border border-base-300 p-4">
				<h2 class="text-sm font-semibold">Top issuers</h2>
				{#if report.by_issuer.length}
					<ul class="flex flex-col gap-1.5 text-xs">
						{#each report.by_issuer as i (i._id)}
							<li class="flex items-center justify-between gap-2">
								<span class="truncate">{i.name || 'Unknown'}</span>
								<span class="font-semibold tabular-nums">{count(i.count)}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-xs text-base-content/60">No data for this period.</p>
				{/if}
			</section>
		{/if}
	</div>

	{#if report.truncated}
		<div class="flex items-center gap-2 rounded-field bg-warning/10 p-3 text-xs">
			<CircleAlert class="size-4 shrink-0 text-warning" />
			Showing the first {count(report.max_rows)} of {count(report.total)} matching tickets. Narrow the
			filters to see the rest.
		</div>
	{/if}

	<!-- row list -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-semibold">
			Tickets
			<span class="font-normal text-base-content/60">
				· {count(report.rows.length)}{report.truncated ? ` of ${count(report.total)}` : ''}
			</span>
		</h2>
		<div class="overflow-x-auto rounded-box border border-base-300">
			<table class="table-pin-rows table table-sm">
				<thead>
					<tr class="text-xs">
						<th>Tracking code</th>
						<th>Date</th>
						<th>Barangay</th>
						<th>Violator</th>
						<th>Issuer</th>
						<th>Violations</th>
						<th class="text-right">Amount</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody class="text-xs">
					{#each report.rows as r (r._id)}
						{@const status = statusOf(r.status)}
						<tr class="hover:bg-base-200/50">
							<td class="font-mono font-medium whitespace-nowrap">
								<a class="link link-hover" href={resolve(`/u/issuance/${r._id}/status`)}>
									{r.tracking_code}
								</a>
							</td>
							<td class="whitespace-nowrap">{formatDate(r.apprehension_date)}</td>
							<td>{r.apprehension_barangay || '—'}</td>
							<td>{r.recipient_name || '—'}</td>
							<td>{r.issuer_name || '—'}</td>
							<td>{r.codes.join(', ')}</td>
							<td class="text-right tabular-nums">{peso.format(r.amount)}</td>
							<td>
								<span class="badge badge-soft badge-xs {status?.badge_color}">
									{status?.label ?? 'Unknown'}
								</span>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="8" class="py-8 text-center text-base-content/60">
								No tickets match the selected filters.
								{#if chips.length}
									<a class="link" href={resolve('/u/reports')}>Reset filters</a>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

<IssuanceReportPrint {report} {period} coverage={scopeLabel} filters={printFilters} {prepared_by} />
