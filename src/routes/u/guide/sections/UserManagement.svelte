<script lang="ts">
	import Callout from '$lib/ui/components/guide/Callout.svelte';
	import FieldList from '$lib/ui/components/guide/FieldList.svelte';
	import Screenshot from '$lib/ui/components/guide/Screenshot.svelte';
	import Steps from '$lib/ui/components/guide/Steps.svelte';
</script>

<section aria-labelledby="user-management">
	<h2 id="user-management">User management</h2>
	<p>
		Administrators create and maintain the accounts of everyone who uses CiteTicket, and control
		what each person can see and do by pairing their account with a user type and an enforcement
		group. You need the matching permissions on the <strong>Users</strong> module to do any of this.
	</p>

	<h3 id="creating-a-user">Creating a user account</h3>
	<Steps title="To create a user:">
		<li><span>Open <strong>Users</strong> in the menu.</span></li>
		<li><span>Select <strong>Add</strong> at the top right of the page.</span></li>
		<li><span>Choose the user's enforcement group and user type.</span></li>
		<li><span>Enter their first name, last name and, optionally, middle name.</span></li>
		<li>
			<span>
				Check the username. One is suggested from the name; you can change it. Availability is
				checked when you save.
			</span>
		</li>
		<li><span>Select <strong>Create</strong>.</span></li>
	</Steps>

	<FieldList
		items={[
			{
				name: 'Enforcement group',
				text: 'Defines which office’s records the user can access.'
			},
			{ name: 'User type', text: 'Defines the user’s permissions.' },
			{ name: 'Firstname', required: true, text: 'The user’s given name.' },
			{ name: 'Middlename', text: 'Optional.' },
			{ name: 'Lastname', required: true, text: 'The user’s family name.' },
			{ name: 'Username', required: true, text: 'Used to log in. Must be unique.' }
		]}
	/>

	<Screenshot caption="The Add New User form." file="user-create.png" />

	<p>
		When the account is created, a dialog shows the username and a temporary password. Copy them and
		give them to the user — the password is shown only then.
	</p>

	<Callout kind="important">
		The temporary password works for the first login only. The user is taken straight to the change
		password page and must set their own password before using anything else.
	</Callout>

	<h3 id="editing-and-archiving">Editing and archiving users</h3>
	<p>
		Edit an account to update the user's details, change their user type, or reassign them to
		another enforcement group — useful when an officer transfers between offices. Editing and
		archiving are separate permissions, granted to a user type, so not every administrator will see
		both.
	</p>
	<p>
		Archiving a user blocks the account at once and signs out any device it is logged in on. Nothing
		is deleted: tickets the user issued stay intact and attributed to them. Archived users drop out
		of active lists such as assignment dropdowns. Filter for archived users to find them, and use <strong
			>Restore</strong
		> to bring an account back.
	</p>

	<h3 id="resetting-password">Resetting a user's password</h3>
	<p>
		If a user is locked out or forgets their password, an administrator can reset it from the
		<strong>Users</strong> page by choosing <strong>Generate new password</strong> for that user.
	</p>
	<ul>
		<li>A new temporary password is generated and shown once, like a new account.</li>
		<li>The old password stops working immediately and the user is signed out of their devices.</li>
		<li>The user must change the temporary password at their next login.</li>
	</ul>
</section>
