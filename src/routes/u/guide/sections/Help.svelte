<script lang="ts">
	const problems = [
		{
			q: 'I can’t log in.',
			a: 'The login page shows one message for a wrong username and a wrong password, so check both. If you still can’t get in, ask your administrator to reset your password — or to check that your account has not been archived.'
		},
		{
			q: 'A module is missing from my menu.',
			a: 'Your user type has no access to it. Ask your administrator to review your permissions.'
		},
		{
			q: 'I was signed out unexpectedly.',
			a: 'You were idle for 4 hours, your session passed 1 day, you signed in on a fourth device, or an administrator reset your password. Log in again.'
		},
		{
			q: 'My ticket doesn’t appear when issuing a citation.',
			a: 'It must be registered, withdrawn and assigned to you as an active pad, and the pad must still have unused series numbers.'
		},
		{
			q: 'The payment was rejected.',
			a: 'The amount is more than the billing’s outstanding balance. Enter the balance or less.'
		},
		{
			q: 'I can’t change a citation to Notice of Settlement.',
			a: 'That status is set only by the system, when a citation passes its settlement period.'
		},
		{
			q: 'The incentive review shows no tickets.',
			a: 'Widen the period, and check each group’s Count: issued tickets count on their apprehension date, paid tickets only once fully paid. Tickets imported from the old system are left out when that switch is off. The line after “Not counted” says why matching tickets were skipped.'
		},
		{
			q: 'Generate report is greyed out.',
			a: 'Something on the Before generating list in the payout summary is still unchecked, such as a missing reason for a changed rate or a left-out ticket. Select the item to jump to it.'
		},
		{
			q: 'A ticket I expected is missing from an incentive report.',
			a: 'It may already be in another report. A ticket can be counted in only one report at a time; void that report to release it.'
		}
	];

	const terms = [
		['Ticket', 'A registered booklet of numbered citation tickets.'],
		['Series number', 'One numbered ticket within a booklet.'],
		['Withdrawal', 'Recording that a booklet has been released to an enforcement group.'],
		['Pad (assignment)', 'A range of series numbers assigned to one officer.'],
		['Issuance', 'A citation issued against a violator.'],
		['Tracking code', 'The code that identifies an issued citation, used to find its billing.'],
		['Billing', 'The amount due for a citation, with what has been paid and what remains.'],
		['Liquidation', 'Checking each series number on a pad against what became of it.'],
		['Enforcement group', 'The office or agency a user and its records belong to.'],
		['User type', 'A role that bundles permissions.'],
		['Code provision', 'The legal or ordinance reference a citation is based on.'],
		['Offense', 'A specific violation under a code provision, with its penalties.'],
		['Incentive report', 'A record of what officers earn from their tickets for a period.'],
		[
			'Incentive settings',
			'An enforcement group’s default rate, used as the starting point for its incentives.'
		],
		[
			'Voided report',
			'An incentive report cancelled with a reason; its tickets can be counted again.'
		]
	];
</script>

<section aria-labelledby="help">
	<h2 id="help">Help</h2>

	<h3 id="troubleshooting">Troubleshooting</h3>
	<dl class="not-prose my-6 divide-y divide-base-300 rounded-box border border-base-300 text-sm">
		{#each problems as p (p.q)}
			<div class="px-4 py-3.5">
				<dt class="font-medium">{p.q}</dt>
				<dd class="mt-1 leading-6 text-base-content/75">{p.a}</dd>
			</div>
		{/each}
	</dl>

	<h3 id="glossary">Glossary</h3>
	<dl class="not-prose my-6 divide-y divide-base-300 rounded-box border border-base-300 text-sm">
		{#each terms as [term, meaning] (term)}
			<div class="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
				<dt class="font-medium">{term}</dt>
				<dd class="leading-6 text-base-content/75">{meaning}</dd>
			</div>
		{/each}
	</dl>
</section>
