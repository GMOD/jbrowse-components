---
id: sessiontracksmanagersessionmixin
title: SessionTracksManagerSessionMixin
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[packages/product-core/src/Session/SessionTracks.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/SessionTracks.ts)

## Docs

### SessionTracksManagerSessionMixin - Properties

#### property: sessionTracks

```js
// type signature
IArrayType<IAnyModelType>
// code
sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      )
```

### SessionTracksManagerSessionMixin - Getters

#### getter: tracks

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
```

### SessionTracksManagerSessionMixin - Actions

#### action: addTrackConf

```js
// type signature
addTrackConf: (trackConf: AnyConfiguration) => any
```

#### action: deleteTrackConf

```js
// type signature
deleteTrackConf: (
  trackConf: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```
