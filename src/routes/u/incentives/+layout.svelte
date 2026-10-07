<script lang="ts">
	import favicon from '$lib/assets/favico_24x24.png';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Incentives - CiteTicket</title>
</svelte:head>

<div class="flex min-h-0 grow flex-col overflow-hidden">
	{@render children?.()}
</div>
