---
id: tracksmanagersessionmixin
title: TracksManagerSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Tracks.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/TracksManagerSessionMixin.md)

## Docs

composed of

- BaseSessionModel
- ReferenceManagementSessionMixin

### TracksManagerSessionMixin - Getters

#### getter: tracks

```js
// type
AnyConfigurationModel[]
```

#### getter: assemblies

Base assemblies from jbrowse config. Child sessions can override to include
additional assemblies (e.g. sessionAssemblies).

```js
// type
{
  sequence: {
    trackId: string
  }
}
;[]
```

#### getter: tracksById

```js
// type
Record<string, AnyConfigurationModel>
```

### TracksManagerSessionMixin - Actions

#### action: addTrackConf

```js
// type signature
addTrackConf: (trackConf: AnyConfiguration) => any
```

#### action: deleteTrackConf

```js
// type signature
deleteTrackConf: (trackConf: AnyConfigurationModel) => any
```
