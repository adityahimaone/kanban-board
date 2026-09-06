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
import { Separator } from "@/components/ui/separator"
import type { Board } from "@/api"
import { LayoutDashboard, Kanban, FolderGit2, Bot, Server, Layers, ScrollText, Puzzle, Brain } from "lucide-react"

export type Page = "board" | "workspaces" | "profiles" | "providers" | "logs" | "skills" | "memory"

export function AppSidebar({
  page,
  boards,
  slug,
  onSelectPage,
  onSelectBoard,
}: {
  page: Page
  boards: Board[]
  slug: string
  onSelectPage: (p: Page) => void
  onSelectBoard: (s: string) => void
}) {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Kanban" onClick={() => onSelectPage("board")}>
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
                <SidebarMenuButton isActive={page === "board"} onClick={() => onSelectPage("board")} tooltip="Kanban Board">
                  <LayoutDashboard />
                  <span>Kanban Board</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "workspaces"} onClick={() => onSelectPage("workspaces")} tooltip="Workspaces">
                  <FolderGit2 />
                  <span>Workspaces</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "profiles"} onClick={() => onSelectPage("profiles")} tooltip="Agent Profiles">
                  <Bot />
                  <span>Agent Profiles</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "providers"} onClick={() => onSelectPage("providers")} tooltip="Providers">
                  <Server />
                  <span>Providers</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "logs"} onClick={() => onSelectPage("logs")} tooltip="Hermes Logs">
                  <ScrollText />
                  <span>Logs</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "skills"} onClick={() => onSelectPage("skills")} tooltip="Skills">
                  <Puzzle />
                  <span>Skills</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={page === "memory"} onClick={() => onSelectPage("memory")} tooltip="Memory">
                  <Brain />
                  <span>Memory</span>
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
              {boards.map((b) => (
                <SidebarMenuItem key={b.slug}>
                  <SidebarMenuButton
                    isActive={page === "board" && slug === b.slug}
                    onClick={() => onSelectBoard(b.slug)}
                    tooltip={b.name}
                  >
                    <Layers />
                    <span className="truncate">{b.icon ? `${b.icon} ` : ""}{b.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {!boards.length && (
                <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">No boards</p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
