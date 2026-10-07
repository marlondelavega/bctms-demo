<script lang="ts">
	import ReportPrintout from '$lib/ui/components/print/ReportPrintout.svelte';
	import { PAYMENT_METHODS } from '$lib/validation_schemas/Payments.zod';
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
	const methodLabel = (value: string) =>
		PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;

	const listed_amount = $derived(report.rows.reduce((sum, r) => sum + r.amount, 0));
</script>

<ReportPrintout title="Payment Report" {period} {coverage} {filters} {prepared_by}>
	<h2 class="rp-h2">Summary</h2>
	<dl class="rp-figures">
		<div>
			<dt>Payments recorded</dt>
			<dd>{count(report.summary.payment_count)}</dd>
		</div>
		<div>
			<dt>Total collected</dt>
			<dd>{peso.format(report.summary.total_amount)}</dd>
		</div>
	</dl>

	<div class="rp-columns">
		<section>
			<h2 class="rp-h2">By payment method</h2>
			<table class="rp-table">
				<thead>
					<tr>
						<th>Method</th>
						<th class="rp-num">Payments</th>
						<th class="rp-num">Amount</th>
					</tr>
				</thead>
				<tbody>
					{#each report.by_method as m (m._id)}
						<tr>
							<td>{methodLabel(m._id)}</td>
							<td class="rp-num">{count(m.count)}</td>
							<td class="rp-num">{peso.format(m.total)}</td>
						</tr>
					{:else}
						<tr><td colspan="3" class="rp-empty">No payments in this period.</td></tr>
					{/each}
					{#if report.by_method.length}
						<tr class="rp-total">
							<td>Total</td>
							<td class="rp-num">{count(report.summary.payment_count)}</td>
							<td class="rp-num">{peso.format(report.summary.total_amount)}</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</section>

		{#if report.scope !== 'own'}
			<section>
				<h2 class="rp-h2">
					Collectors <small>· top {report.by_user.length} by amount</small>
				</h2>
				<table class="rp-table">
					<thead>
						<tr>
							<th>Recorded by</th>
							<th class="rp-num">Payments</th>
							<th class="rp-num">Amount</th>
						</tr>
					</thead>
					<tbody>
						{#each report.by_user as u (u._id)}
							<tr>
								<td>{u.name || 'Unknown'}</td>
								<td class="rp-num">{count(u.count)}</td>
								<td class="rp-num">{peso.format(u.total)}</td>
							</tr>
						{:else}
							<tr><td colspan="3" class="rp-empty">No payments in this period.</td></tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	</div>

	{#if report.truncated}
		<p class="rp-notice">
			<strong>Partial list.</strong> The payment list below shows the {count(report.max_rows)} most recent
			of {count(report.total)} matching payments. The summary and breakdowns above cover all
			{count(report.total)}. Narrow the filters to print the complete list.
		</p>
	{/if}

	<h2 class="rp-h2">
		Payments <small
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
				<th>Method</th>
				<th>Reference no.</th>
				<th>Recorded by</th>
				<th class="rp-num">Amount</th>
			</tr>
		</thead>
		<tbody>
			{#each report.rows as r, index (r._id)}
				<tr>
					<td class="rp-index">{index + 1}</td>
					<td class="rp-code">{r.tracking_code}</td>
					<td class="rp-nowrap">{formatDate(r.payment_date)}</td>
					<td>{methodLabel(r.payment_method)}</td>
					<td>{r.reference_number || '—'}</td>
					<td>{r.recorded_by_name || '—'}</td>
					<td class="rp-num">{peso.format(r.amount)}</td>
				</tr>
			{:else}
				<tr><td colspan="7" class="rp-empty">No payments match the selected filters.</td></tr>
			{/each}
			{#if report.rows.length}
				<tr class="rp-total">
					<td></td>
					<td colspan="5">
						Total of {report.truncated ? 'the' : 'all'}
						{count(report.rows.length)} listed payments
					</td>
					<td class="rp-num">{peso.format(listed_amount)}</td>
				</tr>
			{/if}
		</tbody>
	</table>
</ReportPrintout>
