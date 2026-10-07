<script lang="ts">
	import Callout from '$lib/ui/components/guide/Callout.svelte';
	import Screenshot from '$lib/ui/components/guide/Screenshot.svelte';
	import Steps from '$lib/ui/components/guide/Steps.svelte';
</script>

<section aria-labelledby="getting-started">
	<h2 id="getting-started">Getting started</h2>

	<h3 id="accessing-the-system">Accessing the system</h3>
	<p>
		CiteTicket runs in a web browser. Open the system's URL in your browser's address bar. No
		separate installation is required.
	</p>
	<p>
		CiteTicket opens to a landing page with an overview of the system. Select <strong
			>Open App</strong
		>
		to go to the login page.
	</p>

	<h3 id="logging-in">Logging in</h3>
	<p>
		Enter your username and password on the login page. Only users with an existing account can log
		in — accounts cannot be self-registered. New users must contact their system administrator to
		have an account created for them.
	</p>

	<Steps title="To log in:">
		<li><span>Open the CiteTicket app.</span></li>
		<li><span>Select <strong>Open App</strong>.</span></li>
		<li><span>Enter your username and password.</span></li>
		<li><span>Select <strong>Log in</strong>.</span></li>
	</Steps>

	<Screenshot caption="The login page." file="login.png" />

	<Callout kind="important">
		Never share login credentials between officers or enforcers. Each citation ticket is tied to the
		account that issued it, so a shared account makes it difficult to trace accountability for
		specific tickets.
	</Callout>

	<p>
		If the username or password is wrong, the system shows the same message in both cases. Check
		both, then ask your administrator to reset your password if you still can't get in.
	</p>

	<h3 id="dashboard-overview">Dashboard overview</h3>
	<p>
		After logging in you land on the dashboard — a summary of citation activity relevant to the role
		and enforcement group you are assigned. It shows the collection rate, tickets issued and
		payments collected over the last 30 days, outstanding balances, and recent issuances.
		<a href="#reports">Full reports are covered in Reports and logs.</a>
	</p>
	<Screenshot caption="The dashboard after logging in." file="dashboard.png" />

	<h3 id="navigation">Navigation basics</h3>
	<p>
		The menu on the left lists the modules you have access to: Dashboard, Users, Violators,
		Issuance, Billing, Payments, Reports, Incentives and Logs, plus two groups —
		<strong>Tickets</strong> (Registered tickets, Ticket assignments, Ticket liquidation) and
		<strong>System Configurations</strong> (User types, Enforcement group, Violation categories, Code
		provisions). A module that your user type has no access to is not shown.
	</p>
	<p>
		At the bottom of the menu you'll find your name (which opens your profile), the light/dark
		switch, and <strong>Sign out</strong>. On a phone, tap the CiteTicket logo at the top left of
		any page to open the menu.
	</p>
	<Screenshot
		caption="The side menu, with the profile, theme switch and Sign out."
		file="navigation.png"
	/>
</section>
