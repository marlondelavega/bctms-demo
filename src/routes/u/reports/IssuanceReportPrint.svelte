<script lang="ts">
	import { issuance_status_data } from '$lib/data/static_data';
	import ReportPrintout from '$lib/ui/components/print/ReportPrintout.svelte';
	import type { PageData } from './$types';

	let {
		report,
		period,
		coverage,
		filters,
		prepared_by
	}: {
		report: PageData['report'];
		period: string;
		coverage: string;
		filters: string;
		prepared_by: { name: string; role: string };
	} = $props();

	const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
	const count = (v: number) => v.toLocaleString('en-PH');
	const formatDate = (date: string) =>
		new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
	const statusLabel = (value: number) =>
		issuance_status_data.find((s) => s.value === value)?.label ?? 'Unknown';
	const percent = (n: number) =>
		report.summary.ticket_count ? `${((n / report.summary.ticket_count) * 100).toFixed(1)}%` : '—';

	const by_status = $derived([...report.by_status].sort((a, b) => a._id - b._id));
	const category_totals = $derived(
		report.by_category.reduce(
			(t, c) => ({ count: t.count + c.count, amount: t.amount + c.amount }),
			{ count: 0, amount: 0 }
		)
	);
	const listed_amount = $derived(report.rows.reduce((sum, r) => sum + r.amount, 0));
</script>

<ReportPrintout title="Issuance Report" {period} {coverage} {filters} {prepared_by}>
	<h2 class="rp-h2">Summary</h2>
	<dl class="rp-figures">
		<div>
			<dt>Tickets issued</dt>
			<dd>{count(report.summary.ticket_count)}</dd>
		</div>
		<div>
			<dt>Violations recorded</dt>
			<dd>{count(report.summary.violation_count)}</dd>
		</div>
		<div>
			<dt>Total pecuniary amount</dt>
			<dd>{peso.format(report.summary.total_amount)}</dd>
		</div>
	</dl>

	<div class="rp-columns">
		<section>
			<h2 class="rp-h2">By status</h2>
			<table class="rp-table">
				<thead>
					<tr>
						<th>Status</th>
						<th class="rp-num">Tickets</th>
						<th class="rp-num">Share</th>
					</tr>
				</thead>
				<tbody>
					{#each by_status as s (s._id)}
						<tr>
							<td>{statusLabel(s._id)}</td>
							<td class="rp-num">{count(s.count)}</td>
							<td class="rp-num">{percent(s.count)}</td>
						</tr>
					{:else}
						<tr><td colspan="3" class="rp-empty">No tickets in this period.</td></tr>
					{/each}
					{#if by_status.length}
						<tr class="rp-total">
							<td>Total</td>
							<td class="rp-num">{count(report.summary.ticket_count)}</td>
							<td class="rp-num">100%</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</section>

		<section>
			<h2 class="rp-h2">By violation category</h2>
			<table class="rp-table">
				<thead>
					<tr>
						<th>Category</th>
						<th class="rp-num">Violations</th>
						<th class="rp-num">Amount</th>
					</tr>
				</thead>
				<tbody>
					{#each report.by_category as c (c._id)}
						<tr>
							<td>{c._id || 'Unspecified'}</td>
							<td class="rp-num">{count(c.count)}</td>
							<td class="rp-num">{peso.format(c.amount)}</td>
						</tr>
					{:else}
						<tr><td colspan="3" class="rp-empty">No violations in this period.</td></tr>
					{/each}
					{#if report.by_category.length}
						<tr class="rp-total">
							<td>Total</td>
							<td class="rp-num">{count(category_totals.count)}</td>
							<td class="rp-num">{peso.format(category_totals.amount)}</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</section>

		<section>
			<h2 class="rp-h2">
				Barangays <small>· top {report.by_barangay.length} by tickets</small>
			</h2>
			<table class="rp-table">
				<thead>
					<tr>
						<th>Barangay</th>
						<th class="rp-num">Tickets</th>
						<th class="rp-num">Share</th>
					</tr>
				</thead>
				<tbody>
					{#each report.by_barangay as b (b._id)}
						<tr>
							<td>{b._id || 'Unspecified'}</td>
							<td class="rp-num">{count(b.count)}</td>
							<td class="rp-num">{percent(b.count)}</td>
						</tr>
					{:else}
						<tr><td colspan="3" class="rp-empty">No tickets in this period.</td></tr>
					{/each}
				</tbody>
			</table>
		</section>

		{#if report.scope !== 'own'}
			<section>
				<h2 class="rp-h2">
					Issuers <small>· top {report.by_issuer.length} by tickets</small>
				</h2>
				<table class="rp-table">
					<thead>
						<tr>
							<th>Issuer</th>
							<th class="rp-num">Tickets</th>
							<th class="rp-num">Share</th>
						</tr>
					</thead>
					<tbody>
						{#each report.by_issuer as i (i._id)}
							<tr>
								<td>{i.name || 'Unknown'}</td>
								<td class="rp-num">{count(i.count)}</td>
								<td class="rp-num">{percent(i.count)}</td>
							</tr>
						{:else}
							<tr><td colspan="3" class="rp-empty">No tickets in this period.</td></tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	</div>

	{#if report.truncated}
		<p class="rp-notice">
			<strong>Partial list.</strong> The ticket list below shows the {count(report.max_rows)} most recent
			of {count(report.total)} matching tickets. The summary and breakdowns above cover all
			{count(report.total)}. Narrow the filters to print the complete list.
		</p>
	{/if}

	<h2 class="rp-h2">
		Tickets <small
			>· {count(report.rows.length)}{report.truncated ? ` of ${count(report.total)}` : ''}, newest
			first</small
		>
	</h2>
	<table class="rp-table rp-list">
		<thead>
			<tr>
				<th class="rp-index">#</th>
				<th>Tracking code</th>
				<th>Date</th>
				<th>Barangay</th>
				<th>Violator</th>
				<th>Issuer</th>
				<th>Violations</th>
				<th class="rp-num">Amount</th>
				<th>Status</th>
			</tr>
		</thead>
		<tbody>
			{#each report.rows as r, index (r._id)}
				<tr>
					<td class="rp-index">{index + 1}</td>
					<td class="rp-code">{r.tracking_code}</td>
					<td class="rp-nowrap">{formatDate(r.apprehension_date)}</td>
					<td>{r.apprehension_barangay || '—'}</td>
					<td>{r.recipient_name || '—'}</td>
					<td>{r.issuer_name || '—'}</td>
					<td>{r.codes.join(', ')}</td>
					<td class="rp-num">{peso.format(r.amount)}</td>
					<td>{statusLabel(r.status)}</td>
				</tr>
			{:else}
				<tr><td colspan="9" class="rp-empty">No tickets match the selected filters.</td></tr>
			{/each}
			{#if report.rows.length}
				<tr class="rp-total">
					<td></td>
					<td colspan="6">
						Total of {report.truncated ? 'the' : 'all'}
						{count(report.rows.length)} listed tickets
					</td>
					<td class="rp-num">{peso.format(listed_amount)}</td>
					<td></td>
				</tr>
			{/if}
		</tbody>
	</table>
</ReportPrintout>
