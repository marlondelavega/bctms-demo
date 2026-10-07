<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		table_header,
		table_subHeader,
		table_body
	}: {
		table_header: Snippet;
		table_subHeader?: Snippet;
		table_body: Snippet;
	} = $props();
</script>

<!-- the gutter lives on this wrapper: padding on the <table> itself is ignored (collapsed borders) -->
<div class="h-full min-h-0 w-full grow overflow-x-auto px-6">
	<table class="table-pin-rows table table-sm tabular-nums">
		<thead
			class="z-10 [&_th]:bg-base-200 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-base-content/70"
		>
			<tr>
				<!-- {@render Checkbox()} TBA -->
				{@render table_header()}
			</tr>

			{#if table_subHeader}
				{@render table_subHeader()}
			{/if}
		</thead>

		<tbody class="[&_tr]:transition-colors [&_tr:hover]:bg-base-200/60">
			{@render table_body()}
		</tbody>
	</table>
</div>
