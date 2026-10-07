<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import MultiSelect from '$lib/ui/components/input/MultiSelect.svelte';
	import Incentive from '$lib/validation_schemas/Incentives.zod';
	import { basisLabel, describeRate, sameRate, summarize } from '$lib/utilities/incentives';
	import {
		ChevronRight,
		CircleAlert,
		CircleCheck,
		CircleDashed,
		FilePlus,
		LoaderCircle,
		Plus,
		RefreshCw,
		Search,
		Undo2,
		X
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let {
		form_data,
		options
	}: {
		form_data: SuperValidated<Incentive.Generate, App.Superforms.Message>;
		options: PageData['options'];
	} = $props();

	const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
	const count = (v: number) => v.toLocaleString('en-PH');
	const formatDate = (d: string) =>
		new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
	const formatDay = (ymd: string) => formatDate(`${ymd}T00:00:00`);

	// ---- period presets ------------------------------------------------------------------------
	const DAY = /^\d{4}-\d{2}-\d{2}$/;
	const ymd = (d: Date) =>
		[
			d.getFullYear(),
			String(d.getMonth() + 1).padStart(2, '0'),
			String(d.getDate()).padStart(2, '0')
		].join('-');
	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth();
	const quarter = Math.floor(month / 3) * 3;
	const PRESETS = [
		{
			label: 'Last month',
			from: ymd(new Date(year, month - 1, 1)),
			to: ymd(new Date(year, month, 0))
		},
		{ label: 'This month', from: ymd(new Date(year, month, 1)), to: ymd(today) },
		{
			label: 'Last quarter',
			from: ymd(new Date(year, quarter - 3, 1)),
			to: ymd(new Date(year, quarter, 0))
		},
		{ label: 'This year', from: ymd(new Date(year, 0, 1)), to: ymd(today) }
	];

	// ---- form and live preview -----------------------------------------------------------------
	// everything a preview's numbers depend on — not reasons or remarks, which only matter when generating
	const inputKey = (d: Incentive.Generate) =>
		JSON.stringify([
			d.date_from,
			d.date_to,
			d.issuer,
			d.user_type,
			d.violation_category,
			d.code_provision,
			d.barangay.trim(),
			d.exclude_legacy,
			d.settings
				.filter((s) => s.include)
				.map((s) => [s.group, s.rate_type, Number(s.amount), s.basis])
		]);

	let preview = $state.raw<Incentive.Preview | null>(null);
	let previewed_key = $state('');
	// the inputs of the last preview sent, so one that failed isn't resent in a loop
	let requested_key = $state('');
	let preview_error = $state('');
	let last_action = $state<'preview' | 'generate'>('preview');
	let confirming = $state(false);

	const { form, errors, enhance, submitting, submit } = superForm(
		untrack(() => form_data),
		{
			dataType: 'json',
			resetForm: false,
			// re-running the page load would replace the form and lose the work in progress
			invalidateAll: false,
			timeoutMs: 30000,
			onSubmit: ({ action }) => {
				last_action = action.search.includes('generate') ? 'generate' : 'preview';
			},
			onUpdate: ({ form: updated, cancel }) => {
				const m = updated.message;
				if (m?.type === 'action' && m.text === 'preview') {
					const next = m.data as Incentive.Preview;
					preview = next;
					previewed_key = inputKey(updated.data);
					preview_error = '';
					// keep whatever was typed while the preview was running
					cancel();
					const ids = new Set(next.lines.map((l) => l.issuance));
					if ($form.excluded.some((e) => !ids.has(e.issuance))) {
						$form.excluded = $form.excluded.filter((e) => ids.has(e.issuance));
					}
					return;
				}
				if (m?.type === 'error') {
					if (last_action === 'preview') {
						preview_error = m.text;
					} else {
						confirming = false;
						toast.error(m.text);
					}
				}
			}
		}
	);

	const current_key = $derived(inputKey($form));
	const previewing = $derived($submitting && last_action === 'preview');
	const generating = $derived($submitting && last_action === 'generate');

	// ---- groups & rates ------------------------------------------------------------------------
	const group_by_id = $derived(new Map(options.groups.map((g) => [g._id, g])));
	const groupName = (id: string) => group_by_id.get(id)?.name ?? 'Unknown group';

	const differs = (row: Incentive.GroupSetting) => {
		const saved = group_by_id.get(row.group)?.incentive;
		return row.include && (!saved?.enabled || !sameRate(saved ?? null, row));
	};
	const amountProblem = (row: Incentive.GroupSetting) => {
		const amount = Number(row.amount);
		if (!(amount > 0)) return 'Enter an amount.';
		if (row.rate_type === 'percentage' && amount > 100) return '100% at most.';
		return '';
	};

	const rows = $derived($form.settings.map((row, i) => ({ row, i })));
	const included = $derived(rows.filter(({ row }) => row.include));
	const available = $derived(rows.filter(({ row }) => !row.include));

	let group_query = $state('');
	const available_shown = $derived(
		available.filter(({ row }) =>
			groupName(row.group).toLowerCase().includes(group_query.trim().toLowerCase())
		)
	);

	// ---- readiness -----------------------------------------------------------------------------
	const period_ok = $derived(
		DAY.test($form.date_from) && DAY.test($form.date_to) && $form.date_from <= $form.date_to
	);
	const rates_ok = $derived(
		included.length > 0 && included.every(({ row }) => !amountProblem(row))
	);
	const can_preview = $derived(period_ok && rates_ok);
	const up_to_date = $derived(!!preview && previewed_key === current_key && !previewing);
	const missing_rate_reasons = $derived(
		included.filter(({ row }) => differs(row) && !row.override_reason.trim())
	);
	const missing_left_out_reasons = $derived(
		$form.excluded.filter((e) => e.reason.trim().length < 3).length
	);

	// the preview again auto-refreshes shortly after the inputs settle
	$effect(() => {
		const key = current_key;
		if (!can_preview || $submitting || key === previewed_key || key === requested_key) return;
		const timer = setTimeout(() => {
			requested_key = key;
			submit();
		}, 700);
		return () => clearTimeout(timer);
	});

	function refresh() {
		requested_key = current_key;
		submit();
	}

	// ---- the preview, recomputed live as tickets are left out ----------------------------------
	const excluded_ids = $derived(new Set($form.excluded.map((e) => e.issuance)));
	const included_lines = $derived(
		preview ? preview.lines.filter((l) => !excluded_ids.has(l.issuance)) : []
	);
	const live = $derived(preview ? summarize(included_lines, preview.people, preview.groups) : null);
	// every officer in the result, even one whose tickets are all left out, so they can be put back
	const all_rows = $derived(
		preview ? summarize(preview.lines, preview.people, preview.groups) : null
	);
	const live_by_key = $derived(
		new Map((live?.by_recipient ?? []).map((r) => [`${r.group}:${r.user}`, r]))
	);
	const live_by_group = $derived(new Map((live?.by_group ?? []).map((g) => [g.group, g])));
	const lines_by_key = $derived.by(() => {
		const map: Record<string, Incentive.Line[]> = {};
		for (const l of preview?.lines ?? []) (map[`${l.group}:${l.issuer}`] ??= []).push(l);
		return map;
	});
	const line_by_id = $derived(new Map((preview?.lines ?? []).map((l) => [l.issuance, l])));
	const applied_by_group = $derived(
		new Map((preview?.group_settings ?? []).map((g) => [g.group, g]))
	);

	const skipped_notes = $derived.by(() => {
		if (!preview) return [];
		const s = preview.skipped;
		return [
			s.already_in_report && `${count(s.already_in_report)} already in another report`,
			s.reissued && `${count(s.reissued)} replaced by a reissued ticket`,
			s.not_fully_paid && `${count(s.not_fully_paid)} not fully paid`,
			s.no_group && `${count(s.no_group)} with no group recorded`
		].filter(Boolean) as string[];
	});

	function setExcluded(issuance: string, on: boolean) {
		$form.excluded = on
			? [...$form.excluded, { issuance, reason: '' }]
			: $form.excluded.filter((e) => e.issuance !== issuance);
	}

	// ---- review --------------------------------------------------------------------------------
	type Tab = 'officers' | 'groups' | 'left';
	let tab = $state<Tab>('officers');
	let officer_query = $state('');
	// officer rows render their tickets only while open — a month can be thousands of tickets
	const open_rows = new SvelteSet<string>();
	const toggleRow = (key: string) =>
		open_rows.has(key) ? open_rows.delete(key) : open_rows.add(key);

	const officers_shown = $derived(
		(all_rows?.by_recipient ?? []).filter((r) =>
			r.name.toLowerCase().includes(officer_query.trim().toLowerCase())
		)
	);

	// ---- the summary's checklist ---------------------------------------------------------------
	type Check = { ok: boolean; text: string; target: string; tab?: Tab };
	const checklist = $derived.by(() => {
		const list: Check[] = [
			{
				ok: period_ok,
				text: period_ok
					? `${formatDay($form.date_from)} – ${formatDay($form.date_to)}`
					: 'Choose a period that ends on or after it starts',
				target: 'step-tickets'
			},
			{
				ok: rates_ok,
				text: !included.length
					? 'Add at least one group'
					: rates_ok
						? `${included.length} ${included.length === 1 ? 'group' : 'groups'} with rates`
						: 'Some rates need an amount',
				target: 'step-rates'
			}
		];
		if (included.some(({ row }) => differs(row))) {
			list.push({
				ok: !missing_rate_reasons.length,
				text: missing_rate_reasons.length
					? `Reason needed for ${missing_rate_reasons.map(({ row }) => groupName(row.group)).join(', ')}`
					: 'Rate changes explained',
				target: 'step-rates'
			});
		}
		list.push({
			ok: up_to_date,
			text: previewing
				? 'Updating the preview…'
				: up_to_date
					? 'Preview is up to date'
					: preview
						? 'Preview is out of date'
						: 'Not previewed yet',
			target: 'step-review'
		});
		if (up_to_date) {
			list.push({
				ok: included_lines.length > 0,
				text: included_lines.length
					? `${count(included_lines.length)} tickets to pay`
					: 'No tickets qualify',
				target: 'step-review'
			});
		}
		if ($form.excluded.length) {
			list.push({
				ok: !missing_left_out_reasons,
				text: missing_left_out_reasons
					? `${missing_left_out_reasons} left-out ${missing_left_out_reasons === 1 ? 'ticket needs' : 'tickets need'} a reason`
					: 'Left-out tickets explained',
				target: 'step-review',
				tab: 'left'
			});
		}
		return list;
	});
	const ready = $derived(checklist.every((c) => c.ok) && !$submitting);
	const blocker = $derived(checklist.find((c) => !c.ok));

	function jump(target: string, to_tab?: Tab) {
		if (to_tab) tab = to_tab;
		document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<form
	method="POST"
	action="?/preview"
	use:enhance
	novalidate
	class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]"
>
	<div class="flex min-w-0 flex-col gap-8">
		<!-- tickets -->
		<section
			id="step-tickets"
			class="flex scroll-mt-4 flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-4"
			aria-labelledby="tickets-heading"
		>
			<div class="flex flex-col gap-0.5">
				<h2 id="tickets-heading" class="text-sm font-semibold">Tickets</h2>
				<p class="text-xs text-base-content/60">
					Issued tickets count on their apprehension date; paid tickets on the day the bill was
					fully paid.
				</p>
			</div>

			<div class="flex flex-col gap-2">
				<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Period shortcuts">
					{#each PRESETS as p (p.label)}
						{@const active = $form.date_from === p.from && $form.date_to === p.to}
						<button
							type="button"
							class={['btn btn-xs', active ? 'btn-soft btn-primary' : 'btn-ghost']}
							aria-pressed={active}
							onclick={() => {
								$form.date_from = p.from;
								$form.date_to = p.to;
							}}
						>
							{p.label}
						</button>
					{/each}
				</div>
				<div class="grid grid-cols-2 gap-3 sm:max-w-md">
					<label class="flex flex-col gap-1">
						<span class="text-xs text-base-content/70">From</span>
						<input type="date" class="input input-sm w-full" bind:value={$form.date_from} />
						<InputError>{$errors.date_from?.[0]}</InputError>
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-xs text-base-content/70">To</span>
						<input
							type="date"
							class={['input input-sm w-full', !period_ok && $form.date_to && 'input-error']}
							bind:value={$form.date_to}
						/>
						<InputError>
							{$errors.date_to?.[0] ??
								(DAY.test($form.date_from) && DAY.test($form.date_to) && !period_ok
									? 'Ends before it starts.'
									: '')}
						</InputError>
					</label>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-x-3 sm:grid-cols-2 xl:grid-cols-3">
				{#if options.scope !== 'own'}
					<MultiSelect
						name="issuer"
						label="Officer"
						all_label="Everyone"
						options={options.users.map((u) => ({
							value: u._id,
							label: `${u.lastname}, ${u.firstname}${u.archived ? ' (archived)' : ''}`
						}))}
						selected={$form.issuer}
						onchange={(v) => ($form.issuer = v)}
					/>
				{/if}
				<MultiSelect
					name="user_type"
					label="User type"
					all_label="All user types"
					options={options.user_types.map((t) => ({ value: t._id, label: t.user_type }))}
					selected={$form.user_type}
					onchange={(v) => ($form.user_type = v)}
				/>
				<MultiSelect
					name="violation_category"
					label="Violation category"
					all_label="All categories"
					options={options.categories.map((c) => ({ value: c._id, label: c.name }))}
					selected={$form.violation_category}
					onchange={(v) => ($form.violation_category = v)}
				/>
				<MultiSelect
					name="code_provision"
					label="Code provision"
					all_label="All provisions"
					options={options.provisions.map((p) => ({
						value: p._id,
						label: `${p.code} — ${p.description}`
					}))}
					selected={$form.code_provision}
					onchange={(v) => ($form.code_provision = v)}
				/>
				<fieldset class="fieldset">
					<legend class="fieldset-legend text-xs">Barangay</legend>
					<input
						type="text"
						class="input input-sm w-full"
						placeholder="Any barangay"
						bind:value={$form.barangay}
					/>
				</fieldset>
			</div>

			<label class="flex w-fit cursor-pointer items-center gap-2 text-xs">
				<input
					type="checkbox"
					class="toggle toggle-sm toggle-primary"
					checked={!$form.exclude_legacy}
					onchange={(e) => ($form.exclude_legacy = !e.currentTarget.checked)}
				/>
				Include tickets imported from the old system
			</label>
		</section>

		<!-- groups & rates -->
		<section
			id="step-rates"
			class="flex scroll-mt-4 flex-col gap-3"
			aria-labelledby="rates-heading"
		>
			<div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
				<div class="flex max-w-prose flex-col gap-0.5">
					<h2 id="rates-heading" class="text-sm font-semibold">Groups & rates</h2>
					<p class="text-xs text-base-content/60">
						Groups start from their saved incentive settings. A different rate, or paying a group
						with no active rate, needs a reason — it is kept with the report.
					</p>
				</div>
				<p class="text-xs text-base-content/60 tabular-nums">
					{included.length} of {rows.length} paid
				</p>
			</div>

			{#if included.length}
				<ul class="grid grid-cols-1 items-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
					{#each included as { row, i } (row.group)}
						{@const name = groupName(row.group)}
						{@const saved = group_by_id.get(row.group)?.incentive}
						{@const changed = differs(row)}
						{@const problem = amountProblem(row)}
						<li
							class={[
								'flex flex-col gap-3 rounded-box border bg-base-100 p-3 transition-colors',
								changed ? 'border-warning/60' : 'border-base-300'
							]}
						>
							<div class="flex items-start justify-between gap-2">
								<div class="flex min-w-0 flex-col">
									<span class="text-sm font-medium wrap-break-word">{name}</span>
									<span class="text-xs text-base-content/60">
										{#if saved}
											Saved: {describeRate(saved, peso)} · {basisLabel(saved.basis)}{saved.enabled
												? ''
												: ' (off)'}
										{:else}
											No saved rate
										{/if}
									</span>
								</div>
								<div class="flex shrink-0 items-center gap-1">
									{#if changed}
										<span class="badge badge-soft badge-xs badge-warning">Changed</span>
									{/if}
									<button
										type="button"
										class="btn btn-square btn-ghost btn-xs"
										aria-label={`Don't pay ${name}`}
										title="Don't pay this group"
										onclick={() => ($form.settings[i].include = false)}
									>
										<X class="size-3.5" />
									</button>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-x-2 gap-y-2.5">
								<fieldset class="col-span-2 flex flex-col gap-1">
									<legend class="mb-1 text-xs text-base-content/70">Rate</legend>
									<div class="join w-full">
										{#each Incentive.RATE_TYPES as t (t.value)}
											<input
												type="radio"
												name={`rate_type_${row.group}`}
												class="btn join-item grow btn-sm"
												aria-label={t.label}
												value={t.value}
												bind:group={$form.settings[i].rate_type}
											/>
										{/each}
									</div>
								</fieldset>

								<fieldset class="flex min-w-0 flex-col gap-1">
									<legend class="mb-1 text-xs text-base-content/70">
										{row.rate_type === 'fixed' ? 'Per ticket' : 'Percentage'}
									</legend>
									<label
										class={[
											'input input-sm w-full',
											(problem || $errors.settings?.[i]?.amount) && 'input-error'
										]}
									>
										{#if row.rate_type === 'fixed'}<span class="text-base-content/60">₱</span>{/if}
										<input
											type="number"
											min="0"
											step="0.01"
											max={row.rate_type === 'percentage' ? 100 : undefined}
											class="min-w-0 grow tabular-nums"
											aria-label={`${row.rate_type === 'fixed' ? 'Amount per ticket' : 'Percentage'} for ${name}`}
											bind:value={$form.settings[i].amount}
										/>
										{#if row.rate_type === 'percentage'}<span class="text-base-content/60">%</span
											>{/if}
									</label>
									<InputError>{$errors.settings?.[i]?.amount?.[0] ?? problem}</InputError>
								</fieldset>

								<fieldset class="flex min-w-0 flex-col gap-1">
									<legend class="mb-1 text-xs text-base-content/70">Count</legend>
									<div class="join w-full">
										{#each Incentive.BASES as b (b.value)}
											<input
												type="radio"
												name={`basis_${row.group}`}
												class="btn join-item grow btn-sm"
												aria-label={b.value === 'paid' ? 'Paid' : 'Issued'}
												title={b.hint}
												value={b.value}
												bind:group={$form.settings[i].basis}
											/>
										{/each}
									</div>
								</fieldset>

								{#if changed}
									<fieldset class="col-span-2 flex flex-col gap-1">
										<legend class="mb-1 text-xs text-base-content/70">
											Reason<span class="text-error">*</span>
										</legend>
										<input
											type="text"
											class={[
												'input input-sm w-full',
												$errors.settings?.[i]?.override_reason && 'input-error'
											]}
											placeholder={saved?.enabled
												? 'Why a different rate this time?'
												: 'No active saved rate — why is it being paid?'}
											aria-label={`Reason for ${name}'s rate`}
											bind:value={$form.settings[i].override_reason}
										/>
										<InputError>{$errors.settings?.[i]?.override_reason?.[0]}</InputError>
									</fieldset>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p
					class="rounded-box border border-dashed border-base-300 px-4 py-6 text-center text-sm text-base-content/60"
				>
					No groups are being paid yet. Add one below — groups with a saved rate start here
					automatically.
				</p>
			{/if}

			{#if available.length}
				<div class="flex flex-col gap-2 rounded-box bg-base-200/50 p-3">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h3 class="text-xs font-medium text-base-content/70">
							Add a group <span class="font-normal">· {available.length} not paid</span>
						</h3>
						{#if available.length > 8}
							<label class="input input-xs w-full sm:w-56">
								<Search class="size-3 opacity-60" />
								<input
									type="search"
									class="grow"
									placeholder="Find a group…"
									bind:value={group_query}
								/>
							</label>
						{/if}
					</div>
					<ul class="flex flex-wrap gap-1.5">
						{#each available_shown as { row, i } (row.group)}
							{@const saved = group_by_id.get(row.group)?.incentive}
							<li>
								<button
									type="button"
									class="btn h-auto min-h-8 gap-1.5 border-base-300 bg-base-100 py-1 font-normal btn-sm"
									title={saved
										? `Saved: ${describeRate(saved, peso)} · ${basisLabel(saved.basis)}${saved.enabled ? '' : ' (off)'}`
										: 'No saved rate'}
									onclick={() => ($form.settings[i].include = true)}
								>
									<Plus class="size-3.5 text-primary" />
									<span class="text-left">{groupName(row.group)}</span>
									{#if saved?.enabled}
										<span class="text-xs text-base-content/50">{describeRate(saved, peso)}</span>
									{/if}
								</button>
							</li>
						{:else}
							<li class="text-xs text-base-content/60">No group matches “{group_query}”.</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>

		<!-- review -->
		<section
			id="step-review"
			class="flex scroll-mt-4 flex-col gap-3 pb-4"
			aria-labelledby="review-heading"
			aria-busy={previewing}
		>
			<div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
				<div class="flex flex-col gap-0.5">
					<h2 id="review-heading" class="text-sm font-semibold">Review</h2>
					<p class="text-xs text-base-content/60">
						Open an officer to see their tickets and leave any out.
					</p>
				</div>
				{#if skipped_notes.length}
					<p class="text-xs text-base-content/60">Not counted: {skipped_notes.join(' · ')}</p>
				{/if}
			</div>

			{#if !preview}
				<div
					class="flex flex-col items-center gap-2 rounded-box border border-dashed border-base-300 px-4 py-10 text-center text-sm text-base-content/60"
				>
					{#if previewing}
						<LoaderCircle class="size-5 animate-spin text-primary" />
						<p>Working out the payout…</p>
					{:else if preview_error}
						<CircleAlert class="size-5 text-error" />
						<p>{preview_error}</p>
					{:else}
						<p>The breakdown by officer appears here once there’s a period and a group to pay.</p>
					{/if}
				</div>
			{:else if live && all_rows}
				<div
					class={[
						'flex flex-col rounded-box border border-base-300 bg-base-100 transition-opacity duration-200',
						!up_to_date && 'opacity-60'
					]}
				>
					<div role="tablist" aria-label="Review" class="tabs-border tabs px-2 pt-1">
						<button
							type="button"
							role="tab"
							class={['tab gap-1.5', tab === 'officers' && 'tab-active']}
							aria-selected={tab === 'officers'}
							onclick={() => (tab = 'officers')}
						>
							By officer <span class="badge badge-ghost badge-xs"
								>{all_rows.by_recipient.length}</span
							>
						</button>
						<button
							type="button"
							role="tab"
							class={['tab gap-1.5', tab === 'groups' && 'tab-active']}
							aria-selected={tab === 'groups'}
							onclick={() => (tab = 'groups')}
						>
							By group <span class="badge badge-ghost badge-xs">{all_rows.by_group.length}</span>
						</button>
						<button
							type="button"
							role="tab"
							class={['tab gap-1.5', tab === 'left' && 'tab-active']}
							aria-selected={tab === 'left'}
							onclick={() => (tab = 'left')}
						>
							Left out
							<span
								class={[
									'badge badge-xs',
									missing_left_out_reasons ? 'badge-warning' : 'badge-ghost'
								]}>{$form.excluded.length}</span
							>
						</button>
					</div>

					{#if preview.lines.length === 0}
						<div class="flex flex-col gap-1 px-4 py-10 text-center text-sm text-base-content/60">
							<p>No tickets qualify for this period, these filters and these rates.</p>
							<p class="text-xs">
								{preview.skipped.no_group
									? `${count(preview.skipped.no_group)} matching tickets have no enforcement group recorded — restart the server to fill them in.`
									: 'Try a wider period, or check whether the groups count issued or paid tickets.'}
							</p>
						</div>
					{:else if tab === 'officers'}
						<div class="flex flex-col gap-2 p-3">
							{#if all_rows.by_recipient.length > 8}
								<label class="input input-sm w-full sm:w-64">
									<Search class="size-3.5 opacity-60" />
									<input
										type="search"
										class="grow"
										placeholder="Find an officer…"
										bind:value={officer_query}
									/>
								</label>
							{/if}
							<div class="overflow-x-auto">
								<table class="table table-sm">
									<thead>
										<tr class="text-xs">
											<th>Officer</th>
											<th class="hidden md:table-cell">Group</th>
											<th class="text-right">Tickets</th>
											<th class="hidden text-right sm:table-cell">Base</th>
											<th class="text-right">Incentive</th>
										</tr>
									</thead>
									<tbody>
										{#each officers_shown as r (`${r.group}:${r.user}`)}
											{@const key = `${r.group}:${r.user}`}
											{@const lr = live_by_key.get(key)}
											{@const open = open_rows.has(key)}
											{@const kept = lr?.ticket_count ?? 0}
											<tr class={['hover:bg-base-200/50', !kept && 'text-base-content/50']}>
												<td>
													<button
														type="button"
														class="flex items-start gap-2 text-left"
														aria-expanded={open}
														onclick={() => toggleRow(key)}
													>
														<ChevronRight
															class={[
																'mt-0.5 size-3.5 shrink-0 transition-transform duration-150',
																open && 'rotate-90'
															]}
														/>
														<span class="flex flex-col">
															<span class="font-medium">{r.name}</span>
															<span class="text-xs text-base-content/60">
																{r.user_type}<span class="md:hidden">
																	· {preview.groups[r.group]?.name}</span
																>
															</span>
														</span>
													</button>
												</td>
												<td class="hidden text-xs md:table-cell">{preview.groups[r.group]?.name}</td
												>
												<td class="text-right tabular-nums">
													{count(kept)}{#if kept !== r.ticket_count}<span
															class="text-base-content/50"
														>
															/ {count(r.ticket_count)}</span
														>{/if}
												</td>
												<td class="hidden text-right tabular-nums sm:table-cell">
													{peso.format(lr?.base_amount ?? 0)}
												</td>
												<td class="text-right font-medium tabular-nums">
													{peso.format(lr?.incentive_amount ?? 0)}
												</td>
											</tr>
											{#if open}
												<tr>
													<td colspan="5" class="bg-base-200/40 px-3 py-2">
														<table class="table table-xs">
															<thead>
																<tr>
																	<th class="w-0">Leave out</th>
																	<th>Tracking code</th>
																	<th>
																		{preview.groups[r.group]?.basis === 'paid'
																			? 'Fully paid on'
																			: 'Apprehended'}
																	</th>
																	<th class="text-right">Base</th>
																	<th class="text-right">Incentive</th>
																</tr>
															</thead>
															<tbody>
																{#each lines_by_key[key] ?? [] as l (l.issuance)}
																	{@const out = excluded_ids.has(l.issuance)}
																	<tr class={[out && 'text-base-content/40 line-through']}>
																		<td>
																			<input
																				type="checkbox"
																				class="checkbox checkbox-xs"
																				aria-label={`Leave out ${l.tracking_code}`}
																				checked={out}
																				onchange={(e) =>
																					setExcluded(l.issuance, e.currentTarget.checked)}
																			/>
																		</td>
																		<td class="font-mono">{l.tracking_code}</td>
																		<td class="whitespace-nowrap">{formatDate(l.event_date)}</td>
																		<td class="text-right tabular-nums"
																			>{peso.format(l.base_amount)}</td
																		>
																		<td class="text-right tabular-nums">
																			{peso.format(l.incentive_amount)}
																		</td>
																	</tr>
																{/each}
															</tbody>
														</table>
													</td>
												</tr>
											{/if}
										{:else}
											<tr>
												<td colspan="5" class="py-6 text-center text-base-content/60">
													No officer matches “{officer_query}”.
												</td>
											</tr>
										{/each}
									</tbody>
									<tfoot>
										<tr class="text-xs">
											<td>Total · {count(live.totals.recipient_count)} officers</td>
											<td class="hidden md:table-cell"></td>
											<td class="text-right tabular-nums">{count(live.totals.ticket_count)}</td>
											<td class="hidden text-right tabular-nums sm:table-cell">
												{peso.format(live.totals.base_amount)}
											</td>
											<td class="text-right tabular-nums"
												>{peso.format(live.totals.incentive_amount)}</td
											>
										</tr>
									</tfoot>
								</table>
							</div>
						</div>
					{:else if tab === 'groups'}
						<div class="overflow-x-auto p-3">
							<table class="table table-sm">
								<thead>
									<tr class="text-xs">
										<th>Group</th>
										<th>Rate applied</th>
										<th class="text-right">Tickets</th>
										<th class="hidden text-right sm:table-cell">Base</th>
										<th class="text-right">Incentive</th>
									</tr>
								</thead>
								<tbody>
									{#each all_rows.by_group as g (g.group)}
										{@const lg = live_by_group.get(g.group)}
										{@const applied = applied_by_group.get(g.group)}
										<tr>
											<td class="font-medium">{g.name}</td>
											<td class="text-xs">
												{#if applied}
													{describeRate(applied.applied, peso)} · {basisLabel(
														applied.applied.basis
													)}
													{#if applied.overridden}
														<span class="badge badge-soft badge-xs badge-warning">changed</span>
													{/if}
												{/if}
											</td>
											<td class="text-right tabular-nums">{count(lg?.ticket_count ?? 0)}</td>
											<td class="hidden text-right tabular-nums sm:table-cell">
												{peso.format(lg?.base_amount ?? 0)}
											</td>
											<td class="text-right font-medium tabular-nums">
												{peso.format(lg?.incentive_amount ?? 0)}
											</td>
										</tr>
									{/each}
								</tbody>
								<tfoot>
									<tr class="text-xs">
										<td colspan="2">Total</td>
										<td class="text-right tabular-nums">{count(live.totals.ticket_count)}</td>
										<td class="hidden text-right tabular-nums sm:table-cell">
											{peso.format(live.totals.base_amount)}
										</td>
										<td class="text-right tabular-nums"
											>{peso.format(live.totals.incentive_amount)}</td
										>
									</tr>
								</tfoot>
							</table>
						</div>
					{:else}
						<div class="flex flex-col gap-3 p-4">
							{#if $form.excluded.length}
								<p class="text-xs text-base-content/60">
									Each ticket left out needs a reason; it is kept with the report. A ticket left out
									here can still be counted in a later report.
								</p>
								<ul class="flex flex-col gap-2">
									{#each $form.excluded as ex, i (ex.issuance)}
										{@const line = line_by_id.get(ex.issuance)}
										{@const short = ex.reason.trim().length < 3}
										<li class="grid grid-cols-1 items-start gap-2 sm:grid-cols-[13rem_1fr_auto]">
											<span class="text-xs">
												<span class="font-mono font-medium">{line?.tracking_code}</span>
												<span class="block text-base-content/60">
													{line ? preview.people[line.issuer]?.name : ''}
													{#if line}· {peso.format(line.incentive_amount)}{/if}
												</span>
											</span>
											<span>
												<input
													type="text"
													class={[
														'input input-sm w-full',
														($errors.excluded?.[i]?.reason || (short && ex.reason)) && 'input-error'
													]}
													placeholder="Why is this ticket left out?"
													aria-label={`Reason for leaving out ${line?.tracking_code}`}
													bind:value={$form.excluded[i].reason}
												/>
												<InputError>
													{$errors.excluded?.[i]?.reason?.[0] ??
														(short && ex.reason ? 'At least 3 characters.' : '')}
												</InputError>
											</span>
											<button
												type="button"
												class="btn gap-1 btn-ghost btn-xs"
												onclick={() => setExcluded(ex.issuance, false)}
											>
												<Undo2 class="size-3.5" /> Put back
											</button>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="py-6 text-center text-sm text-base-content/60">
									Nothing left out. Open an officer on the first tab and tick a ticket to leave it
									out of this report.
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</section>
	</div>

	<!-- the payout summary: always in view on a desktop -->
	<aside
		id="payout-summary"
		class="flex scroll-mt-4 flex-col rounded-box border border-base-300 bg-base-100 lg:sticky lg:top-0"
		aria-labelledby="summary-heading"
	>
		<div class="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3">
			<h2 id="summary-heading" class="text-sm font-semibold">Payout summary</h2>
			<span class="flex items-center gap-1 text-xs" aria-live="polite">
				{#if previewing}
					<LoaderCircle class="size-3.5 animate-spin text-primary" />
					<span class="text-base-content/70">Updating</span>
				{:else if !can_preview}
					<CircleDashed class="size-3.5 text-base-content/50" />
					<span class="text-base-content/60">Needs setup</span>
				{:else if preview_error && requested_key === current_key}
					<CircleAlert class="size-3.5 text-error" />
					<span class="text-error">Couldn’t preview</span>
				{:else if up_to_date}
					<CircleCheck class="size-3.5 text-success" />
					<span class="text-base-content/70">Up to date</span>
				{:else}
					<span class="text-warning">Out of date</span>
				{/if}
				{#if can_preview && !previewing}
					<button
						type="button"
						class="btn btn-square btn-ghost btn-xs"
						aria-label="Refresh the preview"
						title="Refresh the preview"
						onclick={refresh}
					>
						<RefreshCw class="size-3.5" />
					</button>
				{/if}
			</span>
		</div>

		<dl class="flex flex-col gap-1.5 px-4 py-3 text-sm">
			<div class="flex justify-between gap-3">
				<dt class="text-base-content/60">Groups</dt>
				<dd class="tabular-nums">{included.length}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-base-content/60">Officers</dt>
				<dd class="tabular-nums">{live ? count(live.totals.recipient_count) : '—'}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-base-content/60">Tickets</dt>
				<dd class="tabular-nums">{live ? count(live.totals.ticket_count) : '—'}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-base-content/60">Base amount</dt>
				<dd class="tabular-nums">{live ? peso.format(live.totals.base_amount) : '—'}</dd>
			</div>
			<div
				class={[
					'mt-1.5 flex items-baseline justify-between gap-3 border-t-2 border-double border-base-300 pt-2.5',
					!up_to_date && 'opacity-60'
				]}
			>
				<dt class="font-medium">Total incentive</dt>
				<dd class="text-xl font-semibold tabular-nums">
					{live ? peso.format(live.totals.incentive_amount) : '—'}
				</dd>
			</div>
		</dl>

		{#if preview_error && requested_key === current_key && !previewing}
			<p class="mx-4 mb-2 rounded-field bg-error/10 px-3 py-2 text-xs text-error">
				{preview_error}
			</p>
		{/if}

		<div class="flex flex-col gap-2 border-t border-base-300 px-4 py-3">
			<h3 class="text-xs font-medium text-base-content/70">Before generating</h3>
			<ul class="flex flex-col gap-1">
				{#each checklist as c (c.text)}
					<li>
						<button
							type="button"
							class="flex w-full items-start gap-2 rounded-field px-1 py-0.5 text-left text-xs hover:bg-base-200"
							onclick={() => jump(c.target, c.tab)}
						>
							{#if c.ok}
								<CircleCheck class="mt-px size-3.5 shrink-0 text-success" />
							{:else}
								<CircleAlert class="mt-px size-3.5 shrink-0 text-warning" />
							{/if}
							<span class={[c.ok ? 'text-base-content/70' : 'text-base-content']}>{c.text}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>

		<div class="flex flex-col gap-3 border-t border-base-300 px-4 py-3">
			<label class="flex flex-col gap-1">
				<span class="text-xs text-base-content/70">Remarks (optional)</span>
				<textarea
					class="textarea textarea-sm w-full"
					rows="2"
					placeholder="Anything finance should know"
					bind:value={$form.remarks}
				></textarea>
				<InputError>{$errors.remarks?.[0]}</InputError>
			</label>

			{#if confirming && ready && live}
				<div class="flex flex-col gap-2 rounded-field bg-primary/10 p-3">
					<p class="text-xs">
						Generate <strong class="tabular-nums"
							>{peso.format(live.totals.incentive_amount)}</strong
						>
						for {count(live.totals.recipient_count)} officers? Its {count(live.totals.ticket_count)} tickets
						are locked to this report.
					</p>
					<div class="flex gap-2">
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => (confirming = false)}>
							Cancel
						</button>
						<button type="submit" formaction="?/generate" class="btn grow btn-sm btn-primary">
							Confirm & generate
						</button>
					</div>
				</div>
			{:else}
				<button
					type="button"
					class="btn gap-1.5 btn-primary"
					disabled={!ready}
					onclick={() => (confirming = true)}
				>
					{#if generating}
						<LoaderCircle class="size-4 animate-spin" /> Generating…
					{:else}
						<FilePlus class="size-4" /> Generate report
					{/if}
				</button>
				{#if blocker && !generating}
					<p class="text-center text-xs text-base-content/60">{blocker.text}</p>
				{/if}
			{/if}
		</div>
	</aside>

	<!-- below the desktop layout the summary sits at the end, so keep the total in reach -->
	<div
		class="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-base-300 bg-base-100 px-4 py-2.5 lg:hidden"
	>
		<span class="flex flex-col">
			<span class="text-xs text-base-content/60">
				{previewing ? 'Updating…' : up_to_date ? 'Total incentive' : 'Total (out of date)'}
			</span>
			<span class="font-semibold tabular-nums">
				{live ? peso.format(live.totals.incentive_amount) : '—'}
			</span>
		</span>
		<button type="button" class="btn btn-sm" onclick={() => jump('payout-summary')}>
			Summary
		</button>
	</div>
</form>
