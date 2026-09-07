---
name: give-a-pluggable-element-an-extendstype
description: Give a pluggable element an `extendsType`
area: config-and-mst
---

# Give a pluggable element an `extendsType`

, so a display built from
another's state-model factory inherits its extensions and `extendDisplayType`
walks the chain rather than matching `element.name` exactly — proposed with a
dev-mode check to flag an undeclared lineage, measured 2026-08-25 and
declined. Three separate reasons, any one of them fatal.

**The check cannot be built the way it was designed.** The premise was that
`types.compose` preserves the base's property objects by identity, making
"this model composes that one" detectable rather than heuristic. It does
preserve them — `cloneAndEnhance` does `Object.assign({}, this.properties,
…)` and `this.initializers.concat(…)`, both by identity — but a display's
model comes from `factory(configSchema)`, and two calls of a factory share
nothing that two unrelated factories do not. Measured over the real lineage
and two controls: `LGVSyntenyDisplay` (79 initializers) against
`LinearAlignmentsDisplay` (73), which it is literally built from, shares **1
property (`id`) and 5 initializers**. `LinearBasicDisplay` (103) against
either of them shares **the same 1 and the same 5** — they are
`BaseDisplay`'s, the one module-level singleton every display composes. The
base's initializers are not even a prefix of the derived model's. The signal
is identical for a real parent and for no relationship at all.

**In-tree it would have one user.** `LGVSyntenyDisplay` ←
`LinearAlignmentsDisplay` is the only pair where a display is built from
another *registered* display's state-model factory. Where displays do share a
base it is an unregistered one with no name to declare —
`linearCanvasBaseDisplayStateModelFactory` under `LinearBasicDisplay` and
`LinearVariantDisplay`, `MultiSampleVariantBaseModel` under the two
multi-sample variant displays, `SharedLDModel` under `LDDisplay` and
`LDTrackDisplay`. Everything else composes `BaseDisplay` plus a mixin set
directly — `TrackHeightMixin`, `MultiRegionDisplayMixin`, `LegendMixin`,
`CanvasFeatureGateMixin`, `WiggleCommonMixin`, `TreeSidebarMixin`. The cost it
was proposed to remove was one duplicated `addDisplayMenuItems` call in
`LinearDerivativeVsRef`, and "one extension registration can name several
element types" removed that instead, by letting `extendDisplayType` and the
menu helpers take an array of names.

**And it cannot express the case that motivates it**, which was out-of-tree
plugins wanting to say "any canvas-family display" instead of naming one. The
canvas family's shared base, `linearCanvasBaseDisplayStateModelFactory`, is
one of the unregistered ones above, so `extendsType` has no name to point at —
and `LinearMultiRowFeatureDisplay`, the other canvas display showing genes and
the one those plugins actually miss, composes the mixins directly and would
declare no parent at all. A name would not help them even if it existed: that
display's `contextMenuInfo` is `{clientX, clientY, refName, pos, hit?}`
against `LinearBasicDisplay`'s `{item, subfeature, displayedRegionIndex}`, so
an extension written against one reads `undefined` on the other. The family
they want is a shared
menu-surface shape, and nothing in the tree declares one.

What the plugins surveyed in `~/src/jb2plugins` hand-roll today is a raw
`Core-extendPluggableElement` callback gated on
`isDisplay(elt) { return elt.name === '…' }` — `LinearBasicDisplay` in
protein3d, msaview, icn3d and graphgenomeview, `LinearAlignmentsDisplay` in
tview, `LinearVariantDisplay` in both alphagenome plugins — and
`addDisplayMenuItems` already answers it. None has adopted it yet, which the
release timeline explains without anyone having been asked: `v4.3.0` has no
`addMenuItems.ts`, so it is not reachable from a published `@jbrowse/core`.
Adoption is the next move here, not machinery.
