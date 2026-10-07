<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		children: Snippet;
	};

	let { title, children }: Props = $props();
</script>

<div class="not-prose my-6 rounded-box bg-base-200 p-5">
	<p class="mb-3 text-sm font-semibold">{title}</p>
	<ol class="steps-list flex flex-col gap-2.5 text-sm leading-6">
		{@render children()}
	</ol>
</div>

<style>
	.steps-list {
		counter-reset: step;
	}

	.steps-list :global(> li) {
		counter-increment: step;
		display: grid;
		grid-template-columns: 1.5rem 1fr;
		column-gap: 0.75rem;
	}

	.steps-list :global(> li)::before {
		content: counter(step);
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 9999px;
		background: var(--color-primary);
		color: var(--color-primary-content);
		font-size: 0.75rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
