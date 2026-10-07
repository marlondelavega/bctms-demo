<script lang="ts">
	import Header from '$lib/ui/layout/header/Header.svelte';
	import CodeProvisionForm from '../CodeProvisionForm.svelte';

	let { data } = $props();
</script>

<Header title="Add Code Provision" />

<div class="flex min-h-0 w-full max-w-3xl grow flex-col py-4">
	<CodeProvisionForm mode="create" data={data.createForm} />
</div>
