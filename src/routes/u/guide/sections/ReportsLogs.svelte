<script lang="ts">
	import Screenshot from '$lib/ui/components/guide/Screenshot.svelte';
</script>

<section aria-labelledby="reports-and-logs">
	<h2 id="reports-and-logs">Reports and logs</h2>

	<h3 id="dashboard">The dashboard</h3>
	<p>
		The dashboard greets you and summarizes your scope of records: the collection rate, tickets
		issued per day and payments collected per day over the last 30 days, outstanding balances,
		recent issuances and recent payments. Each panel has a <strong>View all</strong> link to the full
		list behind it.
	</p>

	<h3 id="reports">Reports</h3>
	<p>
		Open <strong>Reports</strong>. Two reports are available as tabs: the
		<strong>Issuance Report</strong> and the <strong>Payments</strong> report.
	</p>
	<ul>
		<li>
			The issuance report breaks citations down by status, top barangays, violation category and top
			issuers, with the matching citations listed below.
		</li>
		<li>
			Select a status or other group to add it as a filter. Applied filters appear as chips that you
			can remove one at a time, or use <strong>Reset filters</strong> to start over.
		</li>
	</ul>
	<Screenshot caption="The Issuance Report with filters applied." file="reports.png" />

	<h3 id="logs">Logs</h3>
	<p>
		<strong>Logs</strong> is the audit trail. Most changes made in the system are recorded with the
		date, level, action, module and a message. Narrow the list with the <strong>Level</strong>,
		<strong>Action</strong> and <strong>Module</strong> filters.
	</p>
	<Screenshot caption="The audit log with its filters." file="logs.png" />
</section>
