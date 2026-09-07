# Kanban Board Feature Card Design

## Purpose

Make Agent Profiles, Providers, and Skills feel like one technical control panel without forcing three different data types into one generic card template.

Core rule:

> Same design system, different information hierarchy.

Scope: `web/src/features/profiles/ProfilesPage.tsx`, `web/src/features/providers/ProvidersPage.tsx`, `web/src/features/skills/SkillsPage.tsx`.

Do not change API contracts, routing, query semantics, mutations, data models, or backend behavior.

## Product context

Kanban Board is a dark-first developer and AI-agent control panel. Users scan technical identifiers, runtime/configuration state, endpoints, model rosters, and a large skill registry. UI must prioritize fast scanning over decoration.

Physical scene: a developer checks agent configuration on a dim 27-inch monitor, then verifies long model names and URLs on a narrow laptop viewport. Contrast, truncation, focus states, and density matter more than visual effects.

## Shared visual language

- Existing dark palette stays: page `#0b0e14`, surface `#11151f`, raised surface `#161b27`, border `#1e2430`, accent `#10e0dd`.
- Existing Tailwind/shadcn primitives remain source of truth.
- Subtle 1px borders, compact radii, restrained contrast.
- Hover changes border/surface only, 150–200ms ease-out.
- No gradients, glow, oversized icons, heavy shadows, nested card stacks, or decorative glass.
- Card content uses `min-w-0` wherever sibling content can shrink.
- Essential actions remain visible, never hover-only.
- Focus indicators remain visible through existing shadcn focus utilities.

Shared card baseline:

```text
surface: existing card surface
border: 1px solid existing border token
radius: rounded-xl
padding: 16px desktop, 14px compact
hover: border accent at low opacity, slight surface lift
```

## Information hierarchy

### Agent Profiles, identity card

Priority:

```text
profile name + runtime state
model · provider
skill count + configuration state
primary edit action, secondary delete action
```

Composition:

- Identity row: Bot icon, profile name, ACTIVE state.
- Runtime state is stronger than configuration state.
- VALID/BROKEN CONFIG stays quieter and semantic.
- Model/provider is one compact technical line, with monospace values.
- Skill count is a metric, not an orphan paragraph: count plus `skills` label.
- Active profile gets a restrained accent border.
- Edit is outlined and visible. Delete is icon-only, destructive, disabled for active profile, and must not compete with Edit.
- Long profile names truncate safely. Status stays in its own non-shrinking area so it cannot collide with the name.

Target reading order:

```text
[bot] default                         ACTIVE
      codex · custom
      261 skills                       VALID
[ Edit ]                              [trash]
```

### Providers, infrastructure card

Priority:

```text
provider name + key state
endpoint URL
model count + default model
expanded model roster when selected
```

Composition:

- Server icon and provider name lead.
- Key state reads as connection/security health. Show `key set` or explicit `key missing`, not empty space.
- Endpoint always uses monospace, muted text, single-line truncation, and a title tooltip for the full URL.
- Model count is a compact metric. Default model is secondary but readable.
- Clicking card toggles expanded roster. Expanded roster stays inside card with divider and bounded scroll.
- Selected card uses accent border only. No large shadow or scale.
- Provider names and URLs must not force horizontal overflow.

Target reading order:

```text
[server] 9router.adityahimaone.space       KEY SET
         https://9router.adityahimaone.space/v1
         435 models       default: codex
```

### Skills, registry entry

Priority:

```text
skill name + category
short description
```

Composition:

- Compact card, denser than Profiles and Providers.
- Puzzle icon is supporting orientation, not a large tile.
- Skill name gets strongest type treatment and safe truncation.
- Category badge stays subtle and shrink-resistant.
- Description uses two-line clamp with stable line-height.
- Registry grid uses 3 columns on large screens, 2 on medium, 1 on narrow screens.
- Selected skill uses accent border. Detail panel remains separate from list.
- Empty search state names the query and offers no fake action.

