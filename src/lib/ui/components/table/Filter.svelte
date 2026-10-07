<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { SelectItems } from '$lib/types/T_select_options';
	import { parseSelectItems } from '$lib/utilities/helper';
	import { onMount } from 'svelte';
	import { Search } from '@lucide/svelte';
	import Combo from '../input/Combo.svelte';
	import MultiSelect from '../input/MultiSelect.svelte';
	import Select from '../input/Select.svelte';
	import { issuance_status_select } from '$lib/data/static_data';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
	import Filter from '$lib/validation_schemas/Filter.zod';
	import { activeChips, filter_meta, rememberLabels, updateParams } from './filter_state.svelte';

	export type FilterTypes =
		| 'user_type'
		| 'enforcement_group'
		| 'sex'
		| 'birthdate'
		| 'barangay'
		| 'issuance_status'
		| 'category'
		| 'date_range'
		| 'login';

	//#region superform

	// seeds the form once; later URL changes (chips, pagination) don't overwrite what's being typed
	const params = page.url.searchParams;

	const initial_data: Filter.Base = {
		page: 1,
		size: Number(params.get('size') ?? 10),
		search: params.get('search') ?? '',
		// an absent `archived` means "active only" server-side, so that is the select's default
		archived: params.has('archived') ? (Number(params.get('archived')) as -1 | 0 | 1) : 1,
		enforcement_group: params.get('enforcement_group') ?? '',
		user_type: params.get('user_type') ?? '',
		sex: (params.get('sex') ?? '') as 'male' | 'female' | '',
		birthdate: params.get('birthdate') ?? undefined,
		barangay: params.get('barangay') ?? '',
		date_from: params.get('date_from') ?? undefined,
		date_to: params.get('date_to') ?? undefined,
		login: (params.get('login') ?? '') as 'online' | 'ever' | 'never' | ''
	};

	let superform = superForm(defaults(initial_data, zod4(Filter.Schema)), {
		SPA: true,
		validators: zod4Client(Filter.Schema)
	});

	let { form, constraints, reset } = superform;

	//#endregion

	let { filters, date_label = 'Date' }: { filters?: FilterTypes[]; date_label?: string } = $props();
	let popover: HTMLDivElement;
	const today = new Date().toLocaleDateString('en-CA');

	//#region variables
	const filter_count = $derived(activeChips(page.url.searchParams).length);

	// multi-selects follow the URL, and are emptied by Clear
	const status_options = issuance_status_select.map((s) => ({
		value: String(s.value),
		label: s.label
	}));
	let status_selected = $derived(page.url.searchParams.getAll('status'));
	let category_options = $state<{ value: string; label: string }[]>([]);
	let category_selected = $derived(page.url.searchParams.getAll('category'));

	let user_types_select = $state<SelectItems[]>([]);
	let enforcement_select = $state<SelectItems[]>([]);
	//#endregion

	//#region fetch functions

	// Combos only list a handful of matches, so a filter restored from the URL (an opaque id)
	// may not be among them. Look it up once and pin it to the top so the combo can show its name.
	const fetchOptions = async (url: string, label_key: string, param: string, pinned = '') => {
		try {
			const _rq = await fetch(resolve(url as '/'));
			if (!_rq.ok) return [];
			const rows: Record<string, unknown>[] = (await _rq.json()).data ?? [];
			const items = rows.length ? parseSelectItems(rows, label_key, '_id') : [];
			rememberLabels(param, items);

			if (pinned && !items.some((i) => i.value == pinned)) {
				const _all = await fetch(resolve(url.replace('size=5', 'size=100') as '/'));
				const all: Record<string, unknown>[] = _all.ok ? ((await _all.json()).data ?? []) : [];
				const found = parseSelectItems(all, label_key, '_id');
				rememberLabels(param, found);
				const match = found.find((i) => i.value == pinned);
				if (match) items.unshift(match);
			}
			return items;
		} catch {
			return [];
		}
	};

	const searchUserTypes = async (_s: string = '', pinned = '') => {
		user_types_select = await fetchOptions(
			`/api/user-types?page=1&size=5&search=${encodeURIComponent(_s)}`,
			'user_type',
			'user_type',
			pinned
		);
	};

	const searchEnforcementGroup = async (_s: string = '', pinned = '') => {
		enforcement_select = await fetchOptions(
			`/api/enforcement-groups?page=1&size=5&search=${encodeURIComponent(_s)}`,
			'name',
			'enforcement_group',
			pinned
		);
	};

	// issued tickets snapshot the category *name*, and archived categories still have tickets,
	// so list every category (`archived=0`) and filter by name
	const loadCategories = async () => {
		try {
			const _rq = await fetch(resolve('/api/violation-categories?page=1&size=100&archived=0'));
			if (!_rq.ok) return;
			const rows: { name: string }[] = (await _rq.json()).data ?? [];
			category_options = rows.map((r) => ({ value: r.name, label: r.name }));
		} catch {
			category_options = [];
		}
	};

	const isEditable = (t: EventTarget | null) =>
		t instanceof HTMLElement &&
		(t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.ctrlKey && e.key.toLowerCase() === 'k') {
			// don't steal the shortcut from a field the user is typing in (the filter's own fields are fine)
			if (isEditable(e.target) && !popover.contains(e.target as Node)) return;
			e.preventDefault();
			popover.togglePopover();
		}
	};

	// keyword search applies as you type; the other fields still wait for "Apply filters"
	let search_timer: ReturnType<typeof setTimeout>;
	const liveSearch = (value: string) => {
		clearTimeout(search_timer);
		search_timer = setTimeout(() => {
			const term = value.trim();
			if ((page.url.searchParams.get('search') ?? '') === term) return;
			updateParams((p) => {
				if (term) p.set('search', term);
				else p.delete('search');
			}, true);
		}, 400);
	};

	//#endregion

	onMount(() => {
		if (filters?.includes('user_type')) searchUserTypes('', params.get('user_type') ?? '');
		if (filters?.includes('enforcement_group'))
			searchEnforcementGroup('', params.get('enforcement_group') ?? '');
		if (filters?.includes('category')) loadCategories();

		return () => clearTimeout(search_timer);
	});

	// tells <FilterChips> that this page has a filter, and what its date range should be called
	$effect(() => {
		filter_meta.active = true;
		filter_meta.date_label = date_label;
		return () => {
			filter_meta.active = false;
			filter_meta.date_label = 'Date';
		};
	});
