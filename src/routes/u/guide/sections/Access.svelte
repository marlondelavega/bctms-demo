<script lang="ts">
	import Callout from '$lib/ui/components/guide/Callout.svelte';
	import FieldList from '$lib/ui/components/guide/FieldList.svelte';
	import Screenshot from '$lib/ui/components/guide/Screenshot.svelte';
	import Steps from '$lib/ui/components/guide/Steps.svelte';

	const modules = [
		'Users',
		'Tickets',
		'Violators',
		'User types',
		'Enforcement groups',
		'Violation categories',
		'Code provisions',
		'Issuance',
		'Ticket assignments',
		'Ticket liquidation',
		'Billing',
		'Payments',
		'Reports',
		'Logs',
		'Incentives'
	];
</script>

<section aria-labelledby="user-types-permissions">
	<h2 id="user-types-permissions">User types and permissions</h2>

	<h3 id="user-types">User types</h3>
	<p>
		A user type is a role. It decides which actions a person can perform and on whose records. Users
		can only do and see what their user type allows.
	</p>
	<p>
		Permissions are set per module. Each module can be given any of these actions, each with a
		scope:
	</p>
	<dl class="not-prose my-4 grid gap-4 text-sm sm:grid-cols-2">
		<div class="rounded-box bg-base-200 p-4">
			<dt class="font-semibold">Actions</dt>
			<dd class="mt-1 leading-6 text-base-content/75">Access, Create, Edit, Archive, Restore</dd>
		</div>
		<div class="rounded-box bg-base-200 p-4">
			<dt class="font-semibold">Scopes</dt>
			<dd class="mt-1 leading-6 text-base-content/75">
				<strong class="font-medium text-base-content">All</strong> records,
				<strong class="font-medium text-base-content">Office</strong> (own enforcement group),
				<strong class="font-medium text-base-content">Own</strong> (records the user created), or
				<strong class="font-medium text-base-content">None</strong>
			</dd>
		</div>
	</dl>
	<p>The modules that can be controlled are:</p>
	<ul class="not-prose my-4 flex flex-wrap gap-2">
		{#each modules as m (m)}
			<li class="badge badge-ghost h-auto px-3 py-1.5 text-sm">{m}</li>
		{/each}
	</ul>

	<h3 id="enforcement-groups">Enforcement groups</h3>
	<p>
		Enforcement groups represent the local law enforcement agencies or offices responsible for
		issuing citation tickets. Every user belongs to one group, which limits them to that group's
		records. Access can be narrowed further by user type — an enforcer, for example, may see only
		the citations they personally issued.
	</p>

	<Callout kind="note" label="How they work together">
		A user's <em>user type</em> determines which actions they can perform. Their
		<em>enforcement group</em> determines which office's records they can act on.
	</Callout>
</section>

<section aria-labelledby="system-configurations">
	<h2 id="system-configurations">System configurations</h2>
	<p>
		These are set up by the system administrator or authorized staff so the app fits your
		organization. Find them under <strong>System Configurations</strong> in the menu: enforcement groups,
		user types, violation categories and code provisions.
	</p>

	<Callout kind="tip">
		On every form, a field marked <span class="text-error">Required</span> or with an asterisk (<span
			class="text-error">*</span
		>) must be filled in before you can save.
	</Callout>

	<h3 id="configuration-enforcement-groups">Enforcement groups</h3>
	<p>
		Adding a group takes two fields. Once created, a group can be assigned to users, and given
		<a href="#configuration-incentive-settings">incentive settings</a>.
	</p>
	<FieldList
		items={[
			{ name: 'Name', required: true, text: 'Should be unique and descriptive.' },
			{
				name: 'Description',
				required: true,
				text: 'Additional information about the group, such as its purpose and jurisdiction.'
			}
		]}
	/>

	<h3 id="configuration-incentive-settings">Incentive settings</h3>
	<p>
		Each enforcement group has its own incentive settings: the rate a new
		<a href="#generating-incentives">incentive report</a> starts from for that group. The
		<strong>Incentive</strong> column in the enforcement groups list shows each group's current
		setting, or <em>Not set</em>.
	</p>
	<Steps title="To set a group's incentive rate:">
		<li>
			<span>
				Open <strong>System Configurations</strong> → <strong>Enforcement group</strong>.
			</span>
		</li>
		<li><span>On the group's row, select the <strong>Incentives</strong> action.</span></li>
		<li><span>Fill in the settings below, then select <strong>Save</strong>.</span></li>
	</Steps>
	<FieldList
		items={[
			{
				name: 'Incentives enabled',
				text: 'When on, the group is added automatically when generating a report. When off, the group starts out not paid.'
			},
			{
				name: 'Rate',
				required: true,
				text: 'Percentage, or Fixed per ticket.'
			},
			{
				name: 'Percentage / Amount per ticket',
				required: true,
				text: 'Greater than zero. A percentage can be at most 100. The dialog shows a worked example.'
			},
			{
				name: 'Count',
				required: true,
				text: 'Issued tickets (counted on the apprehension date) or Paid tickets (counted on the day the bill was fully paid).'
			}
		]}
	/>
	<Screenshot
		caption="The incentive settings dialog for an enforcement group."
		file="enforcement-incentive-settings.png"
	/>
	<Callout kind="note">
		Changing a group's settings affects only reports generated afterwards. Every report keeps the
		settings it was generated with, and each change is recorded in the logs. Changing these settings
		needs the <strong>Edit</strong> permission on the <strong>Incentives</strong> module.
	</Callout>

	<h3 id="configuration-user-types">User types</h3>
	<p>Creating a user type takes two fields and a set of permissions.</p>
	<FieldList
		items={[
			{ name: 'User type', required: true, text: 'Should be unique and descriptive.' },
			{
				name: 'Role description',
				required: true,
				text: 'Role details and description, outlining its responsibilities.'
			},
			{
				name: 'Permissions',
				required: true,
				text: 'Not a single field, but a set of permissions configured per module for the role.'
			}
		]}
	/>
	<Screenshot caption="The user type form with the permission grid." file="user-type-form.png" />

	<h3 id="configuration-violation-categories">Violation categories</h3>
	<p>
		Violation categories classify offenses so citations are easier to organize and report on. Each
		category has sub-categories that define the violations within it.
	</p>
	<FieldList
		items={[
			{ name: 'Category name', required: true, text: 'Should be unique and descriptive.' },
			{
				name: 'Description',
				required: true,
				text: 'Detailed description of the violation category, outlining its scope.'
			},
			{
				name: 'Sub-categories',
				required: true,
				text: 'Requires at least one sub-category to further categorize violations.'
			}
		]}
	/>

	<h3 id="configuration-code-provisions">Code provisions</h3>
	<p>
		A code provision is the legal or ordinance reference that a citation is based on. Each one is
		linked to a violation category and applies to one enforcement group.
	</p>
	<FieldList
		items={[
			{
				name: 'Code',
				required: true,
				text: 'A reference from an existing legal document, or a code that uniquely identifies the provision.'
			},
			{
				name: 'Descriptor',
				required: true,
				text: 'Short and descriptive name for easy identification.'
			},
			{
				name: 'Description',
				required: true,
				text: 'Detailed explanation of the code provision and its application.'
			},
			{
				name: 'Violation category',
				required: true,
				text: 'Selected from configured violation categories.'
			},
			{
				name: 'Sub-category',
				required: true,
				text: 'Filtered based on the selected violation category.'
			},
			{
				name: 'Enforcement group',
				required: true,
				text: 'Selected from configured enforcement groups.'
			},
			{
				name: 'Offenses',
				required: true,
				text: 'Specific offenses under the provision, each with pecuniary and/or disciplinary penalties and optional surcharge details.'
			}
		]}
	/>
</section>
