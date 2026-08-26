---
id: contextmenumixin
title: ContextMenuMixin
sidebar_label: Mixin -> ContextMenuMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/ContextMenuMixin.ts).

#crossCuttingMixin The right-click state of a display whose menu acts on a
position: the anchor plus whatever the click resolved to (a genomic column,
a feature), held as one value so the menu's open-ness and the position its
items act on cannot disagree. Brings `contextMenuInfo`, `openContextMenu`
and `closeContextMenu`; the display supplies `contextMenuItems()`, and
`DisplayContextMenu` renders the two together

`Info` is the display's own resolution of the click — the multi-row painting
carries the feature under it, multi-wiggle and MAF a column — and every one
of them carries the anchor. The items are built from this value when the
menu opens, not read inside an item's `onClick`, because `closeContextMenu`
runs first when an item is clicked.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-contextmenuinfo">**contextMenuInfo**</span><br><code>contextMenuInfo: undefined as Info &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-opencontextmenu">**openContextMenu**</span><br><code>(info: Info) =&gt; void</code> |  |
| <span id="action-closecontextmenu">**closeContextMenu**</span><br><code>() =&gt; void</code> |  |
