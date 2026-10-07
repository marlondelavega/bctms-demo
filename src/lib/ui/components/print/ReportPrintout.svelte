<script lang="ts">
	import lgu_seal from '$lib/assets/lgu_seal.svg';
	import { lgu } from '$lib/data/lgu';
	import type { Snippet } from 'svelte';

	/**
	 * Paper version of a report: LGU letterhead, what the report covers, the body, and signature
	 * lines. Hidden on screen; the screen view hides itself in print. Page size and the page-number
	 * footer come from `@page report` in app.css. Body markup uses the `rp-*` classes styled here.
	 */
	let {
		title,
		period,
		coverage,
		filters,
		prepared_by,
		children
	}: {
		title: string;
		period: string;
		coverage: string;
		/** summary of the applied filters; empty when nothing beyond the period is applied */
		filters: string;
		prepared_by: { name: string; role: string };
		children: Snippet;
	} = $props();

	const stamp = () =>
		new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

	// refreshed on every print, so a page left open still stamps the real print time
	let generated_at = $state(stamp());
</script>

<svelte:window onbeforeprint={() => (generated_at = stamp())} />

<article class="report-print hidden print:block">
	<header class="rp-letterhead">
		<div class="rp-lgu">
			<img src={lgu_seal} alt="" />
			<div>
				<p class="rp-lgu-name">{lgu.name}</p>
				<p class="rp-lgu-place">{lgu.province}, Philippines</p>
			</div>
		</div>
		<div class="rp-doc">
			<h1>{title}</h1>
			<p>CiteTicket · Citation Ticket Management System</p>
		</div>
	</header>

	<dl class="rp-meta">
		<dt>Period</dt>
		<dd>{period}</dd>
		<dt>Coverage</dt>
		<dd>{coverage}</dd>
		<dt>Filters</dt>
		<dd class="rp-meta-wide">{filters || 'None. Every record in the period is included.'}</dd>
		<dt>Generated</dt>
		<dd class="rp-meta-wide">{generated_at} by {prepared_by.name}</dd>
	</dl>

	{@render children()}

	<footer class="rp-sign">
		<div>
			<p class="rp-sign-label">Prepared by</p>
			<p class="rp-sign-name">{prepared_by.name}</p>
			<p class="rp-sign-role">{prepared_by.role}</p>
		</div>
		<div>
			<p class="rp-sign-label">Reviewed and noted by</p>
			<p class="rp-sign-name">&nbsp;</p>
			<p class="rp-sign-role">Signature over printed name</p>
		</div>
	</footer>
</article>

