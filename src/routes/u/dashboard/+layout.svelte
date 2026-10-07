<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Dashboard - CiteTicket</title>
</svelte:head>

<div class="flex min-h-0 grow flex-col items-center gap-2 overflow-hidden">
	{@render children?.()}
</div>
