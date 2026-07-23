---
id: jbrowsereactlineargenomeviewrootmodel
title: JBrowseReactLinearGenomeViewRootModel
sidebar_label: Root -> JBrowseReactLinearGenomeViewRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/src/createModel/createModel.ts).

## Overview

Composes the shared EmbeddedRootModel with a LinearGenomeView session plus the
LGV-only `disableAddTracks`/`drawerViewHeight` props.

## Members

| Member                                         | Kind       | Defined by                            | Description |
| ---------------------------------------------- | ---------- | ------------------------------------- | ----------- |
| [disableAddTracks](#property-disableaddtracks) | Properties | JBrowseReactLinearGenomeViewRootModel |             |
| [drawerViewHeight](#property-drawerviewheight) | Properties | JBrowseReactLinearGenomeViewRootModel |             |

<details>
<summary>JBrowseReactLinearGenomeViewRootModel - Properties</summary>

#### property: disableAddTracks

```ts
// type signature
type disableAddTracks = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
disableAddTracks: types.stripDefault(types.boolean, false)
```

#### property: drawerViewHeight

```ts
// type signature
type drawerViewHeight = IOptionalIType<ISimpleType<string>, [undefined]>
// code
drawerViewHeight: types.stripDefault(types.string, '100vh')
```

</details>
