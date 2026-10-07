<script lang="ts">
	import { issuance_status_data } from '$lib/data/static_data';
	import Callout from '$lib/ui/components/guide/Callout.svelte';
	import FieldList from '$lib/ui/components/guide/FieldList.svelte';
	import Screenshot from '$lib/ui/components/guide/Screenshot.svelte';
	import Steps from '$lib/ui/components/guide/Steps.svelte';

	const meaning: Record<number, { meaning: string; next: string }> = {
		1: {
			meaning: 'The citation has been issued and is waiting to be settled.',
			next: 'Paid, Filed Case, Cancelled'
		},
		2: {
			meaning: 'The settlement period has passed. Set automatically by the system.',
			next: 'Paid, Filed Case, Cancelled'
		},
		3: { meaning: 'The fine has been settled in full.', next: 'None — final' },
		4: { meaning: 'The violation has gone to court.', next: 'Case Closed, Cancelled' },
		5: { meaning: 'The court case has ended.', next: 'Cancelled' },
		6: { meaning: 'The citation was voided.', next: 'None — final' }
	};
</script>

<section aria-labelledby="citations">
	<h2 id="citations">Issuing citations</h2>

	<h3 id="issuing-a-citation">Issuing a citation</h3>
	<p>
		Open <strong>Issuance</strong> and select <strong>Add</strong>. The form is titled
		<em>Issue New Ticket</em>.
	</p>
	<Steps title="To issue a citation:">
		<li>
			<span>
				Pick the <strong>Violator</strong>. If they are not on record yet, add them first under
				<strong>Violators → Add</strong>.
			</span>
		</li>
		<li>
			<span
				>Pick the <strong>Ticket</strong> from your assigned pads, then the <strong>Series</strong> number.</span
			>
		</li>
		<li><span>Add at least one violation from the configured code provisions.</span></li>
		<li>
			<span>
				Enter when and where it happened: apprehension date, time, barangay, and “at or near”.
			</span>
		</li>
		<li><span>Add remarks if needed, then save.</span></li>
	</Steps>
	<FieldList
		items={[
			{ name: 'Violator', required: true, text: 'The person being cited.' },
			{
				name: 'Ticket and series',
				required: true,
				text: 'The physical ticket the citation is written on.'
			},
			{
				name: 'Status',
				text: 'Fixed to Issued for a new citation. You can change it later.'
			},
			{ name: 'Violations', required: true, text: 'One or more offenses under a code provision.' },
			{
				name: 'Apprehension date and time',
				required: true,
				text: 'When the violation was observed.'
			},
			{ name: 'Barangay and at or near', required: true, text: 'Where it was observed.' },
			{ name: 'Remarks', text: 'Anything the record should keep.' }
		]}
	/>
	<Screenshot caption="The Issue New Ticket form." file="issuance-create.png" />
	<Callout kind="note">
		Each issued citation gets a <strong>tracking code</strong>, and a billing is created for it
		automatically. Cashiers use the tracking code to find the citation.
	</Callout>
	<Callout kind="tip">
		Leaving the form before saving shows a confirmation. Choose <strong>Confirm Cancel</strong>
		only if you want to discard what you entered.
	</Callout>

	<h3 id="citation-status">Citation status</h3>
	<p>
		Every citation has one of six statuses. To change it, open the citation's status page from
		<strong>Issuance</strong>, pick the new value under <strong>Change status to</strong> and select
		<strong>Change</strong>. The page also lists the citation's details and a history of every
		change, who made it, and any remarks.
	</p>

	<div class="not-prose my-6 overflow-x-auto rounded-box border border-base-300">
		<table class="table text-sm">
			<thead>
				<tr>
					<th>Status</th>
					<th>Meaning</th>
					<th>Can change to</th>
				</tr>
			</thead>
			<tbody>
				{#each issuance_status_data as status (status.value)}
					<tr>
						<td class="whitespace-nowrap">
							<span class={['badge badge-soft badge-sm', status.badge_color]}>{status.label}</span>
						</td>
						<td class="min-w-56">{meaning[status.value]?.meaning}</td>
						<td class="min-w-40 text-base-content/75">{meaning[status.value]?.next}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<Callout kind="important">
		Notice of Settlement is never chosen by a person. The system sets it when a citation has gone
		past its settlement period. Paid and Cancelled are final.
	</Callout>
	<Screenshot
		caption="A citation's status page with its change history."
		file="issuance-status.png"
	/>
</section>
