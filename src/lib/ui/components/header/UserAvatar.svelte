<script lang="ts">
	import { resolve } from '$app/paths';
	import { getPreviewUrl } from '$lib/utilities/helper';
	import type User from '$lib/validation_schemas/Users.zod';

	let { user }: { user: User.Base } = $props();
</script>

<label class="avatar cursor-pointer" for="collapsible-sidenav">
	<a
		class="mask size-8 overflow-hidden bg-primary mask-squircle md:size-10"
		href={resolve('/u/users/profile')}
	>
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
	</a>
</label>
