# Switchyard — Product UI Redesign Direction

**Status:** design brief for future implementation  
**Scope:** major visual and component-system redesign. Preserve every route, feature, action, API contract, board state, review gate, and app-shell information architecture.

## 1. Creative direction — Editorial Control Room

Switchyard should feel like a precise operator console with a memorable product surface—not a generic developer dashboard.

The visual cue comes from the supplied stamp-edge animation: a clean editorial field, tiny dot grid, and one luminous soft-gradient object with tactile perforated edges. Use that language sparingly as a brand moment:

- a compact Signal Stamp for high-value summaries, selected states, and empty/onboarding moments;
- a quiet dot-grid or grain field in large page backgrounds;
- soft, contained colour bloom behind focused work—not across the whole interface;
- no literal copying of the reference's layout, typography, copy, or imagery.

The product remains grounded, compact, operational, and readable. It is not glassmorphism, neon cyberpunk, terminal parody, or an animation showcase.

## 2. Non-negotiable guardrails

### Preserve

- Current AppShell, AppHeader, sidebar destinations, route behavior, and responsive sidebar pattern.
- Existing feature surface: Overview, Task Board, Agent Flow, Workspaces, Profiles, Providers, Skills, Memory, Logs, Settings, task detail, review/approval and every current state/action.
- Existing data sources and endpoints, including /api/flow/active.
- Existing Kanban stages and task semantics; visual drag, filters, dialog and detail interactions remain available.
- Existing Switchyard logo usage; the white monogram remains the dark-mode mark.

### Do not do

- Do not delete, hide, or merge away components because they are visually inconvenient.
- Do not redesign the global dashboard/app shell's structure. Refine its visual tokens and shared components only.
- Do not major-redesign Kanban or Agent Flow topology. Make them calmer, clearer, and more premium while preserving their familiar operating model.
- Do not use the stamp-edge treatment on every card or status badge.
- Do not introduce a required animation dependency merely for decoration.

## 3. Visual foundation

### 3.1 Colour architecture

Replace the current almost-black + all-purpose cyan treatment with a balanced **ink, paper, and signal** system. Cyan remains an identity accent, but never becomes the only meaning-bearing colour.

| Token role | Dark mode | Light mode | Purpose |
| --- | --- | --- | --- |
| Canvas | #101112 | #F6F6F3 | app/page base |
| Surface | #181A1B | #FFFFFF | cards, panels, popovers |
| Surface raised | #202324 | #FCFCFA | hover, selected container |
| Ink | #F1F2ED | #171817 | primary text |
| Muted ink | #A3A69E | #6C7069 | descriptions, metadata |
| Hairline | rgba(241,242,237,.11) | rgba(23,24,23,.12) | borders/dividers |
| Brand cyan | #6BE6D9 | #087D73 | primary action, brand focus |
| Lavender | #A89CFF | #6659C9 | orchestration/context |
| Amber | #F1B65A | #B66B06 | attention/review |
| Green | #72D79A | #187B42 | healthy/success |
| Rose | #FF8D9A | #C43F52 | failed/destructive |

Use CSS semantic tokens, not hard-coded page colours. Status colours must meet contrast requirements in both themes and must never rely on colour alone.

### 3.2 Signal Stamp

A reusable decorative primitive, limited to three placements per viewport:

- soft radial gradient (brand cyan → lavender → transparent);
- a 10–14px scalloped/perforated edge only on one side or all sides for hero/summary use;
- low-contrast 1px noise/dot texture;
- content always placed on an opaque/legible layer above it.

Approved uses: Overview's highest-priority insight, selected workspace/profile identity panel, command palette backdrop, no-data guidance.  
Not for: regular cards, Kanban task cards, forms, tables, toasts, or flow nodes.

### 3.3 Typography, density, and shape

