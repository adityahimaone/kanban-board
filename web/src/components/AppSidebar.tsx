import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { LayoutDashboard, Kanban, FolderGit2, Bot, Server, ScrollText, Puzzle, Brain } from "lucide-react"

export type Page = "board" | "workspaces" | "profiles" | "providers" | "logs" | "skills" | "memory"

export function AppSidebar({
  page,
  onSelectPage,
}: {
  page: Page
  onSelectPage: (p: Page) => void
}) {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Kanban" data-cuelume-hover="tick" data-cuelume-press data-cuelume-release onClick={() => onSelectPage("board")}>
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
                <SidebarMenuButton isActive={page === "board"} onClick={() => onSelectPage("board")} tooltip="Kanban Board" data-cuelume-hover="tick" data-cuelume-press data-cuelume-release>
                  <LayoutDashboard />
                  <span>Kanban Board</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "workspaces"} onClick={() => onSelectPage("workspaces")} tooltip="Workspaces" data-cuelume-hover="tick" data-cuelume-press data-cuelume-release>
                  <FolderGit2 />
                  <span>Workspaces</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "profiles"} onClick={() => onSelectPage("profiles")} tooltip="Agent Profiles" data-cuelume-hover="tick" data-cuelume-press data-cuelume-release>
                  <Bot />
                  <span>Agent Profiles</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "providers"} onClick={() => onSelectPage("providers")} tooltip="Providers" data-cuelume-hover="tick" data-cuelume-press data-cuelume-release>
                  <Server />
                  <span>Providers</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "logs"} onClick={() => onSelectPage("logs")} tooltip="Hermes Logs" data-cuelume-hover="tick" data-cuelume-press data-cuelume-release>
                  <ScrollText />
                  <span>Logs</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "skills"} onClick={() => onSelectPage("skills")} tooltip="Skills" data-cuelume-hover="tick" data-cuelume-press data-cuelume-release>
                  <Puzzle />
                  <span>Skills</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "memory"} onClick={() => onSelectPage("memory")} tooltip="Memory" data-cuelume-hover="tick" data-cuelume-press data-cuelume-release>
                  <Brain />
                  <span>Memory</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
