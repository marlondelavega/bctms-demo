<script lang="ts">
	import { page as url_page } from '$app/state';
	import { updateQueryParam } from '$lib/utilities/helper';
	import { ArrowLeft, ArrowRight } from '@lucide/svelte';

	let { total } = $props();

	let page = $derived(Number(url_page.url.searchParams.get('page')) || 1);
	let size = $derived(Number(url_page.url.searchParams.get('size')) || 10);

	//total pages for page select
	let total_pages = $derived(Math.ceil(total / size));

	// [from] to [to] of [total] results
	let current_page_size_from = $derived(page * size - size + 1);
	let current_page_size_to = $derived(Math.min(page * size, total));
</script>

<div class="flex w-full flex-row flex-wrap justify-between gap-y-4 md:flex-nowrap px-6 py-4">
	<div class=" flex w-36 flex-row items-center justify-start">
		<p class="text-xs">
			{#if total > 0}
				{current_page_size_from}-{current_page_size_to} of {total} results
			{:else}
				No results
			{/if}
		</p>
	</div>

	<div class=" flex min-w-0 grow flex-row justify-end gap-2 md:join md:justify-center md:gap-0">
		<button
			class="btn join-item btn-soft btn-xs btn-primary md:btn-sm"
			class:btn-disabled={page == 1}
			onclick={() =>
				updateQueryParam([
					{ key: 'page', value: page - 1 },
					{ key: 'size', value: size }
				])}
		>
			<ArrowLeft class="size-4" />
		</button>

		<select
			class="select w-fit min-w-12 select-xs select-primary md:select-sm"
			bind:value={page}
			onchange={(e) =>
				updateQueryParam([
					{ key: 'page', value: e.currentTarget.value },
					{ key: 'size', value: size }
				])}
		>
			{#each Array(total_pages), index}
				<option value={index + 1}>{index + 1}</option>
			{/each}
		</select>

		<button
			class="btn join-item btn-soft btn-xs btn-primary md:btn-sm"
			class:btn-disabled={page == total_pages}
			onclick={() =>
				updateQueryParam([
					{ key: 'page', value: page + 1 },
					{ key: 'size', value: size }
				])}
		>
			<ArrowRight class="size-4" />
		</button>
	</div>

	<div class=" hidden w-36 flex-row items-center justify-end gap-2 md:flex">
		<select
			class="select w-fit min-w-16 select-sm select-primary"
			bind:value={size}
			onchange={(e) =>
				updateQueryParam([
					{ key: 'page', value: 1 },
					{ key: 'size', value: e.currentTarget.value }
				])}
		>
			<option value={10}>10</option>
			<option value={25}>25</option>
			<option value={50}>50</option>
		</select>
	</div>
</div>
