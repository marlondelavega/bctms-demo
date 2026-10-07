<script lang="ts">
	import { Check, ChevronDown, Search } from '@lucide/svelte';

	type Option = { value: string; label: string };

	let {
		name,
		label,
		options,
		selected = [],
		all_label = 'All',
		searchable = options.length > 8,
		onchange
	}: {
		name: string;
		label: string;
		options: Option[];
		selected?: string[];
		all_label?: string;
		searchable?: boolean;
		/** For use outside a plain GET form: called with the new selection on every change. */
		onchange?: (values: string[]) => void;
	} = $props();

	// The checkboxes below carry `name`, so a surrounding GET form submits one repeated
	// key per ticked option (?status=1&status=3) with no script involved.
	// writable derived: re-syncs when navigation (or a parent) hands down a new selection, and
	// holds the person's own picks in between
	let chosen = $derived([...selected]);
	let query = $state('');

	const summary = $derived.by(() => {
		if (!chosen.length) return all_label;
		const labels = chosen.map((v) => options.find((o) => o.value === v)?.label ?? v);
		return chosen.length <= 2 ? labels.join(', ') : `${chosen.length} selected`;
	});

	const matches = (o: Option) =>
		!query.trim() || o.label.toLowerCase().includes(query.trim().toLowerCase());
	const visible = $derived(options.filter(matches));

	function setChosen(values: string[]) {
		chosen = values;
		onchange?.(values);
	}

	function toggle(value: string, on: boolean) {
		setChosen(on ? [...chosen, value] : chosen.filter((v) => v !== value));
	}

	// The panel is a native popover: it renders in the browser's top layer, so no ancestor
	// (another popover, a dialog, an overflow container) can clip it, and the browser handles
	// open/close, outside click and Escape. Closed, it is display:none. It stays in the DOM, so
	// its checkboxes still belong to the form and submit their values.
	let open = $state(false);
	const panel_id = $props.id();
	const anchor = `--ms-${panel_id}`;
</script>

<fieldset class="fieldset">
	<legend class="fieldset-legend text-xs">{label}</legend>

	<div class="w-full">
		<button
			type="button"
			class="btn w-full justify-between gap-2 px-3 text-left font-normal btn-sm"
			class:btn-active={chosen.length > 0}
			style:anchor-name={anchor}
			popovertarget={panel_id}
			aria-haspopup="true"
			aria-expanded={open}
			aria-controls={panel_id}
		>
			<span class={['truncate', !chosen.length && 'text-base-content/60']}>{summary}</span>
			<span class="flex shrink-0 items-center gap-1.5">
				{#if chosen.length > 2}
					<span class="badge badge-xs badge-primary">{chosen.length}</span>
				{/if}
				<ChevronDown class={['size-3.5 opacity-60 transition-transform', open && 'rotate-180']} />
			</span>
		</button>

		<div
			id={panel_id}
			popover="auto"
			class="ms-panel gap-1 rounded-box border border-base-300 bg-base-100 p-2 text-base-content shadow-lg"
			style:position-anchor={anchor}
			ontoggle={(e) => {
				open = (e as ToggleEvent).newState === 'open';
				if (!open) query = '';
			}}
		>
			{#if searchable}
				<label class="input input-xs flex w-full items-center gap-1.5">
					<Search class="size-3 opacity-60" />
					<input
						type="search"
						class="grow"
						placeholder="Search {label.toLowerCase()}…"
						bind:value={query}
					/>
				</label>
			{/if}

			<div class="flex items-center justify-between px-1 text-xs text-base-content/60">
				<span>{chosen.length} of {options.length} selected</span>
				<button
					type="button"
					class="link link-hover disabled:opacity-40"
					disabled={!chosen.length}
					onclick={() => setChosen([])}
				>
					Clear
				</button>
			</div>

			<ul
				class="max-h-56 overflow-y-auto"
				role="listbox"
				aria-multiselectable="true"
				aria-label={label}
			>
				{#each options as o (o.value)}
					<li class={matches(o) ? '' : 'hidden'}>
						<label
							class="flex cursor-pointer items-center gap-2 rounded-field px-2 py-1.5 text-xs hover:bg-base-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-xs checkbox-primary"
								{name}
								value={o.value}
								checked={chosen.includes(o.value)}
								onchange={(e) => toggle(o.value, e.currentTarget.checked)}
							/>
							<span class="grow">{o.label}</span>
							{#if chosen.includes(o.value)}<Check class="size-3 text-primary" />{/if}
						</label>
					</li>
				{/each}
				{#if !visible.length}
					<li class="px-2 py-3 text-xs text-base-content/60">No match for “{query}”.</li>
				{/if}
			</ul>
		</div>
	</div>
</fieldset>

<style>
	/* Closed popovers are display:none from the UA sheet; only set a display when open. */
	.ms-panel:popover-open {
		display: flex;
		flex-direction: column;
	}

	/* Anchored to the trigger button (position-anchor is set inline, per instance). Replaces the
	   popover UA defaults of a viewport-centred box. Flips above the button, or aligns to the
	   other edge, when there is no room below or beside it. */
	.ms-panel {
		position: fixed;
		inset: auto;
		margin: 0;
		top: calc(anchor(bottom) + 4px);
		left: anchor(left);
		width: anchor-size(width);
		min-width: 14rem;
		max-width: calc(100vw - 1rem);
		overflow: visible;
		position-try-fallbacks:
			flip-block,
			flip-inline,
			flip-block flip-inline;
	}
</style>
