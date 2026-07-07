# Display-type defaults (promotable config slots)

The third config axis, alongside per-track [`trackConfigDeltas`](../packages/product-core/src/Session/CLAUDE.md)
and app-scope `preferences`: a **session-wide default for one config slot, keyed
by display type**. "Make all my alignments tracks compact", "show soft-clipping
on every alignments track by default" — set it once, every track of that type
that hasn't pinned its own value follows.

The whole thing is a **small CSS cascade for a single config slot**. If you only
read one section, read [The cascade](#the-cascade).

## Where it lives

| Concern | File |
| --- | --- |
| Resolver + exported API | `packages/core/src/configuration/promotableDefaults.ts` |
| `promotable` / `promotedBase` slot metadata | `packages/core/src/configuration/configurationSlot.ts` |
| Session store (`get/setDisplayTypeDefault`) | `packages/product-core/src/Session/BaseSession.ts` |
| Session/display type surface | `packages/core/src/util/types/index.ts` |
| Badge hooks mixin | `plugins/linear-genome-view/src/BaseLinearDisplay/models/PromotableDefaultsMixin.tsx` |
| Track-selector badge | `plugins/data-management/.../tree/OverrideBadge.tsx` |
| Menu-row `endAdornment` primitive | `packages/core/src/ui/{MenuTypes.ts,CascadingMenu.tsx}` |
| Compound checkbox row (flat booleans) | `plugins/alignments/src/LinearAlignmentsDisplay/menus/{promotableToggleItem,DefaultForAllAdornment}.tsx` |
| Adopter: `displayMode` (sentinel) | `plugins/canvas/src/LinearBasicDisplay/{baseConfigSchema,baseModel,model}.ts` |
| Adopter: `heightMode` / `linkedReads` / `readConnections` / `sashimiArcsMode` (sentinel) | `plugins/alignments/src/LinearAlignmentsDisplay/{configSchema,model}.ts` |
| Adopter: `showSoftClipping` / `featureHeight` / `featureSpacing` / `colorBy` / `readConnectionsDown` / `showSashimiLabels` (plain) | `plugins/alignments/src/LinearAlignmentsDisplay/{configSchema,model}.ts` |

Tests: `displayMode.test.ts`, `showSoftClipping.test.ts` (both under their
adopter), `OverrideBadge.test.tsx`, `sessionModelFactory.test.ts` (store
round-trip).

## The cascade

A config slot marks itself `promotable: true`. Reading it through
`getConfResolved(self, slot)` walks three tiers:

```
pinned track value (differs from the slot default)     ← highest priority
  └ session-wide promoted default for this display type
     └ the slot's base value                            ← lowest (CSS `initial`)
```

Two things make this cheap:

- **No stored "is-pinned" flag.** `types.stripDefault` already collapses an
  at-default slot out of the snapshot, so "the slot is at its default" *is* the
  "un-pinned / inherit" signal. Pinned = holds any other value.
- **The promoted value lives in the session, not the track.** So promoting a
  default doesn't rewrite every track's config — un-pinned tracks just resolve
  differently on their next read.

**Objects compare structurally.** `pinned` uses `deepEqual(own, defaultValue)`,
which is identity for primitives and an order-independent recursive compare for
objects/arrays — a naive `!==` would read every object slot as *permanently
pinned* (a fresh MST-reconstructed value is never `===` its stored default), so
the session default would never apply. `colorBy` (a `frozen` `{ type: ... }`
slot) is promotable on the strength of this path; a new object/array slot needs
nothing extra.

### Plain vs. sentinel slots

The only real design choice per slot: **is the default value itself pinnable?**

- **Plain** (`showSoftClipping`, `featureHeight`, `featureSpacing`) —
  `defaultValue` doubles as the base *and* the inherit signal. Consequence: you
  can't pin that one value over an opposite session default. With a `true`
  soft-clipping session default, a track can't hold `false` (writing `false`
  reads as "inherit" → resolves back to `true`). **One-directional pin.**

- **Sentinel** (`displayMode`, `heightMode`, `linkedReads`, `readConnections`) —
  `defaultValue` is a dedicated `'inherit'` enum member (the CSS `inherit`
  keyword), and a separate `promotedBase` field holds the value it resolves to
  (the CSS `initial`, e.g. `'normal'` for displayMode, `'off'` for linkedReads).
  Now **every real value — `promotedBase` included — is pinnable**, so a track
  *can* hold `displayMode: 'normal'` over a `compact` session default, or
  `linkedReads: 'off'` over a `normal` (view-as-pairs) session default.

Reach for a sentinel when the value users promote is the **non-default** and
they'll plausibly want to opt an individual track back out — the whole point of
`linkedReads`/`readConnections` is to promote pairs/arcs (non-default) as a
session default while still letting one track pin `off`. The plain limitation is
only acceptable when the reverse pin doesn't happen in practice (nobody pins a
number to *exactly* its default; a `showSoftClipping` track rarely needs to force
`false` under an on default). Still don't add sentinels reflexively — a *boolean*
that needed one would go tri-state (true/false/inherit) and need an inherit
control in the UI; prefer a stringEnum with an explicit `'inherit'` member (the
sentinel getter never surfaces it — `getConfResolved` returns `promotedBase`).

