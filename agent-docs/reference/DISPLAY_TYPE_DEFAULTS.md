---
name: display-type-defaults
description: Session-wide per-display-type slot defaults via promotable slots and CSS-cascade resolution. Read when adding a make-default-for-all-tracks setting, touching getConfResolved, or serializing a session for sharing/export/worker.
---

# Display-type defaults (promotable config slots)

The third config axis, alongside per-track [`trackConfigDeltas`](../../packages/product-core/src/Session/CLAUDE.md)
and app-scope `preferences`: a **session-wide default for one config slot, keyed
by display type**. "Make all my alignments tracks compact", "show soft-clipping
on every alignments track by default" — set it once, every track of that type
that hasn't customized its own value follows.

The whole thing is a **small CSS cascade for a single config slot**. If you only
read one section, read [The cascade](#the-cascade).

## Vocabulary (the two words that matter)

- **customized** — the track holds its own value, differing from the slot
  default. A customized track ignores the display-type default (top of the
  cascade). `resolveSlot(...).customized` is the flag.
- **pin / promoted default** — the display-type default itself, and the UI
  affordance that sets it: a trailing `PushPin` toggle
  (`DefaultForAllAdornment`) on each promotable menu row. A **filled** pin means
  "this value is the default for all tracks of this type"; **outline** means it
  isn't. "Pin" is *not* the track's own value — that's "customized".

## Where it lives

| Concern | File |
| --- | --- |
| Resolver + exported API | `packages/core/src/configuration/promotableDefaults.ts` |
| `promotable` / `promotedBase` slot metadata | `packages/core/src/configuration/configurationSlot.ts` |
| Session store (`get/setDisplayTypeDefault`) | `packages/product-core/src/Session/BaseSession.ts` |
| Share/export bake (`bakePromotedDefaultsIntoSnapshot`) | `packages/product-core/src/Session/shareableSnapshot.ts` |
| Received-session opt-out (`ignorePromotedDefaults`) | `packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx` |
| Session/display type surface | `packages/core/src/util/types/index.ts` |
| Badge hooks mixin | `plugins/linear-genome-view/src/BaseLinearDisplay/models/PromotableDefaultsMixin.tsx` |
| Track-selector badge | `plugins/data-management/.../tree/OverrideBadge.tsx` |
| Pin adornment + row builders | `packages/core/src/ui/{DefaultForAllAdornment.tsx,promotableMenuItems.tsx}` |
| `endAdornment` menu-row primitive + renderer | `packages/core/src/ui/{MenuTypes.ts,CascadingMenu.tsx,MenuItemTrailing.tsx}` |
| Adopter: `displayMode` (sentinel) | `plugins/canvas/src/LinearBasicDisplay/{baseConfigSchema,baseModel,model}.ts` |
| Adopter: `heightMode` / `linkedReads` / `readConnections` / `sashimiArcsMode` (sentinel) | `plugins/alignments/src/LinearAlignmentsDisplay/{configSchema,model}.ts` |
| Adopter: `showSoftClipping` / `featureHeight` / `featureSpacing` / `colorBy` / `readConnectionsDown` / `showSashimiLabels` (plain) | `plugins/alignments/src/LinearAlignmentsDisplay/{configSchema,model}.ts` |

Tests: `promotableDefaults.test.ts` (resolver + control builders),
`showSoftClipping.test.ts` (plain + sentinel adopters end-to-end),
`colorBy.test.tsx` / `readConnections.test.tsx` / `sashimi.test.ts` (per-row
pins), `DefaultForAllAdornment.test.tsx` (the pin), `OverrideBadge.test.tsx`
(badge), `ShareablePromotedDefaults.test.ts` (the share/export bake +
`ignorePromotedDefaults` round-trip, jbrowse-web).

## The cascade

A config slot marks itself `promotable: true`. Reading it through
`getConfResolved(self, slot)` walks three tiers:

```
customized track value (differs from the slot default)  ← highest priority
  └ session-wide promoted default for this display type
     └ the slot's base value                            ← lowest (CSS `initial`)
```

Two things make this cheap:

- **No stored "is-customized" flag.** `types.stripDefault` already collapses an
  at-default slot out of the snapshot, so "the slot is at its default" *is* the
  "follows the default" signal. Customized = holds any other value.
- **The promoted value lives in the session, not the track.** So setting a
  default doesn't rewrite every track's config — tracks that follow the default
  just resolve differently on their next read.

**Objects compare structurally.** `customized` uses `deepEqual(own,
defaultValue)`, which is identity for primitives and an order-independent
recursive compare for objects/arrays — a naive `!==` would read every object
slot as *permanently customized* (a fresh MST-reconstructed value is never
`===` its stored default), so the display-type default would never apply.
`colorBy` (a `frozen` `{ type: ... }` slot) is promotable on the strength of
this path; a new object/array slot needs nothing extra.

### Plain vs. sentinel slots

The only real design choice per slot: **can a track hold the default value
itself while an opposite default is promoted?**

- **Plain** (`showSoftClipping`, `featureHeight`, `featureSpacing`) —
  `defaultValue` doubles as the base *and* the follows-the-default signal.
  Consequence: a track can't customize that one value over an opposite promoted
  default. With a `true` soft-clipping default, a track can't hold `false`
  (writing `false` reads as "follow the default" → resolves back to `true`).
  **One-directional.**

- **Sentinel** (`displayMode`, `heightMode`, `linkedReads`, `readConnections`) —
  `defaultValue` is a dedicated `'inherit'` enum member (the CSS `inherit`
  keyword), and a separate `promotedBase` field holds the value it resolves to
  (the CSS `initial`, e.g. `'normal'` for displayMode, `'off'` for linkedReads).
  Now **every real value — `promotedBase` included — is customizable**, so a
  track *can* hold `displayMode: 'normal'` over a `compact` default, or
  `linkedReads: 'off'` over a `normal` (view-as-pairs) default.

Reach for a sentinel when the value users promote is the **non-default** and
they'll plausibly want to opt an individual track back out — the whole point of
`linkedReads`/`readConnections` is to promote pairs/arcs (non-default) as the
default while still letting one track hold `off`. The plain limitation is only
acceptable when the reverse doesn't happen in practice (nobody customizes a
number to *exactly* its default; a `showSoftClipping` track rarely needs to
force `false` under an on default). Still don't add sentinels reflexively — a
*boolean* that needed one would go tri-state (true/false/inherit) and need an
inherit control in the UI; prefer a stringEnum with an explicit `'inherit'`
member (the sentinel getter never surfaces it — `getConfResolved` returns
`promotedBase`).

