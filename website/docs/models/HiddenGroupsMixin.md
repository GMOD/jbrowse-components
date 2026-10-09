---
id: hiddengroupsmixin
title: HiddenGroupsMixin
description: "The sections a reader hid from an in-track grouping's chips: the facet.hidden keys while the stack groups by the facet's own field, hideGroup and showAllGroups writing them, the…"
sidebar_label: Mixin -> HiddenGroupsMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/HiddenGroupsMixin.ts).

The sections a reader hid from an in-track grouping's chips: the `facet.hidden` keys while the stack groups by the facet's own field, `hideGroup` and `showAllGroups` writing them, the `displayHiddenGroupKeys` hook a display hides a lane through on its own behalf, `hiddenGroupKeys` folding both, `groupStateKey` (with the `ownGroupState` hook) for a live figure to key on, and the `dropGroupState` reset that fires when the host's `groupKeySpace` moves

The hidden sections are config, `facet.hidden`, so they ride a session and
a share link, and a new `field` written whole starts with none. A key names
a section only within the grouping that issued it, `''` being both the
ungrouped section and every field's catch-all, so they apply only while
the stack groups by `facet.field`: where a mode degrades the grouping (an
alignments chain beside a per-read facet) they wait unread. A display
keeping volatile per-group state of its own overrides `dropGroupState`,
which the reset calls.

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-displayhiddengroupkeys">**displayHiddenGroupKeys**</span><br><code>ReadonlySet&lt;string&gt;</code> | Overridable hook: lanes the DISPLAY hides on its own behalf, as opposed to the ones the user hid from a chip. Empty by default; LGVSyntenyDisplay hides the self-alignment lane of an all-vs-all track through it. |
| <span id="getter-owngroupstate">**ownGroupState**</span><br><code>unknown</code> | Overridable hook: the per-group state a display keeps beyond the hidden sections, as a plain value. None by default; alignments answers its collapses and height overrides, the state its `dropGroupState` clears. |
| <span id="getter-hiddengroups">**hiddenGroups**</span><br><code>ReadonlySet&lt;string&gt;</code> | The sections the user hid: `facet.hidden`, while the stack groups by the facet's own field. |
| <span id="getter-hiddengroupkeys">**hiddenGroupKeys**</span><br><code>ReadonlySet&lt;string&gt;</code> | Every key the stack drops: what the user hid and what the display hides for itself. A fresh Set per change, so a layout memo comparing its inputs by identity sees a hide. |
| <span id="getter-groupstatekey">**groupStateKey**</span><br><code>unknown</code> | All the per-group state as a plain, comparable value: the hidden sections, sorted, beside `ownGroupState`. A live figure keys on it, since a display's own state is volatile and in no snapshot; a Set would serialize as `{}`. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-hidegroup">**hideGroup**</span><br><code>(key: string) =&gt; void</code> | Drop a section from the stack. Reversed by `showAllGroups`, which the "Show..." menu offers while anything is hidden, since a hidden section draws no chip of its own to come back from. |
| <span id="action-showallgroups">**showAllGroups**</span><br><code>() =&gt; void</code> |  |
| <span id="action-dropgroupstate">**dropGroupState**</span><br><code>() =&gt; void</code> | Overridable hook: forget the volatile per-group state a display keeps. Nothing by default, since the hidden sections are config. |
