---
id: configoverridemixin
title: ConfigOverrideMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/ConfigOverrideMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/ConfigOverrideMixin.md)

## Docs

Provides a single `configOverrides` map for runtime display config overrides,
replacing per-setting `types.maybe()` properties with one frozen map. Read a
value with `getConfWithOverride` (override wins, else the config slot's value)
or `getOverride` (override only); write with `setOverride`.

### ConfigOverrideMixin - Properties

#### property: configOverrides

runtime overrides keyed by config slot name; serialized only when non-empty (see
postProcessSnapshot)

```js
// type signature
IOptionalIType<IType<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>, [undefined]>
// code
configOverrides: types.optional(
        types.frozen<Record<string, unknown>>(),
        {},
      )
```

### ConfigOverrideMixin - Methods

#### method: getOverride

the override value for a key, or undefined if not overridden

```js
// type signature
getOverride: <T>(key: string) => T | undefined
```

#### method: getConfWithOverride

the override value if set, otherwise the resolved config slot value

```js
// type signature
getConfWithOverride: <T>(key: string) => T
```

### ConfigOverrideMixin - Actions

#### action: setOverride

```js
// type signature
setOverride: (key: string, value: unknown) => void
```

#### action: clearOverride

```js
// type signature
clearOverride: (key: string) => void
```