Target reading order:

```text
[puzzle]  9router-maintenance             devops
           Use when 9router version is stale
           or Headroom setup fails.
```

## Responsive rules

- Profiles: 1 column base, 2 columns from `md`.
- Providers: 1 column base, 2 columns from `md`.
- Skills: 1 column base, 2 columns from `sm`, 3 columns from `lg` when no detail panel is open.
- Search inputs: compact 40–44px touch-friendly height, full width on narrow screens where needed.
- Every flex row containing technical text uses `min-w-0`.
- No fixed card width. No horizontal page overflow.
- Actions remain reachable at narrow widths, even when identifiers truncate.

## States

Loading states must preserve final card geometry. Error states must name feature and error. Empty states must explain next action where one exists. Status colors stay semantic and muted:

- success: green accent
- warning: amber accent
- error: red accent
- neutral: muted gray

Never tint entire card green or red.

## Accessibility

- Preserve keyboard focus rings on buttons, inputs, selects, and clickable cards.
- Clickable cards need keyboard-equivalent interaction if they are exposed as interactive controls. If card remains a `div`, keep action controls independently keyboard accessible and avoid pretending the whole card is a button.
- Icon-only actions require `aria-label` and title.
- Tooltips/title attributes reveal truncated URLs and identifiers.
- Maintain readable contrast against dark surfaces.

## Implementation constraints

- Reuse existing `Card`, `Badge`, `Button`, `Input`, `Separator`, and lucide icons.
- No dependency additions.
- Keep server-state and mutation logic unchanged.
- Prefer static Tailwind classes. Do not construct dynamic Tailwind color classes.
- Do not introduce a broad shared abstraction for three small feature-specific compositions.
- Keep feature boundaries intact.

## Acceptance checklist

- [ ] Profiles read as identity cards, not generic CRUD cards.
- [ ] Provider cards read as infrastructure/endpoint cards.
- [ ] Skill cards read as compact registry entries.
- [ ] All cards remain one coherent dark application.
- [ ] Name, status, URL, category, and model strings cannot collide or create horizontal overflow.
- [ ] Skills are visibly denser than Profiles/Providers.
- [ ] Active, valid, broken, and key states remain obvious but restrained.
- [ ] Delete remains secondary to Edit.
- [ ] Existing search, selection, expansion, edit, delete, and profile-link flows remain unchanged.
- [ ] `pnpm build` passes from `web/`.


---

# Agent Flow Service Map Redesign

## Objective

Redesign the existing Agent Flow page into the dark, dense Service Map style shown in the reference video: compact application shell, dotted-grid infinite canvas, small rectangular service cards, orthogonal connectors, moving status signals, lower-left map controls, and a lower-right minimap.

This is strictly a presentation-layer redesign. Dispatcher, review gate, task lifecycle, API payloads, and current endpoint behaviour must not change.

Reference: https://x.com/makisuo/status/2095625481651454381?s=20

The target should match the reference's information architecture, density, interaction model, and visual rhythm; it must not copy Maple branding, names, icons, or assets.

## Reference anatomy mapped to this product

| Reference area | Target implementation |
| --- | --- |
| Fixed dark sidebar | Preserve AppSidebar and Agent Flow navigation |
| Slim page toolbar | Agent Flow title, short subtitle, filters, connection and refresh state |
| Large dark dotted canvas | Full remaining viewport, #10110f surface and 16px low-contrast grid |
| Service graph with compact cards | Existing infrastructure nodes rendered as small cards |
| Right-angle dependency lines | Retain elbow SVG routing only; no diagonal paths |
| Bright moving status signals | Reuse TravelingDot for active routes |
| Zoom controls lower-left | Move existing controls from upper-right |
| Minimap lower-right | New minimap with viewport rectangle and click-to-recenter |

## Existing data and execution contract: do not change