## The resolver

Everything routes through one internal function; the exported API is thin
readers of it. Don't re-derive tiers in a consumer — add a field to
`SlotResolution` if you need something new.

```ts
interface SlotResolution {
  base: unknown       // value a following track shows with nothing promoted
  customized: boolean // track holds its own value rather than following the default
  promoted: unknown   // raw session-wide promoted default, if any
  value: unknown      // final cascaded value (never a slot's inherit sentinel)
}

function resolveSlot(self, slot): SlotResolution {
  const def = getSlotDefinition(self.configuration, slot)
  const base = def.promotedBase ?? def.defaultValue
  const own = getConf(self, slot)
  // a display that arrived in a received session skips the session-wide tier
  // entirely (see "Received sessions" below), collapsing to "own value, else base"
  const promoted = self.ignorePromotedDefaults
    ? undefined
    : getSession(self).getDisplayTypeDefault?.(self.type, slot)
  // a track is customized only when it holds a *usable* value other than the
  // default — the same `isUsableValue` gate a promoted default passes, so a
  // malformed or stale own value reads as not-customized and degrades to the
  // inherited value rather than reaching a consumer that trusts every value
  const customized = !deepEqual(own, def.defaultValue) && isUsableValue(def, own)
  const inherited = isUsableValue(def, promoted) ? promoted : base
  const value = customized ? own : inherited
  return { base, customized, promoted, value }
}
```

`isUsableValue` is the single gate **both** tiers pass a candidate through — a
promoted default and a track's own saved value. It composes three independent
checks: the value is concrete (not `undefined`, not a sentinel slot's own
`'inherit'` member), its JS shape fits the slot (a `stringEnum` choice, an
object/array of matching kind, a `maybeNumber`'s number, else the default's
`typeof`), and it passes the slot's optional semantic `validate` hook. A value
failing any check is dropped so the getter, the pin, and the badge all fall back
in lockstep — no consumer guards on its own. `colorBy` uses `validate` so a
`.type` naming a since-removed color scheme — customized or promoted — degrades
to the base instead of reaching the total `COLOR_SCHEMES` lookups that throw on
an unregistered type.

`getConfResolved` **always returns a real value**, never a slot's inherit
sentinel, so the display getter needs no post-guard:
`get displayMode() { return getConfResolved<DisplayMode>(self, 'displayMode') }`.

