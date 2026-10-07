<script lang="ts">
	import { page } from '$app/state';
	import { X } from '@lucide/svelte';
	import { activeChips, filter_meta, updateParams } from './filter_state.svelte';

	const chips = $derived(filter_meta.active ? activeChips(page.url.searchParams) : []);
</script>

{#if chips.length}
	<div
		class="flex w-full flex-row flex-wrap items-center gap-2 border-b border-base-300 px-6 py-2 print:hidden"
		role="group"
		aria-label="Applied filters"
	>
		{#each chips as chip (chip.id)}
			<span class="badge gap-1 pr-1 badge-soft badge-sm badge-primary">
				<span class="text-base-content/60">{chip.name}:</span>
				<span class="max-w-48 truncate font-medium">{chip.value}</span>
				<button
					type="button"
					class="cursor-pointer rounded-full p-0.5 hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
					aria-label="Remove filter {chip.name}: {chip.value}"
					onclick={() => updateParams(chip.remove)}
				>
					<X class="size-3" />
				</button>
			</span>
		{/each}

		<button
			type="button"
			class="link text-xs link-hover"
			onclick={() =>
				updateParams((p) => {
					for (const key of [...new Set(p.keys())]) {
						if (key !== 'size') p.delete(key);
					}
				})}
		>
			Clear all
		</button>
	</div>
{/if}
