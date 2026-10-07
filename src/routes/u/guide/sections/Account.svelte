<script lang="ts">
	import Callout from '$lib/ui/components/guide/Callout.svelte';
	import Steps from '$lib/ui/components/guide/Steps.svelte';
</script>

<section aria-labelledby="your-account">
	<h2 id="your-account">Your account</h2>

	<h3 id="profile">Your profile</h3>
	<p>
		Select your name at the bottom of the side menu to open your profile. The same area has the
		light/dark switch and <strong>Sign out</strong>. Your theme choice is remembered on that device.
	</p>

	<h3 id="changing-your-password">Changing your password</h3>
	<Steps title="To change your password:">
		<li><span>Open your profile and choose to change your password.</span></li>
		<li><span>Enter your current password.</span></li>
		<li><span>Enter a new password. A strength indicator shows how strong it is.</span></li>
		<li><span>Confirm the new password and save.</span></li>
	</Steps>
	<p>Use the eye button beside a field to show or hide what you typed.</p>

	<h3 id="staying-signed-in">Staying signed in</h3>
	<ul>
		<li>You are signed out after 4 hours without activity.</li>
		<li>You are always signed out after 1 day, even if you stay active.</li>
		<li>
			An account can be signed in on up to 3 devices at once. Signing in on a fourth signs out the
			one used least recently.
		</li>
		<li>Changing your password signs out your other devices.</li>
	</ul>
	<Callout kind="tip">
		On a shared computer, always choose <strong>Sign out</strong> when you're done instead of just closing
		the tab.
	</Callout>
</section>
