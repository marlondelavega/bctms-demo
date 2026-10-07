<script lang="ts">
	import type { SelectItems } from '$lib/types/T_select_options';
	import { Check, X } from '@lucide/svelte';
	import InputError from './InputError.svelte';
	import { dropdownPosition, keepInputFocus } from './dropdown_position';
	import { untrack } from 'svelte';

	let {
		label,
		name,
		placeholder = `Select ${name.split('.').at(-1)}`,
		width = 'md',
		options = $bindable<SelectItems[]>(),
		allow_errors = true,
		empty_error,
		on_search,
		on_select,
		on_remove,
		value = $bindable(),
		constraints = {},
		errors = [],
		disabled = false,
		autofocus = false,
		search_timeout = 500,
		multiple = false,
		disabled_chip_list = false,
		searching = false
	}: {
		label: string;
		name: string;
		placeholder?: string;
		width?: 'sm' | 'md' | 'lg' | 'full';
		options: SelectItems[];
		allow_errors?: boolean;
		empty_error?: string;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		on_search?: Function;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		on_select?: Function;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		on_remove?: Function;
		value: unknown;
		constraints?: object;
		errors: string[] | undefined;
		disabled?: boolean;
		autofocus?: boolean;
		search_timeout?: number;
		/** When true, allows selecting more than one option. `value` becomes an array,
		 *  the dropdown stays open across picks, and selections render as removable chips. */
		multiple?: boolean;
		disabled_chip_list?: boolean;
		searching?: boolean;
	} = $props();

	const uid = $props.id();
	let timeout: NodeJS.Timeout;
	let combobox: HTMLDivElement;
	let open = $state(false);
	let active_index = $state(-1);

	const option_id = (index: number) => `${uid}-opt-${index}`;

	// Single-select state (unchanged behavior)
	let selected = $state<SelectItems>();
	let placeholder_value = $state<string>('');

	// Multi-select state
	let selected_items = $state<SelectItems[]>(
		multiple && Array.isArray(value)
			? options.filter((o) => (value as unknown[]).includes(o.value))
			: []
	);
	let search_value = $state<string>('');

	const is_selected = (v: unknown) =>
		multiple ? selected_items.some((i) => i.value == v) : selected?.value == v;

	const search = (_s: string) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			search_value = _s;
			if (on_search) {
				on_search(_s);
			}
		}, search_timeout);
	};

	const select = (args: SelectItems) => {
		if (multiple) {
			const exists = selected_items.some((i) => i.value == args.value);
			if (exists) {
				selected_items = selected_items.filter((i) => i.value != args.value);
				if (on_remove) on_remove(args);
			} else {
				selected_items = [...selected_items, args];
				if (on_select) on_select(args);
			}
			value = selected_items.map((i) => i.value);
			// keep the dropdown open and the search box clear for the next pick
			search_value = '';
			return;
		}

		selected = args;
		value = args.value;
		placeholder_value = args.label;
		search_value = args.label;
		if (on_select) {
			placeholder_value = options.find((i) => i.value == value)?.label ?? '';
			on_select(args);
		}
	};

	// picking the selected option again clears it (single) or removes it (multiple)
	const choose = (option: SelectItems) => {
		if (!multiple && selected?.value == option.value) {
			select({ label: '', value: '' });
		} else {
			select({ label: option.label, value: option.value });
		}
		if (!multiple) closeList();
	};

	const remove_chip = (item: SelectItems) => {
		selected_items = selected_items.filter((i) => i.value != item.value);
		value = selected_items.map((i) => i.value);
		if (on_remove) on_remove(item);
	};

	const clear = () => {
		search_value = '';
		if (multiple) {
			const removed = selected_items;
			selected_items = [];
			value = [];
			if (on_remove) removed.forEach((i) => on_remove?.(i));
			return;
		}
		placeholder_value = '';
		selected = { label: '', value: '', detail: '' };
		if (on_search) {
			on_search('');
		}
	};

	const openList = () => {
		if (!disabled && !combobox.matches(':popover-open')) combobox.showPopover();
	};

	const closeList = () => {
		if (combobox.matches(':popover-open')) combobox.hidePopover();
	};

	const moveActive = (step: 1 | -1) => {
		const count = searching ? 0 : options.length;
		if (!count) return;
		if (active_index < 0 || active_index >= count) {
			active_index = step === 1 ? 0 : count - 1;
		} else {
			active_index = (active_index + step + count) % count;
		}
		document.getElementById(option_id(active_index))?.scrollIntoView({ block: 'nearest' });
	};

	const onKeydown = (e: KeyboardEvent) => {
		switch (e.key) {
			case 'ArrowDown':
			case 'ArrowUp':
				e.preventDefault();
				openList();
				moveActive(e.key === 'ArrowDown' ? 1 : -1);
				break;
			case 'Enter':
				if (!open) return;
				// keep Enter from reaching the form while the list is open
				e.preventDefault();
				if (!searching && options[active_index]) choose(options[active_index]);
				break;
			case 'Escape':
				if (!open) return;
				e.preventDefault();
				closeList();
				break;
			case 'Tab':
				closeList();
				break;
		}
	};

	$effect(() => {
		if (!multiple) return;

		const ids = Array.isArray(value) ? (value as unknown[]) : [];
		const current_ids = untrack(() => selected_items.map((i) => i.value));

		const already_matches =
			ids.length === current_ids.length && ids.every((id) => current_ids.includes(id));
		if (already_matches) return;

		// an id that isn't in the current results (e.g. pre-filled) is kept rather than dropped,
		// otherwise the next pick would rewrite `value` without it
		selected_items = ids.map(
			(id) =>
				options.find((o) => o.value == id) ??
				untrack(() => selected_items.find((i) => i.value == id)) ?? {
					label: String(id),
					value: id
				}
		);
	});

	// a new result set invalidates the highlighted row
	$effect(() => {
		void options;
		void searching;
		untrack(() => (active_index = -1));
	});
