<script lang="ts">
	import favicon from '$lib/assets/favico_24x24.png';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Add Code Provision - CiteTicket</title>
</svelte:head>

{@render children?.()}
