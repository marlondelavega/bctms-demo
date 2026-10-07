<script lang="ts" module>
	import type { Component } from 'svelte';

	export type RowAction = {
		/** tooltip text, shown on hover and keyboard focus */
		tip: string;
		/** accessible name; say who it acts on ("Archive Juan Dela Cruz") */
		label: string;
		icon: Component<{ class?: string }>;
		/** hover color; matches the selection bar's info / warning / success / error buttons */
		tone: 'info' | 'warning' | 'success' | 'error';
		/** link target (already passed through resolve()), or... */
		href?: string;
		/** ...a handler, e.g. open a dialog */
		onclick?: () => void;
	} | null;
</script>

<script lang="ts">
	// `null` renders an empty slot, so a row that lacks an action (archived, or no permission)
	// keeps every other icon in the same column as the rows around it.
	let { actions }: { actions: RowAction[] } = $props();

	// 32px touch target on phones (field use), compact on desktop. Tooltips open sideways because the
	// table's scroll container would clip one that opens upward on the first row. The explicit
	// foreground keeps icons readable on dimmed (archived/cancelled) rows.
	const base =
		'tooltip tooltip-left btn btn-square btn-ghost btn-sm md:btn-xs text-base-content/70';
	const tones = {
		info: 'hover:text-info',
		warning: 'hover:text-warning',
		success: 'hover:text-success',
		error: 'hover:text-error'
	};
</script>

<div class="flex flex-row items-center justify-end gap-0.5">
	{#each actions as action, index (index)}
		{#if !action}
			<span class="size-8 md:size-6" aria-hidden="true"></span>
		{:else if action.href}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve()d paths -->
			<a
				href={action.href}
				class="{base} {tones[action.tone]}"
				data-tip={action.tip}
				aria-label={action.label}
			>
				<action.icon class="size-4" />
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<button
				type="button"
				class="{base} {tones[action.tone]}"
				data-tip={action.tip}
				aria-label={action.label}
				onclick={action.onclick}
			>
				<action.icon class="size-4" />
			</button>
		{/if}
	{/each}
</div>
