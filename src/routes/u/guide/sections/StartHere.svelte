<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';

	const roles = [
		{
			name: 'Enforcement officer',
			goal: 'Issue citations from your assigned ticket pad.',
			path: [
				['logging-in', 'Log in'],
				['your-account', 'Change your password'],
				['issuing-a-citation', 'Issue a citation'],
				['citation-status', 'Follow its status']
			]
		},
		{
			name: 'Cashier or treasury staff',
			goal: 'Find a citation’s billing and record the payment.',
			path: [
				['logging-in', 'Log in'],
				['billing', 'Look up a billing'],
				['recording-a-payment', 'Record a payment']
			]
		},
		{
			name: 'Administrator or office in-charge',
			goal: 'Manage people, ticket booklets, assignments and liquidation.',
			path: [
				['user-management', 'Manage users'],
				['ticket-registration', 'Register tickets'],
				['ticket-assignments', 'Assign pads'],
				['ticket-liquidation', 'Liquidate pads'],
				['generating-incentives', 'Pay incentives']
			]
		},
		{
			name: 'Auditor or management',
			goal: 'Review activity, collections and the audit trail.',
			path: [
				['dashboard-overview', 'Read the dashboard'],
				['reports', 'Run reports'],
				['logs', 'Search the logs']
			]
		}
	];
</script>

<section aria-labelledby="start-here">
	<h2 id="start-here">Start here</h2>
	<p>
		Pick the role closest to yours and follow the topics in order. Everything else in this guide is
		reference you can come back to.
	</p>

	<ul class="not-prose my-6 divide-y divide-base-300 rounded-box border border-base-300">
		{#each roles as role (role.name)}
			<li class="grid gap-x-8 gap-y-2 px-4 py-4 md:grid-cols-[15rem_1fr]">
				<div>
					<p class="text-sm font-semibold">{role.name}</p>
					<p class="mt-0.5 text-xs leading-5 text-base-content/70">{role.goal}</p>
				</div>
				<ol class="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
					{#each role.path as [id, label], i (id)}
						<li class="flex items-center gap-1">
							{#if i > 0}
								<ChevronRight class="size-3.5 text-base-content/40" aria-hidden="true" />
							{/if}
							<a href={`#${id}`} class="link link-primary link-hover">{label}</a>
						</li>
					{/each}
				</ol>
			</li>
		{/each}
	</ul>
</section>
