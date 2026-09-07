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
