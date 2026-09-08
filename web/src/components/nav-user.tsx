import { Settings } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NavUser({ onSettings }: { onSettings?: () => void }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground hover:bg-muted/80">
					A
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">Adit</span>
						<span className="text-xs text-muted-foreground">Frontend Dev</span>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem onClick={onSettings}>
						<Settings className="mr-2 size-4" />
						Settings
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
