<script lang="ts">
	import favicon from '$lib/assets/favico_24x24.png';

	import { page } from '$app/state';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Violators - CiteTicket</title>
</svelte:head>

<div
	class={[
		'flex min-h-0 grow flex-col items-center gap-2 overflow-hidden',
		page.route.id !== '/u/violators' && 'px-6'
	]}
>
	{@render children?.()}
</div>
