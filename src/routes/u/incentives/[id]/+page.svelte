<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { superForm } from 'sveltekit-superforms';
	import Can from '$lib/ui/components/Can.svelte';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import Permission from '$lib/validation_schemas/Permissions.zod';
	import type Incentive from '$lib/validation_schemas/Incentives.zod';
	import { basisLabel, describeRate } from '$lib/utilities/incentives';
	import { parseName } from '$lib/utilities/helper';
	import { ArrowLeft, Ban, CircleAlert, Printer, X } from '@lucide/svelte';
	import IncentiveReportPrint from './IncentiveReportPrint.svelte';

	let { data } = $props();

	const report = $derived(data.report);
	const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
	const count = (v: number) => v.toLocaleString('en-PH');
	const formatDate = (d: string) =>
		new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
	const formatDateTime = (d: string) =>
		new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

	const period = $derived(`${formatDate(report.period.from)} – ${formatDate(report.period.to)}`);

	// a partial view only shows the rates of the groups it covers
	const visible_groups = $derived(new Set(report.by_group.map((g) => g.group)));
	const group_settings = $derived(
		data.partial
			? report.group_settings.filter((g) => visible_groups.has(g.group))
			: report.group_settings
	);
	const group_name = $derived(new Map(report.group_settings.map((g) => [g.group, g.name])));
	const person_name = $derived(new Map(report.by_recipient.map((r) => [r.user, r.name])));

	const filters_text = $derived.by(() => {
		const f = report.filters;
		const names = (refs: Incentive.NamedRef[]) => refs.map((r) => r.name).join(', ');
		return [
			f.enforcement_groups.length && `Group: ${names(f.enforcement_groups)}`,
			f.issuers.length && `Officer: ${names(f.issuers)}`,
			f.user_types.length && `User type: ${names(f.user_types)}`,
			f.violation_categories.length && `Category: ${names(f.violation_categories)}`,
			f.code_provisions.length && `Provision: ${names(f.code_provisions)}`,
			f.barangay && `Barangay: ${f.barangay}`,
			f.exclude_legacy ? 'Imported legacy tickets excluded' : 'Imported legacy tickets included'
		]
			.filter(Boolean)
			.join(' · ');
	});

	const coverage = $derived(
		data.scope === 'own'
			? 'Your share of this report'
			: data.scope === 'office'
				? 'Your office’s share of this report'
				: report.by_group.map((g) => g.name).join(', ')
	);

	const items_by_key = $derived.by(() => {
		const map: Record<string, typeof data.items> = {};
		for (const item of data.items) (map[`${item.group}:${item.issuer}`] ??= []).push(item);
		return map;
	});
	const open_rows = new SvelteSet<string>();

	const prepared_by = $derived({
		name: report.generated_by_name,
		role: ''
	});
	const printed_by = $derived({
		name: parseName(data.user),
		role: [data.user.user_type?.user_type, data.user.enforcement_group?.name]
			.filter(Boolean)
			.join(', ')
	});

	// ---- void --------------------------------------------------------------------------------
	let void_dialog: HTMLDialogElement;
	const {
		form: void_form,
		errors: void_errors,
		enhance: void_enhance,
		delayed: void_delayed,
		message: void_message
	} = superForm(
		untrack(() => data.voidForm),
		{
			resetForm: true,
			onResult: ({ result }) => {
				if (result.type === 'success') void_dialog.close();
			}
		}
	);
	void_message.subscribe((m) => {
		if (m?.type === 'success') toast.success(m.text);
		else if (m?.type === 'error') toast.error(m.text);
	});

	onMount(() => {
		if (page.url.searchParams.has('generated')) {
			toast.success(`Incentive report ${report.reference_no} generated.`);
			replaceState(resolve('/u/incentives/[id]', { id: report._id }), page.state);
		}
	});
</script>

