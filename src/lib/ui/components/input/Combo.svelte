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
		value = $bindable(),
		constraints = {},
		errors = [],
		disabled = false,
		autofocus = false,
		search_timeout = 500,
		size = 'md',
		required_mark = true
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
		value: unknown;
		constraints?: object;
		errors: string[] | undefined;
		disabled?: boolean;
		autofocus?: boolean;
		search_timeout?: number;
		/** `sm` lines it up with the compact filter fields */
		size?: 'sm' | 'md';
		/** the red asterisk; turn off for optional fields such as filters */
		required_mark?: boolean;
	} = $props();

	// the field name repeats when a page has the same picker twice (a filter and a modal), so ids come from the instance
	const uid = $props.id();
	let timeout: NodeJS.Timeout;
	let combobox: HTMLDivElement;
	let selected = $state<SelectItems>();
	let placeholder_value = $state<string>('');
	let search_value = $state<string>('');
	let open = $state(false);
	let active_index = $state(-1);

	const option_id = (index: number) => `${uid}-opt-${index}`;

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
		selected = args;
		value = args.value;
		placeholder_value = args.label;
		search_value = args.label;
		if (on_select) {
			on_select(args);
		}
	};

	// picking the selected option again clears it
	const choose = (option: SelectItems) => {
		if (selected?.value == option.value) {
			select({ label: '', value: '' });
		} else {
			select({ label: option.label, value: option.value });
		}
		closeList();
	};

	const clear = () => {
		search_value = '';
		placeholder_value = '';
		selected = { label: '', value: '', detail: '' };
		value = '';
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
		const count = options.length;
		if (!count) return;
		if (active_index < 0 || active_index >= count) {
			const selected_index = options.findIndex((o) => o.value == selected?.value);
			active_index = selected_index >= 0 ? selected_index : step === 1 ? 0 : count - 1;
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
				if (options[active_index]) choose(options[active_index]);
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
		if (value) {
			const currentValue = untrack(() => selected?.value);
			if (currentValue != value) {
				const found = options.find((option) => option.value == value);
				if (found) {
					selected = found;
					placeholder_value = found.label;
					search_value = found.label;
				}
			}
		} else {
			const hasDisplay = untrack(() => selected?.value || placeholder_value);
			if (hasDisplay) {
				selected = { label: '', value: '', detail: '' };
				placeholder_value = '';
				search_value = '';
			}
		}
	});

	// a new result set invalidates the highlighted row
	$effect(() => {
		void options;
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
	<legend class="fieldset-legend text-xs"
		>{label}{#if required_mark}<span class="text-error">*</span>{/if}</legend
	>

	<label class="group relative" for={`${uid}-input`}>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			class={[
				'input w-full pr-10',
				size === 'sm' ? 'input-sm' : 'input-md',
				disabled && 'input-disabled'
			]}
			onclick={(e) => {
				openList();
				if (search_value != e.currentTarget.value) {
					search(e.currentTarget.value);
				}
			}}
			oninput={(e) => {
				openList();
				if (e.currentTarget.value === '') {
					value = '';
					selected = { label: '', value: '' };
				} else {
					search(e.currentTarget.value);
				}
			}}
			onkeydown={onKeydown}
			onchange={(e) => {
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
			{placeholder}
			bind:value={placeholder_value}
			{...constraints}
			{disabled}
			id={`${uid}-input`}
			style={`anchor-name:--${uid}`}
			tabindex="0"
			{autofocus}
		/>

		{#if placeholder_value}
			<button
				class={[
					'absolute top-1/2 right-1.5 z-50 -translate-y-1/2 cursor-pointer rounded-full hover:bg-base-200',
					size === 'sm' ? 'p-1' : 'p-1.5'
				]}
				type="button"
				aria-label={`Clear ${label}`}
				onclick={() => clear()}
			>
				<X class="size-4" />
			</button>
		{/if}

		<input type="hidden" {name} value={value ? value : null} />
	</label>

	<!-- kept outside the <label> so a click on an option is never forwarded to the input -->
	<div
		bind:this={combobox}
		class="dropdown z-20 max-h-72 w-full overflow-y-auto rounded-md bg-base-200 p-1.5 shadow-lg"
		id={`${uid}-list`}
		role="listbox"
		aria-label={label}
		popover
		ontoggle={(e) => {
			open = (e as ToggleEvent).newState === 'open';
			if (!open) active_index = -1;
		}}
		style={dropdownPosition(uid)}
	>
		{#each options as option, index (index)}
			<button
				class={[
					'btn flex h-fit min-h-11 w-full cursor-pointer flex-row items-center justify-start gap-3 border-none py-2 text-left font-normal btn-ghost btn-sm',
					index === active_index && 'bg-base-300'
				]}
				id={option_id(index)}
				role="option"
				aria-selected={selected?.value == option.value}
				onmousedown={keepInputFocus}
				onclick={() => choose(option)}
				onmouseenter={() => (active_index = index)}
				type="button"
			>
				<Check
					class={[
						`size-4 shrink-0 stroke-success stroke-0 transition-all`,
						selected?.value == option.value && `stroke-2`
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
	</div>
	{#if allow_errors}
		<InputError id={`${uid}-error`}>{errors && errors[0]}</InputError>
	{/if}
</fieldset>