Only use the existing live data source:

    GET /api/flow/active

    {
      task_id: string
      title: string
      board: string
      node_id: string
      stage: "dispatched" | "running" | "done" | "failed"
      updated_at: string
    }

Keep internal/kanban/flow.go as the source of truth. The current done/failed TTL stays unchanged. UI-only state such as selected task, filter, zoom, pan, and collapsed groups belongs in React only.

## Topology

| Existing ID | Map group | Visible card |
| --- | --- | --- |
| kanban | Task Intake | Kanban Queue |
| orchestrator | Control Plane | Hermes Orchestrator |
| memory | Context | Memory and Prequest |
| node-agent-server | Dispatch | Node Agent Gateway |
| tailscale | Network | Tailscale Tunnel |
| mac | Execution | Mac Worker |
| windows | Execution | Windows Worker |

Semantic edges remain the same:

    Kanban Queue -> Hermes Orchestrator -> Node Agent Gateway -> Tailscale Tunnel -> Mac Worker
    Memory ------> Hermes Orchestrator                                      -> Windows Worker

The visual map may expose derived labels such as SSH Dispatcher, Review Gate, Git Diff, and Commit and Push only when clearly presented as an existing-behaviour view. It must not invent a new backend path.

## Layout specification

### Canvas

- Remove the current outer Flow page padding so the canvas fills the page below the global header.
- Use a radial dot grid: rgba(255,255,255,.075), 1px dot, 16px grid.
- Start fitted and centred with 48px safe padding and maximum initial scale 1.
- Use horizontal layers: 260px between layers and 84-96px between rows.
- Use left/right-centre card anchors and elbow connectors only.
- Empty surface drag pans. Ctrl/Cmd + wheel zooms at cursor. Clamp scale to 0.35-2.0.
- Node drag can remain as a local convenience, but edges must recompute from the live card anchors.

### Node card

| Property | Specification |
| --- | --- |
| Size | 176-196px x 48-54px |
| Radius | 4-6px, intentionally sharper than current rounded-2xl cards |
| Fill | #171816 |
| Idle border | rgba(255,255,255,.11) |
| Title | 11px medium/semibold, #e8e8e3 |
| Metadata | 9-10px mono, #90928b |
| Icon | 14px aligned left, tinted by service type/status |
| State | 5px left accent strip plus optional 6px activity dot |
| Hover | Brighter border and 2px dark lift only |
| Selection | 1px status-colour ring and inspector opens |

Use real existing values: static infrastructure subtitle, active task count, stage, task ID/title, or latest update. Truncate to one line; show details in inspector.

### Tokens

    --flow-canvas: #10110f;
    --flow-panel: #171816;
    --flow-panel-hover: #1c1e1b;
    --flow-grid: rgba(255, 255, 255, .07);
    --flow-edge-idle: #3a3d36;
    --flow-text: #e8e8e3;
    --flow-muted: #8b8e86;
    --flow-dispatched: #f2c94c;
    --flow-running: #8fd14f;
    --flow-done: #57d18d;
    --flow-failed: #ef6b73;
    --flow-context: #8f83ff;
    --flow-network: #64b7ff;

Keep product cyan for global navigation and primary actions only; the map should not make every card cyan.

## Component mapping

| Existing file | Redesign responsibility |
| --- | --- |
| web/src/features/flow/FlowPage.tsx | Map-specific header, canvas/inspector layout, filter state |
| web/src/features/flow/FlowGraph.tsx | Refactor as ServiceMapCanvas: pan/zoom, grid, layers, edge SVG, minimap |
| web/src/features/flow/FlowNodeCard.tsx | Compact service-card visual and click target |
| web/src/features/flow/layout.ts | Visual coordinates and group metadata only; preserve node IDs/edge semantics |
| web/src/features/flow/FlowLegendTable.tsx | Replace with a right-side FlowInspector |
| web/src/features/flow/TravelingDot.tsx | Keep; reduce to 4-5px signal plus 12-16px halo |
| web/src/features/flow/ShimmerEdge.tsx | Keep idle shimmer but reduce intensity |
| web/src/features/flow/useFlowTasks.ts | Keep endpoint and polling; add client-only filtering helpers |

