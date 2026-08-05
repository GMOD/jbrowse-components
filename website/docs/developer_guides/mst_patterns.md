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
  const { width } = model.lgv

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
it in `untracked()`:

```ts
autorun(() => {
  void self.fetchGeneration // tracked: re-run when generation changes
  if (untracked(() => self.isLoading)) return // not tracked: just a guard
  // ...
})
```

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

A later `.views()` block can call getters defined in an earlier block on `self`,
because each block extends the type incrementally:

```ts
const MyModel = types
  .model({ type: types.literal('MyModel') })
  .views(self => ({
    get adapterConfig() {
      return getConf(self, 'adapter')
    },
  }))
  .views(self => ({
    get adapterType() {
      return pluginManager.getAdapterType(self.adapterConfig.type)
    },
  }))
```

Use multiple blocks when a getter depends on another getter, making the
dependency explicit through ordering.

## types.frozen

Use `types.frozen()` for data that is:

- Large and doesn't need deep reactivity (e.g., an array of 10k feature objects)
- Stored as a plain JSON value and hydrated lazily into MST nodes on first
  access

```ts
const MyModel = types.model({
  featureData: types.frozen<FeatureData>(),
  displayedRegions: types.optional(types.frozen<Region[]>(), []),
})
```

Frozen values are compared by reference; MST does not track fields inside them.
For reactive access to a field inside a frozen value, copy it out into a regular
MST property or a `.volatile()` field.

To track a `types.frozen` field in an autorun, `void` the field rather than
enumerating its properties:

```ts
autorun(() => {
  void self.displayedRegions // fires when the array is replaced
  doSomething()
})
```

## self over this in .views()

Inside a `.views(self => ...)` block, reference sibling views via `self.X`, not
`this.X`. Both work at runtime, but only `self` dispatches to a subclass
override:

```ts
.views(self => ({
  get derivedThing() {
    return compute(self.baseThing)
  },
}))
```

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

Use `.volatile()` for state that should not be persisted in snapshots (loading
flags, cached computed values, maps that are rebuilt from props):

```ts
.volatile(() => ({
  rpcDataMap: observable.map<number, RegionData>(),
  isLoading: false,
  error: undefined as unknown,
}))
```

Observable maps (`.map<K, V>()`) give reactive key-level tracking: an autorun
reading `map.get(key)` re-fires only when that key changes, not on every map
write.

## See also

- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/configuration_schema)
- [](/docs/developer_guides/creating_view)
