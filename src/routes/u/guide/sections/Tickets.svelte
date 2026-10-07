<script lang="ts">
	import Callout from '$lib/ui/components/guide/Callout.svelte';
	import FieldList from '$lib/ui/components/guide/FieldList.svelte';
	import Screenshot from '$lib/ui/components/guide/Screenshot.svelte';
	import Steps from '$lib/ui/components/guide/Steps.svelte';
</script>

<section aria-labelledby="ticket-management">
	<h2 id="ticket-management">Citation ticket management</h2>
	<p>
		Physical citation tickets move through three steps before an officer can use them: they are
		<strong>registered</strong>, <strong>withdrawn</strong> for an enforcement group, and
		<strong>assigned</strong> to an officer as a pad. All three live under
		<strong>Tickets</strong> in the menu.
	</p>

	<h3 id="ticket-registration">Ticket registration</h3>
	<p>
		Register a booklet of tickets before it can be withdrawn or assigned. Open
		<strong>Tickets → Registered tickets</strong> and select <strong>Add</strong>.
	</p>
	<FieldList
		items={[
			{
				name: 'Ticket name',
				required: true,
				text: 'Should be unique — typically a code made up of an identifier and the ticket series, such as AS_U_1001_1050.'
			},
			{
				name: 'Ticket from',
				required: true,
				text: 'The starting number of the citation ticket range.'
			},
			{
				name: 'Ticket to',
				required: true,
				text: 'The last number of the citation ticket range.'
			},
			{ name: 'Date created', required: true, text: 'Date the ticket was registered.' }
		]}
	/>
	<Screenshot caption="The Register New Ticket form." file="ticket-register.png" />

	<h3 id="withdrawing-tickets">Withdrawing tickets</h3>
	<p>
		Withdrawing records that a registered booklet has left storage for an enforcement group. Only
		withdrawn tickets can be assigned.
	</p>
	<Steps title="To withdraw tickets:">
		<li><span>Open <strong>Tickets → Registered tickets</strong>.</span></li>
		<li>
			<span>Choose <strong>Withdraw</strong> for the ticket, or select several tickets first.</span>
		</li>
		<li><span>Fill in the form below.</span></li>
		<li><span>Confirm the withdrawal.</span></li>
	</Steps>
	<FieldList
		items={[
			{
				name: 'Ticket for',
				required: true,
				text: 'The enforcement group the ticket will be assigned to.'
			},
			{
				name: 'Date withdrawn',
				required: true,
				text: 'Date the ticket was withdrawn. Use “today” to fill in the current date.'
			},
			{
				name: 'Person in-charge',
				required: true,
				text: 'The office admin responsible for the withdrawal, filtered by the selected enforcement group.'
			}
		]}
	/>

	<h3 id="ticket-assignments">Ticket assignments</h3>
	<p>
		A pad is a slice of a ticket's number range handed to one officer. The officer can only issue
		citations from series numbers that are assigned to them.
	</p>
	<Steps title="To assign a pad:">
		<li>
			<span
				>Open <strong>Tickets → Ticket assignments</strong> and select <strong>Add</strong>.</span
			>
		</li>
		<li>
			<span>Search for a withdrawn ticket, select it, then choose <strong>Assign</strong>.</span>
		</li>
		<li>
			<span>
				On the page that opens, enter who it is assigned to and the series range, then save.
			</span>
		</li>
	</Steps>
	<FieldList
		items={[
			{ name: 'Assign to', required: true, text: 'The officer who will use this pad.' },
			{ name: 'Ticket from', required: true, text: 'First series number of the pad.' },
			{ name: 'Ticket to', required: true, text: 'Last series number of the pad.' },
			{
				name: 'Status',
				required: true,
				text: 'Active pads can be issued from. Inactive pads are kept for the record.'
			},
			{ name: 'Date assigned', required: true, text: 'Date the pad was handed over.' }
		]}
	/>
	<p>
		The page shows how much of the ticket's range is already assigned. Use <strong>Fill gap</strong>
		to assign a range that was left unassigned, and the edit icon on a row to change an existing assignment.
	</p>
	<Callout kind="note">
		Once every series number on a pad has been used, the pad can no longer be picked when issuing a
		citation.
	</Callout>
	<Screenshot caption="Managing assignments for one ticket." file="ticket-assignments.png" />
</section>
