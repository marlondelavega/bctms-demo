<script lang="ts">
	import '../app.css';
	import { navigating, page } from '$app/state';
	import favicon from '$lib/assets/favico_24x24.png';
	import { toast, Toaster } from 'svelte-sonner';
	import { fade } from 'svelte/transition';
	import { getFlash } from 'sveltekit-flash-message';

	let { children, data } = $props();

	const flashmessage = getFlash(page);

	flashmessage.subscribe((e) => {
		if (e?.type == 'success') {
			toast.success(e.message);
		} else if (e?.type == 'error') {
			toast.error(e.message);
		} else {
			if (e?.message) {
				toast(e?.message);
			}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CiteTicket</title>
</svelte:head>

{@render children?.()}

{#if navigating.from !== null && navigating.to !== null}
	<div
		in:fade={{ delay: 300, duration: 300 }}
		out:fade={{ duration: 300 }}
		class=" fixed top-0 left-0 z-[9999] flex min-h-screen min-w-screen flex-col items-center justify-center gap-2 bg-base-300/80 backdrop-blur-[1px]"
	>
		<span class="loading size-24 loading-ring"></span>
	</div>
{/if}

<!-- in demo mode the badge sits at the top centre, so toasts start below it -->
<Toaster position="top-center" offset={data.demo ? 64 : 32} richColors closeButton />
