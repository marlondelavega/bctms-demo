<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import lguSeal from '$lib/assets/lgu_seal.svg';
	import { lgu } from '$lib/data/lgu';
	import type { TDrawer } from '$lib/types/T_drawer';
	import type User from '$lib/validation_schemas/Users.zod.js';
	import {
		BookOpen,
		ChevronDown,
		Component,
		FileUser,
		LayoutDashboard,
		LogOut,
		Moon,
		SlidersHorizontal,
		Sun,
		Tickets,
		UsersRound,
		Ticket,
		FilePenLine,
		Receipt,
		ScrollText,
		FileBarChart2,
		History,
		HandCoins
	} from '@lucide/svelte';
	import { type Snippet } from 'svelte';
	import { getPreviewUrl, parseName } from '$lib/utilities/helper';
	import { toast } from 'svelte-sonner';

	let { children, drawer, user }: { children: Snippet; drawer: TDrawer[]; user: User.Base } =
		$props();

	let drawer_open = $state(false);
	let theme = $state<'light' | 'dark'>('dark');

	// populated by the /u layout load; a bare id string means the ref wasn't populated
	const office = $derived(
		typeof user.enforcement_group === 'object' ? user.enforcement_group?.name : undefined
	);
	const role = $derived(typeof user.user_type === 'object' ? user.user_type?.user_type : undefined);
	const affiliation = $derived([role, office].filter(Boolean).join(' · '));

	const iconMap: Record<string, typeof Component> = {
		BookOpen,
		FileUser,
		LayoutDashboard,
		SlidersHorizontal,
		Tickets,
		UsersRound,
		Ticket,
		FilePenLine,
		ScrollText,
		Receipt,
		FileBarChart2,
		History,
		HandCoins
	};

	const getIcon = (name?: string) => (name && iconMap[name]) || Component;

	const applyTheme = (value: 'light' | 'dark') => {
		theme = value;
		localStorage.setItem('theme', value);
		document.documentElement.setAttribute('data-theme', value);
	};

	const onThemeToggle = (e: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
		applyTheme(e.currentTarget.checked ? 'light' : 'dark');
	};

	const isActive = (href?: string) => {
		if (!href) return false;
		const target = `/citeticket/u${href}`;
		return page.url.pathname === target || page.url.pathname.startsWith(`${target}/`);
	};

	const closeOnNavigate = () => {
		drawer_open = false;
	};

	$effect(() => {
		const stored = localStorage.getItem('theme');
		applyTheme(stored === 'light' ? 'light' : 'dark');
	});
</script>

