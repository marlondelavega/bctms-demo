<script lang="ts">
	type Field = { name: string; text: string; required?: boolean };

	let { items }: { items: Field[] } = $props();
</script>

<dl
	class="not-prose my-6 divide-y divide-base-300 overflow-hidden rounded-box border border-base-300 text-sm"
>
	{#each items as item (item.name)}
		<div class="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
			<dt class="flex flex-wrap items-baseline gap-x-2 font-medium">
				{item.name}
				{#if item.required}
					<span class="text-xs font-medium text-error">Required</span>
				{/if}
			</dt>
			<dd class="leading-6 text-base-content/75">{item.text}</dd>
		</div>
	{/each}
</dl>
