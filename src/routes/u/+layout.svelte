<script lang="ts">
	import favicon from '$lib/assets/favico_24x24.png';
	import DemoBanner from '$lib/ui/components/DemoBanner.svelte';
	import Drawer from '$lib/ui/layout/drawer/Drawer.svelte';

	let { children, data } = $props();

	let { drawer, user } = data;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CiteTicket</title>
</svelte:head>

<div class="flex h-dvh w-full">
	<Drawer {drawer} {user}>
		{@render children?.()}
	</Drawer>
</div>

{#if data.demo}
	<DemoBanner />
{/if}
