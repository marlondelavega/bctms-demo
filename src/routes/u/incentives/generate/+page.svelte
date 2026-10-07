<script lang="ts">
	import { resolve } from '$app/paths';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import IncentiveGenerator from './IncentiveGenerator.svelte';

	let { data } = $props();

	const scopeNote: Record<string, string> = {
		office: 'You can generate incentives for your own enforcement group only.',
		own: 'You can generate incentives for your own tickets only.'
	};
</script>

<Header title="Generate Incentives">
	{#snippet PropFilter()}{/snippet}
</Header>

<div class="flex min-h-0 w-full grow flex-col gap-4 overflow-auto p-4 md:px-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<a class="flex w-fit items-center gap-2 text-xs" href={resolve('/u/incentives')}>
			<ArrowLeft class="size-3" /> Back to incentive reports
		</a>
		{#if scopeNote[data.options.scope]}
			<p class="text-xs text-base-content/60">{scopeNote[data.options.scope]}</p>
		{/if}
	</div>

	<IncentiveGenerator form_data={data.form} options={data.options} />
</div>
