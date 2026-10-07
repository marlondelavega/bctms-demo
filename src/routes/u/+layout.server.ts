import { getUser_byId } from '$lib/server/services/Users.service';
import type { LayoutServerLoad } from './$types';
import type { DrawerItem, TDrawer } from '$lib/types/T_drawer';
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import type UserType from '$lib/validation_schemas/UserTypes.zod';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import { modules } from '$lib/store/modules';

export const load: LayoutServerLoad = async ({ locals }) => {
	let _u = locals.user;
	if (locals.user) {
		const _p = await getUser_byId(locals.user?._id);
		const _d = JSON.parse(JSON.stringify(_p));
		_d.user_type = _d.user_type as UserType.Base;
		_d.enforcement_group = _d.enforcement_group as EnforcementGroup.Base;
		_u = _d;
	} else if (!locals.user || locals.user == null) {
		redirect(303, `${base}/login`);
	}

	const drawer: TDrawer[] = [
		{
			name: 'Dashboard',
			icon: 'LayoutDashboard',
			href: '/dashboard',
			query: '?page=1&size=10',
			color: 'text-primary'
		},
		{
			name: 'Users',
			icon: 'UsersRound',
			href: '/users',
			query: '?page=1&size=10',
			color: 'text-accent'
		},
		{
			name: 'Violators',
			icon: 'FileUser',
			href: '/violators',
			query: '?page=1&size=10',
			color: 'text-secondary'
		},
		{
			name: 'Issuance',
			icon: 'FilePenLine',
			href: '/issuance',
			query: '?page=1&size=10',
			color: 'text-primary'
		},
		{
			name: 'Billing',
			icon: 'ScrollText',
			href: '/billing',
			query: '?page=1&size=10',
			color: 'text-warning'
		},
		{
			name: 'Payments',
			icon: 'Receipt',
			href: '/payments',
			query: '?page=1&size=10',
			color: 'text-info'
		},
		{
			name: 'Reports',
			icon: 'FileBarChart2',
			href: '/reports',
			color: 'text-primary'
		},
		{
			name: 'Incentives',
			icon: 'HandCoins',
			href: '/incentives',
			query: '?page=1&size=10',
			color: 'text-success'
		},
		{
			name: 'Logs',
			icon: 'History',
			href: '/logs',
			query: '?page=1&size=10',
			color: 'text-error'
		},
		{
			name: 'Tickets',
			icon: 'Tickets',
			// href: '/tickets',
			query: '?page=1&size=10',
			color: 'text-accent',
			subitems: [
				{
					name: 'Registered tickets',
					href: '/tickets',
					query: '?page=1&size=10'
				},
				{
					name: 'Ticket assignments',
					href: '/ticket-assignments',
					query: '?page=1&size=10'
				},
				{
					name: 'Ticket liquidation',
					href: '/ticket-liquidation',
					query: '?page=1&size=10'
				}
			]
		},
		{
			name: 'User guide',
			icon: 'BookOpen',
			href: '/guide',
			color: 'text-info'
		},
		{
			name: 'System Configurations',
			icon: 'SlidersHorizontal',
			query: '?page=1&size=10',
			color: 'text-secondary',
			subitems: [
				{
					name: 'User types',
					href: '/user-types',
					query: '?page=1&size=10'
				},
				{
					name: 'Enforcement group',
					href: '/enforcement',
					query: '?page=1&size=10'
				},
				{
					name: 'Violation categories',
					href: '/violation-categories',
					query: '?page=1&size=10'
				},
				{
					name: 'Code provisions',
					href: '/code-provisions',
					query: '?page=1&size=10'
				}
			]
		}
	];

	const canAccess = (item: DrawerItem) => {
		// the dashboard scopes its own data, and the guide has no data, so every signed-in user gets both
		if (item.href === '/dashboard' || item.href === '/guide') return true;
		if (_u?.user_type && typeof _u.user_type !== 'string' && item.href) {
			const permissions = _u.user_type.permissions;
			const module = modules.find((m) => m.route === item.href);
			const resource = module?.collection ?? item.href.replaceAll('/', '');
			const _t = permissions.some((i: string) => {
				const parts = i.split(':');
				return parts[2] === resource && parts[1] !== 'none';
			});
			return _t;
		}
	};

	const _d = drawer
		.map((_m) => ({
			..._m,
			subitems: _m.subitems?.filter((subitem) => {
				return canAccess(subitem);
			})
		}))
		.filter((item) => {
			if (item.subitems && item.subitems.length > 0) return true;
			return canAccess(item);
		});

	return {
		user: _u,
		drawer: _d
	};
};