</script>

<svelte:document onkeydown={handleKeydown} />

<button
	type="button"
	class={[
		'relative flex size-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-field border bg-base-100 p-0 text-sm transition-colors hover:border-base-content/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:w-96 md:justify-start md:px-3',
		filter_count > 0 ? 'border-primary/60' : 'border-base-300'
	]}
	popovertarget="filter_popover"
	style="anchor-name:--filter-popover"
	aria-label={filter_count > 0 ? `Search and filter, ${filter_count} active` : 'Search and filter'}
>
	<Search class="size-4 shrink-0 text-base-content/70" />
	<span
		class="hidden grow truncate text-left md:block {filter_count ? '' : 'text-base-content/60'}"
	>
		{#if filter_count > 0}
			{filter_count} active {filter_count == 1 ? 'filter' : 'filters'}
		{:else}
			Search and filter
		{/if}
	</span>
	{#if filter_count > 0}
		<span
			class="badge absolute -top-1.5 -right-1.5 badge-xs badge-primary md:hidden"
			aria-hidden="true">{filter_count}</span
		>
	{/if}
	<kbd class="kbd hidden font-mono kbd-xs opacity-60 md:block">Ctrl K</kbd>
</button>

<div
	class="dropdown mr-4 z-100 w-screen max-w-md bg-transparent px-4 py-2 md:p-0"
	popover
	id="filter_popover"
	style="position-anchor:--filter-popover"
	bind:this={popover}
>
	<form
		class="mt-2 grid w-full grid-cols-2 gap-x-3 gap-y-3 rounded-box border border-base-300 bg-base-100 p-4 shadow-lg"
		id="filter"
		method="GET"
		onsubmit={() => {
			popover.hidePopover();
		}}
		novalidate
	>
		<!-- a new filter set always starts from the first page, or it can land past the last one -->
		<input type="hidden" class="disable_filter invisible hidden" readonly name="page" value="1" />
		<input
			type="hidden"
			class="disable_filter invisible hidden"
			readonly
			name="size"
			value={$form.size}
		/>

		<fieldset class="col-span-2 fieldset">
			<legend class="fieldset-legend text-xs">Keyword search</legend>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="search"
				name="search"
				class="input input-sm w-full"
				placeholder="Search..."
				bind:value={$form.search}
				oninput={(e) => liveSearch(e.currentTarget.value)}
				autofocus
				spellcheck="false"
			/>
		</fieldset>

		<div class="col-span-1">
			<Select
				name="archived"
				label="Status"
				options={Filter.ArchiveSelectItems}
				bind:value={$form.archived}
			/>
		</div>

		{#if filters?.includes('issuance_status')}
			<div class="col-span-1">
				<MultiSelect
					name="status"
					label="Ticket status"
					all_label="All statuses"
					options={status_options}
					selected={status_selected}
				/>
			</div>
		{/if}

		{#if filters?.includes('category')}
			<div class="col-span-1">
				<MultiSelect
					name="category"
					label="Violation category"
					all_label="All categories"
					options={category_options}
					selected={category_selected}
				/>
			</div>
		{/if}

		{#if filters?.includes('login')}
			<div class="col-span-1">
				<Select
					name="login"
					label="Login"
					options={Filter.LoginSelectItems}
					bind:value={$form.login}
					clearable
				/>
			</div>
		{/if}

		{#if filters?.includes('user_type')}
			<div class="col-span-1">
				<Combo
					options={user_types_select}
					placeholder="Select type from the list..."
					empty_error="No user type found..."
					label="User type"
					size="sm"
					required_mark={false}
					on_search={(e: string) => searchUserTypes(e)}
					name="user_type"
					on_select={(selected: SelectItems) => ($form.user_type = selected.value as string)}
					errors={[]}
					constraints={$constraints.user_type ? $constraints.user_type : {}}
					bind:value={$form.user_type}
					width="full"
					allow_errors={false}
				/>
			</div>
		{/if}

		{#if filters?.includes('enforcement_group')}
			<div class="col-span-1">
				<Combo
					options={enforcement_select}
					placeholder="Select group from the list..."
					empty_error="No group found..."
					on_search={(e: string) => searchEnforcementGroup(e)}
					on_select={(selected: SelectItems) =>
						($form.enforcement_group = selected.value as string)}
					name="enforcement_group"
					bind:value={$form.enforcement_group}
					errors={[]}
					constraints={$constraints.enforcement_group ? $constraints.enforcement_group : {}}
					label="Enforcement group"
					size="sm"
					required_mark={false}
					width="full"
					allow_errors={false}
				/>
			</div>
		{/if}

		{#if filters?.includes('sex')}
			<div class="col-span-1">
				<Select
					name="sex"
					label="Sex"
					options={Filter.SexSelectItems}
					bind:value={$form.sex}
					clearable
				/>
			</div>
		{/if}

		{#if filters?.includes('birthdate')}
			<fieldset class="col-span-1 fieldset">
				<legend class="fieldset-legend text-xs">Birthdate</legend>
				<input
					type="date"
					name="birthdate"
					class="input input-sm w-full"
					max={today}
					bind:value={$form.birthdate}
				/>
			</fieldset>
		{/if}

		{#if filters?.includes('barangay')}
			<fieldset class="col-span-1 fieldset">
				<legend class="fieldset-legend text-xs">Barangay</legend>
				<input
					type="text"
					name="barangay"
					class="input input-sm w-full"
					bind:value={$form.barangay}
					{...$constraints.barangay}
				/>
			</fieldset>
		{/if}

		{#if filters?.includes('date_range')}
			<fieldset class="col-span-1 fieldset">
				<legend class="fieldset-legend text-xs">{date_label} from</legend>
				<input
					type="date"
					name="date_from"
					class="input input-sm w-full"
					max={$form.date_to || undefined}
					bind:value={$form.date_from}
				/>
			</fieldset>
			<fieldset class="col-span-1 fieldset">
				<legend class="fieldset-legend text-xs">{date_label} to</legend>
				<input
					type="date"
					name="date_to"
					class="input input-sm w-full"
					min={$form.date_from || undefined}
					bind:value={$form.date_to}
				/>
			</fieldset>
		{/if}

		<div class="col-span-2 mt-1 flex flex-row justify-between gap-3 border-t border-base-300 pt-4">
			<button
				class="btn btn-ghost btn-sm"
				type="button"
				onclick={() => {
					status_selected = [];
					category_selected = [];
					reset({
						data: {
							page: 1,
							size: 10,
							search: '',
							archived: 1,
							enforcement_group: '',
							user_type: '',
							sex: '',
							birthdate: undefined,
							barangay: '',
							date_from: undefined,
							date_to: undefined,
							login: ''
						}
					});
				}}>Clear</button
			>
			<button class="btn grow btn-sm btn-primary" type="submit">Apply filters</button>
		</div>
	</form>
</div>
