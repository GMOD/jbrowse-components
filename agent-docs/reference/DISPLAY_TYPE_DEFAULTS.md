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

- Three tiers, resolved at read time by `getConf`: **customized track value >
  session-wide promoted default for the display type > the slot's base value**.
- **No stored is-customized flag.** `stripDefault` collapses an at-default slot
  out of the snapshot, so "at default" *is* "follows the default".
- The promoted value lives in the **session**, not the track, so setting a
  default rewrites nothing. Objects compare with `deepEqual`, not `!==`.
- Every production slot is **sentinel**: `defaultValue` is a dedicated inherit
  signal (an `'inherit'` enum member, or a `maybeNumber`/`maybeBoolean`
  `undefined`), and `promotedBase` holds what it resolves to. This keeps every
  real value customizable over an opposite default.
- **Standing rule at every serialization boundary:** flatten the cascade like
  `getComputedStyle`. Worker RPC → `resolvePromotableConfigSnapshot`;
  share/export → `bakePromotedDefaultsIntoSnapshot`. Never emit a raw promotable
  slot.
- Received sessions carry `ignorePromotedDefaults`: baking alone can't neutralize
  a recipient's default when the sender saw the base value.
- UI is **one row per value**, each with a trailing `PushPin`. Filled = default
  for all tracks of this type. No separate "make default" row.

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
| Read-time resolver (`resolveSlot`, `promotableSlotNames`, `promotableSlots`) | `packages/core/src/configuration/promotableResolve.ts` |
| Resolution-aware reader (`getConf` routes promotable slots through the cascade) | `packages/core/src/configuration/getConf.ts` |
| Control builders + share/worker helpers (`make*Control`, `resolvePromotableConfigSnapshot`, `getDisplayTypeDefaultChanges`) | `packages/core/src/configuration/promotableDefaults.ts` |
| `promotable` / `promotedBase` slot metadata | `packages/core/src/configuration/configurationSlot.ts` |
| Resolved read type (`SlotValueFromDef` excludes the sentinel for `promotedBase` slots) | `packages/core/src/configuration/types.ts` |
| Session store (`get/setDisplayTypeDefault`) | `packages/product-core/src/Session/BaseSession.ts` |
| Share/export bake (`bakePromotedDefaultsIntoSnapshot`) | `packages/product-core/src/Session/shareableSnapshot.ts` |
| Received-session opt-out (`ignorePromotedDefaults`) | `packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx` |
| Session/display type surface | `packages/core/src/util/types/index.ts` |
| Badge hooks mixin | `plugins/linear-genome-view/src/BaseLinearDisplay/models/PromotableDefaultsMixin.tsx` |
| Track-selector badge | `plugins/data-management/.../tree/OverrideBadge.tsx` |
| Pin adornment + row builders | `packages/core/src/ui/{DefaultForAllAdornment.tsx,promotableMenuItems.tsx}` |
| `endAdornment` menu-row primitive + renderer | `packages/core/src/ui/{MenuTypes.ts,CascadingMenu.tsx,MenuItemTrailing.tsx}` |
| Adopters (all sentinel): `displayMode` / `heightMode` / `subfeatureLabels` / `displayDirectionalChevrons` | `plugins/canvas/src/LinearBasicDisplay/{baseConfigSchema,baseModel,model}.ts` — **inherited by every `linearCanvasBaseDisplayStateModelFactory` consumer** (e.g. `LinearVariantDisplay`) via `baseConfiguration`, so those displays get the four pins for free |
| Adopters (all sentinel): `featureHeight` / `heightMode` / `colorBy` / `mismatchAlpha` / `linkedReads` / `readConnections` / `readConnectionsDown` / `sashimiArcsMode` / `showSashimiLabels` / `showSoftClipping` | `plugins/alignments/src/LinearAlignmentsDisplay/{configSchema,model}.ts` |
| Adopters (sentinel): `scatterPointSize` + `lineWidth` (wiggle), `lineWidth` (paired-arc), `scatterPointSize` (Manhattan) | `plugins/wiggle/src/shared/{wiggleConfigSchemaFields.ts,WiggleScoreConfigMixin.ts}`, `plugins/arc/src/LinearPairedArcDisplay/{configSchema,model}.ts`, `plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts` |
| Shared `heightMode` mixin (canvas + alignments) | `plugins/linear-genome-view/src/BaseLinearDisplay/models/{HeightModeMixin.ts,heightMode.ts}` |