<div class="drawer z-50 lg:drawer-open">
	<input
		id="collapsible-sidenav"
		type="checkbox"
		class="drawer-toggle"
		bind:checked={drawer_open}
	/>

	<div class="drawer-content">
		<div class="flex h-dvh flex-col">
			{@render children?.()}
		</div>
	</div>

	<div class="drawer-side z-50 max-h-dvh overflow-hidden">
		<label for="collapsible-sidenav" aria-label="close sidebar" class="drawer-overlay"></label>
		<div
			class="flex max-h-full min-h-full w-64 flex-col items-start justify-between border-r border-base-300 bg-base-200"
		>
			<!-- Brand: city seal with the CiteTicket name -->
			<div class="flex h-16 w-full shrink-0 items-center border-b border-base-300 px-3.5">
				<a
					href={resolve('/u/dashboard')}
					onclick={closeOnNavigate}
					class="group flex min-w-0 items-center gap-2.5 rounded-field outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
					aria-label="CiteTicket, go to dashboard"
				>
					<img
						src={lguSeal}
						alt=""
						class="size-10 shrink-0 rounded-full shadow-[0_1px_2px_rgb(0_0_0/0.15),0_3px_8px_-2px_rgb(0_0_0/0.2)] transition-transform duration-200 ease-out select-none group-hover:-translate-y-px motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
						draggable="false"
					/>
					<span class="flex min-w-0 flex-col">
						<span class="truncate text-[0.9375rem] leading-5 font-semibold tracking-tight">
							CiteTicket
						</span>
						<span class="truncate text-[0.6875rem] leading-4 text-base-content/60">
							{lgu.name}
						</span>
					</span>
				</a>
			</div>

			<div class="min-h-0 w-full grow overflow-auto px-2 pt-3">
				<ul class="menu w-full gap-0.5 p-0 text-xs">
					{#each drawer as { name, icon, subitems, color, href, query }, index (index)}
						{#if subitems?.length}
							{@const Icon = getIcon(icon)}
							<li class="w-full max-w-full">
								<details class="group" open>
									<summary
										class="flex h-9 items-center gap-2 rounded-field px-2 transition-colors hover:bg-base-300/60"
									>
										<Icon class={`size-4 shrink-0 ${color}`} />
										<span class="grow">{name}</span>
									</summary>

									<ul class="relative ml-4 border-l border-base-300 pl-2">
										{#each subitems as subitem, sub_index (sub_index)}
											{#if subitem.href}
												<li data-sveltekit-preload-data>
													<a
														href={resolve(`/u${subitem.href}${subitem.query ?? ''}`)}
														class={[
															'flex h-9 items-center rounded-field px-2 transition-colors',
															isActive(subitem.href)
																? 'bg-primary font-medium text-primary-content'
																: 'hover:bg-base-300/60'
														]}
														aria-current={isActive(subitem.href) ? 'page' : undefined}
														data-tip={subitem.name}
														onclick={closeOnNavigate}
													>
														<span class="overflow-hidden text-nowrap text-ellipsis">
															{subitem.name}
														</span>
													</a>
												</li>
											{/if}
										{/each}
									</ul>
								</details>
							</li>
						{:else}
							{@const Icon = getIcon(icon)}
							<li class="w-full max-w-full" data-sveltekit-preload-data>
								<a
									href={resolve(`/u${href}${query ?? ''}`)}
									class={[
										'flex h-9 items-center gap-2 rounded-field px-2 transition-colors',
										isActive(href) ? 'bg-primary text-primary-content' : 'hover:bg-base-300/60'
									]}
									aria-current={isActive(href) ? 'page' : undefined}
									data-tip={name}
								>
									<Icon
										class={`size-4 shrink-0 ${isActive(href) ? 'text-primary-content' : color}`}
									/>
									{name}
								</a>
							</li>
						{/if}
					{/each}
				</ul>

				<div
					class="pointer-events-none sticky bottom-0 flex h-16 bg-base-200 mask-[linear-gradient(transparent,#000000)]"
				></div>
			</div>

			<!-- Footer -->
			<div class="w-full border-t border-base-300">
				<a
					href={resolve('/u/users/profile')}
					class={[
						'flex items-center gap-2.5 border-b border-base-300 px-3 py-2.5 transition-colors',
						isActive('/profile') ? 'bg-primary text-primary-content' : 'hover:bg-base-300/60'
					]}
					aria-current={isActive('/profile') ? 'page' : undefined}
					title={`@${user.username}`}
				>
					<div class="avatar shrink-0">
						<div class="size-9 rounded-full bg-base-300 ring-1 ring-base-100">
							{#if user.profile_image}
								<img
									src={getPreviewUrl() + user.profile_image}
									alt="Profile"
									onerror={(e) => {
										toast.warning(
											'Failed to load images. You may continue using the app without images.'
										);
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
					</div>

					<div
						class={[
							'flex min-w-0 flex-col gap-0.5 text-[11px] leading-tight',
							isActive('/profile') ? 'text-primary-content/75' : 'text-base-content/60'
						]}
					>
						<span
							class={[
								'truncate text-xs font-medium',
								isActive('/profile') ? 'text-primary-content' : 'text-base-content'
							]}
						>
							{parseName(user)}
						</span>
						<!-- role and office stand in for the username, which stays in the tooltip -->
						<span class="truncate" title={affiliation || undefined}>
							{affiliation || `@${user.username}`}
						</span>
					</div>
				</a>

				<div class="flex items-center justify-between px-3 py-3">
					<label
						for="theme-toggle"
						class="flex cursor-pointer w-fit items-center gap-1.5 rounded-full bg-base-300/50 p-1 pr-2.5"
					>
						<span class="swap grid size-6 place-items-center swap-rotate rounded-full bg-base-100">
							<input
								id="theme-toggle"
								type="checkbox"
								class="hidden"
								onchange={onThemeToggle}
								checked={theme === 'light'}
							/>
							<Sun class="swap-on size-3.5 stroke-current" />
							<Moon class="swap-off size-3.5 stroke-current" />
						</span>
						<span class="text-xs text-base-content/60">
							{theme === 'light' ? 'Light' : 'Dark'}
						</span>
					</label>

					<button
						type="submit"
						form="auth_logout"
						class="flex cursor-pointer items-center gap-1.5 rounded-field px-2 py-1.5 text-xs text-error transition-colors hover:bg-error/10"
					>
						<LogOut class="size-3.5" />
						Sign out
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<form id="auth_logout" method="POST" action={resolve('/api/auth/logout')}></form>