## The resolver

Everything routes through one internal function; the exported API is thin
readers of it. Don't re-derive tiers in a consumer — add a field to
`SlotResolution` if you need something new.

```ts
interface SlotResolution {
  base: unknown      // value an un-pinned track shows with nothing promoted
  pinned: boolean    // track holds its own value rather than inheriting
  promoted: unknown  // raw session-wide promoted default, if any
  inherited: unknown // what an un-pinned track resolves to: promoted if usable, else base
  value: unknown     // final cascaded value (never a slot's inherit sentinel)
}

function resolveSlot(self, slot): SlotResolution {
  const def = getSlotDefinition(self.configuration, slot)
  const base = def.promotedBase ?? def.defaultValue
  const own = getConf(self, slot)
  const promoted = getSession(self).getDisplayTypeDefault?.(self.type, slot)
  // an own value differing from the default but failing the slot's `validate`
  // hook reads as un-pinned, so it degrades to inherited/base like a rejected
  // promoted default rather than reaching a consumer that trusts every value
  const pinned =
    !deepEqual(own, def.defaultValue) && (!def.validate || def.validate(own))
  const inherited = promotedUsable(def, promoted) ? promoted : base
  const value = pinned ? own : inherited
  return { base, pinned, promoted, inherited, value }
}
```

`promotedUsable` rejects a stale/garbage promoted value (wrong JS type, a
`stringEnum` value that isn't a current choice, or a sentinel slot's own
`'inherit'` member) so the getter, the "make default" checkbox, and the badge all
fall back in lockstep — no consumer guards on its own. A slot's optional
`validate` hook adds a semantic check on top of the JS-shape check, and applies
to **both** entry points: a promoted default (inside `promotedUsable`) and a
track's own pinned value (the `pinned` clause above). `colorBy` uses it so a
`.type` naming a since-removed color scheme — pinned or promoted — degrades to
the base instead of reaching the total `COLOR_SCHEMES` lookups that throw on an
unregistered type.

`getConfResolved` **always returns a real value**, never a slot's inherit
sentinel, so the display getter needs no post-guard:
`get displayMode() { return getConfResolved<DisplayMode>(self, 'displayMode') }`.

### Exported API (`@jbrowse/core/configuration`)

| Function | Reads | Drives |
| --- | --- | --- |
| `getConfResolved(self, slot)` | `.value` | the display's own value getter |
| `isSlotPinned(self, slot)` | `.pinned` | "Follow default" reset item visibility |
| `getSlotInheritedValue(self, slot)` | `.inherited` | labels the "Default (X)" entry with what un-pinning would resolve to |
| `areSlotsAtSessionDefault(self, slots)` | `promoted !== undefined && value === promoted` for every slot | "make default" checkbox tick (value-dependent: "promote whatever is current") |
| `setSlotsSessionDefault(self, slots, promote)` | promotes each slot's `.value`, or clears | "make default" checkbox click |
| `isSlotValueSessionDefault(self, slot, value)` | `promoted === value` | per-value pin tick (independent of the track's own value) |
| `setSlotValueSessionDefault(self, slot, value, on)` | promotes `value` specifically, or clears | per-value pin click — pairs with `isSlotValueSessionDefault` |
| `displaySessionDefaultChanges(self)` | `!pinned && value !== base` | track-selector badge diff |
| `clearDisplaySessionDefaults(self)` | — | badge "clear default" |

`areSlotsAtSessionDefault`/`setSlotsSessionDefault` are the **value-dependent**
pair used by a submenu's "make default" checkbox (promote whatever this track is
currently showing). `isSlotValueSessionDefault`/`setSlotValueSessionDefault` are
the **per-value** pair behind `makeSessionDefaultControl` (see "UI surface"
below) — always-visible pins on a specific on-value, independent of what the
track currently shows.

`areSlotsAtSessionDefault` / `toggleSlotsSessionDefault` take a **slot group** so
several slots move behind one menu item (alignments' `featureHeight` +
`featureSpacing` = one "compactness" default).

Note `resolveSlot` reads the session even for a pinned track — required so the
"pinned value equals the promoted default → checkbox checked" case works. This is
cheap: the display's value getter is a cached MobX computed that re-resolves to
the same `===` value, so nothing downstream re-runs.

## Storage

`BaseSession.get/setDisplayTypeDefault(displayType, slot, value)` on
`preferencesOverrides.displayTypeDefaults` (nested `type → slot → value`).
Persists for free via the preferences mixin → localStorage; embedded products
without that mixin resolve admin-only. Both are **optional** methods on
`AbstractSessionModel` (`getDisplayTypeDefault?`) so a session that lacks them
degrades to "no promoted defaults", never throws.

