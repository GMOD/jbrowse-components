---
title: MST patterns
description: Common MobX-State-Tree patterns used across JBrowse plugins
guide_category: Core concepts
---

JBrowse uses `@jbrowse/mobx-state-tree`, an internal ESM fork of
[MobX-State-Tree](https://mobx-state-tree.js.org/). The public API matches
upstream MST, so the upstream documentation applies.

**TL;DR:** Patterns for the MST idioms JBrowse relies on: driving side-effects
with `autorun`, composing models from mixins, `types.frozen`, volatile state,
and using `self` over `this` in views.

## autorun inside useEffect

Drive canvas drawing or other side-effects from MST observables in a React
component. The autorun's disposer is returned straight out of the `useEffect`,
so it becomes the cleanup, and every observable read inside becomes a dependency
without going in the dep array:

<!-- include: plugins/maf/src/LinearMafDisplay/components/TrackBandCanvas.tsx -->

```tsx
import { useEffect, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Shared absolutely-positioned band canvas for the MAF coverage / conservation /
 * row-identity bands. Runs `draw` inside an `autorun` so observable map
 * mutations (`rpcDataMap`/`renderBlocks`) redraw without `useEffect` deps —
 * `observable.map` keeps a stable outer reference. Hidden and not drawn when
 * `show` is false.
 *
 * `canvasWidthPx`, not `lgv.width`: every one of these bands' painters is handed
 * `canvasWidthPx` as its `canvasWidth` and clamps to it, and the GPU rows canvas
 * this one *replaces* in the identity/source-chromosome modes is that wide too.
 * Sizing the element by the view width instead left it 2px past its own
 * container (`TrackRenderingContainer` insets by the track outline under
 * `contain: strict`, so the browser clipped the overhang) with its rightmost 2px
 * unpainted — the exact drift `canvasWidthPx`'s own docstring records MAF making
 * once before.
 */
const TrackBandCanvas = observer(function TrackBandCanvas({
  model,
  top,
  height,
  show,
  draw,
}: {
  model: LinearMafDisplayModel
  top: number
  height: number
  show: boolean
  draw: (ctx: CanvasRenderingContext2D) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const width = model.canvasWidthPx

  useEffect(
    () =>
      autorun(() => {
        const ctx = getPreparedCanvas2D(canvasRef.current, width, height)
        if (ctx && show) {
          draw(ctx)
        }
      }),
    [width, height, show, draw],
  )

  return show ? (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  ) : null
})

export default TrackBandCanvas
```

Note what is _not_ in the dep array. The `draw` callbacks read
`model.rpcDataMap` from inside the autorun, so a mutation there redraws the
canvas without React re-running the effect; the deps carry only what changes the
canvas's size or identity. Sizing goes through `getPreparedCanvas2D`, which
handles device pixel ratio — don't set `width`/`height` by hand.

Prefer `autorun` over `reaction` for drawing: it runs immediately and tracks
dependencies automatically. Use `reaction` only to separate the tracked
expression from the effect.

To read an observable inside an autorun **without** making it a dependency, wrap
it in `untracked()`. The dotplot's fetch tracks exactly one computed and reads
everything else untracked:

<!-- include: plugins/dotplot-view/src/DotplotDisplay/afterAttach.ts#untracked -->

```ts
const fetchKey = self.currentFetchKey
// Untracked: the values behind that key. Reading them here rather than
// as deps keeps raw offsetPx/width changes from refiring the fetch,
// while the worker still sees the current axes.
return untracked(() => ({
  fetchKey,
  // the resolved tier, which is what `currentFetchKey` above carries —
  // `view.lodMode` stays 'auto' while the tier flips under it
  lodTier: self.lodTier,
  hViewSnap: makeViewSnap(view.hview),
  vViewSnap: makeViewSnap(view.vview),
  regions: self.fetchRegions,
}))
```

That is the shape to copy for any expensive effect: fold every input that should
trigger it into one computed, track only that, and read the raw values inside
`untracked`. Tracking the underlying observables individually is strictly
noisier — here an `offsetPx` change on every pan frame would refire a worker
fetch whose result would be identical.

:::warning An autorun must do its own reads — an MST action is an untracked one

`untracked` above is deliberate. **An MST action is the same thing by accident:
actions run untracked**, so moving an autorun's body into one leaves the autorun
with no dependencies at all. It fires exactly once, never again, and nothing
throws or warns.

This is easy to walk into because factoring the body out is the obvious way to
reuse it — from a menu item, or from a flush-on-teardown path that wants the
same work on demand. The fix is to duplicate the reads in the autorun and say
why in a comment; `RegionTooLargeMixin`'s byte gate is the worked example.

The same trap wearing different clothes: `self.someAction(getSnapshot(self))`
tracks fine, and only because the snapshot is taken in the argument list, before
the action is entered. Move that read inside the action and the dependency
disappears with it.

:::

## Model composition

`types.compose(name, ...types)` layers mixins onto a base model. It takes the
name and every part up front — there is no `.compose()` method on a model type,
so the mixins cannot be chained on one at a time the way `.views()` and
`.actions()` are. `LinearMafDisplay` layers four mixins onto `BaseDisplay`:

<!-- include: plugins/maf/src/LinearMafDisplay/stateModel.ts#compose -->

```ts
.compose(
  'LinearMafDisplay',
  BaseDisplay,
  TrackHeightMixin(),
  MultiRegionDisplayMixin(),
  RowHeightMixin(),
  TreeSidebarMixin<MafSource>(),
  types.model({
    /**
     * #property
     */
    type: types.literal('LinearMafDisplay'),
    /**
     * #property
     */
    configuration: ConfigurationReference(configSchema),
  }),
)
```

`.views()` / `.actions()` / `.volatile()` chain onto the result of that one
call.

Mixins are factory functions returning a model type, not classes, so the same
mixin can be composed at different positions in the chain without inheritance.

Keep the main model chain in one file. Splitting `.views()` or `.actions()`
across files obscures the composition order and which views depend on which.

## Chaining multiple .views() blocks

`self` inside a `.views()` block is typed with everything the model had
**before** that block. So a later block reaches an earlier block's getters on
`self`, and that is the reason to split. `LinearArcDisplay` puts its typed
`conf` getter in its own block so every getter after it can read `self.conf`:

<!-- include: plugins/arc/src/LinearArcDisplay/model.ts#chainedViews -->

```ts
  /**
   * #getter
   * the config typed off the concrete schema; `ConfigurationReference`
   * erases `self.configuration` to `any`, so reads route through this to
   * stay typed (same move as `BaseAdapter<CONF>`)
   */
  get conf(): LinearArcDisplayConfig {
    return self.configuration
  },
}))
.views(self => ({
  /**
   * #getter
   */
  get displayMode(): ArcDisplayMode {
    return getConf(self, 'displayMode')
  },
```

Use multiple blocks when a getter depends on another getter, making the
dependency explicit through ordering.

## types.frozen

Use `types.frozen()` for data that is:

- Large and doesn't need deep reactivity (e.g., an array of 10k feature objects)
- Stored as a plain JSON value and hydrated lazily into MST nodes on first
  access

<!-- include: plugins/canvas/src/LinearMultiRowFeatureDisplay/model.ts#frozenProp -->

```ts
// `RowSortSpec`, not a second spelling of it: the autorun that consumes
// this and `setSortRowsBy` are both typed on tree-sidebar's, so an
// inline shape here is a copy that can only ever drift away from the one
// doing the checking. Multi-wiggle's twin already reads it from there.
sortRowsBy: types.maybe(types.frozen<RowSortSpec>()),
```

`types.frozen<T>()` takes the shape as a type parameter and stores a plain
value. Wrap it in `types.maybe` or `types.optional` the same as any other type —
frozen is about what MST does with the value, not about whether it is present.

Frozen values are compared by reference; MST does not track fields inside them.
For reactive access to a field inside a frozen value, copy it out into a regular
MST property or a `.volatile()` field.

To make a field a dependency of an autorun without using its value, `void` it —
for a frozen field that means the autorun fires when the whole value is
replaced, without enumerating its properties. The prerequisite-fetch skeleton
(which Hi-C's file-header read runs on) does it to a counter so the retry button
re-runs the fetch:

<!-- include: plugins/linear-genome-view/src/BaseLinearDisplay/models/installPrerequisiteFetch.ts#voidTracking -->

```ts
() => {
  // the pure "go again" signal, read unconditionally above the gates so a
  // Retry click re-runs the body even when nothing else moved
  void self.reloadCounter
  if (self.isMinimized || opts.enabled?.() === false) {
    return false
  }
  void runOne(rotation.begin())
  return true
},
```

Give every autorun a `name` as that one does — it is what shows up when
debugging which effect refired.

## self over this in .views()

This is a **typing** rule, not a runtime one. `self` and `self`-via-`this` are
the same object at runtime, and both dispatch to a later block's override; what
differs is what TypeScript can see:

- `self` is typed with everything the model had **before** the block. It reaches
  earlier blocks, the properties, and the volatiles — and cannot see a sibling
  in its own block.
- `this` inside the returned object literal is typed as **that literal**. It
  reaches same-block siblings and nothing else.

So prefer `self.X`, and reach for `this.X` only for a sibling defined in the
same block. `LinearVariantDisplay`'s legend getters use both, one line apart:

<!-- include: plugins/variants/src/LinearVariantDisplay/model.ts#sameBlockThis -->

```ts
/**
 * #getter
 */
// True when features are colored by their most severe consequence impact.
get colorsByConsequenceImpact() {
  return self.conf.color === CONSEQUENCE_IMPACT_JEXL
},
/**
 * #getter
 */
// True when features are colored by their structural-variant class.
get colorsBySvType() {
  return self.conf.color === SV_TYPE_COLOR_JEXL
},
/**
 * #getter
 */
// Legend rows for whichever preset color key is active (impact tiers or SV
// classes), or none. SV-type shows the fixed class key; copy-number and
// unrecognized tokens aren't listed (the pure jexl has no present-set).
get colorLegendItems(): LegendItem[] {
  if (this.colorsByConsequenceImpact) {
    return IMPACT_TIERS.map(t => ({ color: t.color, label: t.tier }))
  }
  if (this.colorsBySvType) {
    return PREDEFINED_SV_TYPES.map(t => ({
      color: t.color,
      label: t.label,
    }))
  }
  return []
},
/**
 * #getter
 */
// Whether a preset coloring is active, i.e. whether there is a key at all.
// NOT anded with `colorLegendDismissed`: dismissal is the hook's own flag
// (see CanvasColorLegend), so the track menu's "Show legend" checkbox can
// offer the way back from the key's own "×".
get showColorLegend() {
  // `this` for the sibling defined just above (same block), `self` for
  // what earlier blocks and the volatile added — see the MST patterns guide
  return this.colorLegendItems.length > 0
},
```

Note `colorLegendItems`' explicit `: LegendItem[]` return type. A getter read
through `this` has to be annotated — without it TypeScript has to infer the
literal's type from a member that refers to the literal, and gives up with a
circular-reference error. That annotation is the cost of a same-block `this`
read, and the reason splitting into another block is usually tidier.

If you need to extend a parent view in a subclass, destructure the super version
off `self` **outside** the returned object, before redefining it. Reading it
inside would find your own override and recurse. `LinearMafDisplay` appending to
the inherited track menu:

<!-- include: plugins/maf/src/LinearMafDisplay/stateModel.ts#superMethod -->

```ts
.views(self => {
  const { trackMenuItems: superTrackMenuItems } = self
  return {
    /**
     * #method
     */
    trackMenuItems() {
      return [...superTrackMenuItems(), ...buildMafTrackMenuItems(self)]
    },
  }
})
```

## Volatile state

Use `.volatile(() => ({ … }))` for state that should not be persisted in
snapshots — loading flags, fetched data, hover and menu state that a reload
should reset. The multi-row display's block, in full:

<!-- include: plugins/canvas/src/LinearMultiRowFeatureDisplay/model.ts#volatile -->

```ts
rpcDataMap: regionDataMap<MultiRowRegionData>('rpcDataMap'),
prefersOffset: true,
/**
 * #volatile
 * The feature under the mouse, or undefined when not hovering a block. Pure
 * hover identity — the cursor position that places the tooltip is component
 * state, so moving inside one block doesn't invalidate this.
 *
 * Named apart from the `hoveredFeature` getter it fills, because
 * `BaseDisplay` declares that hook as a computed and MST refuses to
 * instantiate a volatile over one.
 */
hoveredMultiRowFeature: undefined as MultiRowHit | undefined,
/**
 * #volatile
 * Right-click context menu anchor + the genomic position clicked (and the
 * feature there, if any). Undefined when the menu is closed.
 */
contextMenuInfo: undefined as
  | {
      clientX: number
      clientY: number
      refName: string
      pos: number
      hit?: MultiRowHit
    }
  | undefined,
```

`undefined as T | undefined` is the idiom for a volatile whose type MST cannot
infer from its initial value.

Observable maps (`.map<K, V>()`) give reactive key-level tracking: an autorun
reading `map.get(key)` re-fires only when that key changes, not on every map
write.

## See also

- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/configuration_schema)
- [](/docs/developer_guides/creating_view)
