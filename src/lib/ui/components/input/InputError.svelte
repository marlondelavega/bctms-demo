<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children, id }: { children: Snippet; id?: string } = $props();
</script>

<p class="label inline-block h-4 w-full max-w-full text-xs text-error text-wrap" {id}>
	{@render children()}
</p>