- UI font: current sans stack / Inter-style sans. Display font is optional only inside Signal Stamp headline areas; use no more than one short phrase per page.
- 12px metadata, 13–14px standard controls/body, 15–16px card titles, 20–24px page title, 28–32px only for overview hero.
- Base spacing scale: 4, 8, 12, 16, 24, 32.
- Default radius: 10px for cards, 8px for controls, 999px only for filters/status chips.
- Borders and layered surfaces do most of the work. Shadows: low elevation only.

## 4. Theme architecture — dark now, light-ready

Build both themes at token level from the first redesign PR, even if dark ships as default.

Requirements:

1. Persist preference in the existing settings store/local storage, with system, light, and dark options.
2. Apply the theme before React hydration to avoid a flash.
3. Do not use Tailwind arbitrary hex values for new UI; map them to semantic tokens.
4. Preserve status colour meaning across modes; only luminance/saturation changes.
5. Use the white Switchyard monogram on dark and a charcoal/ink version on light.
6. Add theme visual regression coverage for every route before removing old hard-coded colours.

## 5. Component system

Create a small Switchyard layer over the existing shadcn primitives. The goal is consistency, not a parallel component library.

| Component | Visual behavior | Existing usage |
| --- | --- | --- |
| PageFrame | title, contextual description, optional actions; roomy only at page top | all feature pages |
| SectionCard | quiet surface, hairline border, optional dense header | settings, profiles, providers, workspaces |
| MetricTile | value, label, trend/state; optional restrained Signal Stamp backdrop | overview only |
| StatusPill | icon/dot + text; semantic state, no arbitrary colours | tasks, nodes, logs, flow |
| EntityRow | 40–48px scan-friendly row with primary, metadata, trailing action | lists and settings |
| IconAction | 32px square, tooltip and focus ring | headers, tables, map controls |
| FilterBar | search first; grouped chips/selects; active-count and reset | Board, Logs, Skills |
| EmptyState | concise explanation + next action, optional single Signal Stamp | every data view |
| SignalStamp | branded decorative primitive as defined above | restricted use |
| CommandPalette | global navigation + actions, keyboard-first | future enhancement |

All interactive components need visible focus states, minimum 44px touch targets where practical, and disabled/loading states that preserve layout.

## 6. Page directions

### Overview — major visual refresh

Make Overview the clearest expression of the new direction.

- A compact top summary row: operating state, active sessions, review queue, connected workers.
- One selected “What needs attention” Signal Stamp; never turn every metric into a colourful hero card.
- Metrics use typography and thin segmented indicators instead of big filled tiles.
- Activity / recent execution becomes a timeline with real timestamps and status icons.
- Worker health is a compact availability strip, not a second dashboard inside the dashboard.

### Workspaces, Profiles, Providers, Skills, Memory, Logs, Settings — major refresh

Use a consistent **index → inspect** pattern:

- a calm page title and a single primary action;
- search and filters in one compact FilterBar;
- dense entity list/table at the center;
- row click opens the existing detail/side-panel experience;
- settings use grouped SectionCards with explanatory copy, values aligned right, and stable save feedback;
- logs stay monospace in data areas, but get clearer severity hierarchy and easier filtering;
- provider/profile/workspace identity may use one small Signal Stamp in the selected detail only.

### Task Board / Kanban — refinement only

Keep columns, task cards, filtering, task dialog, task detail and status actions.

- columns become tonal lanes with a 1px header rule and compact count badge instead of large rounded containers;
- task cards use title → workspace/agent → status/priority hierarchy; result excerpts only when meaningful;
- replace broad cyan borders with semantic status rails/dots;
- create a clear drop target and subtle 120ms lift on drag, but no dramatic physics;
- keep the filter rail, now styled by the shared FilterBar;
- review cards receive a clear “Needs approval” visual without implying auto-commit.

### Agent Flow / Flow Map — refinement only

Keep existing topology, route resolver, Session Monitor intent, API, controls and inspector model.

