<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowUpRight, Search } from '@lucide/svelte';
</script>

<div class="w-full">
	<main class="flex min-h-dvh w-full flex-col items-center justify-center gap-4 px-6 text-center">
		<svg
			id="CiteTicket_logo"
			xmlns="http://www.w3.org/2000/svg"
			version="1.1"
			xmlns:xlink="http://www.w3.org/1999/xlink"
			viewBox="0 0 24 24"
			class="size-20"
			aria-hidden="true"
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
				<linearGradient id="linear-gradient1" y1="7.78" y2="17.09" xlink:href="#linear-gradient" />
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
		<h1 class="mt-2 text-5xl font-semibold tracking-tight">CiteTicket</h1>
		<p class="max-w-prose text-base text-balance text-base-content/70">
			One app to manage your citation tickets.
		</p>

		<div class="mt-4 flex flex-row flex-wrap justify-center gap-3">
			<a
				class="btn flex flex-row items-center gap-1 rounded-full pr-4 pl-5 btn-primary"
				href={resolve('/login')}
			>
				<span>Open App</span>
				<ArrowUpRight class="size-4" />
			</a>
			<button
				type="button"
				class="btn flex flex-row items-center gap-2 rounded-full pr-4 pl-5 btn-soft"
				disabled
			>
				<Search class="size-4" />
				<span>Track Ticket</span>
				<span class="badge badge-ghost badge-sm">Coming soon</span>
			</button>
		</div>
	</main>
</div>
