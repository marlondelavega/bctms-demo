<script>
	import { X } from '@lucide/svelte';
	let { modal_close } = $props();
</script>

<X
	class="absolute transition right-6 top-6 size-6 cursor-pointer hover:bg-base-300 rounded-full p-1"
	onclick={() => modal_close()}
/>
