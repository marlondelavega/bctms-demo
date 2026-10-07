/* eslint-disable @typescript-eslint/no-namespace */
import type { SelectItems } from '$lib/types/T_select_options';
import z from 'zod';

namespace Filter {
	export const ArchiveSelectItems: SelectItems[] = [
		{
			label: 'Archived only',
			value: -1
		},
		{
			label: 'Any status',
			value: 0
		},
		{
			label: 'Active only',
			value: 1
		}
	] as const satisfies SelectItems[];

	export const SexSelectItems: SelectItems[] = [
		{
			label: 'Male',
			value: 'male'
		},
		{
			label: 'Female',
			value: 'female'
		}
	] as const satisfies SelectItems[];

	// derived from the sessions collection; `ever` only reaches back to its 90-day audit window
	export const LoginSelectItems = [
		{ label: 'Online now', value: 'online' },
		{ label: 'Has logged in', value: 'ever' },
		{ label: 'Never logged in', value: 'never' }
	] as const satisfies SelectItems[];

	export const LoginSchema = z.enum(['online', 'ever', 'never']);

	export const SexValues = SexSelectItems.map((i) => i.value) as ['male', 'female'];
	export const SexSchema = z.union(
		SexValues.map((v) => z.literal(v)) as [z.ZodLiteral<'male'>, z.ZodLiteral<'female'>]
	);

	export const ArchiveValues = ArchiveSelectItems.map((i) => i.value) as [-1, 0, 1];
	export const ArchiveSchema = z.union(
		ArchiveValues.map((v) => z.literal(v)) as [z.ZodLiteral<-1>, z.ZodLiteral<0>, z.ZodLiteral<1>]
	);

	export const Schema = z.object({
		page: z.number(),
		size: z.number(),

		search: z.string(),
		archived: ArchiveSchema.optional(),

		// '' is the "any" option of the select, so a picked value can be un-picked
		sex: SexSchema.or(z.literal('')).optional(),
		birthdate: z.string().optional(),
		barangay: z.string().max(24),

		date_from: z.string().optional(),
		date_to: z.string().optional(),
		login: LoginSchema.or(z.literal('')).optional(),

		user_type: z.string(),
		enforcement_group: z.string()
	});

	export type Base = z.infer<typeof Schema>;
}

export default Filter;
