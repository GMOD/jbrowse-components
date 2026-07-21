---
title: MST patterns
description: Common MobX-State-Tree patterns used across JBrowse plugins
guide_category: Core concepts
---

JBrowse uses `@jbrowse/mobx-state-tree`, an internal ESM fork of
[MobX-State-Tree](https://mobx-state-tree.js.org/). The public API closely
matches upstream MST, so the upstream documentation applies.

## autorun inside useEffect

The standard pattern for driving canvas drawing or other side-effects from MST
observables in a React component:

```tsx
import { useEffect, useRef } from 'react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

const MyCanvas = observer(({ model }: { model: MyDisplayModel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // autorun returns a disposer; useEffect returns it as the cleanup function
    return autorun(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Every observable read here (model.data, model.height, etc.)
      // becomes a dependency — the autorun re-runs when any of them change
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawData(ctx, model.data, model.height)
    })
  }, [model])

  return <canvas ref={canvasRef} />
})
```

Prefer `autorun` over `reaction` for drawing. `autorun` runs immediately and
tracks dependencies automatically. Use `reaction` only when you need to
explicitly separate the tracked expression from the effect.

For code inside an autorun that should read an observable **without** making it
a dependency, wrap it in `untracked()`:

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

Mixins are factory functions that return a model type, not classes. This makes
them composable without classical inheritance and allows the same mixin to be
included at different positions in the chain.

Keep the main model chain in one file. Splitting `.views()` or `.actions()`
across multiple files makes it hard to follow the composition order and which
views depend on which.

## Chaining multiple .views() blocks

A later `.views()` block can call getters defined in an earlier block on `self`,
because each block extends the type incrementally:

```ts
const MyModel = types
  .model({ type: types.literal('MyModel') })
  .views(self => ({
    // First block: simple getters
    get adapterConfig() {
      return getConf(self, 'adapter')
    },
  }))
  .views(self => ({
    // Second block: depends on adapterConfig from the first block
    get adapterType() {
      return pluginManager.getAdapterType(self.adapterConfig.type)
    },
  }))
```

Use multiple blocks when a getter depends on another getter. This makes the
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

Frozen values are compared by reference. MST does not track individual fields
inside them. If you need reactive access to a field inside a frozen value, copy
it out into a regular MST property or a `.volatile()` field.

For iterating a `types.frozen` field inside an autorun to track changes, `void`
the field. You don't need to enumerate its properties:

```ts
autorun(() => {
  void self.displayedRegions // tracks the reference; fires when the array is replaced
  doSomething()
})
```

## self over this in .views()

Inside a `.views(self => ...)` block, reference sibling views via `self.X`
rather than `this.X`. `this` works at runtime but breaks when a subclass
overrides the getter. `self` dispatches to the override, `this` doesn't:

```ts
.views(self => ({
  get derivedThing() {
    return compute(self.baseThing)  // uses override if subclass provides one
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

Observable maps (`.map<K, V>()`) give you reactive key-level tracking. An
autorun that reads `map.get(key)` re-fires when that specific key changes, not
on every map write.

## See also

- [Data fetching pipeline](/docs/developer_guides/data_fetching)
- [Configuration schema](/docs/developer_guides/configuration_schema)
- [Creating custom view types](/docs/developer_guides/creating_view)
