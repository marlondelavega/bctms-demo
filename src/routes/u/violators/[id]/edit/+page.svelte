<script lang="ts">
	import Header from '$lib/ui/layout/header/Header.svelte';
	import ViolatorForm from '../../ViolatorForm.svelte';

	let { data } = $props();
</script>

<Header title="Edit Violator"></Header>

<div class="flex min-h-0 w-full max-w-5xl grow flex-col py-4">
	<ViolatorForm mode="edit" data={data.form} archived={data.archived} />
</div>
