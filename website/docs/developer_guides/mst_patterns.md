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
component:

```tsx
import { useEffect, useRef } from 'react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

const MyCanvas = observer(({ model }: { model: MyDisplayModel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // autorun's disposer becomes the useEffect cleanup
    return autorun(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // every observable read here becomes a dependency
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawData(ctx, model.data, model.height)
    })
  }, [model])

  return <canvas ref={canvasRef} />
})
```

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

Use `types.compose()` to layer mixins onto a base model:

```ts
import { types } from '@jbrowse/mobx-state-tree'
import { MultiRegionDisplayMixin } from '@jbrowse/plugin-linear-genome-view'

const MyDisplay = types
  .model('MyDisplay', {
    type: types.literal('MyDisplay'),
    configuration: ConfigurationReference(configSchema),
  })
  .compose(MultiRegionDisplayMixin())
  .views(self => ({
    get height() {
      return 100
    },
  }))
  .actions(self => ({
    fetchNeeded(needed: Region[]) {
      /* ... */
    },
  }))
```

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

If you need to extend a parent view in a subclass, capture the super version
before redefining it:

```ts
.views(self => {
  const { rpcProps: superRpcProps } = self
  return {
    rpcProps() {
      return { ...superRpcProps(), myExtraField: self.myExtraField }
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
