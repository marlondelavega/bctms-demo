<script lang="ts">
	import Callout from '$lib/ui/components/guide/Callout.svelte';
	import FieldList from '$lib/ui/components/guide/FieldList.svelte';
	import Screenshot from '$lib/ui/components/guide/Screenshot.svelte';
	import Steps from '$lib/ui/components/guide/Steps.svelte';
</script>

<section aria-labelledby="billing-and-payments">
	<h2 id="billing-and-payments">Billing and payments</h2>

	<h3 id="billing">Billing</h3>
	<p>
		A billing is created automatically for every issued citation. Open <strong>Billing</strong> to see
		them all. Each row shows:
	</p>
	<ul>
		<li>the ticket and series number, and the tracking code,</li>
		<li>the recipient,</li>
		<li>the amount due, amount paid and the remaining balance,</li>
		<li>the payment status.</li>
	</ul>
	<p>Open a row to view the full billing.</p>
	<Screenshot caption="The billing list." file="billing-list.png" />

	<h3 id="recording-a-payment">Recording a payment</h3>
	<Steps title="To record a payment:">
		<li><span>Open <strong>Payments</strong> and select <strong>Add</strong>.</span></li>
		<li>
			<span>
				Search by <strong>tracking code or name</strong> and select the billing. Its outstanding balance
				appears.
			</span>
		</li>
		<li><span>Enter the reference number, payment method and amount.</span></li>
		<li><span>Add notes if needed, then save.</span></li>
	</Steps>
	<FieldList
		items={[
			{
				name: 'Reference number',
				required: true,
				text: 'The receipt or transaction reference for this payment.'
			},
			{ name: 'Payment method', required: true, text: 'How the payment was made.' },
			{
				name: 'Other payment method',
				text: 'Required only when the method is “other”. Say what it was.'
			},
			{ name: 'Amount', required: true, text: 'How much was paid, in pesos.' },
			{ name: 'Notes', text: 'Anything the record should keep.' }
		]}
	/>
	<Callout kind="important">
		A payment larger than the outstanding balance is rejected. Partial payments are accepted, and
		the balance goes down with each one.
	</Callout>
	<Screenshot
		caption="The Add Payment form showing a billing's outstanding balance."
		file="payment-create.png"
	/>
	<p>
		A recorded payment can be corrected from <strong>Payments</strong> with its edit action, within the
		same balance rule.
	</p>
</section>

<section aria-labelledby="ticket-liquidation">
	<h2 id="ticket-liquidation">Ticket liquidation</h2>
	<p>
		Liquidation is how office staff close out a pad: every series number is checked against what
		happened to it. Open <strong>Tickets → Ticket liquidation</strong> and choose a ticket.
	</p>
	<ul>
		<li>Each series number is listed with its status, or marked <em>not issued</em>.</li>
		<li>
			A bar at the top shows how many fall in each status. Select a status to filter the list.
		</li>
		<li>Select <strong>Show all tickets</strong> to clear the filter.</li>
		<li>
			Select <strong>Print</strong> to print the liquidation sheet. It prints on paper under the City
			Government of Dalisay heading.
		</li>
	</ul>
	<Screenshot caption="A ticket's liquidation page with the status bar." file="liquidation.png" />
</section>
