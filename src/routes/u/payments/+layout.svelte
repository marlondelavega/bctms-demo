<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();
</script>

<svelte:head>
	<title>Payment - CiteTicket</title>
</svelte:head>

<div
	class={[
		'flex min-h-0 grow flex-col items-center gap-2 overflow-hidden',
		page.route.id !== '/u/payments' && 'px-6'
	]}
>
	{@render children?.()}
</div>