<style>
	/* paper units throughout: this only ever renders in print */
	.report-print {
		color: #111;
		font-size: 8.5pt;
		line-height: 1.35;
		font-variant-numeric: tabular-nums;
	}

	.rp-letterhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12pt;
		padding-bottom: 7pt;
		border-bottom: 1.5pt solid #111;
	}
	.rp-lgu {
		display: flex;
		align-items: center;
		gap: 8pt;
	}
	.rp-lgu img {
		width: 15mm;
		height: 15mm;
	}
	.rp-lgu-name {
		font-size: 11.5pt;
		font-weight: 700;
	}
	.rp-lgu-place {
		font-size: 8pt;
		color: #333;
	}
	.rp-doc {
		text-align: right;
	}
	.rp-doc h1 {
		font-size: 14pt;
		font-weight: 800;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}
	.rp-doc p {
		font-size: 7.5pt;
		color: #444;
	}

	.rp-meta {
		display: grid;
		grid-template-columns: auto 1fr auto 1fr;
		gap: 2.5pt 10pt;
		margin: 8pt 0 2pt;
	}
	.rp-meta dt {
		color: #555;
	}
	.rp-meta-wide {
		grid-column: span 3;
	}

	.rp-sign {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 36pt;
		margin-top: 30pt;
		break-inside: avoid;
	}
	.rp-sign-label {
		margin-bottom: 26pt;
		color: #444;
	}
	.rp-sign-name {
		padding-top: 3pt;
		border-top: 0.75pt solid #111;
		font-weight: 600;
		text-transform: uppercase;
	}
	.rp-sign-role {
		font-size: 7.5pt;
		color: #444;
	}

	/* ---- body building blocks, used by each report's print component ---- */

	.report-print :global(.rp-h2) {
		margin: 13pt 0 4pt;
		font-size: 9.5pt;
		font-weight: 700;
		break-after: avoid;
	}
	.report-print :global(.rp-h2 small) {
		font-size: 8pt;
		font-weight: 400;
		color: #555;
	}

	.report-print :global(.rp-figures) {
		display: grid;
		grid-auto-columns: 1fr;
		grid-auto-flow: column;
		border-top: 0.75pt solid #111;
		border-bottom: 0.75pt solid #111;
		break-inside: avoid;
	}
	.report-print :global(.rp-figures > div) {
		padding: 5pt 8pt 6pt 0;
	}
	.report-print :global(.rp-figures > div + div) {
		padding-left: 8pt;
		border-left: 0.5pt solid #bbb;
	}
	.report-print :global(.rp-figures dt) {
		font-size: 7.5pt;
		color: #444;
	}
	.report-print :global(.rp-figures dd) {
		font-size: 15pt;
		font-weight: 650;
		line-height: 1.2;
	}

	.report-print :global(.rp-columns) {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 16pt;
	}
	.report-print :global(.rp-columns > section) {
		break-inside: avoid;
	}

	.report-print :global(.rp-table) {
		width: 100%;
		border-collapse: collapse;
	}
	.report-print :global(.rp-table thead) {
		display: table-header-group;
	}
	.report-print :global(.rp-table th) {
		padding: 3pt 4pt;
		border-bottom: 0.75pt solid #111;
		font-size: 7.5pt;
		font-weight: 600;
		color: #333;
		text-align: left;
		vertical-align: bottom;
	}
	.report-print :global(.rp-table td) {
		padding: 2.5pt 4pt;
		border-bottom: 0.5pt solid #c8c8c8;
		vertical-align: top;
	}
	.report-print :global(.rp-table :is(th, td):first-child) {
		padding-left: 0;
	}
	.report-print :global(.rp-table :is(th, td):last-child) {
		padding-right: 0;
	}
	.report-print :global(.rp-table tr) {
		break-inside: avoid;
	}
	.report-print :global(.rp-table .rp-num) {
		text-align: right;
		white-space: nowrap;
	}
	.report-print :global(.rp-table .rp-nowrap) {
		white-space: nowrap;
	}
	.report-print :global(.rp-table .rp-index) {
		width: 1%;
		color: #666;
		text-align: right;
		white-space: nowrap;
	}
	.report-print :global(.rp-table .rp-code) {
		font-family: ui-monospace, Consolas, monospace;
		font-size: 7.5pt;
		white-space: nowrap;
	}
	/* the long record list: denser, so a month of tickets doesn't run to dozens of sheets */
	.report-print :global(.rp-table.rp-list) {
		font-size: 7.5pt;
		line-height: 1.25;
	}
	.report-print :global(.rp-table.rp-list th) {
		padding: 2.5pt 3pt;
		font-size: 7pt;
	}
	.report-print :global(.rp-table.rp-list td) {
		padding: 2pt 3pt;
	}
	.report-print :global(.rp-table.rp-list .rp-code) {
		font-size: 7pt;
	}
	.report-print :global(.rp-table .rp-total td) {
		border-top: 0.75pt solid #111;
		border-bottom: none;
		font-weight: 650;
	}
	.report-print :global(.rp-table .rp-empty) {
		padding: 10pt 0;
		color: #555;
		text-align: center;
	}

	.report-print :global(.rp-notice) {
		margin: 10pt 0 0;
		padding: 5pt 7pt;
		border: 0.75pt solid #111;
		break-inside: avoid;
	}
	.report-print :global(.rp-muted) {
		color: #555;
	}
</style>
