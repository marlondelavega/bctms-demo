<script lang="ts">
	import { resolve } from '$app/paths';
	import { getPreviewUrl } from '$lib/utilities/helper';
	import type User from '$lib/validation_schemas/Users.zod';
	import { House, Settings2 } from '@lucide/svelte';

	let { user }: { user: User.Base } = $props();
</script>

<div class="dock">
	<button
		type="button"
		onclick={() => {
			if ((document.getElementById('filter_dropdown') as HTMLDetailsElement).open == false) {
				(document.getElementById('filter_dropdown') as HTMLDetailsElement).open = true;
			} else {
				(document.getElementById('filter_dropdown') as HTMLDetailsElement).open = false;
			}
		}}
	>
		<Settings2 class="stroke-base-content/30" />
	</button>

	<a type="button" href={resolve('/u')}>
		<House class="stroke-base-content/30 stroke-primary" />
	</a>

	<label for="collapsible-sidenav" class="avatar">
		<div class="size-8 overflow-hidden rounded-full">
			{#if user.profile_image}
				<img
					src={getPreviewUrl() + user.profile_image}
					alt="Profile"
					onerror={(e) => {
						e.currentTarget.classList.add('hidden');
						e.currentTarget.nextElementSibling?.classList.remove('hidden');
						e.currentTarget.nextElementSibling?.classList.add('flex');
					}}
				/>
			{:else}
				<div class="flex h-full w-full items-center justify-center">
					{user.firstname[0]}
				</div>
			{/if}
		</div>
	</label>
</div>