## UI surface

- **Track menu** (per adopter): the value control plus a "make this the default
  for all tracks like this" affordance. Two shapes, by setting complexity:
  - **Flat boolean settings** (`linkedReads`, `readConnections`, `showSoftClipping`,
    `readConnectionsDown`, `showSashimiLabels`) use a **compound checkbox row**: an
    ordinary `type:'checkbox'` menu item (native hover/sizing/keyboard) carrying a
    trailing **`endAdornment`** — a pin (`DefaultForAllAdornment`, a MUI
    `ToggleButton`) that promotes the setting's *on-value* as the default. One row
    expresses both axes. `endAdornment` is a general `BaseMenuItem` field;
    `CascadingMenu` renders it in a fixed-width slot to the right of the check
    decoration (reserved on every row when any row has one, so checkboxes stay
    column-aligned and pins float in their own column). The pin is **always
    shown** (discoverable) and uses **per-value** semantics —
    `isSlotValueSessionDefault` / `setSlotValueSessionDefault`, bundled by
    `makeSessionDefaultControl(self, slot, onValue)` into a `SessionDefaultControl`
    (`{ active, toggle }`) that the model exposes and `promotableToggleItem`
    consumes. Per-value (not "promote current") is what lets an always-visible pin
    never promote a meaningless off-value and keeps two toggles sharing one slot
    (arcs `'arc'` vs read cloud `'samplot'`; sashimi `'down'` vs `'auto'`)
    independent. Its content must `stopPropagation`.
  - **Multi-value radio groups sharing one slot** (`sashimiArcsMode`'s
    `'down'`/`'auto'` options) use the same `SessionDefaultControl` plumbing via
    `promotableRadioItem` (`menus/promotableToggleItem.tsx`) — a `type:'radio'`
    row with the same pin `endAdornment`, omitted on the base/un-pinned option
    (`'up'`) since pinning the base is meaningless with per-value semantics.
  - **Submenu settings** (`colorBy`, feature height, `displayMode`) put the
    "make default" checkbox at the **bottom of their own submenu** (e.g.
    `colorBy.ts` `sessionDefaultSection`) — same principle, room to spell it out.
    These still use the value-dependent `areSlotsAtSessionDefault` /
    `setSlotsSessionDefault` ("promote whatever is current"), which suits a
    multi-value picker.
  Selecting a sentinel slot's base value **pins** it. An explicit **"Follow
  default" reset item** (writes `'inherit'`) is *optional*; `displayMode` folds it
  into a top "Default (X)" radio, the others omit it (picking a value pins,
  untouched inherits). Don't add one reflexively.
- **Disabled-not-hidden for dependent options:** options that only apply once a
  parent toggle is on (the arc/read-cloud band submenu, arc coloring) stay
  present but `disabled` with a `disabledHelpText`, rather than vanishing — so
  they're discoverable. `CascadingMenu` already greys a disabled submenu and
  blocks it from opening.
- **Badge** (`OverrideBadge.tsx`, track selector): a distinct `SettingsSuggestIcon`
  (vs. the per-track-edit pencil) shows when `sessionDefaultChanges()` is
  non-empty; click opens `TrackSettingsChangesDialog` with a "clear default"
  action. Both hooks (`sessionDefaultChanges()` view + `clearSessionDefaults()`
  action) come from **`PromotableDefaultsMixin`** — compose it and any display
  gets the badge contract for free (no per-display passthroughs).

## Adding a promotable slot

1. In the display's config schema, add `promotable: true` to the slot. For a
   value users will want to pin *at its default* (rare — think hard), instead make
   the default a dedicated inherit sentinel and add `promotedBase: <realDefault>`.
2. Read it on the display via `getConfResolved(self, slot)` (never raw `getConf`
   for a promotable slot — raw won't apply the session default, and for a
   sentinel slot could hand a consumer `'inherit'`).
3. If the display isn't already an adopter, `.compose(PromotableDefaultsMixin())`
   so the badge hooks exist.
4. Track menu: "make default" via `toggleSlotsSessionDefault(self, [slot])` and
   `areSlotsAtSessionDefault(self, [slot])`; group slots that move together.
5. **Worker boundary:** promotable slots resolve on the **main thread**. If the
   worker needs the value, pass the *resolved* value through `rpcProps()` (read
   the display's resolved getter), and exclude the raw slot from any
   `getConfSnapshot` spread you send. `displayMode` is excluded from the canvas
   worker payload entirely (compact scaling is main-thread).

## Historical note

An earlier design layered admin/user type-default configs via extra
`mergeTrackConfig` passes in the `SessionTracks.ts` `tracks` getter, with a
4-part memo key to keep the hydration cache warm (also the stale block in
`OTHER_IDEAS.md`). **Superseded**: a `promotable` slot resolves on read — no
tracks-getter merge, no admin config slot, no cache-key surgery. Kept the "user
choice wins / display-type granularity" decisions; dropped the machinery.
