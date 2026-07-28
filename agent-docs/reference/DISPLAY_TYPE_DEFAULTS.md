---
name: display-type-defaults
description: Session-wide per-display-type slot defaults via promotable slots and CSS-cascade resolution. Read when adding a make-default-for-all-tracks setting, touching getConf / promotable slots, or serializing a session for sharing/export/worker.
---

# Display-type defaults (promotable config slots)

The third config axis, alongside per-track [`trackConfigDeltas`](../../packages/product-core/src/Session/CLAUDE.md)
and app-scope `preferences`: a **session-wide default for one config slot, keyed
by display type**. "Make all my alignments tracks compact", "show soft-clipping
on every alignments track by default" — set it once, every track of that type
that hasn't customized its own value follows.

The whole thing is a **small CSS cascade for a single config slot**. If you only
read one section, read [The cascade](#the-cascade).

## TL;DR

- Three tiers, resolved at read time by `resolveConf`: **customized track value >
  session-wide promoted default for the display type > the slot's base value**.
- **No stored is-customized flag.** `stripDefault` collapses an unset slot out
  of the snapshot, so "unset" *is* "follows the default".
- The promoted value lives in the **session**, not the track, so setting a
  default rewrites nothing. Objects compare with `deepEqual`, not `!==`.
- **The inherit sentinel is always `undefined`**, enforced by `ConfigSlot`: a
  promotable slot must be a `maybe*` type, must leave `defaultValue` undefined,
  and must declare `promotedBase` for what being unset resolves to. This keeps
  every real value customizable over an opposite default, and keeps the
  mechanism out of the slot's own vocabulary.
- **Standing rule at every serialization boundary:** flatten the cascade like
  `getComputedStyle`. Worker RPC → `resolvePromotableConfigSnapshot`;
  share/export → `bakePromotedDefaultsIntoSnapshot`. Never emit a raw promotable
  slot.
- Received sessions carry `ignorePromotedDefaults`: baking alone can't neutralize
  a recipient's default when the sender saw the base value.
- UI is **one row per value**, each with a trailing `PushPin`. Filled = default
  for all tracks of this type. No separate "make default" row.

## Vocabulary (the two words that matter)

- **customized** — the track's slot is *set* to a usable value of its own
  (rather than left unset). A customized track ignores the display-type default
  (top of the cascade). `resolveSlot(...).customized` is the flag.
- **pin / promoted default** — the display-type default itself, and the UI
  affordance that sets it: a trailing `PushPin` toggle
  (`DefaultForAllAdornment`) on each promotable menu row. A **filled** pin means
  "this value is the default for all tracks of this type"; **outline** means it
  isn't. "Pin" is *not* the track's own value — that's "customized".

## Where it lives

| Concern | File |
| --- | --- |
| Read-time resolver (`resolveSlot`, `isUsableValue`) | `packages/core/src/configuration/promotableResolve.ts` |
| Cached per-schema promotable-slot list (`promotableSlotNames`), shared with the `getConfSnapshot` guard | `packages/core/src/configuration/util.ts` |
| Resolution-aware reader (`resolveConf`; `getConf` alongside it stays raw) | `packages/core/src/configuration/getConf.ts` |
| Control builders + share/worker helpers (`make*Control`, `resolvePromotableConfigSnapshot`, `getDisplayTypeDefaultChanges`, `openPromotableDisplays`) | `packages/core/src/configuration/promotableDefaults.ts` |
| `promotable` / `promotedBase` slot metadata + its authoring guards | `packages/core/src/configuration/configurationSlot.ts` |
| Slot-definition inheritance (an override merges over the base slot, so `promotable` survives) | `packages/core/src/configuration/configurationSchema.ts` (`mergeSchemaDefinition`) |
| Resolved read type (`SlotValueFromDef` excludes the sentinel for `promotedBase` slots) | `packages/core/src/configuration/types.ts` |
| Session store (`get/setDisplayTypeDefault`) | `packages/product-core/src/Session/BaseSession.ts` |
| Share/export bake (`bakePromotedDefaultsIntoSnapshot`) | `packages/product-core/src/Session/shareableSnapshot.ts` |
| Received-session opt-out (`ignorePromotedDefaults`) | `packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx` |
| Session/display type surface | `packages/core/src/util/types/index.ts` |
| Track-selector badge | `plugins/data-management/.../tree/OverrideBadge.tsx` |
| Pin adornment + row builders | `packages/core/src/ui/{DefaultForAllAdornment.tsx,promotableMenuItems.tsx}` |
| `endAdornment` menu-row primitive + renderer | `packages/core/src/ui/{MenuTypes.ts,CascadingMenu.tsx,MenuItemTrailing.tsx}` |
| Adopters: `displayMode` / `heightMode` / `subfeatureLabels` / `displayDirectionalChevrons` | `plugins/canvas/src/LinearBasicDisplay/{baseConfigSchema,baseModel,model}.ts` — **inherited by every `linearCanvasBaseDisplayStateModelFactory` consumer** (e.g. `LinearVariantDisplay`) via `baseConfiguration`, so those displays get the four pins for free |
| Adopters: `featureHeight` / `heightMode` / `colorBy` / `mismatchAlpha` / `linkedReads` / `readConnections` / `readConnectionsDown` / `sashimiArcsMode` / `showSashimiLabels` / `showSoftClipping` | `plugins/alignments/src/LinearAlignmentsDisplay/{configSchema,model}.ts` |
| Adopters: `scatterPointSize` + `lineWidth` (wiggle), `lineWidth` (paired-arc), `scatterPointSize` (Manhattan) | `plugins/wiggle/src/shared/{wiggleConfigSchemaFields.ts,WiggleScoreConfigMixin.ts}`, `plugins/arc/src/LinearPairedArcDisplay/{configSchema,model}.ts`, `plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts` |
| Shared `heightMode` mixin (canvas + alignments) | `plugins/linear-genome-view/src/BaseLinearDisplay/models/{HeightModeMixin.ts,heightMode.ts}` |

Tests: `promotableDefaults.test.ts` (resolver + control builders),
`promotedValueCloneable.test.ts` (node env: a resolved value must survive
`postMessage`), `showSoftClipping.test.ts` (adopters
`showSoftClipping`/`featureHeight` + per-preset pins end-to-end),
`colorBy.test.tsx` / `readConnections.test.tsx` / `sashimi.test.ts` (per-row
pins), `DefaultForAllAdornment.test.tsx` (the pin), `OverrideBadge.test.tsx`
(badge), `ShareablePromotedDefaults.test.ts` (the share/export bake +
`ignorePromotedDefaults` round-trip, jbrowse-web).

## The cascade

A config slot marks itself `promotable: true`, and the display's value getter
reads it with `resolveConf(self, slot)`, which walks three tiers:

```
customized track value (the slot is set to something)   ← highest priority
  └ session-wide promoted default for this display type
     └ the slot's base value                            ← lowest (CSS `initial`)
```

Two things make this cheap:

- **No stored "is-customized" flag.** `types.stripDefault` already collapses an
  unset slot out of the snapshot, so "the slot is unset" *is* the "follows the
  default" signal. Customized = holds any usable value.
- **The promoted value lives in the session, not the track.** So setting a
  default doesn't rewrite every track's config — tracks that follow the default
  just resolve differently on their next read.

**Objects compare structurally.** `customized` needs no comparison at all — the
sentinel is `undefined`, so "holds a usable value" is the whole test. But every
comparison *against the promoted value* (`isPromotableDefault` for the pin's
filled state, `tracksDifferingFrom` for the snackbar count) uses `deepEqual`, not
`===`: a naive `!==` would read every object slot as permanently differing (a
fresh MST-reconstructed value is never `===` its stored twin), so the pin would
never light up. `colorBy` (a `maybeFrozen` `{ type: ... }` slot) is promotable on
the strength of this path; a new object/array slot needs nothing extra.

### The inherit sentinel

**Being unset is the sentinel.** Every promotable slot is a `maybe*` type — so
`undefined` is the CSS `inherit` keyword — and declares `promotedBase` for what
that resolves to (the CSS `initial`). `ConfigSlot` throws unless the type is a
`maybe*`, `defaultValue` is `undefined`, and `promotedBase` is set, so there is
one form and nothing to choose:

- `maybeNumber` — `featureHeight`/`scatterPointSize`/`lineWidth` (e.g.
  `featureHeight` → `7`).
- `maybeBoolean` — `showSoftClipping`/`mismatchAlpha`/`showSashimiLabels`/
  `displayDirectionalChevrons`.
- `maybeStringEnum` — `displayMode`/`heightMode`/`subfeatureLabels`/
  `linkedReads`/`readConnections`/`sashimiArcsMode`, resolving to
  `'normal'`/`'fixed'`/`'none'`/`'off'`/`'off'`/`'up'`. The author writes the
  plain enumeration (`['fixed','grow','fit']`) and `ConfigSlot` wraps it in
  `types.maybe`.
- `maybeFrozen` — the object-valued case: `colorBy`, resolving to
  `{ type: 'normal' }`.

**Why it's mandatory.** Spending only the unset state on the sentinel is what
leaves every *real* value — `promotedBase` included — customizable per-track, so a
track can hold `displayMode: 'normal'` under a promoted `compact`, or
`linkedReads: 'off'` under a promoted `normal` (view-as-pairs). With a concrete
`defaultValue` it would double as the follows-the-default signal, and writing that
one value would read as "follow the default" — making the setting one-directional
and, for a promoted non-default, un-turn-off-able on an individual track.

**Why `undefined` and not a spare `'inherit'` enum member.** An earlier form
spelled the enum sentinel in-band, which meant the enumeration carried a member
that wasn't a mode: `HEIGHT_MODE_VALUES` listed `'inherit'`, every consumer needed
a second `HeightMode` type to subtract it back out, the config editor's dropdown
offered "inherit" as a literal choice, and a raw `readConfObject` handed the
string to a caller that had no idea what it meant. `maybeStringEnum` puts the
nullability in the slot type instead, so the vocabulary is only ever real values.

It costs nothing at the read site: `getConf` resolves `undefined` to
`promotedBase` and the getter never surfaces it (and `SlotValueFromDef` drops
`undefined` from the read type, so the getter's own annotation stays clean).

## The resolver

Everything routes through one internal function; the exported API is thin
readers of it. Don't re-derive tiers in a consumer — add a field to
`SlotResolution` if you need something new.

```ts
// discriminated on `callback` — a callback track has no settled value, so it
// offers no `value` to read. See "Callback values" below
type SlotResolution =
  | { base: unknown; promoted: unknown; callback: false
      customized: boolean // track holds its own value rather than following the default
      value: unknown }    // final cascaded value (never the unset sentinel)
  | { base: unknown; promoted: unknown; callback: true
      customized: true
      evaluate: () => unknown } // run the callback with this read's args

function resolveSlot(self, slot, args = {}): SlotResolution {
  const def = getSlotDefinition(self.configuration, slot)
  const base = def.promotedBase // required on every promotable slot
  // `promoted` stays the raw session-wide value even for an opted-out display:
  // it's a session-wide fact, and the pin's filled/outline state reports on the
  // session, not on one display's view of it. The opt-out belongs to `inherited`
  const promoted = getSession(self).getDisplayTypeDefault?.(self.type, slot)
  // raw read: this *is* the resolver, so `readConfObject`, not `getConf` (which
  // would recurse back into resolveSlot for a promotable slot)
  // (a `jexl:` slot returns before this — see "Callback values")
  const own = readConfObject(self.configuration, slot, args)
  // a track is customized exactly when it holds a *usable* value — the same
  // `isUsableValue` gate a promoted default passes, so a malformed or stale own
  // value reads as not-customized and degrades to the inherited value rather
  // than reaching a consumer that trusts every value
  const customized = isUsableValue(def, own)
  // a display that arrived in a received session skips the session-wide tier
  // entirely (see "Received sessions" below), collapsing to "own value, else base"
  const inherited =
    !self.ignorePromotedDefaults && isUsableValue(def, promoted) ? promoted : base
  const value = customized ? own : inherited
  return { base, customized, promoted, callback: false, value }
}
```

`isUsableValue` is the single gate **both** tiers pass a candidate through — a
promoted default and a track's own saved value. It composes four independent
checks: the value is set at all (`undefined` IS the inherit sentinel), it isn't a
raw `jexl:` string (nothing in the app can promote one, but the store is untyped
and localStorage-backed), its JS shape fits the slot (a `SHAPE_CHECKS` entry for
the slot `type` — a `maybeStringEnum` choice, a *finite* `maybeNumber` — else
`promotedBase`'s object/array kind or `typeof`), and it passes the slot's
optional semantic `validate` hook. A value
failing any check is dropped so the getter, the pin, and the badge all fall back
in lockstep — no consumer guards on its own. `colorBy` uses `validate` so a
`.type` naming a since-removed color scheme — customized or promoted — degrades
to the base instead of reaching the total `COLOR_SCHEMES` lookups that throw on
an unregistered type.

`resolveConf` on a promotable slot **always returns a real value**, never the
unset sentinel, so the display getter needs no post-guard — and its read type
excludes `undefined`, so no cast either:
`get displayMode(): DisplayMode { return getConf(self, 'displayMode') }`.

### Callback values (`jexl:`)

A promotable slot can hold a `jexl:` callback like any other slot, and
`resolveConf(self, slot, args)` forwards its `args` so the callback evaluates
with the caller's context. But a callback returns a **different value per
call**, so it has no single value to compare against the slot default — it can't
meaningfully "follow the default". A `jexl:` value therefore leaves the cascade
at the top: `customized` is true, `callback` is true, and there is no `value` at
all — only `evaluate()`, which needs the caller's `args`.

**That's the union's whole job.** The cascade's own consumers (the pin, the
badge, the share bake) have no per-feature context to supply, and on the callback
branch the type gives them nothing to misread: `resolveConf` is the only reader
that calls `evaluate()`, because it's the only one holding the caller's `args`.
Everyone else branches — `getDisplayTypeDefaultChanges` tests `customized` first
(which narrows the callback branch away, since it's `true` there),
`tracksDifferingFrom` counts a callback track as differing without evaluating it,
`resolvePromotableConfigSnapshot` leaves the raw `jexl:` string in the worker
payload for the worker to evaluate per-feature, and
`makeCurrentValueDisplayTypeDefaultControl` returns a **disabled** pin (a
callback has no single current value to promote). A new consumer that forgets
doesn't reach a menu-breaking throw at runtime; it fails to compile.

### Exported API (`@jbrowse/core/configuration`)

An entry is a `{ slot, value }` pair (`PromotableEntry`); most controls take a
group of them so several slots move as one unit.

| Symbol | Returns / does | Drives |
| --- | --- | --- |
| `resolveConf(self, slot)` | the cascaded `.value`; throws on a non-promotable slot | the display's own value getter |
| `resolvePromotableConfigSnapshot(self)` | config snapshot with every promotable slot replaced by its resolved value | the worker payload (see [Worker boundary](#adding-a-promotable-slot)) |
| `makeDisplayTypeDefaultControl(self, slot, onValue)` | `DisplayTypeDefaultControl` `{ active, disabled, toggle }`, on one fixed value | an always-visible pin on one on-value ("make arcs the default") |
| `makeCurrentValueDisplayTypeDefaultControl(self, slots)` | same, over the track's *current* resolved values; `disabled` when any of them is a `jexl:` callback | "promote whatever I'm showing" for symmetric / continuous settings |
| `getDisplayTypeDefaultChanges(self)` | `TrackConfigChange[]` — promotable slots where a following track's resolved value differs from base | track-selector badge diff |
| `clearPromotedDefaults(self)` | clears every promoted default for this display's type | badge "clear default" |
| `isSlotCustomized(self, slot)` | whether the track holds its own value rather than following the default | a slider row's "reset to default" enablement (wiggle point size, arc line width) |

`DisplayTypeDefaultControl` is
`{ active: boolean; disabled: boolean; toggle: () => void }`.
`active` = this exact value combination is the current default (filled pin);
`disabled` greys the pin (only the promote-current builder sets it — see
[Callback values](#callback-values-jexl));
`toggle` sets or clears it.

**`toggle` writes the session default and nothing else.** No track's own value is
ever touched — the pin edits the stylesheet, never the elements. Following tracks
pick the new value up via `getConf`; customized tracks keep theirs. It raises a
snackbar `"Set as the default"` carrying an **"Apply to N open tracks"** action
for any open track (across all views) not already showing this value, and *that*
action — the one explicit gesture — resets their own value so they follow. On
**clear**, `"Cleared the default"`.

Toggling on used to *also* reset the display the pin was clicked from, so its own
track updated with one click. That silently discarded the display's value:
pin-then-unpin stranded it on `promotedBase` rather than what it held before, a
two-click non-undoable loss from a control that reads as a toggle. Symmetry is
worth the one extra click on a customized track; that track is now just counted
in "Apply to N open tracks" like any other.

The low-level primitives behind the builders —
`makeSlotsValueDisplayTypeDefaultControl(self, entries)` (the grouped base
builder both public ones delegate to), `isPromotableDefault(self, entries)`,
`setPromotableDefault(self, entries, on)`, `tracksDifferingFrom(self, entries)`,
and `resetSlotsToInherit(displays, slots)` — are **module-internal** (exercised
by `promotableDefaults.test.ts`), *not* on the public barrel. Consume the two
`make*Control` builders, not these. The grouped
base is internal because no adopter promotes more than one slot behind a single
pin: feature-height presets once grouped `featureHeight` + `featureSpacing`, but
`featureSpacing` is now *derived* from `featureHeight` and never stored, and the
`colorBy` scheme row promotes the one `colorBy` slot. Export it again if a
genuine multi-slot pin appears.

**Which builder?**

- **`makeDisplayTypeDefaultControl` (per-value, fixed)** — the meaning is "make
  *this specific value* the default", independent of the track's current value.
  Use for an always-visible pin so it never promotes a meaningless value, and so
  two toggles sharing one slot (arcs `'arc'` vs read cloud `'cloud'`; sashimi
  `'down'` vs `'auto'`) stay independent.
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
`preferencesOverrides`, under one **flat composite key** per promoted default
(`displayTypeDefault\0<type>\0<slot>`), *not* a nested `displayTypeDefaults`
object. `preferencesOverrides` is an `observable.map`, so a flat key makes each
promoted default its own tracked entry — promoting one can't invalidate a reader
of another, and every promotable display reads one per `rpcProps`. A single
nested object reassigned wholesale made every setter wake every reader.
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
| Session share / "Export session" → `session.json` (web, react-app) | `getShareableSessionSnapshot(session)` | recipient lacks the sender's local defaults |
| desktop→web export | `bakePromotedDefaultsIntoSnapshot(session, plan.session)` | same, but bakes a snapshot `planWebExport` already transformed |

**Two of those three rows are enforced, not remembered.** `getConfSnapshot`
*throws* on a config carrying promotable slots, naming
`resolvePromotableConfigSnapshot` in the message — so the worker row can't be got
wrong by writing the obvious thing in a new `rpcProps()`. (An internal
`rawConfSnapshot`, deliberately off the barrel, is what the resolver itself uses;
its sub-config recursion still goes through the guarded form, so a promotable
slot declared in a *nested* schema throws too — the resolver only ever walks a
config's own top-level slot table, so a nested one would never resolve at all.)
And `getShareableSessionSnapshot(session)` does the snapshot and the bake in one
call, so the pair can't be split: a bare `getSnapshot(session)` is never a
correct outgoing snapshot.

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

`openPromotableDisplays` recurses into a composite view's **`views` array**
(breakpoint-split, the linear-comparative / synteny family), which holds child
views rather than tracks of its own — `LGVSyntenyDisplay` is only reachable that
way. It is the **only** walk that decides reach: `markIgnorePromotedDefaults`
stamps the flag by matching the displayIds that walk already collected, walking
the outgoing snapshot structurally rather than re-following
views→tracks→displays. A second shape-aware walk had to be kept in step by hand,
and a composite view it forgot got its values baked but not the flag — the half
that silently loses to the recipient's own default.

A view holding its children under *named props* instead
(`SvInspectorView.circularView`) is **not** reached. Enumerating a view's own
properties to find them is not an option — reading every key of an MST node
invokes every computed view on it, and several throw before the view is
initialized. Nothing is missed today (no display under those views declares a
promotable slot); if one ever does, give that view a `views` getter returning its
children rather than duck-typing harder in `hasChildViews`.

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
  a feature-height preset). **Every option in a group gets a pin, the
  `promotedBase` value included.** Once a non-base value is promoted, pinning the
  base back is the only per-value way to undo it from its own row, and a radio
  group with one row silently missing its trailing control reads as a bug.
  `displayTypeDefault` stays optional on the row builder, but a group that omits
  it on some rows and not others is the thing to avoid — expose one
  `f(value) => control` method on the model rather than a named getter per value,
  which is what made `sashimiArcsMode`'s base look unpinnable.

Selecting a value **customizes** the track to it (`promotedBase` included). An
explicit **"Follow default" reset item** (writes `undefined`, unsetting the slot)
is *optional*: `displayMode` folds it into a top "Default (X)" radio;
the others omit it (picking a value customizes, leaving it untouched follows the
default). Don't add one reflexively.

**Disabled-not-hidden for dependent options:** options that only apply once a
parent toggle is on (the arc/read-cloud band submenu, arc coloring) stay present
but `disabled` with a `disabledHelpText`, rather than vanishing — so they're
discoverable. `CascadingMenu` greys a disabled submenu and blocks it from
opening.

**Badge** (`OverrideBadge.tsx`, track selector): the same pencil that marks a
per-track config edit also shows when `getDisplayTypeDefaultChanges(display)` is
non-empty — one badge, two reasons, with the tooltip and the dialog naming the
actual source; click opens `TrackSettingsChangesDialog` with a "clear default"
action wired to `clearPromotedDefaults(display)`.

The badge calls those two core functions **directly on the display**, not through
per-display MST hooks. Both are total — a schema with no promotable slot yields no
changes and clears nothing — so there is nothing to dispatch on, and no display has
to opt in. An earlier `PromotableDefaultsMixin` forwarded them as
`displayTypeDefaultChanges()` / `clearDisplayTypeDefaults()`, which meant six
displays each re-declaring `configuration` a second time and a silent
never-badges failure for any display that forgot to compose it. Don't reintroduce
it.

## Adding a promotable slot

1. In the display's config schema, use a `maybe*` slot type
   (`maybeNumber`/`maybeBoolean`/`maybeColor`/`maybeStringEnum`/`maybeFrozen`),
   leave `defaultValue` undefined, and add `promotable: true` plus
   `promotedBase: <realDefault>`. `ConfigSlot` throws on any other shape, so
   there's nothing to get subtly wrong. If the slot's *shape* alone can't tell a valid value from a stale one
   (e.g. a `maybeFrozen` `colorBy` whose `.type` must name a registered scheme, not just
   be some string), add a `validate: (value) => boolean` hook — it gates both a
   promoted default and a track's own saved value, so a value that's since gone
   invalid degrades to the base instead of reaching a consumer that trusts it.

   **Overriding an inherited promotable slot states only the difference.** A
   subclass schema that redeclares one merges field-by-field over the base's, so
   `LGVSyntenyDisplay`'s `colorBy` writes just its `promotedBase`
   (`{type:'strand'}` rather than `normal`) and inherits `promotable`,
   `validate` and `advanced`. Keep `type` and `defaultValue` — they're what marks
   the entry as a slot rather than a nested sub-schema. A subclass that wants a
   genuinely plain slot writes `promotable: false`.
2. Read it on the display with **`resolveConf(self, slot)`**, not `getConf` —
   `get x(): X { return resolveConf(self, 'x') }`, no post-guard and no cast. If
   you forget, tsc catches it: the raw `getConf` read type is `X | undefined`
   (the unset sentinel) and won't assign to `X`. `resolveConf` throws on a slot
   that isn't promotable, so the two readers can't be swapped by accident in
   either direction.

   The same slot name can be promotable in one schema and plain in another
   (`colorBy` is promotable on alignments, not on gwas/variants; `featureHeight`
   on alignments, not on canvas-base; `displayMode` on canvas-base, not on arc) —
   which reader each display uses is a per-schema fact you can read off the
   getter. `readConfObject` is the raw read from a bare config (the resolver
   itself uses it), and `getConf` is that same raw read through a state model's
   `.configuration`.
3. Track menu: expose a `DisplayTypeDefaultControl` getter from the model built
   with the fitting `make*Control` builder, and pass it as `displayTypeDefault`
   to `promotableToggleItem` / `promotableRadioItem`. Group slots that move
   together into one control. The track-selector badge needs **nothing** — it
   reads the cascade directly off any display.
4. **Serialization boundaries** (see
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

Three later passes removed machinery rather than adding it. A **plain**
promotable form once let `defaultValue` double as the inherit signal; no slot
ever used it, so `ConfigSlot` now requires a `maybe*` type + `promotedBase` and
the resolver has one path. A `PromotableDefaultsMixin` once forwarded the badge's
two hooks per display; both underlying functions are total, so the badge calls
them directly and the mixin is gone. And the sentinel itself was **collapsed onto
`undefined`**: enums used to spend a spare `'inherit'` member on it (see [The
inherit sentinel](#the-inherit-sentinel)), which put the mechanism into every
enumeration, the config editor dropdown, and a second `Exclude<…, 'inherit'>`
type per consumer. `maybeStringEnum` / `maybeFrozen` replaced that, so
`isUsableValue`'s first check is a bare `value !== undefined` and no
`defaultValue` comparison survives in the resolver.

A naming pass also **reclaimed "pin"**: the track's own value is now
"customized", and "pin" names the make-default affordance. The prior API's
`isSlotPinned` / `areSlotsAtSessionDefault` / `setSlotsSessionDefault` /
`isSlotValueSessionDefault` / `setSlotValueSessionDefault` /
`getSlotInheritedValue` collapsed into the three `make*Control` builders (public)
over `isPromotableDefault` / `setPromotableDefault` (internal), and the
`SessionDefault*` names became `DisplayTypeDefault*`.
