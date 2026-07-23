---
id: treesidebarmixin
title: TreeSidebarMixin
sidebar_label: Mixin -> TreeSidebarMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/TreeSidebarMixin.ts).

## Overview

Adds a dendrogram sidebar to a display: stores the leaf layout, newick cluster
tree, sidebar width and subtree filter, plus the hover/canvas volatile state
used while drawing the tree.

## Members

| Member                                                     | Kind       | Defined by       | Description |
| ---------------------------------------------------------- | ---------- | ---------------- | ----------- |
| [layout](#property-layout)                                 | Properties | TreeSidebarMixin |             |
| [clusterTree](#property-clustertree)                       | Properties | TreeSidebarMixin |             |
| [treeAreaWidth](#property-treeareawidth)                   | Properties | TreeSidebarMixin |             |
| [subtreeFilter](#property-subtreefilter)                   | Properties | TreeSidebarMixin |             |
| [hoveredTreeNode](#volatile-hoveredtreenode)               | Volatiles  | TreeSidebarMixin |             |
| [treeCanvas](#volatile-treecanvas)                         | Volatiles  | TreeSidebarMixin |             |
| [mouseoverCanvas](#volatile-mouseovercanvas)               | Volatiles  | TreeSidebarMixin |             |
| [parsedTree](#getter-parsedtree)                           | Getters    | TreeSidebarMixin |             |
| [root](#getter-root)                                       | Getters    | TreeSidebarMixin |             |
| [treeHasBranchLengths](#getter-treehasbranchlengths)       | Getters    | TreeSidebarMixin |             |
| [willClearTree](#method-willcleartree)                     | Methods    | TreeSidebarMixin |             |
| [setLayout](#action-setlayout)                             | Actions    | TreeSidebarMixin |             |
| [clearLayout](#action-clearlayout)                         | Actions    | TreeSidebarMixin |             |
| [setClusterTree](#action-setclustertree)                   | Actions    | TreeSidebarMixin |             |
| [setLayoutAndClusterTree](#action-setlayoutandclustertree) | Actions    | TreeSidebarMixin |             |
| [setTreeAreaWidth](#action-settreeareawidth)               | Actions    | TreeSidebarMixin |             |
| [setSubtreeFilter](#action-setsubtreefilter)               | Actions    | TreeSidebarMixin |             |
| [setHoveredTreeNode](#action-sethoveredtreenode)           | Actions    | TreeSidebarMixin |             |
| [setTreeCanvasRef](#action-settreecanvasref)               | Actions    | TreeSidebarMixin |             |
| [setMouseoverCanvasRef](#action-setmouseovercanvasref)     | Actions    | TreeSidebarMixin |             |

<details>
<summary>TreeSidebarMixin - Properties</summary>

| Member                                                 | Type                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| <span id="property-layout">layout</span>               | `IOptionalIType<IType<S[], S[], S[]>, [undefined]>`                    |
| <span id="property-clustertree">clusterTree</span>     | `IOptionalIType<IMaybe<ISimpleType<string>>, [undefined]>`             |
| <span id="property-treeareawidth">treeAreaWidth</span> | `IOptionalIType<ISimpleType<number>, [undefined]>`                     |
| <span id="property-subtreefilter">subtreeFilter</span> | `IOptionalIType<IMaybe<IArrayType<ISimpleType<string>>>, [undefined]>` |

</details>

<details>
<summary>TreeSidebarMixin - Volatiles</summary>

| Member                                                     | Type                           |
| ---------------------------------------------------------- | ------------------------------ |
| <span id="volatile-hoveredtreenode">hoveredTreeNode</span> | `HoveredTreeNode \| undefined` |
| <span id="volatile-treecanvas">treeCanvas</span>           | `HTMLCanvasElement \| null`    |
| <span id="volatile-mouseovercanvas">mouseoverCanvas</span> | `HTMLCanvasElement \| null`    |

</details>

<details>
<summary>TreeSidebarMixin - Getters</summary>

| Member                                                             | Type                                     |
| ------------------------------------------------------------------ | ---------------------------------------- |
| <span id="getter-parsedtree">parsedTree</span>                     | `HierarchyNode<NewickNode> \| undefined` |
| <span id="getter-root">root</span>                                 | `HierarchyNode<NewickNode> \| undefined` |
| <span id="getter-treehasbranchlengths">treeHasBranchLengths</span> | `boolean`                                |

</details>

<details>
<summary>TreeSidebarMixin - Methods</summary>

| Member                                               | Type                     |
| ---------------------------------------------------- | ------------------------ |
| <span id="method-willcleartree">willClearTree</span> | `(next: S[]) => boolean` |

</details>

<details>
<summary>TreeSidebarMixin - Actions</summary>

| Member                                                                   | Type                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------- |
| <span id="action-setlayout">setLayout</span>                             | `(layout: S[]) => void`                             |
| <span id="action-clearlayout">clearLayout</span>                         | `() => void`                                        |
| <span id="action-setclustertree">setClusterTree</span>                   | `(tree?: string \| undefined) => void`              |
| <span id="action-setlayoutandclustertree">setLayoutAndClusterTree</span> | `(layout: S[], tree?: string \| undefined) => void` |
| <span id="action-settreeareawidth">setTreeAreaWidth</span>               | `(width: number) => void`                           |
| <span id="action-setsubtreefilter">setSubtreeFilter</span>               | `(names?: string[] \| undefined) => void`           |
| <span id="action-sethoveredtreenode">setHoveredTreeNode</span>           | `(node?: HoveredTreeNode \| undefined) => void`     |
| <span id="action-settreecanvasref">setTreeCanvasRef</span>               | `(ref: HTMLCanvasElement \| null) => void`          |
| <span id="action-setmouseovercanvasref">setMouseoverCanvasRef</span>     | `(ref: HTMLCanvasElement \| null) => void`          |

</details>
