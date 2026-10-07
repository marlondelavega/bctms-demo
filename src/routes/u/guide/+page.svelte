<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import TocList, { type TocEntry } from '$lib/ui/components/guide/TocList.svelte';
	import StartHere from './sections/StartHere.svelte';
	import Introduction from './sections/Introduction.svelte';
	import GettingStarted from './sections/GettingStarted.svelte';
	import Access from './sections/Access.svelte';
	import UserManagement from './sections/UserManagement.svelte';
	import Tickets from './sections/Tickets.svelte';
	import Citations from './sections/Citations.svelte';
	import Payments from './sections/Payments.svelte';
	import ReportsLogs from './sections/ReportsLogs.svelte';
	import Incentives from './sections/Incentives.svelte';
	import Account from './sections/Account.svelte';
	import Help from './sections/Help.svelte';

	let scroller = $state<HTMLElement>();
	let content = $state<HTMLElement>();
	let toc = $state<TocEntry[]>([]);
	let active = $state('');
	let jump = $state<HTMLDetailsElement>();

	// the outline is read from the headings themselves, so it can never drift from the content
	const buildToc = () => {
		if (!content) return;
		const entries: TocEntry[] = [];
		content.querySelectorAll<HTMLElement>('h2[id], h3[id]').forEach((h) => {
			const title = h.textContent?.trim() ?? '';
			if (h.tagName === 'H2') entries.push({ id: h.id, title, children: [] });
			else entries.at(-1)?.children.push({ id: h.id, title });
		});
		toc = entries;
	};

	let frame = 0;
	const spy = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			if (!scroller || !content) return;
			const top = scroller.getBoundingClientRect().top + 96;
			let current = '';
			for (const h of content.querySelectorAll<HTMLElement>('h2[id], h3[id]')) {
				if (h.getBoundingClientRect().top <= top) current = h.id;
				else break;
			}
			active = current;
		});
	};

	onMount(() => {
		buildToc();
		spy();
		return () => cancelAnimationFrame(frame);
	});
</script>

<svelte:head>
	<title>User guide · CiteTicket</title>
</svelte:head>

<Header title="User guide">
	{#snippet PropFilter()}{/snippet}
</Header>

<div
	bind:this={scroller}
	onscroll={spy}
	class="guide-scroll min-h-0 grow overflow-y-auto print:overflow-visible"
>
	<div class="mx-auto flex w-full max-w-6xl gap-12 px-6 py-8 md:px-10 md:py-12">
		<div class="min-w-0 flex-1">
			<details bind:this={jump} class="mb-8 rounded-box bg-base-200 xl:hidden print:hidden">
				<summary
					class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium"
				>
					On this page
					<ChevronDown class="size-4 text-base-content/60" aria-hidden="true" />
				</summary>
				<div class="px-2 pb-3">
					<TocList {toc} {active} onnavigate={() => jump && (jump.open = false)} />
				</div>
			</details>

			<article bind:this={content} class="guide-prose prose max-w-[70ch]">
				<StartHere />
				<Introduction />
				<GettingStarted />
				<Access />
				<UserManagement />
				<Tickets />
				<Citations />
				<Payments />
				<ReportsLogs />
				<Incentives />
				<Account />
				<Help />
			</article>
		</div>

		<aside class="hidden w-56 shrink-0 xl:block print:hidden">
			<div class="sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto pb-8">
				<p class="mb-2 px-2 text-xs font-semibold text-base-content/60">On this page</p>
				<TocList {toc} {active} />
			</div>
		</aside>
	</div>
</div>

<style>
	@media (prefers-reduced-motion: no-preference) {
		.guide-scroll {
			scroll-behavior: smooth;
		}
	}

	summary::-webkit-details-marker {
		display: none;
	}

	details[open] > summary :global(svg) {
		transform: rotate(180deg);
	}

	.guide-prose {
		--tw-prose-body: color-mix(in oklab, var(--color-base-content) 85%, transparent);
		--tw-prose-headings: var(--color-base-content);
		--tw-prose-lead: var(--color-base-content);
		--tw-prose-links: var(--color-primary);
		--tw-prose-bold: var(--color-base-content);
		--tw-prose-counters: color-mix(in oklab, var(--color-base-content) 60%, transparent);
		--tw-prose-bullets: color-mix(in oklab, var(--color-base-content) 45%, transparent);
		--tw-prose-hr: var(--color-base-300);
		--tw-prose-code: var(--color-base-content);
		font-size: 0.9375rem;
		line-height: 1.75;
	}

	.guide-prose :global(section) {
		margin-top: 4.5rem;
		padding-top: 2.5rem;
		border-top: 1px solid var(--color-base-300);
	}

	.guide-prose :global(section:first-child) {
		margin-top: 0;
		padding-top: 0;
		border-top: 0;
	}

	.guide-prose :global(h2) {
		margin: 0 0 1rem;
		font-size: 1.625rem;
		font-weight: 650;
		line-height: 1.2;
		letter-spacing: -0.02em;
		text-wrap: balance;
		scroll-margin-top: 1.5rem;
	}

	.guide-prose :global(h3) {
		margin: 2.5rem 0 0.75rem;
		font-size: 1.0625rem;
		font-weight: 600;
		line-height: 1.35;
		text-wrap: balance;
		scroll-margin-top: 1.5rem;
	}

	.guide-prose :global(a:not(.link)) {
		text-underline-offset: 0.2em;
	}

	@media print {
		.guide-prose {
			max-width: none;
		}

		.guide-prose :global(section) {
			break-inside: avoid-page;
		}
	}
</style>
