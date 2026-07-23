---
id: timetraveller
title: TimeTraveller
sidebar_label: General -> TimeTraveller
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/TimeTraveller.ts).

## Overview

Undo/redo history for a target state-tree node: records snapshots as it changes
and exposes canUndo/canRedo with undo/redo actions.

## Members

| Member                                           | Kind       | Defined by    | Description |
| ------------------------------------------------ | ---------- | ------------- | ----------- |
| [undoIdx](#property-undoidx)                     | Properties | TimeTraveller |             |
| [targetPath](#property-targetpath)               | Properties | TimeTraveller |             |
| [history](#volatile-history)                     | Volatiles  | TimeTraveller |             |
| [notTrackingUndo](#volatile-nottrackingundo)     | Volatiles  | TimeTraveller |             |
| [canUndo](#getter-canundo)                       | Getters    | TimeTraveller |             |
| [canRedo](#getter-canredo)                       | Getters    | TimeTraveller |             |
| [stopTrackingUndo](#action-stoptrackingundo)     | Actions    | TimeTraveller |             |
| [resumeTrackingUndo](#action-resumetrackingundo) | Actions    | TimeTraveller |             |
| [addUndoState](#action-addundostate)             | Actions    | TimeTraveller |             |
| [initialize](#action-initialize)                 | Actions    | TimeTraveller |             |
| [undo](#action-undo)                             | Actions    | TimeTraveller |             |
| [redo](#action-redo)                             | Actions    | TimeTraveller |             |

<details>
<summary>TimeTraveller - Properties</summary>

| Member                                           | Type     |
| ------------------------------------------------ | -------- |
| <span id="property-undoidx">undoIdx</span>       | `number` |
| <span id="property-targetpath">targetPath</span> | `string` |

</details>

<details>
<summary>TimeTraveller - Volatiles</summary>

| Member                                                     | Type        |
| ---------------------------------------------------------- | ----------- |
| <span id="volatile-history">history</span>                 | `unknown[]` |
| <span id="volatile-nottrackingundo">notTrackingUndo</span> | `false`     |

</details>

<details>
<summary>TimeTraveller - Getters</summary>

| Member                                   | Type      |
| ---------------------------------------- | --------- |
| <span id="getter-canundo">canUndo</span> | `boolean` |
| <span id="getter-canredo">canRedo</span> | `boolean` |

</details>

<details>
<summary>TimeTraveller - Actions</summary>

| Member                                                         | Type                          |
| -------------------------------------------------------------- | ----------------------------- |
| <span id="action-stoptrackingundo">stopTrackingUndo</span>     | `() => void`                  |
| <span id="action-resumetrackingundo">resumeTrackingUndo</span> | `() => void`                  |
| <span id="action-addundostate">addUndoState</span>             | `(snapshot: unknown) => void` |
| <span id="action-initialize">initialize</span>                 | `() => void`                  |
| <span id="action-undo">undo</span>                             | `() => void`                  |
| <span id="action-redo">redo</span>                             | `() => void`                  |

</details>
