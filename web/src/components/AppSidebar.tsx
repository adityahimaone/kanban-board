import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import type { Board } from "@/api"
import { LayoutDashboard, Layers, Kanban } from "lucide-react"

export function AppSidebar({
  boards,
  slug,
  onSelect,
  onNewTask,
}: {
  boards: Board[]
  slug: string
  onSelect: (s: string) => void
  onNewTask: () => void
}) {
  const active = boards.filter((b) => !["default", "archived"].includes(b.slug))

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Kanban" className="data-[state=open]:bg-sidebar-accent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#10e0dd] text-black">
                <Kanban className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Kanban</span>
                <span className="truncate text-xs text-muted-foreground">Board</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive tooltip="Kanban Board">
                  <LayoutDashboard />
                  <span>Kanban Board</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-2 w-auto" />

        <SidebarGroup>
          <SidebarGroupLabel>Boards</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {active.map((b) => (
                <SidebarMenuItem key={b.slug}>
                  <SidebarMenuButton
                    isActive={slug === b.slug}
                    onClick={() => onSelect(b.slug)}
                    tooltip={`${b.name}`}
                  >
                    <Layers />
                    <span className="truncate">{b.icon ? `${b.icon} ` : ""}{b.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {!active.length && (
                <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">No boards</p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onNewTask}
              tooltip="New Task"
              className="bg-[#10e0dd] text-black hover:bg-[#10e0dd]/90 hover:text-black"
            >
              <span className="text-base leading-none">＋</span>
              <span>New Task</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
