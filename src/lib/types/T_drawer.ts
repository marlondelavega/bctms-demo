export type DrawerItem = {
	name: string;
	icon?: string;
	href?: string;
	query?: string;
	color?: string;
};

export type TDrawer = DrawerItem & {
	subitems?: Omit<DrawerItem, 'icon'>[];
	icon?: string;
};