- retain the dot grid, adapted to each theme (ink dots on paper in light, muted dots in dark);
- keep physical edge colours and full parent → child active-route semantics;
- use semantic tokens for nodes, edge glow, inspector, and Session Monitor;
- compact node cards should feel like devices: crisp 6–8px radius, small service icon, strong current-state rail;
- active routes use the existing thin glow + deterministic session dots; line thickness changes subtly, never blur the whole map;
- maps remain calm at idle. Motion appears only for actual state change or live route travel.

## 7. Motion language

Take inspiration from the supplied animation's soft, deliberate presence and the Amicro reference's micro-transition mindset—not either visual identity.

| Interaction | Motion | Duration |
| --- | --- | --- |
| page content enter | opacity + 6px rise, once | 180ms |
| card hover | border/tone + 1px lift | 140ms |
| selected row/panel | soft tint crossfade | 160ms |
| dialog/sheet | opacity + scale .98 → 1 | 180ms |
| status change | colour/indicator transition | 160ms |
| Signal Stamp ambient bloom | very slow opacity drift, no transform | 8–12s |
| live flow route | retain existing data-driven signal travel | state-based |

Rules:

- Prefer CSS transition/keyframes; use existing dependencies before adding new ones.
- Animate opacity, transform, and SVG stroke properties only.
- No infinite animation on ordinary cards, buttons, tables, or sidebar items.
- Respect prefers-reduced-motion: remove travel/drift; leave static state cues.
- Keep route dots capped and memoized as already planned for Flow.

## 8. Implementation sequence

1. **Token foundation:** replace hard-coded colours in web/src/index.css with semantic dark/light tokens, type/spacing/shadow tokens, theme bootstrap and toggle.
2. **Shared primitives:** implement PageFrame, SectionCard, StatusPill, EntityRow, FilterBar, EmptyState, IconAction.
3. **Major page pass:** Overview, then entity/settings/log pages; preserve existing feature components and APIs.
4. **Board refinement:** update visual hierarchy and drag/drop feedback only.
5. **Flow refinement:** map tokens, cards, inspector, monitor and active signals only; preserve topology/data behaviour.
6. **Polish and QA:** motion audit, responsive QA, keyboard, reduced-motion, dark/light screenshots, and performance checks.

## 9. File-level guidance

| Area | Responsibility |
| --- | --- |
| web/src/index.css | semantic theme tokens, shared motion and reduced-motion rules |
| web/src/components/ | Switchyard shared primitives layered on current shadcn components |
| web/src/components/app-shell.tsx and app-header.tsx | token-only refinement; preserve layout and destinations |
| web/src/features/overview/ | major Overview composition |
| web/src/features/workspaces, profiles, providers, skills, memory, logs, settings | apply index → inspect system |
| web/src/features/board/ | Kanban refinement only; keep task workflow and components |
| web/src/features/flow/ | Flow refinement only; keep existing topology and state resolver |
| web/src/hooks/useSettings.ts | persisted theme preference alongside existing UI settings |

## 10. Acceptance checklist

- [ ] Every current route and action remains present and functional.
- [ ] App shell destinations and layout are retained.
- [ ] Dark and light modes render from semantic tokens, persist correctly, and respect system mode.
- [ ] Overview and management pages look materially fresh, not merely recoloured.
- [ ] Kanban and Agent Flow are visibly improved but familiar in hierarchy and behavior.
- [ ] Signal Stamp appears intentionally and sparingly, never as repeated decoration.
- [ ] Motion is lightweight, data-aware, and fully reduced-motion safe.
- [ ] 1280×720, 1440×900, tablet and mobile remain usable.
- [ ] Keyboard focus, status labels, contrast, and screen-reader names are verified.
- [ ] pnpm build passes; no API endpoint or task/review semantics change.

## 11. Design decisions to retain

- Switchyard is a control plane, so **clarity wins over decoration**.
- The dark UI must keep the white monogram legible; light mode is a first-class future mode, not an inverted afterthought.
- The brand language should be recognisable in a single glance through the restrained Signal Stamp, dot texture, and calm signal motion.
- The board and route map are operational instruments. Their visual evolution must protect muscle memory.
