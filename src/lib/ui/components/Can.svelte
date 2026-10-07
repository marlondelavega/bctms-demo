<script lang="ts">
	import { permissions } from '$lib/utilities/helper';
	import type Permission from '$lib/validation_schemas/Permissions.zod';

	const { children, permissions: p, action, route, fallback }: Permission.Props = $props();
	const allowed = $derived(permissions.get(route, p));
</script>

{#if allowed[action] !== 'none'}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
