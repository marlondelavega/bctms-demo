<script lang="ts">
	import { Check, ChevronDown } from '@lucide/svelte';

	type Option = { value: unknown; label: string };

	let {
		name,
		label,
		options,
		value = $bindable(),
		placeholder = 'Any',
		clearable = false
	}: {
		name: string;
		label: string;
		options: readonly Option[];
		value?: unknown;
		/** shown when nothing is picked */
		placeholder?: string;
		/** adds an "Any" row that clears the pick; leave off when the list already has its own "all" option */
		clearable?: boolean;
	} = $props();

	const key = (v: unknown) => String(v ?? '');
	const selected = $derived(options.find((o) => key(o.value) === key(value)));

	// Same anchored native popover as MultiSelect: it lives in the browser's top layer, so no
	// ancestor (the filter popover, a dialog, an overflow container) can clip it, and the browser
	// handles outside click and Escape. The hidden input carries the pick in a surrounding GET form.
	let open = $state(false);
	let panel: HTMLDivElement;
	const panel_id = $props.id();
	const anchor = `--sel-${panel_id}`;

	const pick = (v: unknown) => {
		value = v;
		panel.hidePopover();
	};
</script>

<fieldset class="fieldset">
	<legend class="fieldset-legend text-xs">{label}</legend>

	<div class="w-full">
		<button
			type="button"
			class="btn w-full justify-between gap-2 px-3 text-left font-normal btn-sm"
			class:btn-active={!!selected && clearable}
			style:anchor-name={anchor}
			popovertarget={panel_id}
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-controls={panel_id}
		>
			<span class={['truncate', !selected && 'text-base-content/60']}
				>{selected?.label ?? placeholder}</span
			>
			<ChevronDown
				class={['size-3.5 shrink-0 opacity-60 transition-transform', open && 'rotate-180']}
			/>
		</button>

		<input type="hidden" {name} value={value ?? ''} />

		<div
			bind:this={panel}
			id={panel_id}
			popover="auto"
			class="sel-panel rounded-box border border-base-300 bg-base-100 p-1 text-base-content shadow-lg"
			style:position-anchor={anchor}
			ontoggle={(e) => (open = (e as ToggleEvent).newState === 'open')}
		>
			<ul class="max-h-56 overflow-y-auto" role="listbox" aria-label={label}>
				{#if clearable}
					<li role="presentation">
						<button
							type="button"
							role="option"
							aria-selected={!selected}
							class="flex w-full cursor-pointer items-center gap-2 rounded-field px-2 py-1.5 text-left text-xs hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
							onclick={() => pick('')}
						>
							<span class="grow text-base-content/70">{placeholder}</span>
							{#if !selected}<Check class="size-3 text-primary" />{/if}
						</button>
					</li>
				{/if}
				{#each options as o (key(o.value))}
					<li role="presentation">
						<button
							type="button"
							role="option"
							aria-selected={!!selected && key(selected.value) === key(o.value)}
							class="flex w-full cursor-pointer items-center gap-2 rounded-field px-2 py-1.5 text-left text-xs hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
							onclick={() => pick(o.value)}
						>
							<span class="grow">{o.label}</span>
							{#if selected && key(selected.value) === key(o.value)}<Check
									class="size-3 text-primary"
								/>{/if}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</fieldset>

<style>
	/* Anchored to the trigger; flips above it or to the other edge when there is no room. */
	.sel-panel {
		position: fixed;
		inset: auto;
		margin: 0;
		top: calc(anchor(bottom) + 4px);
		left: anchor(left);
		width: anchor-size(width);
		min-width: 10rem;
		max-width: calc(100vw - 1rem);
		overflow: visible;
		position-try-fallbacks:
			flip-block,
			flip-inline,
			flip-block flip-inline;
	}
</style>
