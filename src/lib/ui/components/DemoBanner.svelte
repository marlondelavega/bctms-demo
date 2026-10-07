<script lang="ts">
	import { FlaskConical, X } from '@lucide/svelte';
	import { onMount } from 'svelte';

	const KEY = 'citeticket-demo-banner-dismissed';

	let dismissed = $state(false);

	onMount(() => {
		try {
			dismissed = sessionStorage.getItem(KEY) === '1';
		} catch {
			// storage can be blocked; the banner then simply stays until closed
		}
	});

	function dismiss() {
		dismissed = true;
		try {
			sessionStorage.setItem(KEY, '1');
		} catch {
			// not remembered across pages, which is fine
		}
	}
</script>

{#if !dismissed}
	<!-- fixed, so it never changes the height the app layouts are built around -->
	<div
		class="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 print:hidden"
		role="status"
	>
		<div
			class="pointer-events-auto flex items-center gap-2 rounded-full border border-warning/40 bg-base-100/95 py-1 pr-1 pl-3 text-xs shadow-lg backdrop-blur"
		>
			<FlaskConical class="size-3.5 text-warning" aria-hidden="true" />
			<span
				><strong class="font-semibold">Demo</strong> — all data is fictional and resets nightly</span
			>
			<button
				type="button"
				class="btn btn-circle btn-ghost btn-xs"
				aria-label="Dismiss demo notice"
				onclick={dismiss}
			>
				<X class="size-3.5" />
			</button>
		</div>
	</div>
{/if}
