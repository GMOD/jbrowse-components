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

## Vocabulary (the two words that matter)

- **customized** — the track's slot is *set* to a usable value of its own
  (rather than left unset). A customized track ignores the display-type default
  (top of the cascade). `resolveSlot(...).customized` is the flag.
- **pin / promoted default** — the display-type default itself, and the UI
  affordance around it: a trailing `PushPin` toggle (`PinAdornment`) on each
  promotable menu row. A **filled** pin means "this value is the default for all
  tracks of this type"; **outline** means it isn't. **The state is not the
  click** — clicking an outline pin applies the value to the open tracks and
  *offers* the default in a snackbar, so the ordinary way to reach filled is two
  clicks. "Pin" is *not* the track's own value — that's "customized".

## Where it lives

| Concern | File |
| --- | --- |
| Read-time resolver (`resolveSlot`) + the `ResolvableDisplay` shape | `packages/core/src/configuration/promotableResolve.ts` |
| The usable-value gate (`isUsableValue`, `SHAPE_CHECKS`), shared by the resolver and by `ConfigSlot`'s `promotedBase` guard | `packages/core/src/configuration/slotShape.ts` |
| Cached per-schema promotable-slot list (`promotableSlotNames`) | `packages/core/src/configuration/promotableSlots.ts` |
| The raw walker `fullConfSnapshot` and its nested-schema guard | `packages/core/src/configuration/fullConfSnapshot.ts` |
| Resolution-aware reader (`resolveConf`; `getConf` alongside it stays raw) | `packages/core/src/configuration/getConf.ts` |
| Pin builder + share/worker helpers (`makePin`, `getConfigSnapshotWithPromotables`, `getDisplayTypeDefaultChanges`) | `packages/core/src/configuration/promotableDefaults.ts` |
| The "every display on an open track" walk (`openPromotableDisplays`) — not a cascade concern, shared with the share/export bake | `packages/core/src/util/openDisplays.ts` |
| `promotedBase` slot metadata (the promotable marker) + its authoring guards | `packages/core/src/configuration/configurationSlot.ts` |
| Slot-definition inheritance (an override merges over the base slot, so `promotedBase` survives) | `packages/core/src/configuration/configurationSchema.ts` (`mergeSchemaDefinition`) |
| Resolved read type (`SlotValueResolvedFromDef` excludes the sentinel for `promotedBase` slots) | `packages/core/src/configuration/types.ts` |
| Session store (`get/setDisplayTypeDefault`) | `packages/product-core/src/Session/BaseSession.ts` |
| Share/export bake (`bakePromotedDefaultsIntoSnapshot`) | `packages/product-core/src/Session/shareableSnapshot.ts` |
| About "Copy config" flatten (`getTrackConfigWithPromotables`) | `packages/core/src/configuration/promotableDefaults.ts`, consumed in `packages/product-core/src/ui/{AboutDialogContents,HeaderButtons}.tsx` |
| Session/display type surface | `packages/core/src/util/types/index.ts` |
| Track-selector badge | `plugins/data-management/.../tree/OverrideBadge.tsx` |
| Preferences inventory (`getDisplayTypeDefaults`, list + per-row clear) | `packages/product-core/src/{Session/BaseSession.ts,ui/DisplayDefaultsSection.tsx}` |
| The `Pin` interface itself (imports nothing, so `MenuTypes.ts` stays React-free) | `packages/core/src/configuration/promotablePin.ts` |
| Pin adornment + row builders | `packages/core/src/ui/{PinAdornment.tsx,promotableMenuItems.ts,legendMenuItem.ts}` |
| Promotable slider row (`makePromotableSizeMenu`, its lazily-loaded drawn half) | `packages/core/src/ui/{makeSizeMenu.tsx,SizeSliderRow.tsx}` |
| Config-editor view of a promotable slot (`SlotFacade.promotedBase`, consumed by `BooleanEditor` / `JsonEditor` / `StringEnumEditor`) | `packages/core/src/configuration/slotFacade.ts`, `plugins/config/src/ConfigurationEditorWidget/components/` |
| `pin` / `endAdornment` menu-row primitives and the one place they resolve | `packages/core/src/ui/{MenuTypes.ts,menuItemAdornment.tsx,CascadingMenu.tsx,MenuItemTrailing.tsx}` |
| Pin coverage (which promotable slots a built menu offers a pin for) | `packages/core/src/ui/promotablePinCoverage.ts` |
| Adopters — every display that declares or inherits a promotable slot, and the schema file each slot comes from | [Adopters](#adopters), generated |
| Shared `heightMode` mixin (canvas + alignments) | `packages/display-kit/src/{HeightModeMixin.ts,heightMode.ts}` |

Tests: `promotableDefaults.test.ts` (resolver + `makePin`),
`promotedValueCloneable.test.ts` (node env: a resolved value must survive
`postMessage`), `showSoftClipping.test.ts` (adopters
`showSoftClipping`/`featureHeight` + per-preset pins end-to-end),
`colorBy.test.tsx` / `readConnections.test.tsx` / `sashimi.test.ts` (per-row
pins), `PinAdornment.test.tsx` (the pin), `OverrideBadge.test.tsx`
(badge), `ShareablePromotedDefaults.test.ts` (the share/export bake +
the sender-at-base case it deliberately does not cover, jbrowse-web),
`ribbonSettingsCascade.test.ts` (the synteny ribbon slots through a live
display — every tier, the settings checkbox's fan-out write, the init-command
spelling, and the color lane the marker toggle is spent on).

### Adopters

<!-- PROMOTABLE_ADOPTERS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Slot | Falls back to | Declared in | Displays that get it |
| --- | --- | --- | --- |
| `colorBy` | <code>{ type: 'normal' }</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LinearAlignmentsDisplay |
| `colorBy` | <code>{ type: 'strand' }</code> | `plugins/linear-comparative-view/src/LGVSyntenyDisplay/configSchemaF.ts` | LGVSyntenyDisplay |
| `displayDirectionalChevrons` | <code>true</code> | `plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts` | LinearBasicDisplay, LinearVariantDisplay |
| `displayMode` | <code>'normal'</code> | `plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts` | LinearBasicDisplay, LinearVariantDisplay |
| `drawCurves` | <code>false</code> | `plugins/linear-comparative-view/src/LinearSyntenyDisplay/configSchemaF.ts` | LinearSyntenyDisplay |
| `drawLocationMarkers` | <code>false</code> | `plugins/linear-comparative-view/src/LinearSyntenyDisplay/configSchemaF.ts` | LinearSyntenyDisplay |
| `featureHeight` | <code>7</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `heightMode` | <code>'fixed'</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `heightMode` | <code>'fixed'</code> | `plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts` | LinearBasicDisplay, LinearVariantDisplay |
| `hideNonCanonicalJunctions` | <code>false</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `lineWidth` | <code>3</code> | `plugins/arc/src/LinearPairedArcDisplay/configSchema.ts` | LinearPairedArcDisplay |
| `lineWidth` | <code>1</code> | `plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts` | LinearGCContentDisplay, LinearGCContentTrackDisplay, LinearWiggleDisplay |
| `lineWidth` | <code>1</code> | `plugins/wiggle/src/MultiLinearWiggleDisplay/configSchema.ts` | MultiLinearWiggleDisplay |
| `linkedReads` | <code>'off'</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `mismatchAlpha` | <code>false</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `readConnections` | <code>'off'</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `readConnectionsDown` | <code>true</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `sashimiArcsMode` | <code>'up'</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `scatterPointSize` | <code>4</code> | `plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts` | LinearManhattanDisplay |
| `scatterPointSize` | <code>2</code> | `plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts` | LinearGCContentDisplay, LinearGCContentTrackDisplay, LinearWiggleDisplay |
| `scatterPointSize` | <code>2</code> | `plugins/wiggle/src/MultiLinearWiggleDisplay/configSchema.ts` | MultiLinearWiggleDisplay |
| `showLabels` | <code>'auto'</code> | `plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts` | LinearBasicDisplay, LinearVariantDisplay |
| `showLdLegend` | <code>true</code> | `plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts` | LinearManhattanDisplay |
| `showLegend` | <code>false</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `showLegend` | <code>true</code> | `plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts` | LinearBasicDisplay, LinearVariantDisplay |
| `showLegend` | <code>true</code> | `plugins/canvas/src/LinearMultiRowFeatureDisplay/configSchema.ts` | LinearMultiRowFeatureDisplay |
| `showLegend` | <code>false</code> | `plugins/hic/src/LinearHicDisplay/configSchema.ts` | LinearHicDisplay |
| `showLegend` | <code>true</code> | `plugins/maf/src/LinearMafDisplay/configSchema.ts` | LinearMafDisplay |
| `showLegend` | <code>false</code> | `plugins/variants/src/LDDisplay/SharedLDConfigSchema.ts` | LDDisplay, LDTrackDisplay |
| `showLegend` | <code>true</code> | `plugins/variants/src/shared/SharedVariantConfigSchema.ts` | LinearMultiSampleVariantDisplay, LinearMultiSampleVariantMatrixDisplay |
| `showLegend` | <code>true</code> | `plugins/wiggle/src/MultiLinearWiggleDisplay/configSchema.ts` | MultiLinearWiggleDisplay |
| `showSashimiArcs` | <code>true</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `showSashimiLabels` | <code>false</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `showSoftClipping` | <code>false</code> | `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | LGVSyntenyDisplay, LinearAlignmentsDisplay |
| `subfeatureLabels` | <code>'none'</code> | `plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts` | LinearBasicDisplay, LinearVariantDisplay |

<!-- PROMOTABLE_ADOPTERS END -->

Generated by `pnpm autogen` from the schemas, because `baseConfiguration` enrols
displays whose author never opened the file the slot is declared in — the
hand-written version was four rows and went stale the moment anyone added one.
`website/docs/user_guides/display_defaults.md` carries the same slots keyed by
track type, for readers rather than for us. Rows here are keyed by declaration
site instead: a slot inherited through a base schema is one row naming every
display that gets it, and a slot declared separately per display family —
`showLegend` — gets a row per declaration, which is where their `promotedBase`
values visibly disagree.

What the table cannot derive:

- **The canvas slots' pins do not all live where the slots do.** Every one of
  them resolves into the base `rpcProps` worker payload, but `displayMode`,
  `heightMode` and `showLabels` take their rows from the shared `trackMenus.ts`
  while the `subfeatureLabels` / `displayDirectionalChevrons` rows **and their
  `resolveConf` getters** live in the concrete `LinearBasicDisplay/model.ts`.
  That split is right — both are transcript-structure settings, inert on a
  variant track — so don't move them down; see the variant row in
  [the pin table](#promotable-is-a-schema-fact-the-pin-is-a-menu-fact).
- **`showLegend`** has a different `promotedBase` per declaration, each one's
  old `defaultValue` (Hi-C and LD off, the rest on), because the legends are
  different objects. `LGVSyntenyDisplay` inherits the alignments slot and wires
  its own pin. The row itself is one builder — see
  [the `showLegend` note](#showlegend-is-one-row-over-many-schemas-and-one-caller-has-no-slot).
- **The synteny ribbons** (`drawCurves`, `drawLocationMarkers`) are pinned from
  `LinearComparativeView/components/syntenySettingsMenuItems.ts`, and their
  checkbox writes the SLOT — `setDrawCurves` fans the value out over every
  synteny display the view shows, so the cascade is the only mechanism. A
  `LinearSyntenyView` property pair used to sit as a tier above the cascade;
  its first menu write permanently detached the view from any pinned default
  (no affordance wrote the inherit sentinel back), and v5 removed it rather
  than giving it a way home the cascade already had. The authored spellings
  survive as init COMMANDS (`drawCurves` in a spec/URL writes the slot on the
  tracks the init opens); a view-level `drawCurves` in an old saved session is
  dropped. `ribbonSettingsCascade.test.ts` pins the fan-out and the command.

### Promotable is a schema fact; the pin is a menu fact

A slot's `promotedBase` travels down `baseConfiguration` to every subclass,
but the **pin** is built by whichever menu happens to construct a row for
that slot. A display that inherits the slot and curates its own menu therefore
has a promotable slot with **no pin anywhere** — and since a promoted default is
keyed by *display type*, no other display's pin can write it either, so the slot
resolves to `promotedBase` forever unless a track customizes it.

**That menu is not always a track menu.** `LinearSyntenyDisplay` curates none:
the view owns the ribbons, so its `drawCurves` and `drawLocationMarkers` pins sit
on the LinearSyntenyView settings menu (`syntenySettingsMenuItems`), where a
per-track copy of "Curved lines" would be a second answer to a question the view
already asks once. A fixture in the coverage check below therefore carries two
optional hooks — `menuItems` to name the surface the pins are on, and `open` for
a display that `showTrack` on the session's default LGV cannot reach. Letting
either fall back to its default would report those slots as pin-less and grow the
baseline an entry saying so.

**The list lives in one place, and it is not here.** It is
`KNOWN_UNPINNED` in `products/jbrowse-web/src/tests/PromotablePinCoverage.test.ts`,
which opens one display of every type that declares a promotable slot, drives it
through the states that reveal its rows, and diffs the pins it finds against
`promotableSlotNames`. Wiring a missing row makes that test fail, and the fix is
to delete a line from the baseline. This prose table was the previous
arrangement and it drifted twice in the obvious two directions — a row for a
slot that had been deleted, and a missing row for one that had been added — which
is the whole argument for the check. The entries come from `LGVSyntenyDisplay`,
which composes the alignments state model but curates its own menu, and
`LinearVariantDisplay`, which inherits transcript-structure settings that draw
nothing on a VCF feature. The baseline names the slots and says why, per entry; a
second copy here is a copy to drift.

**Its reach is checked too, and that half had no symptom at all.** The
per-display test only reports on the display types `FIXTURES` names, so one
declaring a promotable slot with no fixture was simply not checked and said
nothing about it — six were in that position, every one of them a `showLegend`
arriving through `LegendMixin`. `displayTypesWithPromotableSlots` asks the
registered `DisplayType`s themselves, before anything is opened, and the answer
has to be covered by a fixture or named in `NO_FIXTURE` with the reason (today:
Hi-C and `LDTrackDisplay`, neither of which volvox has a track for). A stale
exemption fails the other way. This matters because `promotedBase` travels down
`baseConfiguration`: giving a shared base schema a promotable slot enrols every
display composing it, including ones whose author never opened that file.

The mechanism the check reads: `Pin` carries the `slot` it
promotes (nothing draws it — the pin renders from `active`/`toggle` alone), so a
built menu can be walked for the slots it offers. A `type: 'custom'` row —
`makePromotableSizeMenu`, the three sliders — draws its own pin and declares
`pin` anyway; `hasMenuItemAdornment` excludes it from the shared
trailing-column reservation, which it could never draw in regardless. Those two
questions look like one and are not; both sites say so.

**The shape to copy when wiring one of these** is `colorBy`, which used to be a
synteny entry: the shared `getColorByMenuItem` already took an optional `pin`
factory, so the wiring was two lines over a schema override that existed only to
give the slot a synteny `promotedBase` (`{type:'strand'}`).
`trackMenuItems.test.ts` pins it at the **call site** — the shared builder's own
test can't, since passing no factory is legitimate for a display whose slot isn't
promotable.

**Dropping `promotedBase` is not the fix for the synteny rows.** Those slots are read
through the *shared* model's `resolveConf` getters, which throw on a
non-promotable slot — making them plain breaks the display outright. Wiring
the missing rows is the only fix, and it is a product decision (new pins on
settings synteny deliberately curated out), not a cleanup.

**Neither is it the fix for the two variant rows, and neither is a pin.** This
file used to say "move the rows + getters down to `baseModel.ts` if that's
wanted"; don't — it would put a "Show chevrons" row on every variant track menu
for a setting that draws nothing there. `promotedBase: undefined` is the tempting other
direction and is also wrong: the base `rpcProps` ships
`getConfigSnapshotWithPromotables(self)`, so a slot that stops being promotable
stops being resolved and reaches the worker as its bare `undefined` sentinel,
against a `renderConfig` that declares `boolean`. Making it a genuinely plain
slot means redeclaring `type` and a concrete `defaultValue` on the variant
schema. Those entries buy nothing today and are recorded rather than fixed.

The generated user-guide table (`writePromotableSlotDocs`) is derived from
`promotedBase`, so it lists the pin-less slots too; its column therefore claims
"settings with a session-wide default", not "with a pin", and the guide says where
the pin actually lives. Nothing static can see a menu row, so don't try to make
that table exact.

A display only reaches that table if it has a `#config` block whose name equals a
`new DisplayType({name})`. The two GC-content displays once had promotable slots,
working pins and no table row, because their annotated block sat on a shared base
nothing registers — a docs-generator rule rather than a cascade one, and
`website/scripts/api-docs/README.md` owns it (`assertSingleHeader`,
`isBaseSchema`).

### Alignments names each pin twice, and that is the price of its menu split

Every other adopter builds a pin where it builds the row — `makePin(self, slot)`
inline, with nothing declared anywhere else. Alignments looks worse: its
`menus/{reads,readConnections,sashimi}.ts` each declare one `Pin` member per slot
on a duck-typed `…Model` interface, and `LinearAlignmentsDisplay/model.ts` exposes
a matching getter to satisfy it — so every one of its pins is named twice.

**Deleting them was tried, and reverted.** The obvious fix is to have those
modules extend `ResolvableDisplay` and call `makePin` themselves, exactly as
canvas, LGV, synteny and `makeSizeMenu` do. It works, and it costs more than it
saves: `makePin` reaches the session through `getSession`, so the *whole* fake in
each of those three menu tests has to become a live MST display under a session
shim. Today they are plain object literals testing menu *structure*, and they
would each become a `PluginManager`-booting integration test to assert the same
thing.

The asymmetry with the other adopters is real but not the same shape: those build
pins in a model file where `self` is in scope, not in a separate module handed a
duck-typed model. The per-slot members are what buys that separation. Two things
do keep the copies honest — the getter and the interface member are both typed, so
a mismatch is a compile error, and `promotableSlotsWithoutPin` catches a slot no
row offers at all.

One genuine sharp edge found on the way: the plain fakes define `toggle()` as a
method that flips `this.active`, which no real `Pin` does (`makePin` closes over
what it needs). So those tests assert against a `Pin` that behaves unlike the
production one — harmless while `MenuItemPin` holds the control by reference, and
the reason flattening that wrapper into `interface MenuItemPin extends Pin` breaks
them. `MenuTypes.ts` says so at the declaration.

### `showLegend` is one row over many schemas, and one caller has no slot

Every other promotable slot is one display's (or one base schema's).
`showLegend` is declared once per display family that has a legend — alignments
(LGVSynteny inherits it), Hi-C, multi-row features, multi-wiggle, the
multi-sample variant displays via their shared schema, and LD via its own shared
one; [Adopters](#adopters) is the current set, and restating it here is what
went stale twice. The **schemas stay separate**: a Hi-C color ramp and a variant
genotype key are different objects with different right answers for
on-by-default, which is why each `promotedBase` is that display's old
`defaultValue` rather than a shared constant.

What is shared is the **row**. `showLegendCheckboxItem` takes an optional `pin`
and builds through `promotableToggleItem` when given one, `checkboxItem`
otherwise — the same "plus a pin" relationship every builder in
`promotableMenuItems.ts` has, so the promotable and plain forms of "Show legend"
cannot drift in label, help text or disabled state.

The optional `pin` is now down to **one** caller with nothing to promote:
`LinearBasicDisplay`'s color key is a per-legend `dismissed` flag on the legend
object, not config at all, so there is no slot for a pin to name. That is not a
promotable-slot gap to close by adding a pin — closing it means first deciding
the setting should be config, which is a product question about that display,
not a cascade one.

`LinearManhattanDisplay` was the other, and it is the worked example of making
that decision. Its `showLdLegend` was a **volatile**, sitting with
`featureUnderMouse` and `rpcDataMap` while being a track-menu setting — so it
reset on every retick, and no config or session could set it. It is now a
`maybeBoolean` slot with `promotedBase: true` (the volatile's old initial
value, so an untouched track is unchanged) and carries a pin. The name stayed
`showLdLegend` rather than joining the `showLegend` family: it labels the r²
ramp specifically, and the display could grow a second key wanting its own
switch.

**A volatile is the thing to look for when a "Show ..." row has no pin.** The
alignments doctrine — display options are config slots, volatiles are for
hover/selection/scroll — puts every such row on the config side, so a volatile
one is usually a slot that was never made.

All but Hi-C are in `PromotablePinCoverage.test.ts`'s fixtures. Three needed
care to be checked at all: multi-wiggle's row is gated on
`overlayLegendApplies`, which wants an overlay rendering **and** sources, and
sources arrive with data the test never fetches — hence a fixture state that
seeds them. Multi-row features gates its row on having a legend at all, so its
fixture states a `legend` in the display snapshot — the slot `colorLegend` reads
before it derives anything from data. Manhattan's row is
`disabled` without LD coloring but still built and still pinned, which is what
lets the walk (which runs in the default `colorBy: 'normal'` state) find it;
gating the row out entirely would have hidden the pin. Hi-C needs a `HicTrack`
and volvox has no `.hic` file, so it is in that file's `NO_FIXTURE` — see
[the reach check](#promotable-is-a-schema-fact-the-pin-is-a-menu-fact).

## The cascade

A config slot declares a `promotedBase`, and the display's value getter
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
- **The promoted value lives in the session, not the track.** So *promoting* a
  value doesn't rewrite any track's config — tracks that follow the default just
  resolve differently on their next read. The pin's own click does rewrite them,
  which is a separate write and the reason the two are separate clicks.

**Objects are shared, and frozen.** A resolved value is handed out **by
reference**: `promotedBase` is the schema's own literal, so every track sitting at
base reads the same object, and a promoted default is handed straight back out of
the preference store to every follower. That is deliberate — `===` stability is
what lets a display's cached computed re-resolve without waking anything
downstream — so both sources freeze the value instead (`freezeDeep`, called from
`ConfigSlot` and from `setPreferenceOverride`/the localStorage restore). An
in-place edit of a resolved value throws rather than silently rewriting what every
other track reads, and for `promotedBase` what every *later session* reads too,
since that object belongs to the schema. Two consequences: declare `promotedBase`
as its own literal rather than a reference to an object other code mutates, and
build a modified value by copying (`{...colorBy, type}`), never by assignment.
Canaries: `promotedValueCloneable.test.ts`, `sessionModelFactory.test.ts`
("freezes an object-valued promoted default").

**Objects compare structurally.** `customized` needs no comparison at all — the
sentinel is `undefined`, so "holds a usable value" is the whole test. But every
comparison *against the promoted value* (`isPromotableDefault` for the pin's
filled state, `applySlotToOpenTracks`'s already-holds-it check) uses `deepEqual`, not
`===`: a naive `!==` would read every object slot as permanently differing (a
fresh MST-reconstructed value is never `===` its stored twin), so the pin would
never light up. `colorBy` (a `maybeFrozen` `{ type: ... }` slot) is promotable on
the strength of this path; a new object/array slot needs nothing extra.

### The inherit sentinel

**Being unset is the sentinel.** Every promotable slot is a `maybe*` type — so
`undefined` is the CSS `inherit` keyword — and declares `promotedBase` for what
that resolves to (the CSS `initial`). **Declaring `promotedBase` is also the only
thing that marks a slot promotable**, so there is one field, one form, and
nothing to choose. `ConfigSlot` throws unless the type is a `maybe*` and
`defaultValue` is `undefined`:

- `maybeNumber` — `featureHeight`/`scatterPointSize`/`lineWidth` (e.g.
  `featureHeight` → `7`).
- `maybeBoolean` — `showSoftClipping`/`mismatchAlpha`/`showSashimiLabels`/`hideNonCanonicalJunctions`/
  `displayDirectionalChevrons`.
- `maybeStringEnum` — `displayMode`/`heightMode`/`showLabels`/
  `subfeatureLabels`/`linkedReads`/`readConnections`/`sashimiArcsMode`,
  resolving to `'normal'`/`'fixed'`/`'auto'`/`'none'`/`'off'`/`'off'`/`'up'`.
  The author writes the plain enumeration (`['fixed','grow','fit']`) and
  `ConfigSlot` wraps it in `types.maybe`.
- `maybeFrozen` — the object-valued case: `colorBy`, resolving to
  `{ type: 'normal' }`.

A subclass turns an inherited promotable slot back into a plain one by stating
`promotedBase: undefined`; `mergeSchemaDefinition` is a spread, so a stated
`undefined` overwrites the base's value where an omitted key would inherit it.

**A preset that turns itself OFF must unset a promotable slot, never write what
it thinks the default is.** The two are indistinguishable when you read the slot
back and different in every session afterwards: the write pins the track, so a
session-wide default stops reaching it for good. `SV_CHANNELS_OFF` wrote
`readConnectionsDown: false` against a `promotedBase` of `true` and flipped
every track that used it onto the wrong side of the coverage band; it wrote
`readConnections: 'off'` against a `promotedBase` of `'off'`, which looks like a
no-op and quietly opted the track out of a promoted `'arc'`.

That also means a preset's write shape is wider than its read shape — the getter
always resolves, only the setter takes `undefined` — so a preset typed as "the
settings I compare against" cannot express leaving at all. Split the two
(`SvChannelsWrite` vs `SvChannelsSettings`) rather than widening the getter.
And a slot the preset does not READ is one it must not WRITE: writing one the
active-check ignores is the two halves disagreeing, and the user sees it as a
setting that reverts itself.

**There was a separate `promotable: true` flag and it is gone.** It carried no
information `promotedBase` didn't, and keeping the two in agreement cost two
`ConfigSlot` throws — "promotable with no base", and the mirror mistake of a base
on a slot that never said promotable — plus a line in all 19 declarations. The
argument that settles it is that the *type* layer never read the flag and could
not: `SlotValueResolvedFromDef` maps a subclass's literal definition, while a
boolean left to be inherited arrives only through the runtime merge, so
`promotedBase` was already the marker on that side. Deleting the flag made the
two layers read the same field, and the throws describe states no schema can now
express. The one place this needs care is `SlotValueResolvedFromDef`'s first
branch: `{ promotedBase: undefined }` satisfies `{ promotedBase: unknown }`, so
the off-switch has to be matched *before* the promotable case or tsc promises a
resolved value for a slot `resolveConf` now refuses (canary:
`configTypeNarrowing.test.ts`, checked by `pnpm typecheck`).

It costs nothing at the read site: `resolveConf` resolves `undefined` to
`promotedBase` and the getter never surfaces it (and `SlotValueResolvedFromDef`
drops `undefined` from the read type, so the getter's own annotation stays
clean).

**Why the sentinel is mandatory, why it isn't a spare `'inherit'` enum member,
why `defaultValue` may not double as it, and why the mirror mistake throws:**
[ADR-047](../architecture-decision-records/adr-047-undefined-is-the-only-inherit-sentinel.md).

## The resolver

Everything routes through one internal function; the exported API is thin
readers of it. Don't re-derive tiers in a consumer — add a field to
`SlotResolution` if you need something new.

```ts
interface SlotResolution {
  base: unknown       // the slot's promotedBase (CSS `initial`)
  promoted: unknown   // the raw session-wide promoted default, if any
  customized: boolean // track holds its own value rather than following the default
  inherited: boolean  // value came from the session tier, and moves the track off `base`
  value: unknown      // final cascaded value (never the unset sentinel)
}
```

`resolveSlotIn` in `promotableResolve.ts` is the whole of it — about fifteen
lines. **Read it there rather than a copy here**: this section used to carry a
transcription of the function body and had silently drifted from it, which is the
failure a second copy invites. Its three non-obvious invariants are commented at
the lines that implement them — `promoted` stays raw even for an opted-out
display, a track's own value passes the same `isUsableValue` gate as a promoted
default, and there is deliberately no callback case
([No callbacks](#no-callbacks-jexl)).

### What a display has to be

One shape: **`ResolvableDisplay`** — `IStateTreeNode` + `type` +
`configuration` (`IStateTreeNode`, never `IAnyStateTreeNode`: the latter
resolves through `STNValue<any, …>` to `any` and would turn off checking for the
two members this interface exists to declare — see the repo `CLAUDE.md`).
Everything the cascade needs, and what **every public entry
point takes**: `resolveConf`, `makePin`, `isSlotCustomized`,
`getConfigSnapshotWithPromotables`, `getDisplayTypeDefaultChanges` and
`clearPromotedDefaults`.

There is deliberately no write-capable variant. A `PromotableDisplay` used to
exist for the single member the subsystem wrote — `setIgnorePromotedDefaults` —
and collapsed into this one when that flag was removed; the subsystem's only
write to a display is now a config slot, reached through `configuration`.

Asking for the display node rather than a bare `{ configuration }` is what keeps
`resolveConf` **cast-free** — hand it a config holder and tsc names the missing
members instead of the read failing at runtime with
`getDisplayTypeDefault(undefined, slot)`. Keeping the shape to two members is
what keeps that affordable: a mixin or test double doesn't have to fake anything
it never calls. An MST mixin whose own `self` is an empty model
still casts (`confNode(self)` in `HeightModeMixin` / `WiggleScoreConfigMixin`) —
that's the mixin not seeing props the concrete display declares, and the cast
target names exactly what the cascade reads.

`isUsableValue` (`slotShape.ts`) is the single gate **both** tiers pass a
candidate through — a promoted default and a track's own saved value —
composing four checks: set at all, not a raw `jexl:` string
([No callbacks](#no-callbacks-jexl)), JS shape fits the slot (`SHAPE_CHECKS`: a
`maybeStringEnum` choice, a *finite* `maybeNumber`, else `promotedBase`'s
object/array kind or `typeof`), and the slot's optional semantic `validate`
hook. **`ConfigSlot` runs the same gate over `promotedBase` at construction**,
so the tier every other tier falls back to can't itself be unusable — a base
outside the slot's own vocabulary would otherwise be returned by every read with
nothing thrown anywhere. A value failing any check is dropped so the getter, the
pin, and the badge all fall back in lockstep — no consumer guards on its own.
`colorBy` uses `validate` so a
`.type` naming a since-removed color scheme — customized or promoted — degrades
to the base instead of reaching the total `COLOR_SCHEMES` lookups that throw on
an unregistered type.

**`makePin` runs the same gate over a caller-supplied on-value**, and throws —
the third place the gate is applied ahead of time rather than at read. A pin over
a value the cascade would refuse is inert *and* silent in both directions: the
toggle writes a store key `resolveSlotIn` then drops, so no track moves, while
`isPromotableDefault` compares the *raw* stored value, so the pin draws outline
forever with a dead key left in the user's localStorage. Passing the inherit
sentinel explicitly (`makePin(self, slot, undefined)`) fails the other way — with
nothing promoted it compares `undefined` to `undefined` and draws **filled**,
a pin that claims to be the current default and clears nothing. Every in-tree
caller passes a literal option value or a hand-guarded one (`tagItem` in the
alignments colorBy menu, which is the discipline this makes checkable), so the
throw only fires on an authoring mistake. The value-*omitted* form can't trip it:
the cascade only ever settles on a usable value.

One consequence is worth knowing rather than fixing. A promoted default that
fails the gate goes *invisible* in the track UI: `isPromotableDefault` compares
the raw stored value, so no row's pin fills (an unregistered scheme has no row at
all), and every track resolves to base so `getDisplayTypeDefaultChanges` is empty
and no badge appears. Preferences → "Display defaults" lists and clears it, which
is the intended escape hatch — the alternative, deleting the key from inside
`resolveSlot`, would mean writing observable state from a MobX computed.

`resolveConf` on a promotable slot **always returns a real value**, never the
unset sentinel, so the display getter needs no post-guard — and its read type
excludes `undefined`, so no cast either:
`get displayMode(): DisplayMode { return resolveConf(self, 'displayMode') }`.

### No callbacks (`jexl:`)

**A promotable slot cannot hold a `jexl:` callback**, and `resolveConf` takes no
`args` because there is no per-feature context to supply. The two ideas are
opposites: a promoted default is *one value shared by every track of a display
type*, while a callback computes a *different value per feature*. A callback
therefore has nothing to compare against the default and can't meaningfully
"follow" one.

That isn't only a design statement — it's the state of the code. The config
editor offers its callback toggle **only on a slot declaring
`contextVariable`**, and none of the promotable slots does, so no supported path
can author one. The single remaining way in is a hand-edited `config.json`, and
`isUsableValue` refuses it there: the slot reads as *not customized* and degrades
to the inherited value, in lockstep with every other unusable value. No consumer
branches, and `SlotResolution.value` is always readable.

This replaced a discriminated union whose callback arm carried `evaluate()`, a
`disabled` state on the pin control, a greyed pin with its own
tooltip and live-wrapper `<span>`, and a branch in four consumers — all for a
state nothing could author and which was already degenerate wherever it did
appear (the pin disabled itself, the badge couldn't report it, and the snackbar
count read it as permanently differing). If a promotable slot
ever genuinely needs per-feature values, that is a sign the setting belongs on a
plain slot, not that the union should come back.

### Exported API (`@jbrowse/core/configuration`)

Every control is over **one slot and one value**. There is no grouped form: a
pin that moved several slots at once existed while feature-height presets
promoted `featureHeight` + `featureSpacing` together, but `featureSpacing` is now
*derived* from `featureHeight` and never stored, so every adopter promotes
exactly one slot. Reintroduce the group only alongside a real multi-slot pin.

| Symbol | Returns / does | Drives |
| --- | --- | --- |
| `resolveConf(self, slot)` | the cascaded `.value`; throws on a non-promotable slot. Takes a `ResolvableDisplay`, so a bare `{ configuration }` is a compile error | the display's own value getter |
| `getConfigSnapshotWithPromotables(self)` | config snapshot with every promotable slot replaced by its resolved value | the worker payload (see [Worker boundary](#adding-a-promotable-slot)) |
| `makePin(self, slot, onValue)` | `Pin` `{ slot, onValue, active, toggle }` on one fixed value — "make arcs the default", independent of what the track shows, so two rows sharing a slot (arcs `'arc'` vs cloud `'cloud'`) stay independent | an always-visible per-value pin |
| `makePin(self, slot)` — value omitted | same, over the track's *current* resolved value | a continuous setting with no sensible fixed on-value (wiggle point size, arc line width) |
| `makeTogglePin(self, slot)` | `Pin` whose `active` mirrors the row's checked state and whose click flips it on every open track, offering the new state as the default. Throws on a slot that does not resolve to a boolean | every checkbox row over a plain `maybeBoolean` slot |
| `getDisplayTypeDefaultChanges(self)` | `TrackConfigChange[]` — promotable slots where a following track's resolved value differs from base | track-selector badge diff |
| `clearPromotedDefaults(self, slots)` | clears the named promoted defaults for this display's type | badge "clear session default", which passes the slots it listed |
| `isSlotCustomized(self, slot)` | whether the track holds its own value rather than following the default | a slider row's "reset to default" enablement (wiggle point size, arc line width) |
| `getTrackConfigWithPromotables(session, trackConfig)` | a whole track's config snapshot with every display's promotable slots resolved, plus the `<displayType>.<slot>` list of what came from a session default. Takes a config, not a display — no open track required | the About dialog's "Copy config" (see [Serialization boundaries](#serialization-boundaries-getcomputedstyle)) |

`Pin` is `{ slot: string; onValue: unknown; active: boolean; toggle: () => void }`.
`active` = this value is the current session default (filled pin), which is the
*state*, not what clicking does. There is no disabled state — a pin always has a
value to apply (see [No callbacks](#no-callbacks-jexl)).

**`toggle` on an outline pin writes every open track of the display type** —
`applySlotToOpenTracks` over `openTracksOfType` — and raises
`"Applied to N open tracks"` carrying one action, **"Set as the default"**,
which stores the display-type default and touches nothing else. **`toggle` on a
filled pin clears that default and writes no track**: `"Cleared the default"`,
no action. A default therefore costs two deliberate clicks, which suits how long
it lives — it outlives the tracks it was set for and governs every track of the
type opened later.

**One apply, not an override/apply pair.** The snackbar used to carry two
actions over two different track sets — "Override N customized tracks" (clear
the own values of tracks that *resolve* to something else) and "Apply to N open
tracks instead" (write every open track, reading the *stored* value). The
distinction is real in the code and invisible to the user, who has one intention
and no reason to know that a follower and a customized track need opposite
writes to reach it. Overwriting a customized track is the same write as filling
in a follower, so `applySlotToOpenTracks` covers both.

**It reads the stored value, and has to.** A follower holds nothing of its own
and is showing the value only by way of whatever default is in place, so
skipping it would leave it free to move again the next time that default
changed. Reading the stored value is also what lets a `jexl:` slot answer "is
this already what we would write?" without being evaluated — this caller has no
feature context.

**"Set as the default" does not then clear what the click applied.** The open
tracks keep the values just written, so they are customized and a later default
change will not reach them. Clearing them would be a second bulk write, and it
would make the following "clear the default" click visibly revert every open
track to `promotedBase` — a bulk discard out of the one remaining toggle. In
practice it costs nothing: the pin overwrites open tracks on every click.

**Unsetting a promotable slot is a removal, and a `trackConfigDeltas` track
could not keep one.** `diffTrackConfig` records adds and changes but never
deletions — so unsetting a slot an admin `config.json` declares diffs to
*nothing*, exactly as netting back to the base does. `updateTrackConfiguration`
read that as an implicit reset, cleared the delta, and reverted the track's
working copy to the base, undoing the edit 400ms after the user watched it land.
It now keeps the working copy when the update came from that working copy itself
(the config editor, which edits a separate temporary node, still needs the
revert). The removal still doesn't survive a reload — that is
`trackConfigDelta.ts`'s stated no-tombstones limitation, not this subsystem's.
The pin no longer unsets anything, so the reachable caller is the slider rows'
reset; `PromotedDefaultApply.test.ts` is the canary.

**N counts tracks, and `openTracksOfType` dedupes to make that true.** The walk
yields *displays*, and one track open in two views is two of them over one config
node (`TrackConfigurationReference` resolves both through the hydration cache) —
so the count read `2` for a single track, which is the ordinary case in a
breakpoint-split view. The label's number and the number of tracks written come
from that one deduped walk and cannot disagree. It is **seeded with the clicked
display**, so the track the pin was clicked from is in the set by construction
rather than by the walk happening to reach it — a display the walk missed used to
cost nothing and would now be the whole of the click.
`promotableDefaults.test.ts`'s own fakes compose a fresh config into each display
and cannot express the dedup case; the canary is `PromotedDefaultApply.test.ts`
in jbrowse-web.

That the click applies and the snackbar promotes, that the override/apply pair
collapsed into one write, and that the promotion closes over the display *type*
and no decision — so it still lands if the clicked track is closed while the
snackbar is up — are all
[ADR-048](../architecture-decision-records/adr-048-the-pin-applies-then-offers-the-default.md).
It also records what the reversal gave up — the pin is no longer symmetric.
Read it before making the pin do more.

`slots` is **required**, and the all-slots form it replaced was a hazard rather
than a convenience: it reached further than any list a dialog can have shown, so
clearing from the badge could move sibling tracks over a slot the dialog never
listed. Clearing every promoted default at once is a preferences-scope action,
and Preferences → "Reset to defaults" is where it lives.

The low-level primitives behind the builders —
`isPromotableDefault(self, slot, value)`, `openTracksOfType(self)`, and
`applySlotToOpenTracks(displays, slot, value)` — are **module-internal**
(exercised by `promotableDefaults.test.ts`), *not* on the public barrel. Consume
the two `makePin`, not these.

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
without that mixin resolve admin-only. Both are **required** methods on
`AbstractSessionModel`, alongside the rest of the preference store
(`setPreferenceOverride` / `clearPreferenceOverrides` / `setScrollZoom`):
`BaseSessionModel` declares them, so every product session has them, and each
product's `AssertSessionModel<…>` turns a member drifting out of that set into a
build error. So the resolver and the control builders call them plainly, with no
`?.` (what dropping it exposed:
[Historical note](#historical-note)). `preferencesOverrides` is
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
| Worker RPC payload | `getConfigSnapshotWithPromotables(display)` | worker has no session/`preferencesOverrides` to resolve against |
| Session share / "Export session" → `session.json` (web, react-app) | `getShareableSessionSnapshot(session)` | recipient lacks the sender's local defaults |
| desktop→web export | `bakePromotedDefaultsIntoSnapshot(session, plan.session)` | same, but bakes a snapshot `planWebExport` already transformed |
| About dialog → "Copy config" | `getTrackConfigWithPromotables(session, trackConfig)` | the output is pasted into a `config.json`, which has no cascade at all |

**Local persistence is deliberately *not* on that list** — web autosave
(`SessionLoader`), HMR restore, and desktop's native `.jbrowse` file
(`getSaveSession` in `products/jbrowse-desktop/src/rootModel/rootModel.ts`) all
use a raw `getSnapshot(session)`, correctly: the same browser still has the
`preferencesOverrides` the cascade resolves against, and baking would freeze
today's resolved values into the user's *own* reloaded session, so later changing
a promoted default would no longer move the tracks that were following it.
The consequence to know: hand-passing a `.jbrowse` file to someone else is the
one path that loses the sender's promoted defaults, since it's a save format, not
an export. `ExportToWebDialog` is the desktop route that bakes.

**Two of those three rows are enforced, not remembered.** The raw walker
(`fullConfSnapshot`) is **off the `@jbrowse/core/configuration` barrel**, so
`getConfigSnapshotWithPromotables` is the only snapshot importable at all and the
worker row can't be got wrong by writing the obvious thing in a new `rpcProps()`
— the mistake doesn't resolve rather than throwing at the first fetch. (It used
to be public as `getConfSnapshot` and defend itself by throwing; unreachable
beats guarded.) What no import can express is still checked at runtime: the
walker refuses a promotable slot declared in a *nested* schema, because the
cascade only ever walks a config's own top-level slot table, so a nested one
would resolve nowhere and serialize as its bare sentinel. And
`getShareableSessionSnapshot(session)` does the snapshot and the bake in one
call, so the pair can't be split: a bare `getSnapshot(session)` is never a
correct outgoing snapshot.

`bakePromotedDefaultsIntoSnapshot` (`shareableSnapshot.ts`, wired into
jbrowse-web `ShareDialog` and jbrowse-desktop `ExportToWebDialog`) returns a deep
copy of the snapshot in which, for every **open** display:

- each slot it *inherits* from a promoted default (`getDisplayTypeDefaultChanges`
  — non-customized, differs from base) is written into the track config layer:
  the track's own config when it has one (a user-added `sessionTracks` entry, or
  an opened connection track's `connectionTrackConfigs` config), else a
  `trackConfigDeltas` entry against the admin base. The connection case is not
  cosmetic — deltas are merged over `jbrowse.tracks` alone, so a delta written
  for a connection track resolves nowhere, and the recipient renders the base
  value. Only
  genuinely-inherited non-base values are baked — customized slots already live
  in the config, at-base slots need nothing — so no spurious "edited" badge
  appears on the recipient side for an untouched slot.

Tracks the sender never opened carry no display state to resolve, so they're
left to pick up the recipient's own defaults when opened — matching "export the
actual state of the *open* tracks".

`openPromotableDisplays` recurses into a composite view's **`views` array**
(breakpoint-split, the linear-comparative / synteny family), which holds child
views rather than tracks of its own — `LGVSyntenyDisplay` is only reachable that
way. It is now the **only** walk that decides reach, which is the point: there
used to be a second, shape-aware one stamping `ignorePromotedDefaults`, it had to
be kept in step by hand, and a composite view it forgot got its values baked but
not the flag.

A view holding its children under *named props* instead
(`SvInspectorView.circularView`) is **not** reached. Enumerating a view's own
properties to find them is not an option — reading every key of an MST node
invokes every computed view on it, and several throw before the view is
initialized. Nothing is missed today (no display under those views declares a
promotable slot); if one ever does, give that view a `views` getter returning its
children rather than duck-typing harder in `hasChildViews`.

### Received sessions

**Baked values are the whole mechanism, and they are sufficient for every case
that has a value.** A baked value lands in the track's config layer, so the
recipient reads it as *customized* — the top of the cascade — and their own
promoted defaults are never consulted for that slot. Nothing is written to the
display node.

There is exactly one case the bake cannot cover: **the sender was sitting at
`base`.** Nothing gets baked (the value equals base, and `stripDefault` drops it
from the snapshot regardless), so a recipient who has promoted something else
resolves it from their own cascade and sees their value. No value can express "I
deliberately saw the default" — at-base and unset are byte-identical once
stripped, which is the same property that makes the sentinel design work.

**That case is accepted, and reopening it means re-adding a flag.** It used to be
covered by an `ignorePromotedDefaults` `#property` on `BaseDisplay` that made
`resolveSlot` skip the session tier, stamped onto every open display by a second
snapshot walk (`markIgnorePromotedDefaults`). Three reasons it went:

- the second walk had to be kept in step with `openPromotableDisplays` by hand,
  and a composite view it forgot got its values baked but not the flag — the half
  that silently loses;
- the flag was per *display*, not per slot, and permanent, so a recipient who had
  promoted something found their own pins doing nothing to received tracks until
  they clicked "use this default" on each;
- a promoted default is a personal, local preference, and the only one the bake
  touched. A shared session has never carried the sender's theme
  (`sessionThemeName` is `.volatile()` and `shareableSnapshot.ts` doesn't mention
  it), and a read height is a smaller imposition than a theme.

Canary for the accepted behavior: the two paired tests in
`ShareablePromotedDefaults.test.ts` — a sender at base picks up the recipient's
default, and a baked value cannot be overridden by one.

The About-track dialog splits the two halves: its *attributes table* hides the
`displays` array outright, so there is no fidelity gap to close there, but
**"Copy config" copies the whole track config, displays included**, and that
output is pasted into a `config.json` — a context with no cascade at all. So it
flattens through `getTrackConfigWithPromotables`, and it is the one boundary that
writes **every** promotable slot rather than only the inherited ones (the
function's own doc comment has the argument, and says not to "align" it with the
share bake). `fromDisplayTypeDefaults` is what lets `HeaderButtons` say out loud
that a session-wide preference was folded in.

That resolution runs off the display **config** nodes, not open display state —
a track the user never opened still has an answer, by the same code path. It
briefly looked up the open display first; that was left over from
`ignorePromotedDefaults`, which lived on the display node. With the flag gone the
lookup produced an identical context every time (same config node via the
hydration cache, same `type`, same session) and was deleted. Don't reintroduce
it.

## UI surface

Every promotable setting renders **one row per value**, and every such row
carries the same trailing pin. There is no separate "apply to all tracks" or
"make default" row anymore; the pin *is* that affordance, and it lives beside
the value control on the same row. Pins are **always shown** (discoverable) and
their content `stopPropagation`s so a click applies the value across the open
tracks without toggling the row value or dismissing the menu.

**A row declares a pin; it does not render one.** `BaseMenuItem` has two
trailing-content fields and they are not interchangeable:

- **`pin: MenuItemPin`** — `{ control: Pin, label: string }`, a *description*.
  `menuItemAdornment.tsx` turns it into `PinAdornment` (`PushPin`
  `ToggleButton`) at the point the menu is drawn. This is the field every
  promotable builder sets, and the only one `pinnedSlots` counts — a pin is
  findable precisely because `Pin` carries the `slot` it promotes.
- **`endAdornment: React.ReactNode`** — an already-built element, the escape
  hatch for content nothing else can describe (synteny's colour swatch, the
  wiggle colour dot). It is **deliberately not counted** by `pinnedSlots`: an
  arbitrary element cannot say which slot it promotes, so a pin written this way
  is a thing to find, not to accept.

Setting `endAdornment` where `pin` was meant is therefore silent in exactly the
way the coverage check exists to catch, and it also costs the eager bundle: a
menu builder is called from state models and menu modules, so constructing the
element there puts MUI's `ToggleButton`, `Tooltip` and two icons into every
host's first paint (reference/EAGER_BUNDLE.md; `menuItems.purity.test.ts` holds
the line). `menuItemAdornment` resolves the two — `endAdornment` first, then
`pin` — in one place, so the "does any row draw one?" predicate
(`hasMenuItemAdornment`) and the rendering cannot disagree.
`MenuItemTrailing` draws whichever it gets in a fixed-width column, reserved on
every row when any row has one, so value checks stay column-aligned and pins
right-align in their own column.

**A pin's `active` and `onValue` are captured when the menu is built, so the
surface has to hand `CascadingMenu` a getter and not an array.** Nothing in
`Pin` is observable — `PinAdornment` reads two plain fields — and the pin stays
live only because `CascadingMenu` is an `observer` that calls a
`MenuItemsGetter` inside its own render, and building a pin reads the slot
(`resolveSlot`) and the promoted default. A menu passed as a plain `MenuItem[]`
built outside an observer therefore draws a frozen pin: it keeps the
filled/outline state and the on-value it had at build time, so a click applies a
stale value and a filled pin fails to clear. Every pin surface today passes a
getter — the track menu (`TrackLabelMenu`'s `getMenuItems`) and the synteny
settings menu, which is a function for the coverage check's sake anyway.

The row builders in `promotableMenuItems.ts`:

Each is its plain counterpart in `toggleMenuItems.ts` **plus a pin**, and is
built that way rather than as a second literal, so the promotable and plain forms
of a row can only differ by the pin:

- **`promotableToggleItem`** — a `type:'checkbox'` row (native
  hover/sizing/keyboard) for a flat boolean setting (`showSoftClipping`,
  `readConnectionsDown`, `showSashimiLabels`). The checkbox toggles the track's
  value; the pin is **that same checkbox over every open track of the type** —
  `makeTogglePin(self, slot)` for a plain `maybeBoolean` slot. Its fill mirrors
  the row, a click flips the row's state on every open track, and the snackbar
  offers the new state as the default. It never clears a default: flipping
  back and taking the offer promotes the other value, and a promoted base value
  is indistinguishable from none. The value pins' "filled means promoted, click
  to clear" reading is what these rows dropped — a symmetric value-omitted
  `makePin` carried the row's current state, so the pin beside an *unchecked*
  box, which reads as "turn this on everywhere", applied *off* to every open
  track and changed nothing on screen. The per-value `makePin` form is for the
  checkbox rows that *share* a multi-valued slot and each stand for one of its
  values: `readConnections` is one slot behind an "Arcs" row pinning `'arc'` and
  a "Read cloud" row pinning `'cloud'`, which stay independent only because
  each names its own on-value. Row built by `checkboxItem`, so it offers
  that builder's full option set (`subLabel`, `disabled`, `disabledHelpText`, …);
  it used to drop three of them.
- **`promotableRadioItems`** — a whole `type:'radio'` group over a multi-value
  slot, and **the one to reach for**: `radioItems` plus one pin per option, with
  the pin supplied as a factory `value => makePin(self, slot, value)` so it
  cannot be a row short. **Every option in a group gets a pin, the `promotedBase`
  value included** — once a non-base value is promoted, pinning the base back is
  the only per-value way to undo it from its own row, and a radio group with one
  row silently missing its trailing control reads as a bug. Building the group in
  one call is what makes that structural rather than a rule to follow;
  `sashimiArcsMode`'s base looked unpinnable precisely because the rows had been
  named by hand. The five groups on it: `heightMode`, `displayMode`,
  `showLabels`, `subfeatureLabels`, `sashimiArcsMode`. Canvas reaches it through
  `inlineRadioGroup`, which is `subHeader` + this — its `pin` factory is
  required, since a group with one caller and an optional pin is the row that
  goes missing.
- **`promotableRadioItem`** — one row, the escape hatch for a group the plural
  form can't express. Three cases have it: a row with no single value to promote
  yet (the colorBy "Tag..." row before a tag is picked), a display whose slot
  isn't promotable at all (the shared colorBy menu on gwas/variants) — `pin` is
  optional for both — and the alignments size presets, whose group is gated row
  by row (`needsContent`) and mixes in a non-promotable "Custom..." peer.

Selecting a value **customizes** the track to it (`promotedBase` included), and
**no radio or checkbox group offers a "follow default" row** — picking a value
customizes, leaving the group untouched follows the default. Don't add one
reflexively; it's a fourth control on an already-busy row for a state the user
reaches by not clicking.

The three **slider** rows (wiggle point size — shared with the GWAS Manhattan
plot — and wiggle/arc line width) do have one,
because a slider has no "untouched" position to leave alone: the reset button is
enabled off `isSlotCustomized` and writes `undefined`. That reset is the only
path left that *unsets* a promotable slot — the pin overwrites rather than
clears — so it carries the `trackConfigDeltas` removal hazard on its own. When a
value-group track is customized and the user wants it back on the cascade, the
path is the track-selector badge's "Reset to default", which drops the whole
`trackConfigDeltas` entry.

**Disabled-not-hidden for dependent options:** options that only apply once a
parent toggle is on (the arc/read-cloud band submenu, arc coloring) stay present
but `disabled` with a `disabledHelpText`, rather than vanishing — so they're
discoverable. `CascadingMenu` greys a disabled submenu and blocks it from
opening. **A pin on such a row is greyed too**, by `menuItemAdornment` reading
the row's own `disabled`: a disabled `MenuItem` is `pointer-events: none` (the
same property `DisabledTooltip` exists to work around), so the pin took no click
while looking exactly like a live one. It stays drawn rather than vanishing, so
the trailing column keeps its alignment. The alignments feature-height presets
are the rows that reach this, gated row by row on `needsContent`.

**Inventory** (`DisplayDefaultsSection.tsx`, Preferences dialog): every promoted
default, what it overrides, and a per-row clear. The pin is easy to set and was
hard to find again — the badge below shows one only on an **open** track it
moves, so a default affecting nothing currently open, one promoted to a value
equal to `promotedBase`, and one the gate refuses appeared nowhere but the
"Reset preferences to defaults" confirmation. It asks the session for
`getDisplayTypeDefaults()` rather than filtering `getPreferenceChanges` on a path
head, so the composite-key layout stays `BaseSession`'s.

Its display-type lookup builds a map from `getDisplayElements()` and **does not
call `getDisplayType`, which throws** on an unregistered name. That is not a
hypothetical: `preferencesOverrides` is localStorage per *origin* while the
registered display set is per *session* — a runtime plugin uninstalled from the
plugin store, or simply a second config on the same host, strands keys naming
display types this build has never heard of. `DisplayType.aliases` renames a
display type for track configs and reaches nothing here, so a rename strands them
too. The row renders the raw type name and a `(default)` base; the section is the
only surface that can show it at all.

**Badge** (`OverrideBadge.tsx`, track selector): the same pencil that marks a
per-track config edit also shows when `getDisplayTypeDefaultChanges(display)` is
non-empty — one badge, two reasons, with the tooltip and the dialog naming the
actual source; click opens `TrackSettingsChangesDialog` with a "clear session
default" action wired to `clearPromotedDefaults(display, listedSlots)`. It
passes the slots the dialog **listed**, so the button clears exactly what the
user is looking at: a promoted default this track customized over, or one
promoted to a value equal to `promotedBase`, is `inherited: false` and appears
in no row, yet clearing it would move every *sibling* track.

The badge calls those two core functions **directly on the display**, not through
per-display MST hooks. Both are total — a schema with no promotable slot yields no
changes and clears nothing — so there is nothing to dispatch on, and no display has
to opt in. An earlier `PromotableDefaultsMixin` forwarded them as
`displayTypeDefaultChanges()` / `clearDisplayTypeDefaults()`, which meant six
displays each re-declaring `configuration` a second time and a silent
never-badges failure for any display that forgot to compose it. Don't reintroduce
it.

### The config editor is the other surface, and it sees only two tiers

`ConfigurationEditorWidget` renders every display slot, promotable ones included,
and its target is often a **detached** config node (`trackSchema.create(...)` in
`DrawerWidgets.ts`) — so it cannot reach the session and cannot resolve the
middle tier. What it *can* show is the bottom one, which is why `SlotFacade`
carries `promotedBase` alongside `defaultValue`: on a promotable slot
`defaultValue` is always the `undefined` sentinel, so an editor rendering it
renders nothing at all.

Each `maybe*` editor has to say so in its own vocabulary, and the two that
didn't both mis-reported an unset slot as a concrete value:

- `StringEnumEditor` prepends an `<em>default (fixed)</em>` choice for
  `maybeStringEnum` — the model the others follow. It names the `promotedBase`
  member rather than saying a bare "default", because every other choice in that
  list is a value the user can read off the plot and this was the only one that
  said nothing about what picking it draws.
- `NumberEditor` shows an empty field for an unset `maybeNumber` — right, since
  a number field has a state for "nothing" where a checkbox does not — with
  `promotedBase` as its **placeholder**, so a blank `featureHeight` still says
  reads are 7px. A labelled MUI field draws no placeholder unless the label is
  shrunk, hence the `slotProps.inputLabel` that `ConfigurationTextField` now
  merges rather than replaces.
- `BooleanEditor` coerced with `!!`, so every unset slot read *unchecked* — the
  opposite of the truth for the three whose base is `true`
  (`displayDirectionalChevrons`, `showSashimiArcs`, `readConnectionsDown`).
  Ticking the box then wrote the value the track already had: nothing changed on
  screen, but the slot silently left the cascade. It renders
  `value ?? promotedBase` now.
- `JsonEditor` seeded its buffer from `JSON.stringify(slot.value)`, which for an
  unset `maybeFrozen` (`colorBy`) returns the *value* `undefined`, not a string
  — the field went uncontrolled until the first keystroke. Same fix.

The reset button is still what separates *inherited* from *customized* (it keys
off `SlotFacade.modified`, i.e. presence in the stripped snapshot). Adding the
pin itself to this panel is the parked proposal in
`agent-docs/ideas/promotable-slot-ui.md`; read the three frictions it names
before starting.

## Adding a promotable slot

1. In the display's config schema, use a `maybe*` slot type
   (`maybeNumber`/`maybeBoolean`/`maybeColor`/`maybeStringEnum`/`maybeFrozen`),
   leave `defaultValue` undefined, and add `promotedBase: <realDefault>` —
   declaring that one field is what makes the slot promotable. `ConfigSlot` throws on any other shape, so
   there's nothing to get subtly wrong. If the slot's *shape* alone can't tell a valid value from a stale one
   (e.g. a `maybeFrozen` `colorBy` whose `.type` must name a registered scheme, not just
   be some string), add a `validate: (value) => boolean` hook — it gates both a
   promoted default and a track's own saved value, so a value that's since gone
   invalid degrades to the base instead of reaching a consumer that trusts it.

   **Overriding an inherited promotable slot states only the difference.** A
   subclass schema that redeclares one merges field-by-field over the base's, so
   `LGVSyntenyDisplay`'s `colorBy` writes just its `promotedBase`
   (`{type:'strand'}` rather than `normal`) and inherits `validate` and
   `advanced`. Keep `type` — it is what marks the entry as a slot rather than a
   nested sub-schema. (`defaultValue` is not required on a `maybe*` slot, so a
   promotable override omits it — unless the base slot has a *concrete* default,
   which the merge would otherwise inherit, leaving the slot never unset.) A
   subclass that wants a
   genuinely plain slot writes `promotedBase: undefined` — the merge is a
   spread, so a stated `undefined` overwrites the inherited base.
2. Read it on the display with **`resolveConf(self, slot)`**, not `getConf` —
   `get x(): X { return resolveConf(self, 'x') }`, no post-guard and no cast. If
   you forget, tsc usually catches it: the raw `getConf` read type is
   `X | undefined` (the unset sentinel) and won't assign to `X`. `resolveConf`
   throws on a slot that isn't promotable, so the two readers can't be swapped by
   accident in either direction.

   **`maybeFrozen` is the exception** — `SlotValueRawFromDef` maps it to `any`
   (arbitrary dynamic JSON the caller asserts at the read boundary), so a raw
   `getConf(self, 'colorBy')` type-checks and hands back the sentinel. That one
   slot is on the reviewer, not the compiler.

   The same slot name can be promotable in one schema and plain in another
   (`colorBy` is promotable on alignments, not on gwas/variants; `featureHeight`
   on alignments, not on canvas-base; `displayMode` on canvas-base, not on arc) —
   which reader each display uses is a per-schema fact you can read off the
   getter. `readConfObject` is the raw read from a bare config (the resolver
   itself uses it), and `getConf` is that same raw read through a state model's
   `.configuration`.
3. Track menu: build a `Pin` with `makePin(self, slot, value?)` and pass it as
   `pin` to `promotableToggleItem`, or hand `promotableRadioItems` the factory
   `value => makePin(self, slot, value)` for a whole radio group (the plural form
   is what keeps a group from being one pin short — see
   [UI surface](#ui-surface)). The track-selector badge
   needs **nothing** — it reads the cascade directly off any display.
4. **Serialization boundaries** (see
   [that section](#serialization-boundaries-getcomputedstyle)): promotable slots
   resolve on the **main thread**, so anything that ships the config elsewhere
   must flatten. If the worker needs the value, send
   `getConfigSnapshotWithPromotables(self)` (or read the display's resolved getter
   into `rpcProps()`) — an unresolved promotable slot serializes as its inherit
   sentinel, which the worker can't interpret. There is no raw alternative on the
   barrel to reach for by mistake.
   `displayMode` is excluded from the canvas worker payload entirely (compact
   scaling is main-thread). The **share/export** boundary needs nothing per-slot:
   `bakePromotedDefaultsIntoSnapshot` walks every promotable slot via
   `getDisplayTypeDefaultChanges`, so a new slot is covered automatically.

   **The two worker-payload conventions are not an inconsistency to clean up.**
   Canvas sends the whole snapshot, so a new promotable slot reaches its worker
   for free. Alignments hand-lists resolved getters instead, and must: only three
   of its ten promotable slots belong in the payload at all, because *every field
   `rpcProps()` returns is an RPC cache key* — the rest are main-thread layout
   (`featureHeight`, `heightMode`) or repaint-only (`mismatchAlpha`, the arc and
   sashimi settings), and listing them would refetch the region on a setting that
   only redraws. `colorBy` goes further and is narrowed through `workerColorBy`
   so switching between schemes the shader decides on its own repaints from data
   already in memory. Converting alignments to `getConfigSnapshotWithPromotables`
   would undo both. See `plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md`
   for the tier table that decides which side a slot lands on.

## Historical note

An earlier design layered admin/user type-default configs via extra
`mergeTrackConfig` passes in the `SessionTracks.ts` `tracks` getter, with a
4-part memo key to keep the hydration cache warm (also the stale block in
`agent-docs/ideas/promotable-slot-ui.md`). **Superseded**: a promotable slot resolves on read — no
tracks-getter merge, no admin config slot, no cache-key surgery. Kept the "user
choice wins / display-type granularity" decisions; dropped the machinery.

Every pass since has removed machinery, never added it. Three of those removals
carry a standing "don't reintroduce this", and each is an ADR —
[ADR-046](../architecture-decision-records/adr-046-resolveconf-names-the-cascade.md)
(cascading inside `getConf`),
[ADR-047](../architecture-decision-records/adr-047-undefined-is-the-only-inherit-sentinel.md)
(the `'inherit'` enum member and the `defaultValue`-as-sentinel form), and
[ADR-048](../architecture-decision-records/adr-048-the-pin-applies-then-offers-the-default.md)
(the pin resetting the clicking display, and the override/apply action pair). The rest were straightforward
deletions, listed here only so a reader doesn't go looking for them:

- **`PromotableDefaultsMixin`** forwarded the badge's two hooks per display. Both
  underlying functions are total, so the badge calls them directly (see
  [UI surface](#ui-surface) — that one *is* worth not reintroducing).
- **Group controls** (`PromotableEntry[]` behind one pin) served a feature-height
  preset promoting `featureHeight` + `featureSpacing` together; `featureSpacing`
  is derived now and every call site passed one slot.
- **A discriminated-union resolution** with a `jexl:` callback arm — see
  [No callbacks](#no-callbacks-jexl) for why that state was unauthorable and
  already degenerate.
- **`PromotableDisplay` everywhere**, reached by `resolveConf` through an
  `as unknown as`. Splitting the read-only `ResolvableDisplay` off removed the
  cast; the fallout was nine sites, all fakes under-modelling a real display.
  The split then collapsed altogether with the `ignorePromotedDefaults` removal
  below, since the setter it existed for went away.
- **`ignorePromotedDefaults`**, the per-display received-session opt-out, and
  `markIgnorePromotedDefaults`, the second snapshot walk that stamped it. See
  [Received sessions](#received-sessions) for what it covered and why the trade
  went the other way.
- **The `promotable: true` flag**, which said nothing `promotedBase` didn't and
  cost two `ConfigSlot` throws to keep the pair in agreement — see
  [The inherit sentinel](#the-inherit-sentinel) and ADR-047. A subclass now turns
  an inherited promotable slot off with `promotedBase: undefined`.
- **The second pin builder.** `makeCurrentValueDisplayTypeDefaultControl(self,
  slot)` was exactly `make…Control(self, slot, resolveSlot(self, slot).value)`, so
  the pair was one function plus a section explaining which name to reach for.
  `makePin`'s optional value argument says what the longer name said. The same
  pass renamed `DisplayTypeDefaultControl` → `Pin`, `defaultForAll` → `pin` and
  `DefaultForAllAdornment` → `PinAdornment`, finishing a rename the prose, the
  helpers and the test names had already made.
- **The open-display walk**, moved rather than deleted: `openPromotableDisplays`
  and its structural guards are in `core/src/util/openDisplays.ts`, since "which
  displays is the user looking at" is not a cascade question and the share/export
  bake wants the same answer.

The optionality of the session store went too: `get/setDisplayTypeDefault` (with
`setPreferenceOverride` / `clearPreferenceOverrides` / `setScrollZoom`) are
required on `AbstractSessionModel`, so the resolver and the control builders call
them plainly. What that exposed is worth knowing before tightening any other
session member: **tsc catches nothing here**, because unit-test session fakes are
bare `types.model({…})` shims that are never annotated as `AbstractSessionModel`.
A missing member surfaces only as a runtime `TypeError` inside a MobX reaction.
Twenty-one of the twenty-eight shims in the repo were missing
`getDisplayTypeDefault`, several for display types that already have promotable
slots. Run the plugin test suites, not just `pnpm typecheck`.

A naming pass also **reclaimed "pin"**: the track's own value is now
"customized", and "pin" names the make-default affordance. The prior API's
`isSlotPinned` / `areSlotsAtSessionDefault` / `setSlotsSessionDefault` /
`isSlotValueSessionDefault` / `setSlotValueSessionDefault` /
`getSlotInheritedValue` collapsed into `makePin` (public)
over `isPromotableDefault` (internal), and the `SessionDefault*` names became
`DisplayTypeDefault*`.
