<script lang="ts">
	import type { SelectItems } from '$lib/types/T_select_options';
	import { onMount } from 'svelte';
	import InputError from './InputError.svelte';
	import { Check } from '@lucide/svelte';

	let {
		placeholder = 'Search...',
		empty_error = 'No items found.',
		options = $bindable<SelectItems[]>(),
		label,
		on_search,
		name,
		form_value = $bindable(),
		form_error,
		form_constraints,
		size = 'md',
		on_select
	}: {
		placeholder: string;
		empty_error: string;
		options: SelectItems[];
		label: string;
		on_search: Function;
		name: string;
		form_value?: string;
		form_error?: string[] | undefined;
		form_constraints?:
			| Partial<{
					pattern: string;
					min: number | string;
					max: number | string;
					required: boolean;
					step: number | 'any';
					minlength: number;
					maxlength: number;
			  }>
			| undefined;
		size?: 'sm' | 'md' | 'lg' | 'full';
		on_select?: Function;
	} = $props();

	let show_dropdown = $state(false);
	let combobox: HTMLDivElement;
	let timeout: any;
	let selected_items = $state<string | undefined>();
	let placeholder_value = $state<string>();

	const handle_search = (_s: string) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			on_search(_s);
		}, 500);
	};

	const handle_select = (
		e: Event & {
			currentTarget: EventTarget & HTMLInputElement;
		},
		label: string
	) => {
		if (e.currentTarget.checked) {
			let _val = e.currentTarget.value;

			placeholder_value = label;
			selected_items = _val;

			if (on_select) {
				on_select(_val);
			}
			show_dropdown = false;
		} else {
			placeholder_value = '';
			selected_items = '';
		}
	};

	onMount(() => {
		const handleModalMouseDown = (e: EventTarget) => {
			//@ts-ignore
			if (combobox && !combobox.contains(e)) {
				show_dropdown = false;
			}
		};

		document.addEventListener('mousedown', (e) => handleModalMouseDown(e.target as EventTarget));
	});
</script>

<fieldset
	class={[
		`fieldset w-full`,
		size == 'md' && `max-w-72`,
		size == 'lg' && ` max-w-[30rem]`,
		size == 'full' && `w-full`
	]}
>
	<legend class="fieldset-legend">{label}<span class="text-error">*</span></legend>

	<div class="relative flex w-full flex-col" bind:this={combobox}>
		<input
			class=" input input-md w-full"
			onfocus={() => (show_dropdown = true)}
			{placeholder}
			value={placeholder_value}
			name={`placeholder-` + name}
			aria-invalid={form_error ? true : undefined}
			oninput={(e) => handle_search(e.currentTarget.value)}
		/>

		<!-- value holder -->
		<input type="hidden" class="invisible hidden" {name} value={selected_items} />

		<div
			class="absolute top-12 z-50 hidden h-fit max-h-52 w-full overflow-y-auto rounded-sm border-1 border-base-content/20 bg-base-200"
			class:block!={show_dropdown}
		>
			<div class="flex flex-col p-2">
				{#each options as { value, label, detail }, index (index + name + value)}
					<label
						for={`combobox-${value}`}
						class="group flex h-8 w-full cursor-pointer flex-row items-center gap-2 overflow-hidden p-2 transition-colors hover:bg-primary hover:text-primary-content"
					>
						<Check
							class="size-4 stroke-success stroke-0 transition-all group-hover:stroke-primary-content group-has-[:checked]:stroke-2"
						/>

						<p class="min-w-0 grow overflow-hidden overflow-ellipsis">
							{label}<span>{detail}</span>
						</p>
						<input
							id={`combobox-${value}`}
							type="checkbox"
							{value}
							class="group hidden"
							onchange={(e) => {
								handle_select(e, label);
							}}
							checked={selected_items == value}
							{...form_constraints}
						/>
					</label>
				{:else}
					<div
						class="flex h-10 w-full flex-row items-center px-4 py-2 transition-colors text-error"
					>
						{empty_error}
					</div>
				{/each}
			</div>
		</div>
	</div>

	<InputError>{form_error && form_error[0]}</InputError>
</fieldset>