<Header title="Incentive Report">
	{#snippet PropFilter()}{/snippet}
	{#snippet AddButtons()}
		<div class="flex gap-2">
			{#if report.status === 'generated'}
				<Can
					permissions={data.user.user_type.permissions}
					action={Permission.Actions.ARCHIVE}
					route="incentives"
				>
					<button
						type="button"
						class="btn gap-1 btn-soft btn-sm btn-error"
						onclick={() => void_dialog.showModal()}
					>
						<Ban class="size-4" /> Void
					</button>
				</Can>
			{/if}
			<button type="button" class="btn gap-1 btn-sm btn-primary" onclick={() => window.print()}>
				<Printer class="size-4" /> Print
			</button>
		</div>
	{/snippet}
</Header>

<div class="flex min-h-0 w-full grow flex-col gap-4 overflow-auto p-4 md:px-6 print:hidden">
	<a class="flex w-fit items-center gap-2 text-xs" href={resolve('/u/incentives')}>
		<ArrowLeft class="size-3" /> Back to incentive reports
	</a>

	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h1 class="flex items-center gap-2 text-lg font-semibold">
				<span class="font-mono">{report.reference_no}</span>
				{#if report.status === 'voided'}
					<span class="badge badge-ghost badge-sm">Voided</span>
				{:else}
					<span class="badge badge-soft badge-sm badge-success">Generated</span>
				{/if}
			</h1>
			<p class="text-xs text-base-content/60">
				{period} · generated {formatDateTime(report.created_at)} by {report.generated_by_name}
			</p>
			<p class="text-xs text-base-content/60">{filters_text}</p>
		</div>
	</div>

	{#if report.status === 'voided'}
		<div class="flex items-start gap-2 rounded-field bg-error/10 p-3 text-xs">
			<Ban class="mt-0.5 size-4 shrink-0 text-error" />
			<p>
				Voided {report.voided_at ? formatDateTime(report.voided_at) : ''} by
				{report.voided_by_name || 'unknown'}: “{report.void_reason}”. Its tickets have been released
				and can be counted in a new report.
			</p>
		</div>
	{/if}

	{#if data.partial}
		<p class="text-xs text-base-content/60">
			You are seeing {data.scope === 'own' ? 'your own' : 'your office’s'} share of this report.
		</p>
	{/if}

	{#if data.changed.length}
		<div class="flex flex-col gap-1 rounded-field bg-warning/10 p-3 text-xs">
			<p class="flex items-center gap-2 font-medium">
				<CircleAlert class="size-4 shrink-0 text-warning" />
				{count(data.changed.length)}
				{data.changed.length === 1 ? 'ticket has' : 'tickets have'} changed since this report was generated
			</p>
			<ul class="ml-6 list-disc">
				{#each data.changed.slice(0, 10) as c (c.issuance)}
					<li><span class="font-mono">{c.tracking_code}</span> — {c.reason}</li>
				{/each}
				{#if data.changed.length > 10}
					<li>and {count(data.changed.length - 10)} more</li>
				{/if}
			</ul>
			<p class="text-base-content/70">
				The report keeps what was generated. Void it and generate again if it should be corrected.
			</p>
		</div>
	{/if}

	{#if report.remarks}
		<p class="rounded-field bg-base-200 px-3 py-2 text-xs">
			<span class="font-medium">Remarks:</span>
			{report.remarks}
		</p>
	{/if}

	<dl
		class="grid grid-cols-2 divide-base-300 rounded-box border border-base-300 lg:grid-cols-4 lg:divide-x"
	>
		<div class="flex flex-col gap-0.5 px-4 py-3">
			<dt class="text-xs text-base-content/60">Tickets</dt>
			<dd class="text-xl font-semibold tabular-nums">{count(report.totals.ticket_count)}</dd>
		</div>
		<div class="flex flex-col gap-0.5 px-4 py-3">
			<dt class="text-xs text-base-content/60">Officers</dt>
			<dd class="text-xl font-semibold tabular-nums">{count(report.totals.recipient_count)}</dd>
		</div>
		<div class="flex flex-col gap-0.5 px-4 py-3">
			<dt class="text-xs text-base-content/60">Base amount</dt>
			<dd class="text-xl font-semibold tabular-nums">{peso.format(report.totals.base_amount)}</dd>
		</div>
		<div class="flex flex-col gap-0.5 px-4 py-3">
			<dt class="text-xs text-base-content/60">Total incentive</dt>
			<dd class="text-xl font-semibold text-primary tabular-nums">
				{peso.format(report.totals.incentive_amount)}
			</dd>
		</div>
	</dl>

	<!-- rates used -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-semibold">Rates used</h2>
		<div class="overflow-x-auto rounded-box border border-base-300">
			<table class="table table-sm">
				<thead>
					<tr class="text-xs">
						<th>Group</th>
						<th>Saved setting</th>
						<th>Applied</th>
						<th class="text-right">Tickets</th>
						<th class="text-right">Base</th>
						<th class="text-right">Incentive</th>
					</tr>
				</thead>
				<tbody class="text-xs">
					{#each group_settings as g (g.group)}
						{@const totals = report.by_group.find((x) => x.group === g.group)}
						<tr>
							<td class="font-medium">{g.name}</td>
							<td>
								{#if g.defaults}
									{describeRate(g.defaults, peso)} · {basisLabel(
										g.defaults.basis
									)}{g.defaults_enabled ? '' : ' (off)'}
								{:else}
									<span class="text-base-content/60">Not set</span>
								{/if}
							</td>
							<td>
								{describeRate(g.applied, peso)} · {basisLabel(g.applied.basis)}
								{#if g.overridden}
									<span class="badge badge-soft badge-xs badge-warning">changed</span>
									<span class="block text-base-content/60">Reason: {g.override_reason}</span>
								{/if}
							</td>
							<td class="text-right tabular-nums">{count(totals?.ticket_count ?? 0)}</td>
							<td class="text-right tabular-nums">{peso.format(totals?.base_amount ?? 0)}</td>
							<td class="text-right font-medium tabular-nums">
								{peso.format(totals?.incentive_amount ?? 0)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- by officer -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-semibold">
			By officer <span class="font-normal text-base-content/60">· open a row for its tickets</span>
		</h2>
		<div class="flex flex-col rounded-box border border-base-300">
			<div
				class="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-base-300 bg-base-200 px-4 py-2 text-xs font-semibold text-base-content/70 sm:grid-cols-[1fr_6rem_8rem_8rem]"
			>
				<span>Officer</span>
				<span class="text-right">Tickets</span>
				<span class="hidden text-right sm:block">Base</span>
				<span class="text-right">Incentive</span>
			</div>
			{#each report.by_recipient as r (`${r.group}:${r.user}`)}
				{@const key = `${r.group}:${r.user}`}
				<details
					class="border-b border-base-300 last:border-b-0"
					ontoggle={(e) => (e.currentTarget.open ? open_rows.add(key) : open_rows.delete(key))}
				>
					<summary
						class="grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2 text-xs hover:bg-base-200/50 sm:grid-cols-[1fr_6rem_8rem_8rem]"
					>
						<span class="min-w-0">
							<span class="font-medium">{r.name}</span>
							<span class="block truncate text-base-content/60">
								{[r.user_type, group_name.get(r.group)].filter(Boolean).join(' · ')}
							</span>
						</span>
						<span class="text-right tabular-nums">{count(r.ticket_count)}</span>
						<span class="hidden text-right tabular-nums sm:block">{peso.format(r.base_amount)}</span
						>
						<span class="text-right font-medium tabular-nums"
							>{peso.format(r.incentive_amount)}</span
						>
					</summary>
					{#if open_rows.has(key)}
						<div class="overflow-x-auto bg-base-200/40 px-4 py-2">
							<table class="table table-xs">
								<thead>
									<tr>
										<th>Tracking code</th>
										<th>Counted on</th>
										<th class="text-right">Base</th>
										<th class="text-right">Incentive</th>
									</tr>
								</thead>
								<tbody>
									{#each items_by_key[key] ?? [] as item (item._id)}
										<tr>
											<td class="font-mono">{item.tracking_code}</td>
											<td class="whitespace-nowrap">
												{formatDate(item.event_date)}
												<span class="text-base-content/60">
													· {item.basis === 'paid' ? 'fully paid' : 'apprehended'}
												</span>
											</td>
											<td class="text-right tabular-nums">{peso.format(item.base_amount)}</td>
											<td class="text-right tabular-nums">{peso.format(item.incentive_amount)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</details>
			{:else}
				<p class="px-4 py-6 text-center text-xs text-base-content/60">
					No officers in this report.
				</p>
			{/each}
		</div>
	</section>

	{#if report.exclusions.length}
		<section class="flex flex-col gap-2">
			<h2 class="text-sm font-semibold">
				Left out <span class="font-normal text-base-content/60">· {report.exclusions.length}</span>
			</h2>
			<ul class="flex flex-col divide-y divide-base-300 rounded-box border border-base-300 text-xs">
				{#each report.exclusions as ex (ex.issuance)}
					<li class="flex flex-wrap gap-x-3 gap-y-0.5 px-4 py-2">
						<span class="font-mono font-medium">{ex.tracking_code}</span>
						<span class="text-base-content/60"
							>{(ex.issuer && person_name.get(ex.issuer)) || ''}</span
						>
						<span class="basis-full sm:basis-auto">{ex.reason}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<dialog class="modal p-2 backdrop-blur-xs" bind:this={void_dialog}>
	<div class="relative modal-box flex w-full max-w-md flex-col gap-4">
		<div class="flex flex-col gap-1">
			<h3 class="font-bold">Void {report.reference_no}?</h3>
			<p class="text-xs text-base-content/70">
				The report stays on record as voided, with your reason. Its
				{count(report.totals.ticket_count)} tickets are released so they can be counted in a new report.
				This cannot be undone.
			</p>
		</div>
		<form method="POST" action="?/void" use:void_enhance novalidate class="flex flex-col gap-3">
			<input type="hidden" name="_id" value={$void_form._id} />
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Reason<span class="text-error">*</span></legend>
				<textarea
					name="reason"
					rows="3"
					class={['textarea w-full', $void_errors.reason && 'textarea-error']}
					placeholder="e.g. Wrong rate used for Traffic group"
					bind:value={$void_form.reason}
				></textarea>
				<InputError>{$void_errors.reason?.[0]}</InputError>
			</fieldset>
			<div class="modal-action mt-0">
				<button class="btn btn-ghost" type="button" onclick={() => void_dialog.close()}
					>Cancel</button
				>
				<button class="btn btn-error" type="submit">
					{#if $void_delayed}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						Void report
					{/if}
				</button>
			</div>
		</form>
		<button
			class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
			type="button"
			aria-label="Close"
			onclick={() => void_dialog.close()}><X class="size-4" /></button
		>
	</div>
	<form method="dialog" class="modal-backdrop h-dvh">
		<button>x</button>
	</form>
</dialog>

<IncentiveReportPrint
	{report}
	items={data.items}
	{period}
	{coverage}
	filters={filters_text}
	prepared_by={printed_by}
	generated_by={prepared_by.name}
/>
