# Display-type defaults (promotable config slots)

The third config axis, alongside per-track [`trackConfigDeltas`](CONFIG_DELTA_OVERRIDE_HANDOFF.md)
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
| Adopter: `displayMode` (sentinel) | `plugins/canvas/src/LinearBasicDisplay/{baseConfigSchema,baseModel,model}.ts` |
| Adopter: `showSoftClipping` / `featureHeight` / `featureSpacing` (plain) | `plugins/alignments/src/LinearAlignmentsDisplay/{configSchema,model}.ts` |

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

**Primitives only.** `pinned` is `own !== def.defaultValue` (strict compare) —
correct for string/number/boolean, but an object/array slot is always
reference-unequal to its default and reads as *permanently pinned* (session
default never applies). Give `resolveSlot` a value-equality path before marking a
collection slot `promotable`.

### Plain vs. sentinel slots

The only real design choice per slot: **is the default value itself pinnable?**

- **Plain** (`showSoftClipping`, `featureHeight`, `featureSpacing`) —
  `defaultValue` doubles as the base *and* the inherit signal. Consequence: you
  can't pin that one value over an opposite session default. With a `true`
  soft-clipping session default, a track can't hold `false` (writing `false`
  reads as "inherit" → resolves back to `true`). **One-directional pin.**

- **Sentinel** (`displayMode`) — `defaultValue` is a dedicated `'inherit'` enum
  member (the CSS `inherit` keyword), and a separate `promotedBase` field holds
  the value it resolves to (`'normal'`, the CSS `initial`). Now **every real
  value — `promotedBase` included — is pinnable**, so a track *can* hold
  `displayMode: 'normal'` over a `compact` session default.

The plain limitation is intentional: the reverse pin doesn't happen in practice
(nobody sets soft-clipping-on as a default, or pins a number to *exactly* its
default). Only `displayMode` earned a sentinel, because `normal` is a value users
genuinely pin. Don't add sentinels reflexively — a boolean that needed one would
go tri-state (true/false/inherit) and need an inherit control in the UI.

## The resolver

Everything routes through one internal function; the exported API is thin
readers of it. Don't re-derive tiers in a consumer — add a field to
`SlotResolution` if you need something new.

```ts
interface SlotResolution {
  base: unknown      // value an un-pinned track shows with nothing promoted
  pinned: boolean    // track holds its own value rather than inheriting
  promoted: unknown  // raw session-wide promoted default, if any
  value: unknown     // final cascaded value (never a slot's inherit sentinel)
}

function resolveSlot(self, slot): SlotResolution {
  const def = getSlotDefinition(self.configuration, slot)
  const base = def.promotedBase ?? def.defaultValue
  const own = getConf(self, slot)
  const promoted = getSession(self).getDisplayTypeDefault?.(self.type, slot)
  const pinned = own !== def.defaultValue
  const value = pinned ? own : promotedUsable(def, promoted) ? promoted : base
  return { base, pinned, promoted, value }
}
```

`promotedUsable` rejects a stale/garbage promoted value (wrong JS type, a
`stringEnum` value that isn't a current choice, or a sentinel slot's own
`'inherit'` member) so the getter, the "make default" checkbox, and the badge all
fall back in lockstep — no consumer guards on its own.

`getConfResolved` **always returns a real value**, never a slot's inherit
sentinel, so the display getter needs no post-guard:
`get displayMode() { return getConfResolved<DisplayMode>(self, 'displayMode') }`.

### Exported API (`@jbrowse/core/configuration`)

| Function | Reads | Drives |
| --- | --- | --- |
| `getConfResolved(self, slot)` | `.value` | the display's own value getter |
| `isSlotPinned(self, slot)` | `.pinned` | "Follow default" reset item visibility |
| `areSlotsAtSessionDefault(self, slots)` | `promoted !== undefined && value === promoted` | "make default" checkbox tick |
| `toggleSlotsSessionDefault(self, slots)` | promotes `.value` / clears | "make default" checkbox click |
| `displaySessionDefaultChanges(self)` | `!pinned && value !== base` | track-selector badge diff |
| `clearDisplaySessionDefaults(self)` | — | badge "clear default" |

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

- **Track menu** (per adopter): a radio/checkbox for the value, a "Use X by
  default for all tracks like this" checkbox (`areSlotsAtSessionDefault` state +
  `toggleSlotsSessionDefault`), and — only when `isSlotPinned` — a "Follow
  default" reset item that writes the slot back to its default/sentinel.
  Selecting the sentinel slot's base value now **pins** it; the reset item is the
  un-pin path.
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