Tests: `promotableDefaults.test.ts` (resolver + control builders),
`showSoftClipping.test.ts` (sentinel adopters `showSoftClipping`/`featureHeight`
+ per-preset pins end-to-end),
`colorBy.test.tsx` / `readConnections.test.tsx` / `sashimi.test.ts` (per-row
pins), `DefaultForAllAdornment.test.tsx` (the pin), `OverrideBadge.test.tsx`
(badge), `ShareablePromotedDefaults.test.ts` (the share/export bake +
`ignorePromotedDefaults` round-trip, jbrowse-web).

## The cascade

A config slot marks itself `promotable: true`. `getConf(self, slot)` detects a
promotable slot (per-schema, via `promotableSlotNames`) and routes it through
`resolveSlot`, which walks three tiers:

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

- **Plain** — `defaultValue` doubles as the base *and* the follows-the-default
  signal. Consequence: a track can't customize that one value over an opposite
  promoted default (writing the default reads as "follow the default"), so its
  pin only ever promotes the one base value. **One-directional.** The resolver
  still supports this form (a received-session opt-out test in
  `promotableDefaults.test.ts` exercises it), but **no production slot uses it** —
  every production promotable slot is sentinel. Reach for plain only when no
  control will ever promote the *opposite* of `defaultValue`.

- **Sentinel** (every production slot) — `defaultValue` is a dedicated inherit
  sentinel, and a separate `promotedBase` field holds the value it resolves to
  (the CSS `initial`). Two forms, by slot type:
  - a spare `stringEnum` member — an `'inherit'` choice (the CSS `inherit`
    keyword): `displayMode`/`heightMode`/`linkedReads`/`readConnections`/
    `sashimiArcsMode`, resolving to `'normal'`/`'fixed'`/`'off'`/`'off'`/`'up'`.
  - the `undefined` of a `maybeNumber`/`maybeBoolean` — a number or boolean has
    no spare in-band value for "inherit", so the `maybe*` type spends `undefined`
    on it: `featureHeight`/`scatterPointSize`/`lineWidth` (numbers, e.g.
    `featureHeight` → `7`) and `showSoftClipping`/`mismatchAlpha`/
    `showSashimiLabels`/`displayDirectionalChevrons` (booleans). `colorBy` is the
    `frozen` analogue — a `{ type: 'inherit' }` sentinel resolving to
    `{ type: 'normal' }`.

  Either way **every real value — `promotedBase` included — stays customizable**,
  so a track *can* hold `displayMode: 'normal'` over a `compact` default, or
  `linkedReads: 'off'` over a `normal` (view-as-pairs) default.

