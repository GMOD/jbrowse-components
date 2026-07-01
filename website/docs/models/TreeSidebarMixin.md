---
id: treesidebarmixin
title: TreeSidebarMixin
sidebar_label: Mixin -> TreeSidebarMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/TreeSidebarMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/TreeSidebarMixin.md)

## Overview

Adds a dendrogram sidebar to a display: stores the leaf layout, newick cluster
tree, sidebar width and subtree filter, plus the hover/canvas volatile state
used while drawing the tree.

<details open>
<summary>TreeSidebarMixin - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| [`layout`](#property-layout)               | `IOptionalIType<IType<S[], S[], S[]>, [undefined]>`                    |
| [`clusterTree`](#property-clustertree)     | `IOptionalIType<IMaybe<ISimpleType<string>>, [undefined]>`             |
| [`treeAreaWidth`](#property-treeareawidth) | `IOptionalIType<ISimpleType<number>, [undefined]>`                     |
| [`subtreeFilter`](#property-subtreefilter) | `IOptionalIType<IMaybe<IArrayType<ISimpleType<string>>>, [undefined]>` |

</details>

<details>
<summary>TreeSidebarMixin - Properties (all signatures)</summary>

#### property: layout

```ts
// type signature
type layout = IOptionalIType<IType<S[], S[], S[]>, [undefined]>
// code
layout: types.stripDefault(types.frozen<S[]>(), [])
```

#### property: clusterTree

```ts
// type signature
type clusterTree = IOptionalIType<IMaybe<ISimpleType<string>>, [undefined]>
// code
clusterTree: types.stripDefault(types.maybe(types.string), undefined)
```

#### property: treeAreaWidth

```ts
// type signature
type treeAreaWidth = IOptionalIType<ISimpleType<number>, [undefined]>
// code
treeAreaWidth: types.stripDefault(types.number, 80)
```

#### property: subtreeFilter

```ts
// type signature
type subtreeFilter = IOptionalIType<
  IMaybe<IArrayType<ISimpleType<string>>>,
  [undefined]
>
// code
subtreeFilter: types.stripDefault(
  types.maybe(types.array(types.string)),
  undefined,
)
```

</details>

<details open>
<summary>TreeSidebarMixin - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature                      |
| ---------------------------------------------- | ------------------------------ |
| [`hoveredTreeNode`](#volatile-hoveredtreenode) | `HoveredTreeNode \| undefined` |
| [`treeCanvas`](#volatile-treecanvas)           | `HTMLCanvasElement \| null`    |
| [`mouseoverCanvas`](#volatile-mouseovercanvas) | `HTMLCanvasElement \| null`    |

</details>

<details>
<summary>TreeSidebarMixin - Volatiles (all signatures)</summary>

#### volatile: hoveredTreeNode

```ts
// type signature
type hoveredTreeNode = HoveredTreeNode | undefined
// code
hoveredTreeNode: undefined as HoveredTreeNode | undefined
```

#### volatile: treeCanvas

```ts
// type signature
type treeCanvas = HTMLCanvasElement | null
// code
treeCanvas: null as HTMLCanvasElement | null
```

#### volatile: mouseoverCanvas

```ts
// type signature
type mouseoverCanvas = HTMLCanvasElement | null
// code
mouseoverCanvas: null as HTMLCanvasElement | null
```

</details>

<details open>
<summary>TreeSidebarMixin - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature                                |
| ------------------------------------------------------ | ---------------------------------------- |
| [`parsedTree`](#getter-parsedtree)                     | `HierarchyNode<NewickNode> \| undefined` |
| [`root`](#getter-root)                                 | `HierarchyNode<NewickNode> \| undefined` |
| [`treeHasBranchLengths`](#getter-treehasbranchlengths) | `boolean`                                |

</details>

<details>
<summary>TreeSidebarMixin - Getters (all signatures)</summary>

#### getter: parsedTree

```ts
type parsedTree = HierarchyNode<NewickNode> | undefined
```

#### getter: root

```ts
type root = HierarchyNode<NewickNode> | undefined
```

#### getter: treeHasBranchLengths

```ts
type treeHasBranchLengths = boolean
```

</details>

<details open>
<summary>TreeSidebarMixin - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                   | Signature                |
| ---------------------------------------- | ------------------------ |
| [`willClearTree`](#method-willcleartree) | `(next: S[]) => boolean` |

</details>

<details>
<summary>TreeSidebarMixin - Methods (all signatures)</summary>

#### method: willClearTree

```ts
type willClearTree = (next: S[]) => boolean
```

</details>

<details open>
<summary>TreeSidebarMixin - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                       | Signature                                           |
| ------------------------------------------------------------ | --------------------------------------------------- |
| [`setLayout`](#action-setlayout)                             | `(layout: S[]) => void`                             |
| [`clearLayout`](#action-clearlayout)                         | `() => void`                                        |
| [`setClusterTree`](#action-setclustertree)                   | `(tree?: string \| undefined) => void`              |
| [`setLayoutAndClusterTree`](#action-setlayoutandclustertree) | `(layout: S[], tree?: string \| undefined) => void` |
| [`setTreeAreaWidth`](#action-settreeareawidth)               | `(width: number) => void`                           |
| [`setSubtreeFilter`](#action-setsubtreefilter)               | `(names?: string[] \| undefined) => void`           |
| [`setHoveredTreeNode`](#action-sethoveredtreenode)           | `(node?: HoveredTreeNode \| undefined) => void`     |
| [`setTreeCanvasRef`](#action-settreecanvasref)               | `(ref: HTMLCanvasElement \| null) => void`          |
| [`setMouseoverCanvasRef`](#action-setmouseovercanvasref)     | `(ref: HTMLCanvasElement \| null) => void`          |

</details>

<details>
<summary>TreeSidebarMixin - Actions (all signatures)</summary>

#### action: setLayout

```ts
type setLayout = (layout: S[]) => void
```

#### action: clearLayout

```ts
type clearLayout = () => void
```

#### action: setClusterTree

```ts
type setClusterTree = (tree?: string | undefined) => void
```

#### action: setLayoutAndClusterTree

```ts
type setLayoutAndClusterTree = (layout: S[], tree?: string | undefined) => void
```

#### action: setTreeAreaWidth

```ts
type setTreeAreaWidth = (width: number) => void
```

#### action: setSubtreeFilter

```ts
type setSubtreeFilter = (names?: string[] | undefined) => void
```

#### action: setHoveredTreeNode

```ts
type setHoveredTreeNode = (node?: HoveredTreeNode | undefined) => void
```

#### action: setTreeCanvasRef

```ts
type setTreeCanvasRef = (ref: HTMLCanvasElement | null) => void
```

#### action: setMouseoverCanvasRef

```ts
type setMouseoverCanvasRef = (ref: HTMLCanvasElement | null) => void
```

</details>
