<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { KeyRound, LogOut, User as UserIcon } from '@lucide/svelte';

	let { children } = $props();

	// Extend this list as more account-level sections are needed
	// (e.g. notification settings) — same shape, same nav.
	const tabs = [
		{ name: 'My profile', href: resolve('/u/users/profile'), icon: UserIcon },
		{
			name: 'Change password',
			href: resolve('/u/users/profile/change-password'),
			icon: KeyRound
		}
	];

	const isActive = (href: string) => page.url.pathname.replace(/\/$/, '') === href;
</script>

<svelte:head>
	<title>Account Settings - CiteTicket</title>
</svelte:head>

<Header title="Account Settings">
	{#snippet PropFilter()}
		<div></div>
	{/snippet}
</Header>

<div
	class="flex min-h-0 w-full grow flex-col gap-4 overflow-auto py-4 md:flex-row md:overflow-hidden"
>
	<nav
		class="flex shrink-0 flex-row gap-0.5 self-stretch overflow-x-auto rounded-box border border-base-300 bg-base-100 p-1.5 md:w-56 md:flex-col md:self-start md:p-2"
		aria-label="Account settings"
	>
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				class={[
					'flex h-9 shrink-0 items-center gap-2 rounded-field px-3 text-sm whitespace-nowrap transition-colors',
					isActive(tab.href) ? 'bg-primary text-primary-content' : 'hover:bg-base-300/60'
				]}
				aria-current={isActive(tab.href) ? 'page' : undefined}
			>
				<tab.icon class="size-4 shrink-0" />
				{tab.name}
			</a>
		{/each}

		<div class="mx-1 border-l border-base-300 md:mx-0 md:my-1 md:border-t md:border-l-0"></div>

		<button
			type="submit"
			form="auth_logout"
			class="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-field px-3 text-sm whitespace-nowrap text-error transition-colors hover:bg-error/10"
		>
			<LogOut class="size-4 shrink-0" />
			Sign out
		</button>
	</nav>

	<div
		class="shrink-0 rounded-box border border-base-300 bg-base-100 p-4 md:min-h-0 md:shrink md:grow md:overflow-auto md:p-6"
	>
		{@render children()}
	</div>
</div>

<form id="auth_logout" method="POST" action={resolve('/api/auth/logout')}></form>
