<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Ticket Liquidation - CiteTicket</title>
</svelte:head>

<div class="flex min-h-0 grow flex-col items-center gap-2 overflow-hidden print:overflow-visible">
	{@render children?.()}
</div>
