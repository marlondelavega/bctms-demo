<script lang="ts">
	import { resolve } from '$app/paths';
	import { issuance_status_data } from '$lib/data/static_data';
	import ColumnChart from '$lib/ui/components/charts/ColumnChart.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import {
		ArrowRight,
		CircleAlert,
		Eye,
		FilePenLine,
		Receipt,
		ScrollText,
		TrendingUp
	} from '@lucide/svelte';

	let { data } = $props();

	const d = $derived(data.dashboard);
	const user = $derived(data.user);

	const peso = new Intl.NumberFormat('en-PH', {
		style: 'currency',
		currency: 'PHP',
		maximumFractionDigits: 0
	});
	const pesoExact = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
	const pesoCompact = new Intl.NumberFormat('en-PH', {
		style: 'currency',
		currency: 'PHP',
		notation: 'compact',
		maximumFractionDigits: 1
	});

	const money = (v: number) => (Math.abs(v) >= 1_000_000 ? pesoCompact : peso).format(v);
	const count = (v: number) => v.toLocaleString('en-PH');
	const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? '' : 's'}`;
	const formatDate = (date: string) =>
		new Date(date).toLocaleDateString('en-PH', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'Asia/Manila'
		});

	const hour = Number(
		new Intl.DateTimeFormat('en-PH', {
			hour: 'numeric',
			hourCycle: 'h23',
			timeZone: 'Asia/Manila'
		}).format(new Date())
	);
	const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
	const today = new Date().toLocaleDateString('en-PH', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'Asia/Manila'
	});

	const officeName = $derived(
		typeof user.enforcement_group === 'object' ? user.enforcement_group?.name : undefined
	);

	const scopeLabel = $derived(
		{
			own: 'Your records',
			office: officeName ? `${officeName} office` : 'Your office',
			all: 'All offices',
			none: ''
		}[d.scopes.issuance]
	);

	const statusOf = (value: number) => issuance_status_data.find((s) => s.value === value);

	const billingStatusLabel: Record<string, string> = {
		UNPAID: 'Unpaid',
		PARTIALLY_PAID: 'Partially paid',
		OVERDUE: 'Overdue'
	};

	const nothingVisible = $derived(!d.issuances && !d.billing && !d.payments);
</script>

<Header title="Dashboard">
	{#snippet PropFilter()}
		{#if scopeLabel}
			<span class="badge gap-1 badge-ghost badge-sm" title="Issuance data shown on this dashboard">
				<Eye class="size-3" />
				{scopeLabel}
			</span>
		{/if}
	{/snippet}
</Header>

<div class="flex min-h-0 w-full grow flex-col gap-4 overflow-auto p-4">
	<div class="flex flex-col gap-0.5">
		<h2 class="text-lg font-semibold">{greeting}, {user.firstname}</h2>
		<p class="text-xs text-base-content/60">
			{today} · {user.user_type.user_type}{officeName ? ` · ${officeName}` : ''}
		</p>
	</div>

	{#if nothingVisible}
		<div
			class="flex flex-col items-center gap-2 rounded-box border border-dashed border-base-300 px-4 py-16 text-center"
		>
			<Eye class="size-6 text-base-content/40" />
			<p class="text-sm font-medium">Nothing to show yet</p>
			<p class="max-w-sm text-xs text-base-content/60">
				Your account doesn't have access to issuances, billing, or payments. Ask an administrator to
				update your user type's permissions.
			</p>
		</div>
	{:else}
		<!-- Headline figures -->
		<div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
			{#if d.issuances}
				{@render tile(
					'Tickets issued this month',
					count(d.issuances.this_month),
					`${count(d.issuances.today)} today · ${count(d.issuances.total)} all time`,
					FilePenLine
				)}
			{/if}
			{#if d.payments}
				{@render tile(
					'Collected this month',
					money(d.payments.month.total),
					`${money(d.payments.today.total)} today · ${plural(d.payments.month.count, 'payment')}`,
					Receipt,
					pesoExact.format(d.payments.month.total)
				)}
			{/if}
			{#if d.billing}
				{@render tile(
					'Outstanding balance',
					money(d.billing.outstanding),
					`${plural(d.billing.open_count, 'open billing')}`,
					ScrollText,
					pesoExact.format(d.billing.outstanding)
				)}

				<div class="flex flex-col gap-1 rounded-box border border-base-300 bg-base-100 p-4">
					<div class="flex items-center justify-between text-xs text-base-content/60">
						<span>Collection rate</span>
						<TrendingUp class="size-4" />
					</div>
					<div class="text-2xl font-semibold">
						{d.billing.collection_rate === null
							? '—'
							: `${Math.round(d.billing.collection_rate * 100)}%`}
					</div>
					<div
						class="h-1.5 w-full overflow-hidden rounded-full bg-success/20"
						role="meter"
						aria-label="Collection rate"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round((d.billing.collection_rate ?? 0) * 100)}
					>
						<div
							class="h-full rounded-full bg-success"
							style:width="{(d.billing.collection_rate ?? 0) * 100}%"
						></div>
					</div>
					<div class="text-xs text-base-content/60">
						{money(d.billing.collected)} collected of {money(
							d.billing.collected + d.billing.outstanding
						)}
					</div>
				</div>
			{/if}
		</div>

		<div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
			<!-- Issuance trend -->
			{#if d.issuances}
				<section class="card-panel lg:col-span-2">
					{@render panelHeader('Tickets issued', `Last 30 days · ${scopeLabel}`)}
					<ColumnChart
						data={d.issuances.trend}
						label="Tickets issued per day, last 30 days"
						format={(v) => plural(v, 'ticket')}
						formatTick={count}
						emptyText="No tickets issued in the last 30 days."
					/>
				</section>

				<!-- Status breakdown -->
				<section class="card-panel">
					{@render panelHeader('Issuance status', `${count(d.issuances.total)} tickets all time`)}
					<ul class="flex flex-col gap-3">
						{#each d.issuances.by_status as s (s.value)}
							{@const pct = d.issuances.total ? s.count / d.issuances.total : 0}
							<li class="flex flex-col gap-1">
								<div class="flex items-center justify-between gap-2 text-xs">
									<span class="flex items-center gap-2">
										<span class="badge badge-xs {s.badge_color}"></span>
										{s.label}
									</span>
									<span class="tabular-nums">
										<span class="font-semibold">{count(s.count)}</span>
										<span class="text-base-content/50">· {Math.round(pct * 100)}%</span>
									</span>
								</div>
								<div class="h-1.5 w-full rounded-full bg-base-200">
									<div class="h-full rounded-r-sm bg-primary/70" style:width="{pct * 100}%"></div>
								</div>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<!-- Collections trend -->
			{#if d.payments}
				<section class="card-panel lg:col-span-2">
					{@render panelHeader(
						'Collections',
						`Last 30 days · ${money(d.payments.week.total)} in the last 7 days`
					)}
					<ColumnChart
						data={d.payments.trend}
						label="Payments collected per day, last 30 days"
						format={(v) => pesoExact.format(v)}
						formatTick={(v) => pesoCompact.format(v)}
						barClass="fill-success"
						emptyText="No payments collected in the last 30 days."
					/>
				</section>
			{/if}

			<!-- Outstanding balances -->
			{#if d.billing}
				<section class="card-panel">
					{@render panelHeader(
						'Outstanding balances',
						'Unsettled billings',
						resolve('/u/billing?page=1&size=10')
					)}
					<ul class="flex flex-col divide-y divide-base-200 text-xs">
						{#each d.billing.by_status as b (b.status)}
							<li class="flex items-center justify-between py-2">
								<span>
									{billingStatusLabel[b.status]}
									<span class="text-base-content/50">· {count(b.count)}</span>
								</span>
								<span class="font-semibold tabular-nums">{pesoExact.format(b.balance)}</span>
							</li>
						{/each}
					</ul>

					{#if d.billing.overdue_count > 0}
						<div class="flex flex-col gap-2 rounded-field bg-error/10 p-3">
							<p class="flex items-center gap-1.5 text-xs font-semibold">
								<CircleAlert class="size-3.5 text-error" />
								{plural(d.billing.overdue_count, 'billing')} past surcharge due date
							</p>
							<ul class="flex flex-col gap-1 text-xs">
								{#each d.billing.overdue as o (o._id)}
									<li>
										<a
											href={resolve(`/u/billing/${o._id}/view`)}
											class="link flex justify-between gap-2 link-hover"
										>
											<span class="font-medium">{o.tracking_code}</span>
											<span class="text-base-content/60">
												{pesoExact.format(o.balance)} · due {formatDate(o.earliest_due_date)}
											</span>
										</a>
									</li>
								{/each}
							</ul>
							{#if d.billing.overdue_count > d.billing.overdue.length}
								<p class="text-[11px] text-base-content/60">
									+{count(d.billing.overdue_count - d.billing.overdue.length)} more
								</p>
							{/if}
						</div>
					{/if}
				</section>
			{/if}

			<!-- Recent issuances -->
			{#if d.issuances}
				<section class="card-panel lg:col-span-2">
					{@render panelHeader(
						'Recent issuances',
						scopeLabel,
						resolve('/u/issuance?page=1&size=10')
					)}
					{#if d.issuances.recent.length}
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr class="text-xs">
										<th>Tracking code</th>
										<th>Violator</th>
										<th class="text-right">Amount</th>
										<th>Status</th>
										<th class="text-right">Apprehended</th>
									</tr>
								</thead>
								<tbody class="text-xs">
									{#each d.issuances.recent as r (r._id)}
										{@const status = statusOf(r.status)}
										<tr class="hover:bg-base-200/50">
											<td>
												<a
													class="link font-medium link-hover"
													href={resolve(`/u/issuance/${r._id}/status`)}
												>
													{r.tracking_code}
												</a>
											</td>
											<td>
												{r.recipient_name || '—'}
												<span class="text-base-content/50">
													· {plural(r.violations_count, 'violation')}
												</span>
											</td>
											<td class="text-right tabular-nums">{pesoExact.format(r.amount)}</td>
											<td>
												<span class="badge badge-soft badge-xs {status?.badge_color}">
													{status?.label ?? 'Unknown'}
												</span>
											</td>
											<td class="text-right whitespace-nowrap">
												{formatDate(r.apprehension_date)}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						{@render empty('No tickets issued yet.')}
					{/if}
				</section>
			{/if}

			<div class="flex flex-col gap-3">
				<!-- Top issuers (office / all scope only) -->
				{#if d.issuances?.top_issuers}
					<section class="card-panel">
						{@render panelHeader('Top issuers', 'This month')}
						{#if d.issuances.top_issuers.length}
							{@const top = d.issuances.top_issuers[0].count}
							<ol class="flex flex-col gap-2.5">
								{#each d.issuances.top_issuers as t, i (t._id)}
									<li class="flex flex-col gap-1 text-xs">
										<div class="flex justify-between gap-2">
											<span class="truncate">
												<span class="text-base-content/50">{i + 1}.</span>
												{t.name || 'Unknown user'}
											</span>
											<span class="font-semibold tabular-nums">{count(t.count)}</span>
										</div>
										<div class="h-1.5 w-full rounded-full bg-base-200">
											<div
												class="h-full rounded-r-sm bg-primary/70"
												style:width="{(t.count / top) * 100}%"
											></div>
										</div>
									</li>
								{/each}
							</ol>
						{:else}
							{@render empty('No tickets issued this month.')}
						{/if}
					</section>
				{/if}

				<!-- Recent payments -->
				{#if d.payments}
					<section class="card-panel">
						{@render panelHeader(
							'Recent payments',
							`${plural(d.payments.week.count, 'payment')} in the last 7 days`,
							resolve('/u/payments?page=1&size=10')
						)}
						{#if d.payments.recent.length}
							<ul class="flex flex-col divide-y divide-base-200 text-xs">
								{#each d.payments.recent as p (p._id)}
									<li class="flex items-center justify-between gap-2 py-2">
										<div class="flex min-w-0 flex-col">
											<span class="truncate font-medium">{p.tracking_code}</span>
											<span class="text-base-content/50">
												{p.payment_method} · {formatDate(p.payment_date)}
											</span>
										</div>
										<span class="font-semibold tabular-nums">{pesoExact.format(p.amount)}</span>
									</li>
								{/each}
							</ul>
						{:else}
							{@render empty('No payments recorded yet.')}
						{/if}
					</section>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#snippet tile(label: string, value: string, sub: string, Icon: typeof FilePenLine, title?: string)}
	<div class="flex flex-col gap-1 rounded-box border border-base-300 bg-base-100 p-4">
		<div class="flex items-center justify-between gap-2 text-xs text-base-content/60">
			<span>{label}</span>
			<Icon class="size-4 shrink-0" />
		</div>
		<div class="text-2xl font-semibold" {title}>{value}</div>
		<div class="text-xs text-base-content/60">{sub}</div>
	</div>
{/snippet}

{#snippet panelHeader(title: string, subtitle: string, href?: string)}
	<div class="flex items-start justify-between gap-2">
		<div class="flex flex-col">
			<h3 class="text-sm font-semibold">{title}</h3>
			<p class="text-xs text-base-content/60">{subtitle}</p>
		</div>
		{#if href}
			<a {href} class="btn gap-1 btn-ghost btn-xs">View all <ArrowRight class="size-3" /></a>
		{/if}
	</div>
{/snippet}

{#snippet empty(text: string)}
	<p class="py-6 text-center text-xs text-base-content/50">{text}</p>
{/snippet}

<style>
	.card-panel {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.75rem;
		border-radius: var(--radius-box);
		border: 1px solid var(--color-base-300);
		background-color: var(--color-base-100);
		padding: 1rem;
	}
</style>
