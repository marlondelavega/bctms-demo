<script lang="ts">
	import Callout from '$lib/ui/components/guide/Callout.svelte';
	import FieldList from '$lib/ui/components/guide/FieldList.svelte';
	import Screenshot from '$lib/ui/components/guide/Screenshot.svelte';
	import Steps from '$lib/ui/components/guide/Steps.svelte';

	const never_counted = [
		['Cancelled citations', 'A cancelled ticket never earns an incentive.'],
		[
			'Reissued citations',
			'When a citation was reissued, only the latest one in the chain counts, not the original.'
		],
		[
			'Tickets already in a report',
			'A ticket can be in only one report at a time. It becomes available again only if that report is voided.'
		],
		[
			'Partly paid tickets',
			'For groups that count paid tickets, a ticket counts only once its bill is fully paid.'
		]
	];

	const permissions = [
		[
			'Access',
			'See incentive reports. Own: only your share. Office: your group’s share. All: everything.'
		],
		[
			'Create',
			'Generate reports. Office: for your own group only. Own: for your own tickets only.'
		],
		['Edit', 'Change a group’s incentive settings on the Enforcement groups page.'],
		['Archive', 'Void reports.']
	];
</script>

<section aria-labelledby="incentives">
	<h2 id="incentives">Incentives</h2>
	<p>
		The <strong>Incentives</strong> module works out what each officer earns from the citations they issued,
		and keeps every payout as a report on record. Each enforcement group has its own incentive settings,
		which every new report starts from. You can still adjust the rates for a single report before you
		generate it.
	</p>

	<h3 id="how-incentives-are-counted">How incentives are counted</h3>
	<p>Every group's rate has three parts:</p>
	<ul>
		<li>
			<strong>Count</strong> — which tickets earn an incentive. <em>Issued tickets</em> count on
			their apprehension date. <em>Paid tickets</em> count on the day their bill was fully paid.
		</li>
		<li>
			<strong>Rate</strong> — a <em>percentage</em>, or a <em>fixed</em> amount per ticket.
		</li>
		<li>
			<strong>Amount</strong> — the percentage, or the peso amount per ticket. A percentage is taken from
			the ticket's fine total for issued tickets, and from the amount paid for paid tickets.
		</li>
	</ul>
	<p>
		Each ticket's incentive is rounded to the centavo, and the totals are the sum of those rounded
		amounts. A ticket belongs to the enforcement group it was issued under, so an officer who
		transfers keeps their earlier tickets under their old group.
	</p>
	<p>Some tickets are left out automatically:</p>
	<dl class="not-prose my-6 divide-y divide-base-300 rounded-box border border-base-300 text-sm">
		{#each never_counted as [term, meaning] (term)}
			<div class="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
				<dt class="font-medium">{term}</dt>
				<dd class="leading-6 text-base-content/75">{meaning}</dd>
			</div>
		{/each}
	</dl>

	<h3 id="generating-incentives">Generating an incentive report</h3>
	<p>
		Open <strong>Incentives</strong> and select <strong>Generate</strong>. The page has three parts
		on the left — <strong>Tickets</strong>, <strong>Groups &amp; rates</strong> and
		<strong>Review</strong> — and the <strong>Payout summary</strong> on the right, which stays in view
		as you scroll.
	</p>
	<Steps title="To generate an incentive report:">
		<li>
			<span>
				Under <strong>Tickets</strong>, choose the period. The shortcuts
				<strong>Last month</strong>, <strong>This month</strong>, <strong>Last quarter</strong> and
				<strong>This year</strong> fill in the dates for you.
			</span>
		</li>
		<li>
			<span>
				Narrow the tickets if needed: by officer, user type, violation category, code provision or
				barangay. Turn off <strong>Include tickets imported from the old system</strong> to leave out
				tickets migrated from the old system.
			</span>
		</li>
		<li>
			<span>
				Under <strong>Groups &amp; rates</strong>, check the groups being paid. Groups whose saved
				incentive settings are switched on are added automatically. Add others from
				<strong>Add a group</strong>, or remove one with its <strong>×</strong> button.
			</span>
		</li>
		<li>
			<span>
				Adjust a group's rate for this report if needed. If it differs from the group's saved
				settings, the card is marked <strong>Changed</strong> and you must give a reason.
			</span>
		</li>
		<li>
			<span>
				Check the <strong>Review</strong> and the <strong>Payout summary</strong>. They update by
				themselves a moment after each change.
			</span>
		</li>
		<li>
			<span>
				When every item under <strong>Before generating</strong> is checked, select
				<strong>Generate report</strong>, then <strong>Confirm &amp; generate</strong>.
			</span>
		</li>
	</Steps>
	<Screenshot
		caption="Generating incentives: the tickets, groups and rates on the left, the payout summary on the right."
		file="incentives-generate.png"
	/>

	<Callout kind="important">
		Generating saves the report and locks its tickets, so they can't be counted in another report.
		Check the review before you confirm.
	</Callout>

	<h3 id="reviewing-incentives">Reviewing before you generate</h3>
	<p>The <strong>Review</strong> has three tabs:</p>
	<ul>
		<li>
			<strong>By officer</strong> — each officer's tickets, base amount and incentive. Select an
			officer to see their tickets, and tick <strong>Leave out</strong> on any ticket that should not
			be paid this time.
		</li>
		<li><strong>By group</strong> — the rate applied to each group and its subtotal.</li>
		<li>
			<strong>Left out</strong> — the tickets you left out. Each one needs a reason, which is kept
			with the report. Select <strong>Put back</strong> to include it again.
		</li>
	</ul>
	<p>
		A ticket you leave out is not locked; it can still be counted in a later report. Tickets left
		out automatically are listed after <strong>Not counted</strong>, above the tabs.
	</p>
	<Screenshot
		caption="The review, with one officer opened to show their tickets."
		file="incentives-review.png"
	/>

	<p>
		The <strong>Before generating</strong> list in the payout summary shows what still needs doing: a
		valid period, at least one group with a rate, reasons for changed rates and left-out tickets, an up-to-date
		review, and at least one ticket to pay. Select an item to jump to where it can be fixed.
	</p>

	<h3 id="incentive-reports">Viewing, printing and voiding reports</h3>
	<p>
		Open <strong>Incentives</strong> to see the generated reports, newest first. Search by reference number,
		or filter by period, enforcement group or status. Select a reference number to open the report.
	</p>
	<Screenshot
		caption="The list of incentive reports. Voided reports stay listed, greyed out."
		file="incentives-list.png"
	/>
	<p>An incentive report shows:</p>
	<ul>
		<li>its reference number, period, who generated it and when, and any remarks,</li>
		<li>
			the <strong>Rates used</strong>: each group's saved setting next to the rate that was applied,
			with the reason for any change,
		</li>
		<li>the totals, and each officer's share, which you can open to see their tickets,</li>
		<li>the tickets that were left out, with their reasons.</li>
	</ul>
	<p>
		If a ticket was cancelled, or stopped being fully paid, after the report was generated, a
		warning lists it. The report keeps what was generated; void it and generate a new one if it
		needs correcting.
	</p>
	<Screenshot caption="An incentive report." file="incentive-report.png" />
	<p>
		Select <strong>Print</strong> for the paper copy. It includes a payout table with a
		<strong>Received by</strong> column for each officer's signature, and the full list of tickets counted.
	</p>

	<Steps title="To void a report:">
		<li><span>Open the report and select <strong>Void</strong>.</span></li>
		<li><span>Enter the reason, then select <strong>Void report</strong>.</span></li>
	</Steps>
	<Callout kind="note">
		A report is never edited or deleted. A voided report stays on record with who voided it and why,
		and its tickets can be counted again in a new report. Voiding can't be undone.
	</Callout>

	<h3 id="incentive-permissions">Who can do what</h3>
	<p>Access to incentives is set on the <strong>Incentives</strong> row of a user type:</p>
	<FieldList items={permissions.map(([name, text]) => ({ name, text }))} />
</section>
