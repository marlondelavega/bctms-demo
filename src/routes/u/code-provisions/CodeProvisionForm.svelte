<script lang="ts">
	import { resolve } from '$app/paths';
	import type { SelectItems } from '$lib/types/T_select_options';
	import Combo from '$lib/ui/components/input/Combo.svelte';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import { getNumberOrdinal } from '$lib/utilities/helper';
	import type CodeProvision from '$lib/validation_schemas/CodeProvisions.zod';
	import { ArrowLeft, Plus, Trash2 } from '@lucide/svelte';
	import { onMount, tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';

	let {
		mode,
		data
	}: {
		mode: 'create' | 'edit';
		/** the create or edit form from the page's load */
		data:
			| SuperValidated<CodeProvision.Create, App.Superforms.Message>
			| SuperValidated<CodeProvision.Edit, App.Superforms.Message>;
	} = $props();

	const uid = $props.id();

	const MAX_OFFENSES = 10;

	const { form, errors, enhance, constraints, message, delayed, tainted, isTainted, reset } =
		// both schemas share every field rendered here (edit only adds `_id`), so one typed view serves both
		superForm(data as SuperValidated<CodeProvision.Edit, App.Superforms.Message>, {
			dataType: 'json',
			delayMs: 400,
			timeoutMs: 8000,
			taintedMessage: 'Leave this page? Your unsaved changes will be lost.'
		});

	//#region pickers: category, sub-category and enforcement group

	type Named = { _id: string; name: string };
	type Category = Named & { sub_categories?: Named[] };

	const toItems = (rows: Named[]): SelectItems[] =>
		rows.map((r) => ({ label: r.name, value: r._id }));

	const getData = async <T,>(url: string): Promise<T | null> => {
		try {
			const res = await fetch(url);
			return res.ok ? ((await res.json()).data ?? null) : null;
		} catch {
			return null;
		}
	};

	// the saved value is kept in the list even when a search filters it out, so its picker can always
	// show and check it
	const withCurrent = (items: SelectItems[], current: SelectItems | null, search: string) =>
		!current || search || items.some((i) => i.value === current.value)
			? items
			: [current, ...items];

	let categories = $state<SelectItems[]>([]);
	let groups = $state<SelectItems[]>([]);
	let current_category = $state<SelectItems | null>(null);
	let current_group = $state<SelectItems | null>(null);

	const searchCategories = async (search: string = '') => {
		const rows = await getData<Named[]>(
			resolve(`/api/violation-categories?page=1&size=5&search=${encodeURIComponent(search)}`)
		);
		categories = withCurrent(toItems(rows ?? []), current_category, search);
	};

	const searchGroups = async (search: string = '') => {
		const rows = await getData<Named[]>(
			resolve(`/api/enforcement-groups?page=1&size=5&search=${encodeURIComponent(search)}`)
		);
		groups = withCurrent(toItems(rows ?? []), current_group, search);
	};

	// sub-categories live inside their category, so they are filtered here rather than searched
	let all_sub_categories = $state<SelectItems[]>([]);
	let sub_search = $state('');
	let sub_failed = $state(false);

	const sub_categories = $derived(
		all_sub_categories.filter((s) =>
			s.label.toLowerCase().includes(sub_search.trim().toLowerCase())
		)
	);

	// a slow answer for a category the user has already moved off must not overwrite the current one
	let category_request = 0;

	const loadCategory = async (id: string) => {
		const request = ++category_request;
		sub_failed = false;

		if (!id) {
			all_sub_categories = [];
			return;
		}

		const category = await getData<Category>(resolve(`/api/violation-categories/${id}`));
		if (request !== category_request) return;

		if (!category) {
			all_sub_categories = [];
			sub_failed = true;
			return;
		}

		current_category = { label: category.name, value: category._id };
		all_sub_categories = toItems(category.sub_categories ?? []);
		categories = withCurrent(categories, current_category, '');
	};

	// picking (or clearing) a category invalidates the sub-category chosen under the old one
	let loaded_category = untrack(() => $form.violation_category);

	$effect(() => {
		const id = $form.violation_category ?? '';
		untrack(() => {
			if (id === loaded_category) return;
			loaded_category = id;
			$form.violation_sub_category = '';
			sub_search = '';
			loadCategory(id);
		});
	});

	onMount(async () => {
		// edit: the saved category and group come first, so their pickers can show a name straight away
		const loadGroup = async (id: string) => {
			const group = await getData<Named>(resolve(`/api/enforcement-groups/${id}`));
			if (group) current_group = { label: group.name, value: group._id };
		};

		await Promise.all([
			$form.violation_category ? loadCategory($form.violation_category) : null,
			$form.enforcement_group ? loadGroup($form.enforcement_group) : null
		]);

		searchCategories();
		searchGroups();
	});

	//#endregion

	//#region offenses

	type Offense = CodeProvision.Create['penalty'][number];

	const blankOffense = (): Offense => ({ pecuniary: 0, disciplinary: '' });

	const addOffense = async () => {
		if ($form.penalty.length >= MAX_OFFENSES) return;
		$form.penalty = [...$form.penalty, blankOffense()];
		await tick();
		document.getElementById(`${uid}-fine-${$form.penalty.length - 1}`)?.focus();
	};

	const removeOffense = (index: number) => {
		if ($form.penalty.length <= 1) return;
		$form.penalty = $form.penalty.filter((_, i) => i !== index);
	};

	const toggleSurcharge = (index: number, on: boolean) => {
		$form.penalty[index].surcharge = on
			? { type: 'fixed', value: 0, applied_after_days: 30, applied_every_after: 30 }
			: undefined;
	};

	type OffenseErrors = {
		pecuniary?: string[];
		disciplinary?: string[];
		surcharge?: {
			value?: string[];
			applied_after_days?: string[];
			applied_every_after?: string[];
		};
	};

	// superforms files a per-offense error under its index, and one about the list as a whole as a
	// plain list of messages
	const offenseErrors = (index: number): OffenseErrors =>
		(($errors.penalty as unknown as Record<number, OffenseErrors> | undefined) ?? {})[index] ?? {};

	const list_error = $derived.by(() => {
		const e = $errors.penalty as unknown;
		return Array.isArray(e) ? (e[0] as string | undefined) : undefined;
	});

	const peso = (n: number) =>
		new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

	const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

	// the rule in plain words, so it can be checked against what was meant before saving
	const surchargeSummary = (offense: Offense) => {
		const sc = offense.surcharge;
		if (!sc || !(sc.value >= 1) || !(sc.applied_after_days >= 1) || !(sc.applied_every_after >= 1))
			return '';

		const added =
			sc.type === 'percentage'
				? `${sc.value}% of the fine (${peso((offense.pecuniary ?? 0) * (sc.value / 100))})`
				: peso(sc.value);

		return `If unpaid after ${days(sc.applied_after_days)}, ${added} is added, then again every ${days(sc.applied_every_after)}.`;
	};

	//#endregion

	message.subscribe((m) => {
		if (!m) return;
		if (m.type === 'error') toast.error(m.text);
		if (m.type === 'success') toast.success(m.text);
	});

	const has_changes = $derived(isTainted($tainted));
</script>

<form
	class="flex min-h-0 w-full grow flex-col overflow-hidden rounded-box border border-base-300 bg-base-100"
	method="POST"
	action={mode === 'create' ? '?/create' : '?/edit'}
	use:enhance
	novalidate
>
	<header
		class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-base-300 px-4 py-3 md:px-6"
	>
		<a
			class="btn -ml-2 gap-1.5 px-2 btn-ghost btn-sm"
			href={resolve('/u/code-provisions?page=1&size=10')}
		>
			<ArrowLeft class="size-4" /> Code provisions
		</a>

		<p class="min-w-0 truncate text-xs text-base-content/70">
			{#if mode === 'edit'}
				{$form.code || 'Untitled provision'}
			{:else}
				Each offense below sets the penalty for a repeat violation.
			{/if}
		</p>
	</header>

	<div class="flex min-h-0 grow flex-col gap-6 overflow-y-auto px-4 py-5 md:px-6">
		<!-- the provision itself -->
		<section class="flex flex-col gap-1" aria-labelledby={`${uid}-provision`}>
			<h2 id={`${uid}-provision`} class="text-sm font-semibold">Provision</h2>
			<p class="text-xs text-base-content/60">
				The code is how officers and records refer to it; the descriptor is the short name printed
				on tickets and billings.
			</p>

			<div class="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Code<span class="text-error">*</span></legend>
					<input
						type="text"
						class={['input w-full', $errors.code && 'border-error']}
						placeholder="AS-2019-21"
						name="code"
						autocomplete="off"
						spellcheck="false"
						bind:value={$form.code}
						{...$constraints.code}
						aria-invalid={$errors.code ? true : undefined}
						aria-describedby={`${uid}-code-error`}
					/>
					<InputError id={`${uid}-code-error`}>{$errors.code && $errors.code[0]}</InputError>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">Descriptor<span class="text-error">*</span></legend>
					<input
						type="text"
						class={['input w-full', $errors.descriptor && 'border-error']}
						placeholder="No helmet"
						name="descriptor"
						autocomplete="off"
						bind:value={$form.descriptor}
						{...$constraints.descriptor}
						aria-invalid={$errors.descriptor ? true : undefined}
						aria-describedby={`${uid}-descriptor-error`}
					/>
					<InputError id={`${uid}-descriptor-error`}
						>{$errors.descriptor && $errors.descriptor[0]}</InputError
					>
				</fieldset>

				<fieldset class="fieldset sm:col-span-2">
					<legend class="fieldset-legend">Description<span class="text-error">*</span></legend>
					<textarea
						class={['textarea min-h-28 w-full', $errors.description && 'border-error']}
						placeholder="The full wording of the ordinance, or a detailed explanation of what this provision covers."
						name="description"
						bind:value={$form.description}
						{...$constraints.description}
						aria-invalid={$errors.description ? true : undefined}
						aria-describedby={`${uid}-description-error`}
					></textarea>
					<InputError id={`${uid}-description-error`}
						>{$errors.description && $errors.description[0]}</InputError
					>
				</fieldset>
			</div>
		</section>

		<!-- where it sits -->
		<section
			class="flex flex-col gap-1 border-t border-base-300 pt-5"
			aria-labelledby={`${uid}-classification`}
		>
			<h2 id={`${uid}-classification`} class="text-sm font-semibold">Classification</h2>
			<p class="text-xs text-base-content/60">
				Where this provision is filed, and the enforcement group that applies it.
			</p>

			<div class="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
				<Combo
					options={categories}
					placeholder="Search categories..."
					empty_error="No categories match that search."
					label="Violation category"
					on_search={(s: string) => searchCategories(s)}
					name="violation_category"
					bind:value={$form.violation_category}
					errors={$errors.violation_category}
					constraints={$constraints.violation_category ?? {}}
					width="full"
				/>

				<Combo
					options={sub_categories}
					placeholder={$form.violation_category
						? 'Search sub-categories...'
						: 'Choose a category first'}
					empty_error={sub_failed
						? "Sub-categories couldn't be loaded. Pick the category again."
						: 'This category has no sub-categories.'}
					label="Sub-category"
					on_search={(s: string) => (sub_search = s)}
					name="violation_sub_category"
					bind:value={$form.violation_sub_category}
					errors={$errors.violation_sub_category}
					constraints={$constraints.violation_sub_category ?? {}}
					disabled={!$form.violation_category}
					width="full"
				/>

				<div class="sm:col-span-2 sm:max-w-[calc(50%-0.375rem)]">
					<Combo
						options={groups}
						placeholder="Search groups..."
						empty_error="No groups match that search."
						label="Enforcement group"
						on_search={(s: string) => searchGroups(s)}
						name="enforcement_group"
						bind:value={$form.enforcement_group}
						errors={$errors.enforcement_group}
						constraints={$constraints.enforcement_group ?? {}}
						width="full"
					/>
				</div>
			</div>
		</section>

		<!-- penalties -->
		<section
			class="flex flex-col gap-3 border-t border-base-300 pt-5"
			aria-labelledby={`${uid}-offenses`}
		>
			<div class="flex flex-col gap-1">
				<h2 id={`${uid}-offenses`} class="text-sm font-semibold">Penalty by offense</h2>
				<p class="text-xs text-base-content/60">
					A violator's 1st violation of this provision gets the 1st offense's penalty, the 2nd gets
					the 2nd, and so on. Past the last one listed, the last penalty keeps applying. Empty
					offenses at the end are left out when you save.
				</p>
			</div>

			{#if list_error}
				<p
					class="rounded-field bg-error/10 px-3 py-2 text-sm text-error"
					role="alert"
					id={`${uid}-offenses-error`}
				>
					{list_error}
				</p>
			{/if}

			<ol class="flex flex-col gap-3">
				{#each $form.penalty as offense, index (index)}
					{@const ordinal = `${getNumberOrdinal(index + 1)} offense`}
					{@const errs = offenseErrors(index)}
					{@const summary = surchargeSummary(offense)}

					<li class="rounded-box border border-base-300" aria-label={ordinal}>
						<div
							class="flex items-center justify-between gap-2 border-b border-base-300 bg-base-200/40 px-4 py-2"
						>
							<h3 class="text-sm font-semibold">{ordinal}</h3>

							{#if $form.penalty.length > 1}
								<button
									type="button"
									class="btn btn-square text-base-content/70 btn-ghost btn-xs hover:text-error"
									aria-label={`Remove ${ordinal}`}
									onclick={() => removeOffense(index)}
								>
									<Trash2 class="size-4" />
								</button>
							{/if}
						</div>

						<div class="grid grid-cols-1 gap-x-3 px-4 pt-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Fine</legend>
								<label class={['input w-full gap-2', errs.pecuniary && 'border-error']}>
									<span class="text-base-content/70" aria-hidden="true">₱</span>
									<input
										id={`${uid}-fine-${index}`}
										type="number"
										inputmode="decimal"
										min="0"
										step="0.01"
										class="tabular-nums"
										placeholder={String(500 * (index + 1))}
										aria-label={`${ordinal} fine in pesos`}
										aria-invalid={errs.pecuniary ? true : undefined}
										aria-describedby={`${uid}-fine-${index}-error`}
										bind:value={$form.penalty[index].pecuniary}
									/>
								</label>
								<InputError id={`${uid}-fine-${index}-error`}>{errs.pecuniary?.[0]}</InputError>
							</fieldset>

							<fieldset class="fieldset">
								<legend class="fieldset-legend">Disciplinary action</legend>
								<textarea
									class={['textarea min-h-12 w-full', errs.disciplinary && 'border-error']}
									rows="2"
									placeholder="Suspension of driver's license"
									aria-label={`${ordinal} disciplinary action`}
									aria-invalid={errs.disciplinary ? true : undefined}
									bind:value={$form.penalty[index].disciplinary}
								></textarea>
								<InputError>{errs.disciplinary?.[0]}</InputError>
							</fieldset>
						</div>

						<div class="flex flex-col gap-2 border-t border-base-300 px-4 py-3">
							<label class="flex w-fit cursor-pointer items-center gap-2 text-sm">
								<input
									type="checkbox"
									class="toggle toggle-sm"
									checked={!!offense.surcharge}
									onchange={(e) => toggleSurcharge(index, e.currentTarget.checked)}
								/>
								Add a surcharge if the fine isn't paid in time
							</label>

							{#if $form.penalty[index].surcharge}
								<div class="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
									<fieldset class="fieldset">
										<legend class="fieldset-legend">Surcharge</legend>
										<div class="join w-full">
											<input
												type="number"
												inputmode="decimal"
												min="0"
												step="0.01"
												class={[
													'input join-item w-full tabular-nums',
													errs.surcharge?.value && 'border-error'
												]}
												aria-label={`${ordinal} surcharge amount`}
												aria-invalid={errs.surcharge?.value ? true : undefined}
												bind:value={$form.penalty[index].surcharge.value}
											/>
											<select
												class="select join-item w-20 shrink-0"
												aria-label={`${ordinal} surcharge type`}
												bind:value={$form.penalty[index].surcharge.type}
											>
												<option value="fixed">₱</option>
												<option value="percentage">%</option>
											</select>
										</div>
										<InputError>{errs.surcharge?.value?.[0]}</InputError>
									</fieldset>

									<fieldset class="fieldset">
										<legend class="fieldset-legend">Added after</legend>
										<label
											class={[
												'input w-full gap-2',
												errs.surcharge?.applied_after_days && 'border-error'
											]}
										>
											<input
												type="number"
												inputmode="numeric"
												min="1"
												step="1"
												class="tabular-nums"
												aria-label={`${ordinal} days until the surcharge is added`}
												aria-invalid={errs.surcharge?.applied_after_days ? true : undefined}
												bind:value={$form.penalty[index].surcharge.applied_after_days}
											/>
											<span class="text-base-content/70" aria-hidden="true">days</span>
										</label>
										<InputError>{errs.surcharge?.applied_after_days?.[0]}</InputError>
									</fieldset>

									<fieldset class="fieldset">
										<legend class="fieldset-legend">Repeats every</legend>
										<label
											class={[
												'input w-full gap-2',
												errs.surcharge?.applied_every_after && 'border-error'
											]}
										>
											<input
												type="number"
												inputmode="numeric"
												min="1"
												step="1"
												class="tabular-nums"
												aria-label={`${ordinal} days between repeated surcharges`}
												aria-invalid={errs.surcharge?.applied_every_after ? true : undefined}
												bind:value={$form.penalty[index].surcharge.applied_every_after}
											/>
											<span class="text-base-content/70" aria-hidden="true">days</span>
										</label>
										<InputError>{errs.surcharge?.applied_every_after?.[0]}</InputError>
									</fieldset>
								</div>

								<p class="min-h-4 text-xs text-base-content/70" aria-live="polite">
									{summary}
								</p>
							{/if}
						</div>
					</li>
				{/each}
			</ol>

			<div class="flex items-center gap-3">
				<button
					type="button"
					class="btn gap-1.5 btn-outline btn-sm"
					disabled={$form.penalty.length >= MAX_OFFENSES}
					onclick={addOffense}
				>
					<Plus class="size-4" /> Add offense
				</button>
				<span class="text-xs text-base-content/60 tabular-nums">
					{$form.penalty.length} of {MAX_OFFENSES}
				</span>
			</div>
		</section>
	</div>

	<footer
		class="flex flex-row items-center justify-between gap-3 border-t border-base-300 px-4 py-3 md:px-6"
	>
		<p class="flex items-center gap-2 text-xs text-base-content/70" aria-live="polite">
			{#if has_changes && mode === 'edit'}
				<span class="size-1.5 rounded-full bg-warning" aria-hidden="true"></span>
				Unsaved changes
			{:else}
				<span><span class="text-error">*</span> Required</span>
			{/if}
		</p>

		<div class="flex flex-row gap-2">
			{#if mode === 'create'}
				<button
					class="btn btn-ghost btn-sm md:btn-md"
					type="button"
					onclick={() => reset()}
					disabled={!has_changes || $delayed}>Clear</button
				>
			{:else}
				<a
					class="btn btn-ghost btn-sm md:btn-md"
					href={resolve('/u/code-provisions?page=1&size=10')}>Cancel</a
				>
			{/if}
			<button
				class="btn w-fit min-w-32 btn-sm btn-primary md:btn-md"
				type="submit"
				disabled={$delayed}
			>
				{#if $delayed}
					<span class="loading loading-xs loading-spinner"></span>
					{mode === 'create' ? 'Adding' : 'Saving'}
				{:else}
					{mode === 'create' ? 'Add provision' : 'Save changes'}
				{/if}
			</button>
		</div>
	</footer>
</form>
