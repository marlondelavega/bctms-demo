<script lang="ts">
	import Header from '$lib/ui/layout/header/Header.svelte';
	import CodeProvisionForm from '../../CodeProvisionForm.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Edit Code Provision - CiteTicket</title>
</svelte:head>

<Header title="Edit Code Provision" />

<div class="flex min-h-0 w-full max-w-3xl grow flex-col py-4">
	<CodeProvisionForm mode="edit" data={data.editForm} />
</div>