</script>

<fieldset
	class={[
		`fieldset`,
		width === 'sm' && 'w-48',
		width === 'md' && 'w-64',
		width === 'lg' && 'w-96',
		width === 'full' && 'w-full'
	]}
>
	<legend class="fieldset-legend text-xs">{label}<span class="text-error">*</span></legend>

	<label class="group relative" for={`${uid}-input`}>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			class={['input input-md w-full pr-10', disabled && 'input-disabled']}
			onclick={(e) => {
				openList();
				if (search_value != e.currentTarget.value) {
					search(e.currentTarget.value);
				}
			}}
			oninput={(e) => {
				openList();
				if (multiple) {
					search(e.currentTarget.value);
					return;
				}
				if (e.currentTarget.value === '') {
					value = '';
					selected = { label: '', value: '' };
				} else {
					search(e.currentTarget.value);
				}
			}}
			onkeydown={onKeydown}
			onchange={(e) => {
				if (multiple) return;
				if (
					e.currentTarget.value === '' ||
					!options.find((option) => option.label === e.currentTarget.value)
				) {
					value = '';
					selected = { label: '', value: '' };
				}
			}}
			type="text"
			role="combobox"
			autocomplete="off"
			aria-autocomplete="list"
			aria-expanded={open}
			aria-controls={`${uid}-list`}
			aria-activedescendant={open && active_index >= 0 ? option_id(active_index) : undefined}
			aria-invalid={errors?.length ? true : undefined}
			aria-describedby={allow_errors && errors?.length ? `${uid}-error` : undefined}
			placeholder={multiple
				? selected_items.length
					? `Search to add more (${selected_items.length} selected)`
					: placeholder
				: placeholder}
			bind:value={
				() => (multiple ? search_value : placeholder_value),
				(v) => (multiple ? (search_value = v) : (placeholder_value = v))
			}
			{...constraints}
			{disabled}
			id={`${uid}-input`}
			style={`anchor-name:--${uid}`}
			tabindex="0"
			{autofocus}
		/>

		{#if multiple ? selected_items.length > 0 : placeholder_value}
			<button
				class="absolute top-1/2 right-1.5 z-50 -translate-y-1/2 cursor-pointer rounded-full p-1.5 hover:bg-base-200"
				type="button"
				aria-label={multiple ? `Clear all ${label.toLowerCase()}` : `Clear ${label}`}
				onclick={() => clear()}
			>
				<X class="size-4" />
			</button>
		{/if}

		{#if multiple}
			{#each selected_items as item (item.value)}
				<input type="hidden" {name} value={item.value} />
			{:else}
				<input type="hidden" {name} value="" />
			{/each}
		{:else}
			<input type="hidden" {name} value={value ? value : null} />
		{/if}
	</label>

	<!-- kept outside the <label> so a click on an option or chip is never forwarded to the input -->
	<div
		bind:this={combobox}
		class="dropdown z-20 max-h-72 w-full overflow-y-auto rounded-md bg-base-200 p-1.5 shadow-lg"
		id={`${uid}-list`}
		role="listbox"
		aria-label={label}
		aria-multiselectable={multiple || undefined}
		aria-busy={searching || undefined}
		popover
		ontoggle={(e) => {
			open = (e as ToggleEvent).newState === 'open';
			if (!open) active_index = -1;
		}}
		style={dropdownPosition(uid)}
	>
		{#if searching}
			<div class="flex min-h-14 w-full flex-row items-center justify-center gap-4 p-2 text-sm">
				<span class="loading loading-spinner loading-md"></span>
				Searching...
			</div>
		{:else}
			{#each options as option, index (index)}
				<button
					class={[
						'btn flex h-fit min-h-11 w-full cursor-pointer flex-row items-center justify-start gap-3 border-none py-2 text-left font-normal btn-ghost btn-sm',
						index === active_index && 'bg-base-300'
					]}
					id={option_id(index)}
					role="option"
					aria-selected={is_selected(option.value)}
					onmousedown={keepInputFocus}
					onclick={() => choose(option)}
					onmouseenter={() => (active_index = index)}
					type="button"
				>
					<Check
						class={[
							`size-4 shrink-0 stroke-success stroke-0 transition-all`,
							is_selected(option.value) && `stroke-2`
						]}
					/>

					<span class="flex min-w-0 flex-col">
						<span class="truncate text-sm">{option.label}</span>
						{#if option.detail}
							<span class="truncate text-xs text-base-content/60">{option.detail}</span>
						{/if}
					</span>
				</button>
			{:else}
				<div
					class="px-3 py-2.5 text-sm text-base-content/60"
					role="option"
					aria-selected="false"
					aria-disabled="true"
				>
					{#if empty_error}
						{empty_error}
					{:else}
						No data found...
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	{#if multiple && selected_items.length > 0 && disabled_chip_list == false}
		<div class="mt-2 flex max-h-36 flex-wrap gap-2 overflow-x-auto">
			{#each selected_items as item (item.value)}
				<span class="badge gap-1 badge-sm badge-soft text-xs badge-primary">
					{item.label}
					<button
						type="button"
						class="cursor-pointer rounded-full p-0.5 hover:bg-primary/20"
						aria-label={`Remove ${item.label}`}
						onclick={() => remove_chip(item)}
					>
						<X class="size-3" />
					</button>
				</span>
			{/each}
		</div>
	{/if}
	{#if allow_errors}
		<InputError id={`${uid}-error`}>{errors && errors[0]}</InputError>
	{/if}
</fieldset>
