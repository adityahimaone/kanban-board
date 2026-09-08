# Switchyard UI Redesign — Blue Glass System

## Direction
Use the attached reference as the visual target: a dark, layered workspace with blue identity, subtle glass surfaces, soft inner highlights, low-contrast borders, and small decorative texture. This supersedes the previous editorial/stamp direction.

Keep the current AppShell, AppHeader, sidebar destinations, routes, APIs, task workflow, Kanban, Agent Flow topology, review gate, and all existing components. This is a system/UI-surface redesign, not a feature deletion or shell rebuild.

## Phase 1 — System UI and colour

### Core tokens
| Role | Value |
|---|---|
| app canvas | #080B12 |
| shell/sidebar | rgba(10,14,23,.88) |
| glass panel | rgba(21,28,42,.62) |
| raised glass | rgba(31,42,61,.72) |
| border | rgba(184,211,255,.14) |
| border hover | rgba(116,181,255,.34) |
| primary blue | #58A9FF |
| blue glow | rgba(88,169,255,.28) |
| text | #F2F6FF |
| muted text | #94A0B5 |
| success | #42D392 |
| warning | #F6B44A |
| danger | #FF7185 |

Dark mode is the default. Add light mode using the same semantic tokens: cool off-white canvas, white translucent panels, ink text, and darker accessible blue. Persist system/light/dark in existing settings; avoid new hard-coded hex values after token migration.

### Glass rules
- App shell: only refine background, border and active nav treatment; do not alter layout.
- Surfaces use 10–14px backdrop blur, translucent fill, 1px cool border and restrained inner top highlight.
- Glass must remain readable: no panel below 60% effective opacity over imagery.
- Use one diffuse blue glow behind selected/important panels only; never every card.
- Preserve 8–10px radii, compact density, visible keyboard focus and reduced-motion support.

### Decorative layer
Add reusable, optional decorations:
- dot-grid/noise texture at 3–6% opacity;
- radial blue spotlight clipped inside a panel;
- thin corner shine or edge gradient;
- soft blue active halo for selected card/node;
- no decorative imagery inside data-dense tables, Kanban cards, or flow nodes.

Create GlassPanel, GlassToolbar, GlassIconButton, StatusPill, BlueGlow, and SurfaceTexture over current shadcn primitives.

## Phase 2 — Feature cards

### Overview and management pages
- Use GlassPanel as the shared base.
- Metric cards: icon tile, value, label, tiny status trend, optional blue spotlight.
- List/table headers use glass toolbars; rows remain mostly opaque/dark for scanning.
- Selected workspace/provider/profile gets raised glass, blue border and a small decorative glow.
- Empty states may use a larger blue gradient orb/grid; ordinary cards may not.

### Kanban — refinement only
Keep columns, cards, filters, dialogs and task semantics.
- Columns become dark translucent lanes with a slim blue/semantic status top line.
- Task cards have a glass edge highlight on hover, not permanent blur.
- Use blue for selection/action; keep review amber, running blue, done green, blocked red.
- Drag feedback: 120–160ms lift plus blue drop-zone ring; no heavy animation.

### Agent Flow — refinement only
Keep current topology, Session Monitor, controls and active route semantics.
- Canvas is near-black with muted blue dot grid.
- Nodes are compact glass devices with a crisp blue/semantic state rail.
- Idle edges stay quiet; active routes retain existing thin glow and travelling dots.
- Inspector and Session Monitor use raised glass with readable opaque data rows.
- Do not apply blur to SVG route lines or increase visual noise.

## Motion
Use opacity, transform and SVG stroke only: hover 140ms, panels 180ms, dialogs 180ms. Ambient glow may drift slowly (10–14s). No looping motion on ordinary cards. Respect prefers-reduced-motion.

## Implementation order
1. Migrate index.css to semantic blue-glass tokens and add theme preference.
2. Build shared glass primitives and replace shared component styling.
3. Refresh Overview, Workspaces, Profiles, Providers, Skills, Memory, Logs and Settings.
4. Apply conservative Kanban refinement.
5. Apply conservative Flow refinement.
6. Verify dark/light contrast, mobile, keyboard, reduced motion and pnpm build.

## Acceptance
- [ ] App shell layout and every existing feature/action remain.
- [ ] Blue is the identity/action colour; status colours retain meaning.
- [ ] Glass effects improve hierarchy without reducing text/table readability.
- [ ] Light and dark themes are token-driven and persistent.
- [ ] Kanban and Agent Flow remain familiar and functionally unchanged.