### Exported API (`@jbrowse/core/configuration`)

An entry is a `{ slot, value }` pair (`PromotableEntry`); most controls take a
group of them so several slots move as one unit.

| Symbol | Returns / does | Drives |
| --- | --- | --- |
| `getConfResolved(self, slot)` | `.value` | the display's own value getter |
| `resolvePromotableConfigSnapshot(self)` | config snapshot with every promotable slot replaced by its resolved value | the worker payload (see [Worker boundary](#adding-a-promotable-slot)) |
| `makeSlotsValueDisplayTypeDefaultControl(self, entries)` | `DisplayTypeDefaultControl` `{ active, toggle }` — the base builder | a per-value pin over an exact combination of slot values |
| `makeDisplayTypeDefaultControl(self, slot, onValue)` | same, single fixed value | an always-visible pin on one on-value ("make arcs the default") |
| `makeCurrentValueDisplayTypeDefaultControl(self, slots)` | same, over the track's *current* resolved values | "promote whatever I'm showing" for symmetric / continuous settings |
| `getDisplayTypeDefaultChanges(self)` | `TrackConfigChange[]` — promotable slots where a following track's resolved value differs from base | track-selector badge diff |
| `clearPromotedDefaults(self)` | clears every promoted default for this display's type | badge "clear default" |

`DisplayTypeDefaultControl` is `{ active: boolean; toggle: () => void }`.
`active` = this exact value combination is the current default (filled pin);
`toggle` sets or clears it (non-destructive — following tracks pick it up via
`getConfResolved`, customized tracks keep their own value). On **set**, `toggle`
raises a snackbar `"Set as the default"` carrying an **"Apply to N open tracks"**
action for any open tracks (across all views) not already showing this value —
the action resets their own value so they follow the new default; on **clear**,
`"Cleared the default"`.

The low-level primitives behind the builders — `isPromotableDefault(self,
entries)`, `setPromotableDefault(self, entries, on)`, `tracksDifferingFrom(self,
entries)`, `resetSlotsToInherit(displays, slots)`, and `isSlotCustomized` — are
**module-internal** (exercised by `promotableDefaults.test.ts`), *not* on the
public barrel. Consume the three `make*Control` builders, not these.

**Which builder?**

- **`makeDisplayTypeDefaultControl` (per-value, fixed)** — the meaning is "make
  *this specific value* the default", independent of the track's current value.
  Use for an always-visible pin so it never promotes a meaningless value, and so
  two toggles sharing one slot (arcs `'arc'` vs read cloud `'samplot'`; sashimi
  `'down'` vs `'auto'`) stay independent.
- **`makeSlotsValueDisplayTypeDefaultControl` (per-value, grouped)** — same, but
  a group of slots moves behind one pin (feature-height presets = `featureHeight`
  + `featureSpacing`; a `colorBy` scheme row).
- **`makeCurrentValueDisplayTypeDefaultControl` (promote-current)** — the pin
  means "whatever I'm showing", not a fixed on-value. Use for symmetric or
  continuous settings where a fixed value makes no sense (wiggle point size, arc
  line width, `mismatchAlpha`).

Note `resolveSlot` reads the session even for a customized track — required so
the "customized value equals the promoted default → pin filled" case works. This
is cheap: the display's value getter is a cached MobX computed that re-resolves
to the same `===` value, so nothing downstream re-runs.

## Storage

`BaseSession.get/setDisplayTypeDefault(displayType, slot, value)` on
`preferencesOverrides.displayTypeDefaults` (nested `type → slot → value`).
Persists for free via the preferences mixin → localStorage; embedded products
without that mixin resolve admin-only. Both are **optional** methods on
`AbstractSessionModel` (`getDisplayTypeDefault?`) so a session that lacks them
degrades to "no promoted defaults", never throws. `preferencesOverrides` is
`.volatile()`, so it's **kept off the session snapshot** deliberately — it's a
local, per-browser UI preference, not shared-session state. (Admin-baked shared
defaults ship separately via `configuration.preferences`.)

The catch this creates: a track *following* a promoted default holds no value of
its own, so a raw snapshot records it as at-default and a recipient — who lacks
the sender's `preferencesOverrides` — resolves it differently. That's what the
[serialization boundaries](#serialization-boundaries-getcomputedstyle) section
below handles: the preference stays local, but its *resolved effect* is baked
into the outgoing document.

## Serialization boundaries (getComputedStyle)

The cascade is **live, personal, and local** — like a CSS stylesheet. It stays
that way inside the running session (clearing a promoted default retroactively
reverts every follower; nothing is ever written into a following track). But the
moment the session crosses a boundary to a context that *doesn't have the
stylesheet* — a worker, a share recipient, an exported file — you must **flatten
the cascade to concrete values**, exactly as `getComputedStyle` flattens CSS.
The live session is never mutated; only the outgoing copy is flattened.

This is a **standing rule, not a per-feature patch**: any code that serializes a
display's config for consumption elsewhere must route through a resolver, never
emit a raw promotable slot (which serializes as its inherit sentinel or a
stripped at-default). There is one resolver per boundary shape, and adding a new
boundary means *calling* one — not writing bespoke resolution:

| Boundary | Resolver | Why |
| --- | --- | --- |
| Worker RPC payload | `resolvePromotableConfigSnapshot(display)` | worker has no session/`preferencesOverrides` to resolve against |
| Session share / desktop→web export | `bakePromotedDefaultsIntoSnapshot(session, snapshot)` | recipient lacks the sender's local defaults |

`bakePromotedDefaultsIntoSnapshot` (`shareableSnapshot.ts`, wired into
jbrowse-web `ShareDialog` and jbrowse-desktop `ExportToWebDialog`) returns a deep
copy of the snapshot in which, for every **open** display:

- each slot it *inherits* from a promoted default (`getDisplayTypeDefaultChanges`
  — non-customized, differs from base) is written into the track config layer: a
  user-added track's `sessionTracks` config, else a `trackConfigDeltas` entry
  against the admin base. Only genuinely-inherited non-base values are baked —
  customized slots already live in the config, at-base slots need nothing — so no
  spurious "edited" badge appears on the recipient side for an untouched slot.
- the display state is marked `ignorePromotedDefaults` (see below).

Tracks the sender never opened carry no display state to resolve, so they're
left to pick up the recipient's own defaults when opened — matching "export the
actual state of the *open* tracks".

### Received sessions (`ignorePromotedDefaults`)

A `#property` on `BaseDisplay` (`stripDefault(boolean, false)`, so absent from
snapshots until set). When `true`, `resolveSlot` skips the session-wide tier
entirely — the display resolves from its own config only, ignoring *this*
browser's promoted defaults.

It exists because baking the values isn't sufficient on its own. Two cases:

- **Sender saw a non-base value** → baked into the config; the recipient's
  display now reads as *customized* and ignores their cascade anyway.
- **Sender saw the base value while the recipient has promoted a different one**
  → nothing is baked (the value equals base), so without the flag the recipient's
  cascade would repaint it. The flag is the only thing that forces the received
  track to stay at what the sender saw. (For a *plain* slot it's the sole
  mechanism that can neutralize a promoted default at all — no baked value can
  read as customized there.)

So the bake sets the flag on **every** open display, making the shared session a
faithful frozen picture, immune to the recipient's local preferences. The flag
is **cleared** by `resetSlotsToInherit` — i.e. the moment the recipient
deliberately clicks "use this default", the display rejoins the cascade. A track
the recipient opens *fresh* in a received session never gets the flag, so it
picks up their defaults normally.

Note the About-track dialog needs **no** flattening: every promotable slot is
display-level and the dialog intentionally hides the `displays` array, so there
is no track-level fidelity gap to close there.

## UI surface

Every promotable setting renders **one row per value**, and every such row
carries the same trailing pin — the `DefaultForAllAdornment` (`PushPin`
`ToggleButton`) as the menu item's **`endAdornment`**, driven by a
`DisplayTypeDefaultControl`. There is no separate "make default" checkbox row
anymore; the pin *is* the make-default affordance, and it lives beside the value
control on the same row. `endAdornment` is a general `BaseMenuItem` field;
`MenuItemTrailing` renders it in a fixed-width column (reserved on every row when
any row has one, so value checks stay column-aligned and pins right-align in
their own column). Pins are **always shown** (discoverable) and their content
`stopPropagation`s so a click sets the default without toggling the row value or
dismissing the menu.

The row builders in `promotableMenuItems.tsx`:

- **`promotableToggleItem`** — a `type:'checkbox'` row (native
  hover/sizing/keyboard) for a flat boolean setting (`showSoftClipping`,
  `readConnectionsDown`, `showSashimiLabels`). The checkbox toggles the track's
  value; the pin promotes the setting's on-value. Takes a `displayTypeDefault`
  control (per-value, from `makeDisplayTypeDefaultControl`).
- **`promotableRadioItem`** — a `type:'radio'` row for one option of a
  multi-value slot (a `colorBy` scheme, a `heightMode`/`sashimiArcsMode` option,
  a feature-height preset). `displayTypeDefault` is *omitted* on the base /
  follow-the-default option (e.g. a mode enum's `'up'`/`'normal'`), since
  promoting the base is meaningless with per-value semantics.

Selecting a value **customizes** the track to it (a sentinel slot's base value
included). An explicit **"Follow default" reset item** (writes the `'inherit'`
sentinel) is *optional*: `displayMode` folds it into a top "Default (X)" radio;
the others omit it (picking a value customizes, leaving it untouched follows the
default). Don't add one reflexively.

**Disabled-not-hidden for dependent options:** options that only apply once a
parent toggle is on (the arc/read-cloud band submenu, arc coloring) stay present
but `disabled` with a `disabledHelpText`, rather than vanishing — so they're
discoverable. `CascadingMenu` greys a disabled submenu and blocks it from
opening.

**Badge** (`OverrideBadge.tsx`, track selector): a distinct `SettingsSuggestIcon`
(vs. the per-track-edit pencil) shows when the display's
`displayTypeDefaultChanges()` is non-empty; click opens
`TrackSettingsChangesDialog` with a "clear default" action. Both hooks — the
`displayTypeDefaultChanges()` view (→ `getDisplayTypeDefaultChanges`) and the
`clearDisplayTypeDefaults()` action (→ `clearPromotedDefaults`) — come from
**`PromotableDefaultsMixin`**; compose it and any display gets the badge contract
for free (no per-display passthroughs).

## Adding a promotable slot

1. In the display's config schema, add `promotable: true` to the slot. For a
   value users will want to keep *at its default* while an opposite default is
   promoted (rare — think hard), instead make the default a dedicated inherit
   sentinel and add `promotedBase: <realDefault>`. If the slot's *shape* alone
   can't tell a valid value from a stale one (e.g. a `frozen` `colorBy` whose
   `.type` must name a registered scheme, not just be some string), add a
   `validate: (value) => boolean` hook — it gates both a promoted default and a
   track's own saved value, so a value that's since gone invalid degrades to the
   base instead of reaching a consumer that trusts it.
2. Read it on the display via `getConfResolved(self, slot)` (never raw `getConf`
   for a promotable slot — raw won't apply the display-type default, and for a
   sentinel slot could hand a consumer `'inherit'`).
3. If the display isn't already an adopter, `.compose(PromotableDefaultsMixin())`
   so the badge hooks exist.
4. Track menu: expose a `DisplayTypeDefaultControl` getter from the model built
   with the fitting `make*Control` builder, and pass it as `displayTypeDefault`
   to `promotableToggleItem` / `promotableRadioItem`. Group slots that move
   together into one control.
5. **Serialization boundaries** (see
   [that section](#serialization-boundaries-getcomputedstyle)): promotable slots
   resolve on the **main thread**, so anything that ships the config elsewhere
   must flatten. If the worker needs the value, send
   `resolvePromotableConfigSnapshot(self)` (or read the display's resolved getter
   into `rpcProps()`) rather than a raw `getConfSnapshot` — a raw promotable slot
   serializes as its inherit sentinel, which the worker can't interpret.
   `displayMode` is excluded from the canvas worker payload entirely (compact
   scaling is main-thread). The **share/export** boundary needs nothing per-slot:
   `bakePromotedDefaultsIntoSnapshot` walks every promotable slot via
   `getDisplayTypeDefaultChanges`, so a new slot is covered automatically.

## Historical note

An earlier design layered admin/user type-default configs via extra
`mergeTrackConfig` passes in the `SessionTracks.ts` `tracks` getter, with a
4-part memo key to keep the hydration cache warm (also the stale block in
`OTHER_IDEAS.md`). **Superseded**: a `promotable` slot resolves on read — no
tracks-getter merge, no admin config slot, no cache-key surgery. Kept the "user
choice wins / display-type granularity" decisions; dropped the machinery.

A second naming pass then **reclaimed "pin"**: the track's own value is now
"customized", and "pin" names the make-default affordance. The prior API's
`isSlotPinned` / `areSlotsAtSessionDefault` / `setSlotsSessionDefault` /
`isSlotValueSessionDefault` / `setSlotValueSessionDefault` /
`getSlotInheritedValue` collapsed into the three `make*Control` builders (public)
over `isPromotableDefault` / `setPromotableDefault` (internal), and the
`SessionDefault*` names became `DisplayTypeDefault*`.
