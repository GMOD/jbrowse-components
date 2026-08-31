---
id: timetraveller
title: TimeTraveller
sidebar_label: General -> TimeTraveller
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/TimeTraveller.ts).

Undo/redo history for a target state-tree node: records snapshots as it
changes and exposes canUndo/canRedo with undo/redo actions.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-undoidx">**undoIdx**</span><br><code>undoIdx: -1</code> |  |
| <span id="property-targetpath">**targetPath**</span><br><code>targetPath: ''</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-history">**history**</span><br><code>history: [] as unknown[]</code> |  |
| <span id="volatile-nottrackingundo">**notTrackingUndo**</span><br><code>notTrackingUndo: false</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-canundo">**canUndo**</span><br><code>boolean</code> |  |
| <span id="getter-canredo">**canRedo**</span><br><code>boolean</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-stoptrackingundo">**stopTrackingUndo**</span><br><code>() =&gt; void</code> |  |
| <span id="action-resumetrackingundo">**resumeTrackingUndo**</span><br><code>() =&gt; void</code> |  |
| <span id="action-addundostate">**addUndoState**</span><br><code>(snapshot: unknown) =&gt; void</code> |  |
| <span id="action-initialize">**initialize**</span><br><code>() =&gt; void</code> | Start recording history for the target store. Re-runs whenever the root swaps in a new session node, so it must be idempotent: the previous registration is disposed and the history reset, because `history` is volatile while `undoIdx` is a persisted prop — carrying the old session's snapshots forward would make undo apply them to the new one. |
| <span id="action-undo">**undo**</span><br><code>() =&gt; void</code> |  |
| <span id="action-redo">**redo**</span><br><code>() =&gt; void</code> |  |
