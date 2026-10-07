<script lang="ts">
	import Header from '$lib/ui/layout/header/Header.svelte';
	import lgu_seal from '$lib/assets/lgu_seal.svg';
	import { lgu } from '$lib/data/lgu';
	import type Billing from '$lib/validation_schemas/Billing.zod.js';
	import type Issuance from '$lib/validation_schemas/Issuances.zod.js';
	import type Violator from '$lib/validation_schemas/Violators.zod.js';
	import { date, getNumberOrdinal, parseName } from '$lib/utilities/helper.js';
	import type TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod.js';
	import User from '$lib/validation_schemas/Users.zod.js';
	import type Ticket from '$lib/validation_schemas/Tickets.zod.js';
	const { data } = $props();

	const billing: Billing.Base<
		Issuance.Base<TicketAssignment.Base<string, Ticket.Base, string>, User.Base, string>,
		Violator.Base
	> = $derived(data.billing);

	const grace_period: number = 15;
	const every_after: number = 30;
</script>

<Header title="" />

<div class="flex min-h-0 w-full grow flex-col gap-16 overflow-auto py-8 md:px-0">
	<div
		class="mx-auto aspect-17/26 h-312 w-204 rounded-lg border border-base-300 bg-base-200 p-8 shadow-lg"
	>
		<header class="flex flex-row justify-between">
			<div class="flex flex-col justify-center">
				<p class="text-xs">Page 1 of 2</p>
				<p class="font-bold uppercase">Ordinance Violations</p>
				<p class="text-sm">Billing Statement</p>
			</div>

			<div class="flex flex-row items-center gap-3 text-right">
				<div>
					<p class="text-xs leading-3.5">Republic of the Philippines</p>
					<p class="text-xs leading-3.5">{lgu.province}</p>
					<p class="leading-6 font-semibold">{lgu.city}</p>
				</div>

				<img src={lgu_seal} alt="" class="size-16" />
			</div>
		</header>
		<div class="divider"></div>

		<main>
			<section class="flex flex-col gap-1.5">
				<h1 class="text-lg font-bold uppercase">{parseName(billing.recipient)}</h1>

				<div>
					<table class="text-xs">
						<tbody>
							<tr>
								<td>Ticket no.:</td>
								<td class="pl-8"
									>{billing.issuance.ticket_assignment.ticket.name} - {billing.issuance
										.ticket_series}</td
								>
							</tr>
							<tr>
								<td>Date of apprehension:</td>
								<td class="pl-8"
									>{date.formatDate({
										date: billing.issuance.apprehension_date,
										format: 'MMMM dd, yyyy - wk'
									})}</td
								>
							</tr>
							<tr>
								<td>Apprehended on or around:</td>
								<td class="pl-8">{date.formatTime(billing.issuance.apprehension_time)}</td>
							</tr>
							<tr>
								<td>Apprehended at or near:</td>
								<td class="line-clamp-2 pl-8"
									>{billing.issuance.apprehension_address}, {billing.issuance
										.apprehension_barangay}, {lgu.city}</td
								>
							</tr>
							<tr>
								<td>Apprehending officer:</td>
								<td class="pl-8">{parseName(billing.issuance.issuer)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>
			<div class="divider"></div>

			<section class="flex flex-col gap-4">
				<div>
					<h1>Violations</h1>
				</div>

				<table class="table table-auto table-xs">
					<thead>
						<tr>
							<th></th>
							<th>Code</th>
							<th>Description</th>
							<th></th>
							<th>Amount</th>
						</tr>
					</thead>

					<tbody>
						{#each billing.violations as violation, index (index)}
							<tr>
								<td>{index + 1}</td>
								<td class="whitespace-nowrap">{violation.code}</td>
								<td class="line-clamp-3 overflow-hidden">{violation.description}</td>
								<td class="whitespace-nowrap">{getNumberOrdinal(violation.level)} offense</td>
								<td class="text-right whitespace-nowrap">&#8369; {violation.penalty.pecuniary}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>

			<section class="mt-4 flex flex-row items-end justify-end gap-4">
				<h1>Total:</h1>
				<div class=" min-w-28 border-b-2 border-base-100 text-right text-error">
					<h1 class="text-xl font-bold">&#8369; {billing.violations_total_amount}</h1>
				</div>
			</section>
			<div class="divider"></div>

			<section class="mt-4 flex flex-col gap-4">
				<h1>Reminders</h1>
				<ol class="list list-decimal pl-4 text-xs leading-6">
					<li>
						Payment must be made within fifteen ({grace_period}) days from the date of issuance.
						Failure to settle within the given period will result in surcharges and/or penalties as
						indicated in the surcharge section on the reverse side of this billing statement or in
						the next page.
					</li>
					<li>
						Surcharges will continue to take effect every after thirty ({every_after}) days after
						the 15-days grace period.
					</li>
					<li>
						Please make sure that the details, especially the ticket number and name, of your
						billing statement are correct before payment.
					</li>
					<li>
						You may pay your ticket at the {lgu.payment_office} of the {lgu.city} located at {lgu.payment_address},
						{lgu.city} or through any of our accredited payment centers.
					</li>
					<li>
						Non-payment of this ticket may result in suspension or revocation of your license.
					</li>
					<li>
						If you wish to contest this citation, you must appear before the adjudication office
						within ten (10) days from the date of issuance.
					</li>
				</ol>
			</section>
		</main>

		<div class="divider"></div>

		<footer></footer>
	</div>

	<div
		class="mx-auto aspect-17/26 h-312 w-204 rounded-lg border border-base-300 bg-base-200 p-8 shadow-lg"
	>
		<header class="flex flex-row justify-between">
			<div class="flex flex-col justify-center">
				<p class="text-xs">Page 2 of 2</p>
				<p class="font-bold uppercase">Ordinance Violations</p>
				<p class="text-sm">Surcharge Details</p>
			</div>

			<div class="flex flex-row items-center gap-3 text-right">
				<div>
					<p class="text-xs leading-3.5">Republic of the Philippines</p>
					<p class="text-xs leading-3.5">{lgu.province}</p>
					<p class="leading-6 font-semibold">{lgu.city}</p>
				</div>

				<img src={lgu_seal} alt="" class="size-16" />
			</div>
		</header>
		<div class="divider"></div>

		<main>
			<section class="flex flex-col gap-1.5">
				<h1 class="text-lg font-bold uppercase">{parseName(billing.recipient)}</h1>

				<div>
					<table class="text-xs">
						<tbody>
							<tr>
								<td>Ticket no.:</td>
								<td class="pl-8"
									>{billing.issuance.ticket_assignment.ticket.name} - {billing.issuance
										.ticket_series}</td
								>
							</tr>
							<tr>
								<td>Date of apprehension:</td>
								<td class="pl-8"
									>{date.formatDate({
										date: billing.issuance.apprehension_date,
										format: 'MMMM dd, yyyy - wk'
									})}</td
								>
							</tr>
							<tr>
								<td>Apprehended on or around:</td>
								<td class="pl-8">{date.formatTime(billing.issuance.apprehension_time)}</td>
							</tr>
							<tr>
								<td>Apprehended at or near:</td>
								<td class="line-clamp-2 pl-8"
									>{billing.issuance.apprehension_address}, {billing.issuance
										.apprehension_barangay}, {lgu.city}</td
								>
							</tr>
							<tr>
								<td>Apprehending officer:</td>
								<td class="pl-8">{parseName(billing.issuance.issuer)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>
			<div class="divider"></div>

			<section class="flex flex-col gap-4">
				<div>
					<h1>Surcharges</h1>
					<p class="text-xs">
						Note: pay your violations on or before the specified dates below to avoid surcharges.
					</p>
				</div>

				<table class="table table-auto table-xs">
					<thead>
						<tr>
							<th></th>
							<th>Code</th>
							<th>Rate</th>
							<th>Surcharge</th>
							<th>Applied on</th>
							<th>Every after</th>
						</tr>
					</thead>

					<tbody>
						{#each billing.violations as violation, index (index)}
							<tr>
								<td>{index + 1}</td>

								<td class="whitespace-nowrap">{violation.code}</td>

								<td class="whitespace-nowrap">
									{#if violation.penalty.surcharge.type == 'fixed'}
										&#8369; {violation.penalty.surcharge.value}
									{:else if violation.penalty.surcharge.type == 'percentage'}
										{violation.penalty.surcharge.value} %
									{/if}
								</td>

								<td class="whitespace-nowrap"
									>&#8369;
									{#if violation.penalty.surcharge.type == 'fixed'}
										{violation.penalty.surcharge.value}
									{:else if violation.penalty.surcharge.type == 'percentage'}
										{violation.penalty.pecuniary * (violation.penalty.surcharge.value / 100)}
									{/if}
								</td>

								<td class="whitespace-nowrap">
									{violation.penalty.surcharge.applied_after_days} days
								</td>

								<td class="whitespace-nowrap">
									{violation.penalty.surcharge.applied_every_after} days
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
			<div class="divider"></div>
		</main>
	</div>
</div>
