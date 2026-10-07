<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favico_24x24.png';
	import { get_current_route } from '$lib/utilities/helper';

	let routes: string[] = $state([]);

	$effect(() => {
		routes = get_current_route('array', page.url.pathname) as string[];
	});
</script>

<div class="breadcrumbs text-sm">
	<ul>
		{#each routes as route, index (index)}
			{#if index === 0}
				<li class="flex w-fit flex-row items-center gap-1">
					<a href={resolve(`/${routes.slice(0, index + 1).join('/')}`)}>
						<img class="size-6" src={favicon} alt="bctms-logo" />
						<p>BCTMS • <span class="capitalize">{route}</span></p>
					</a>
				</li>
			{:else}
				<li class="capitalize">
					<a href={resolve(`/${routes.slice(0, index + 1).join('/')}`)}>
						{route}
					</a>
				</li>
			{/if}
		{/each}
	</ul>
</div>
