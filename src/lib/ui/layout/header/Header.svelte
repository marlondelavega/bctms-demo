<script lang="ts">
	import Filter from '$lib/ui/components/table/Filter.svelte';
	import FilterChips from '$lib/ui/components/table/FilterChips.svelte';
	import { ChevronRight } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		PropFilter?: Snippet;
		AddButtons?: Snippet;
		Title?: Snippet;
		title?: string;
	};

	let { PropFilter, AddButtons, Title, title }: Props = $props();
</script>

<header
	class="flex w-full flex-row items-center justify-between gap-3 border-b border-base-300 print:hidden px-6 py-4"
>
	<div class="flex min-w-0 flex-row items-center gap-2">
		<label
			for="collapsible-sidenav"
			aria-label="Open navigation"
			class="block shrink-0 cursor-pointer rounded-field focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary lg:hidden"
		>
			<svg
				id="CiteTicket_logo"
				xmlns="http://www.w3.org/2000/svg"
				version="1.1"
				xmlns:xlink="http://www.w3.org/1999/xlink"
				viewBox="0 0 24 24"
				class="size-7"
			>
				<defs>
					<style>
						.st0 {
							fill: url(#linear-gradient2);
						}

						.st1 {
							fill: url(#linear-gradient1);
						}

						.st2 {
							fill: #605dff;
						}

						.st3 {
							fill: url(#linear-gradient);
						}
					</style>
					<linearGradient
						id="linear-gradient"
						x1="13.75"
						y1="6.89"
						x2="13.75"
						y2="17.3"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0" stop-color="#605dff" />
						<stop offset="1" stop-color="#605dff" stop-opacity="0" />
					</linearGradient>
					<linearGradient
						id="linear-gradient1"
						y1="7.78"
						y2="17.09"
						xlink:href="#linear-gradient"
					/>
					<linearGradient id="linear-gradient2" y1="6.89" y2="17.3" xlink:href="#linear-gradient" />
				</defs>

				<path
					class="st2 fill-primary"
					d="M8.47,8.15v2.13c.96.05,1.72.84,1.72,1.81s-.76,1.76-1.72,1.81v2.13c0,.43.35.77.77.77h10.53v3.42h-9.42c-3.4,0-6.16-2.76-6.16-6.15v-3.96c0-3.4,2.76-6.15,6.16-6.15h9.42v3.42h-10.53c-.43,0-.77.35-.77.77Z"
				/>
				<g class="bg-linear-to-t from-primary/10 to-primary">
					<path
						class="st3"
						d="M13.75,17.3c-.13,0-.24-.11-.24-.24v-.44c0-.13.11-.24.24-.24s.24.11.24.24v.44c0,.13-.11.24-.24.24Z"
					/>
					<path
						class="st1"
						d="M13.75,15.34c-.13,0-.24-.11-.24-.24v-.99c0-.13.11-.24.24-.24s.24.11.24.24v.99c0,.13-.11.24-.24.24ZM13.75,12.83c-.13,0-.24-.11-.24-.24v-.99c0-.13.11-.24.24-.24s.24.11.24.24v.99c0,.13-.11.24-.24.24ZM13.75,10.31c-.13,0-.24-.11-.24-.24v-.99c0-.13.11-.24.24-.24s.24.11.24.24v.99c0,.13-.11.24-.24.24Z"
					/>
					<path
						class="st0"
						d="M13.75,7.8c-.13,0-.24-.11-.24-.24v-.44c0-.13.11-.24.24-.24s.24.11.24.24v.44c0,.13-.11.24-.24.24Z"
					/>
				</g>
			</svg>
		</label>

		<ChevronRight class="block size-4 shrink-0 stroke-base-content/40 lg:hidden" />

		{#if title}
			<h1 class="truncate text-base font-semibold tracking-tight md:text-lg">{title}</h1>
		{:else if Title}
			{@render Title()}
		{/if}
	</div>

	<div class="flex shrink-0 flex-row items-center gap-2 md:gap-3">
		{#if PropFilter}
			{@render PropFilter()}
		{:else}
			<Filter />
		{/if}

		{#if AddButtons}
			{@render AddButtons()}
		{/if}
	</div>
</header>

<FilterChips />