Reach for a sentinel when the value users promote is the **non-default** and
they'll plausibly want to opt an individual track back out — the whole point of
`linkedReads`/`readConnections` is to promote pairs/arcs (non-default) as the
default while still letting one track hold `off`. In practice **almost every slot
is a sentinel**: the `maybeNumber`/`maybeBoolean` types make a number/boolean
sentinel free — no tri-state UI, because `getConf` resolves `undefined` to
`promotedBase` and the getter never surfaces it (and `SlotValueFromDef` drops the
sentinel from the read type, so the getter's own annotation stays clean).

## The resolver

Everything routes through one internal function; the exported API is thin
readers of it. Don't re-derive tiers in a consumer — add a field to
`SlotResolution` if you need something new.

```ts
interface SlotResolution {
  base: unknown       // value a following track shows with nothing promoted
  customized: boolean // track holds its own value rather than following the default
  promoted: unknown   // raw session-wide promoted default, if any
  callback: boolean   // track holds a `jexl:` value — see "Callback values" below
  value: unknown      // final cascaded value (never a slot's inherit sentinel)
}

function resolveSlot(self, slot, args = {}): SlotResolution {
  const def = getSlotDefinition(self.configuration, slot)
  const base = def.promotedBase ?? def.defaultValue
  // `promoted` stays the raw session-wide value even for an opted-out display:
  // it's a session-wide fact, and the pin's filled/outline state reports on the
  // session, not on one display's view of it. The opt-out belongs to `inherited`
  const promoted = getSession(self).getDisplayTypeDefault?.(self.type, slot)
  // raw read: this *is* the resolver, so `readConfObject`, not `getConf` (which
  // would recurse back into resolveSlot for a promotable slot)
  const own = readConfObject(self.configuration, slot, args)
  // a track is customized only when it holds a *usable* value other than the
  // default — the same `isUsableValue` gate a promoted default passes, so a
  // malformed or stale own value reads as not-customized and degrades to the
  // inherited value rather than reaching a consumer that trusts every value
  const customized = !deepEqual(own, def.defaultValue) && isUsableValue(def, own)
  // a display that arrived in a received session skips the session-wide tier
  // entirely (see "Received sessions" below), collapsing to "own value, else base"
  const inherited =
    !self.ignorePromotedDefaults && isUsableValue(def, promoted) ? promoted : base
  const value = customized ? own : inherited
  return { base, customized, promoted, callback: false, value }
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

`getConf` on a promotable slot **always returns a real value**, never a slot's
inherit sentinel, so the display getter needs no post-guard — and
`SlotValueFromDef` excludes the sentinel from the read type, so no cast either:
`get displayMode(): DisplayMode { return getConf(self, 'displayMode') }`.

### Callback values (`jexl:`)

A promotable slot can hold a `jexl:` callback like any other slot, and
`getConf(self, slot, args)` forwards its `args` so the callback evaluates with
the caller's context. But a callback returns a **different value per call**, so
it has no single value to compare against the slot default — it can't
meaningfully "follow the default". A `jexl:` value therefore leaves the cascade
at the top: `customized` is true, `callback` is true, and `value` is whatever the
callback returns for this read's `args`.

`value` on that branch evaluates **lazily**, because the cascade's own consumers
(the pin, the badge, the share bake) have no per-feature context to supply and
must not blow up on a track whose slot holds one. They branch on `callback`
instead — `getDisplayTypeDefaultChanges` tests `customized` first,
`tracksDifferingFrom` counts a callback track as differing without evaluating it,
and `resolvePromotableConfigSnapshot` leaves the raw `jexl:` string in the worker
payload for the worker to evaluate per-feature. A **new** consumer reading
`.value` without `args` must do the same.

### Exported API (`@jbrowse/core/configuration`)

An entry is a `{ slot, value }` pair (`PromotableEntry`); most controls take a
group of them so several slots move as one unit.

| Symbol | Returns / does | Drives |
| --- | --- | --- |
| `getConf(self, slot)` | resolved `.value` for a promotable slot (raw read otherwise) | the display's own value getter |
| `resolvePromotableConfigSnapshot(self)` | config snapshot with every promotable slot replaced by its resolved value | the worker payload (see [Worker boundary](#adding-a-promotable-slot)) |
| `makeSlotsValueDisplayTypeDefaultControl(self, entries)` | `DisplayTypeDefaultControl` `{ active, toggle }` — the base builder | a per-value pin over an exact combination of slot values |
| `makeDisplayTypeDefaultControl(self, slot, onValue)` | same, single fixed value | an always-visible pin on one on-value ("make arcs the default") |
| `makeCurrentValueDisplayTypeDefaultControl(self, slots)` | same, over the track's *current* resolved values | "promote whatever I'm showing" for symmetric / continuous settings |
| `getDisplayTypeDefaultChanges(self)` | `TrackConfigChange[]` — promotable slots where a following track's resolved value differs from base | track-selector badge diff |
| `clearPromotedDefaults(self)` | clears every promoted default for this display's type | badge "clear default" |

`DisplayTypeDefaultControl` is `{ active: boolean; toggle: () => void }`.
`active` = this exact value combination is the current default (filled pin);
`toggle` sets or clears it (non-destructive for *other* tracks — following ones
pick it up via `getConf`, customized ones keep their own value). On **set**,
`toggle` also resets **the display the pin was clicked from** to inherit, so it
shows the new default with one click; note that discards that display's own
value, so pin-then-unpin leaves it at `promotedBase`, not at what it held
before. It then raises a snackbar `"Set as the default"` carrying an **"Apply to
N open tracks"** action for any open tracks (across all views) not already
showing this value — the action resets their own value so they follow the new
default; on **clear**, `"Cleared the default"`.

The low-level primitives behind the builders — `isPromotableDefault(self,
entries)`, `setPromotableDefault(self, entries, on)`, `tracksDifferingFrom(self,
entries)`, `resetSlotsToInherit(displays, slots)`, and `isSlotCustomized` — are
**module-internal** (exercised by `promotableDefaults.test.ts`), *not* on the
public barrel. Consume the three `make*Control` builders, not these.

**Which builder?**

- **`makeDisplayTypeDefaultControl` (per-value, fixed)** — the meaning is "make
  *this specific value* the default", independent of the track's current value.
  Use for an always-visible pin so it never promotes a meaningless value, and so
  two toggles sharing one slot (arcs `'arc'` vs read cloud `'cloud'`; sashimi
  `'down'` vs `'auto'`) stay independent.
- **`makeSlotsValueDisplayTypeDefaultControl` (per-value, grouped)** — same, but
  a group of slots moves behind one pin. The base builder the other two delegate
  to; its one current caller is the `colorBy` scheme row. (Feature-height presets
  once grouped `featureHeight` + `featureSpacing` here, but `featureSpacing` is
  now *derived* from `featureHeight` — never a stored slot — so that pin is a
  single-value `makeDisplayTypeDefaultControl` on `featureHeight`.)
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
| Session share / desktop→web export | `bakePromotedDefaultsIntoSnapshot(session, snapshot)` | recipient lacks the sender's local defaults |
| "Export session" → `session.json` (web, react-app) | `bakePromotedDefaultsIntoSnapshot(session, snapshot)` | same: a file handed to someone else |

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

**Badge** (`OverrideBadge.tsx`, track selector): the same pencil that marks a
per-track config edit also shows when the display's
`displayTypeDefaultChanges()` is non-empty — one badge, two reasons, with the
tooltip and the dialog naming the actual source; click opens
`TrackSettingsChangesDialog` with a "clear default" action. Both hooks — the
`displayTypeDefaultChanges()` view (→ `getDisplayTypeDefaultChanges`) and the
`clearDisplayTypeDefaults()` action (→ `clearPromotedDefaults`) — come from
**`PromotableDefaultsMixin`**; compose it and any display gets the badge contract
for free (no per-display passthroughs).

## Adding a promotable slot

1. In the display's config schema, add `promotable: true` to the slot. **Default
   to the sentinel form** — a `maybeNumber`/`maybeBoolean` (whose `undefined` is
   the inherit signal), or a `stringEnum` with a spare `'inherit'` member, plus
   `promotedBase: <realDefault>`. It costs nothing extra and lets a track hold any
   real value — `promotedBase` included — over an opposite promoted default. Only
   skip it (plain slot, where `defaultValue` doubles as the inherit signal) when
   no control will ever promote the *opposite* of `defaultValue`. If the slot's
   *shape* alone can't tell a valid value from a stale one (e.g. a `frozen`
   `colorBy` whose `.type` must name a registered scheme, not just be some
   string), add a `validate: (value) => boolean` hook — it gates both a promoted
   default and a track's own saved value, so a value that's since gone invalid
   degrades to the base instead of reaching a consumer that trusts it.
2. Read it on the display via `getConf(self, slot)` — nothing special. `getConf`
   detects a promotable slot per-schema (`promotableSlotNames`) and routes it
   through the cascade automatically, so an ordinary `get x() { return
   getConf(self, 'x') }` getter starts following the display-type default the
   moment you flip `promotable: true`, and can never surface the inherit sentinel
   (`SlotValueFromDef` also drops the sentinel from the read type, so the getter
   needs no cast). The per-schema detection is why the same slot name can be
   promotable in one schema and plain in another (`colorBy` is promotable on
   alignments, plain on gwas/variants; `featureHeight` promotable on alignments,
   plain on canvas-base; `displayMode` promotable on canvas-base, plain on arc) —
   `getConf` resolves it only where it's marked promotable. `readConfObject` is
   the deliberate **raw** escape hatch — the resolver itself uses it (calling
   `getConf` there would recurse), as does any consumer holding a bare config
   with no session to resolve against. So: `getConf` = resolution-aware entry
   point on a state model; `readConfObject` = raw read.
3. `.compose(PromotableDefaultsMixin(configSchema))` if the display doesn't
   already, so the badge hooks exist. **Every display with a promotable slot
   needs it** — the badge probes the two hooks optionally, so a display that
   skips it silently never badges and offers no "clear default". Current
   composers: canvas base, alignments, wiggle, multi-wiggle, paired-arc,
   Manhattan.
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
