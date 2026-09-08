import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import type { SidebarNavItem } from "@/components/app-shared";
import { NavUser } from "@/components/nav-user";
import type { ReactNode } from "react";

export function AppHeader({
	breadcrumb,
	right,
	onSettings,
}: {
	breadcrumb: { title: string };
	right?: ReactNode;
	onSettings?: () => void;
}) {
	const crumb: SidebarNavItem = { title: breadcrumb.title };

	return (
		<header
			className={cn(
				"sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-4 md:px-6",
				"glass-toolbar"
			)}
		>
			<div className="flex items-center gap-3">
				<CustomSidebarTrigger />
				<Separator
					className="mr-2 h-4 data-[orientation=vertical]:self-center"
					orientation="vertical"
				/>
				<AppBreadcrumbs page={crumb} />
			</div>
			<div className="flex items-center gap-3">
				{right}
				<Separator
					className="h-4 data-[orientation=vertical]:self-center"
					orientation="vertical"
				/>
				<NavUser onSettings={onSettings} />
			</div>
		</header>
	);
}