Recommended split:

    features/flow/
      ServiceMapHeader.tsx
      ServiceMapCanvas.tsx
      ServiceNode.tsx
      ServiceEdge.tsx
      ServiceGroup.tsx
      MapControls.tsx
      ServiceMapMinimap.tsx
      FlowInspector.tsx
      map-layout.ts
      map-tokens.css

Refactoring FlowGraph.tsx in place is also valid. Do not add a second flow source.

## Interaction requirements

1. Initial view fits every group without clipping.
2. Empty-canvas drag pans; Ctrl/Cmd+wheel zooms around cursor.
3. Lower-left controls are compact 32px dark square buttons: zoom in, zoom out, fit, reset; show the current percentage.
4. Lower-right minimap is 160 x 104px with miniature group-coloured cards, viewport rectangle, and click-to-recentre.
5. Clicking a service card pins a 280-320px right inspector with service metadata, route count, and active tasks. Closing it restores canvas width.
6. Clicking an inspector task focuses its route: unrelated edges use 15-20% opacity while the relevant route remains full opacity.
7. Stage motion:
   - dispatched: yellow signal from Kanban to dispatcher;
   - running: lime signal from dispatcher to selected worker;
   - done: brief green completion pulse then fade;
   - failed: red signal stops at the failure node.
8. Empty state preserves topology with muted connectors and a small No active task label; do not replace the canvas with an empty card.
9. All controls have accessible labels/tooltips, cards are keyboard-reachable buttons, and prefers-reduced-motion disables travel animation.

## Header and sidebar

Retain AppSidebar and its current destinations. When Agent Flow is selected, use a map-specific header:

- Left: Agent Flow title and “Live task routing and execution map”.
- Centre: search input plus All / Dispatched / Running / Done / Failed filter.
- Right: active-flow count, connection status, and last refresh.

Preserve every existing sidebar item, but use a compact map-oriented density on this route: 196-208px expanded sidebar, 36px rows, 12px group labels, and one clear active tint on Agent Flow.

On mobile, keep the sidebar off-canvas; show the selected inspector as a bottom sheet; hide minimap below 768px.

## Guardrails

- Do not change FlowTask, FlowTrack, dispatcher, review approval, workspace validation, or TTL behaviour.
- Do not add UI that edits topology or dispatch routes.
- Do not imitate Maple/Service Map branding or assets.
- Avoid full page rerenders for signals: memoize geometry and animate with transforms/SVG.
- Cap visible live signals (for example 24); summarize overflow in the inspector.

## Acceptance criteria

### Visual

- [ ] Dark full-screen dotted canvas with compact sidebar and toolbar.
- [ ] Small sharp service cards and only orthogonal connectors.
- [ ] Lower-left controls and lower-right minimap.
- [ ] Clear hierarchy: Task Intake -> Control Plane / Context -> Dispatch -> Network -> Execution.
- [ ] Active route is understandable without opening the inspector.

### Functional

- [ ] The map uses only the existing /api/flow/active endpoint.
- [ ] Stage values remain exactly dispatched, running, done, and failed.
- [ ] Mac/Windows running tasks highlight the correct existing route.
- [ ] Done/failed expiry follows the current server TTL.
- [ ] Board, review, approval, and other routes are unchanged.

### Verification

1. Run pnpm build in web/.
2. Seed or create one dispatched, one Mac running, one Windows running, one done, and one failed flow task.
3. Verify 1280x720 and 1440x900: fit view, readable labels, no clipped controls/minimap.
4. Verify keyboard focus, reduced-motion, and mobile.
5. Verify browser network traffic contains only the existing /api/flow/active polling request for live map data.
