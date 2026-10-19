---
id: contextmenumixin
title: ContextMenuMixin
description: "The right-click state of a display whose menu acts on a position: the anchor plus whatever the click resolved to (a genomic column, a feature), held as one value so the menu's open-ness and the…"
sidebar_label: Mixin -> ContextMenuMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/ContextMenuMixin.ts).

The right-click state of a display whose menu acts on a position: the anchor plus whatever the click resolved to (a genomic column, a feature), held as one value so the menu's open-ness and the position its items act on cannot disagree.

Brings `contextMenuInfo`, `openContextMenu` and `closeContextMenu`; the
display supplies `contextMenuItems()`, and `DisplayChrome` renders the menu
for every display composing this.

`Info` is what the display resolves the click to: the multi-row painting
holds the feature under it, and multi-wiggle and MAF hold a column. Every
one of them holds the anchor. The items are built from this value when the
menu opens, not read inside an item's `onClick`, because `closeContextMenu`
runs first when an item is clicked.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-contextmenuinfo">**contextMenuInfo**</span><br><code>Info &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-opencontextmenu">**openContextMenu**</span><br><code>(info: Info) =&gt; void</code> |  |
| <span id="action-closecontextmenu">**closeContextMenu**</span><br><code>() =&gt; void</code> |  |
