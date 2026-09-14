---
id: hiddengroupsmixin
title: HiddenGroupsMixin
sidebar_label: Mixin -> HiddenGroupsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/HiddenGroupsMixin.ts).

#crossCuttingMixin The sections a reader hid from an in-track grouping's chips: the `hiddenGroups` set, `hideGroup` and `showAllGroups` over it, the `displayHiddenGroupKeys` hook a display hides a lane through on its own behalf, `hiddenGroupKeys` folding both, and the `dropGroupState` reset that fires when the host's `groupKeySpace` moves

A key names a section only within the grouping that issued it: `''` is both
the ungrouped section and every dimension's catch-all, and two dimensions'
digit keys overlap outright. So the state is volatile and dropped whenever
`groupKeySpace` changes, whichever route moved it: the menu, the settings
editor writing the slot, a reset, or a mode that degrades the grouping. A
display keeping more per-group state overrides `dropGroupState` and calls
through.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-hiddengroups">**hiddenGroups**</span><br><code>hiddenGroups: observable.set&lt;string&gt;()</code> | Group keys the user hid from the stack. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-displayhiddengroupkeys">**displayHiddenGroupKeys**</span><br><code>ReadonlySet&lt;string&gt;</code> | Overridable hook: lanes the DISPLAY hides on its own behalf, as opposed to the ones the user hid from a chip. Empty by default; LGVSyntenyDisplay hides the self-alignment lane of an all-vs-all track through it. |
| <span id="getter-hiddengroupkeys">**hiddenGroupKeys**</span><br><code>ReadonlySet&lt;string&gt;</code> | Every key the stack drops: what the user hid and what the display hides for itself. A fresh Set per change rather than the observable set itself, so a layout memo comparing its inputs by identity sees a hide. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-hidegroup">**hideGroup**</span><br><code>(key: string) =&gt; void</code> | Drop a section from the stack. Reversed by `showAllGroups`, which the "Show..." menu offers while anything is hidden, since a hidden section draws no chip of its own to come back from. |
| <span id="action-showallgroups">**showAllGroups**</span><br><code>() =&gt; void</code> |  |
| <span id="action-dropgroupstate">**dropGroupState**</span><br><code>() =&gt; void</code> | Forget every hidden section. |
