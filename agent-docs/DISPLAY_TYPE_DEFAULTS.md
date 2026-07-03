# Display-type defaults plan

Goal: let an admin (config.json) and a user (UI) override the *default* config
applied to a whole class of displays — e.g. "all alignments displays are compact
by default" — without touching each track. Historically gestured at as
"configOverrides"; this is the type-keyed layer, distinct from the per-track
`trackConfigDeltas` and the app-scope `preferences` systems already in tree.

## Why this is small

It composes two mechanisms that already exist:

- **Admin-default + user-override layering** — the `preferences` system
  (`configuration.preferences.*` admin default + `preferencesOverrides` volatile
  persisted to localStorage + `getPreference` resolver). See
  `packages/product-core/src/Session/{Preferences.ts,BaseSession.ts}` and
  `RootModel/PreferencesConfig.ts`.
- **Layer a partial config over a base track** — `mergeTrackConfig`
  (`packages/core/src/util/trackConfigDelta.ts`), already used by the `tracks`
  getter in `SessionTracks.ts` to merge `trackConfigDeltas` over `jbrowse.tracks`.
  Merges `displays` by `displayId`, recurses nested configs.

Type-defaults are the missing middle axis: per-track deltas are keyed by
`trackId`; preferences are one global singleton; type-defaults are keyed by
**display type**.

## Decisions (locked with user 2026-07-02)

- **Granularity: display type** (`LinearPileupDisplay`, `LinearAlignmentsDisplay`,
  …). That is where `compact`/height/featureHeight actually live; track-type
  would just reach through to displays anyway.
- **Precedence: user choice wins.** A user's global type-default overrides an
  admin's *explicit per-track* setting. Within each actor, the more specific
  (per-track) layer beats the more general (per-type) one.

### Precedence stack (lowest → highest priority)

```
display schema default            baked into the display type (MST optional)
  └ admin type-default            configuration.displayTypeDefaults[type]   (config.json)
     └ admin explicit track       jbrowse.tracks entry (stripDefault: explicit slots only)
        └ user type-default       displayTypeDefaultOverrides[type]  (localStorage, UI)
           └ user per-track delta trackConfigDeltas[trackId]        (existing)
```

Note user-type sits ABOVE admin-explicit-track (per "user choice wins"), but
user-per-track-delta stays on top (a user's edit to one specific track beats
their own global default for that type).

## Implementation

### 1. Admin schema slot

`RootConfiguration.ts` (+ embedded `product-core/RootModel/createConfigModel.ts`,
same as preferences did) gains:

```ts
displayTypeDefaults: { type: 'frozen', defaultValue: {} }
```

Shape: `{ [displayType: string]: PartialDisplayConfig }`, e.g.
`{ LinearPileupDisplay: { renderer: { ... } }, LinearAlignmentsDisplay: { height: 100 } }`.
`frozen` (not a typed sub-schema) because the value space is the open union of
every plugin's display slots — same call the `theme` slot already makes.

### 2. User-override volatile + resolver (mirror preferences exactly)

In `BaseSession.ts`:
- volatile `displayTypeDefaultOverrides: {} as Record<string, PlainConfig>`
- resolver `getDisplayTypeDefault(type): PlainConfig` =
  `mergeConfig(getConf(self, ['displayTypeDefaults', type]) ?? {}, overrides[type] ?? {})`
  (user merged over admin, shallow-recursive like `mergeTrackConfig`).
- action `setDisplayTypeDefaultOverride(type, partial)`.

New `DisplayTypeDefaultsSessionMixin` (sibling of `PreferencesSessionMixin`,
web/desktop only) loads/persists `displayTypeDefaultOverrides` to localStorage
under its own key. Embedded omits it → resolves admin-only, matching preferences.

### 3. Injection in the `tracks` getter (`SessionTracks.ts`)

Today (per base track): `mergeTrackConfig(toPlainConfig(base), delta)`.

Build a type-default layer keyed to the base's OWN display ids (base displays
carry stable ids `${trackId}-${displayType}`, injected by
`baseTrackConfig.preProcessSnapshot`), so `mergeTrackConfig`'s merge-by-displayId
realigns it. Resolve each layer separately so the stack ordering is honored:

```
const adminTypeLayer = buildTypeLayer(base, t => getConf admin default for t)
const userTypeLayer  = buildTypeLayer(base, t => user override for t)
let cfg = toPlainConfig(base)
cfg = mergeTrackConfig(adminTypeLayer, cfg)   // base (admin explicit) wins over admin type-default
cfg = mergeTrackConfig(cfg, userTypeLayer)    // user type-default wins over admin explicit
cfg = mergeTrackConfig(cfg, delta)            // user per-track edit wins over all
```

`buildTypeLayer(base, resolve)` maps `base.displays` → `{ trackId,
displays: [{ type, displayId, ...resolve(display.type) }] }`, skipping displays
whose type has no default (so the layer is `{}`-cheap for the common case).

**Identity/cache discipline (load-bearing):** the current getter returns `base`
by identity when there's no delta, to keep the hydration cache warm
(`configuration/CLAUDE.md`). Extend the memo key from `(base, delta)` to
`(base, delta, adminTypeSnapshot, userTypeSnapshot)`; when all layers are empty
for a track, still return `base` unchanged by identity. The type-default maps are
frozen (admin) / structural-shared (user), so referential keying works. Guard
against unnecessary churn the same way the delta path does.

### 4. UI

- **Admin**: nothing new — `displayTypeDefaults` is a config slot, editable via
  the config editor / config.json.
- **User**: a display/track-menu action "Set current settings as default for all
  <TypeLabel> displays" → `diffTrackConfig`-style diff of this display against its
  schema default → `setDisplayTypeDefaultOverride(type, partial)`. Plus a "clear
  type defaults" affordance. A settings surface listing active type-defaults can
  come later; v1 is set/clear from the menu.

## Tests

- `trackConfigDelta` merge already covered; add cases for the 3-layer stack
  ordering in a new `displayTypeDefaults.test.ts` (admin type < admin explicit <
  user type < user delta).
- `SessionTracks` getter: base returned by identity when no layers apply; type
  layer fills a slot the base omits; user type overrides an admin-explicit slot;
  per-track delta still wins.
- Resolver: user override merges over admin default; embedded resolves admin-only.
- Persistence round-trip through localStorage (mirror preferences test).

## Open / defer

- Track-level (non-display) slot defaults: out of scope; add a parallel
  `trackTypeDefaults` later if a real need appears.
- Sharing user type-defaults in a saved session: preferences chose localStorage-
  only (personal, not shared). Match that for v1.
- Migration: nothing to migrate — this is additive; legacy sessions have neither
  the slot nor the override map, both default empty.
