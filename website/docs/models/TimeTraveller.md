---
id: timetraveller
title: TimeTraveller
sidebar_label: General -> TimeTraveller
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/TimeTraveller.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/TimeTraveller.md)

## Overview

Undo/redo history for a target state-tree node: records snapshots as it changes
and exposes canUndo/canRedo with undo/redo actions.

<details open>
<summary>TimeTraveller - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                               | Signature |
| ------------------------------------ | --------- |
| [`undoIdx`](#property-undoidx)       | `number`  |
| [`targetPath`](#property-targetpath) | `string`  |

</details>

<details>
<summary>TimeTraveller - Properties (all signatures)</summary>

#### property: undoIdx

```ts
// type signature
type undoIdx = number
// code
undoIdx: -1
```

#### property: targetPath

```ts
// type signature
type targetPath = string
// code
targetPath: ''
```

</details>

<details open>
<summary>TimeTraveller - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature   |
| ---------------------------------------------- | ----------- |
| [`history`](#volatile-history)                 | `unknown[]` |
| [`notTrackingUndo`](#volatile-nottrackingundo) | `false`     |

</details>

<details>
<summary>TimeTraveller - Volatiles (all signatures)</summary>

#### volatile: history

```ts
// type signature
type history = unknown[]
// code
history: [] as unknown[]
```

#### volatile: notTrackingUndo

```ts
// type signature
type notTrackingUndo = false
// code
notTrackingUndo: false
```

</details>

<details open>
<summary>TimeTraveller - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                       | Signature |
| ---------------------------- | --------- |
| [`canUndo`](#getter-canundo) | `boolean` |
| [`canRedo`](#getter-canredo) | `boolean` |

</details>

<details>
<summary>TimeTraveller - Getters (all signatures)</summary>

#### getter: canUndo

```ts
type canUndo = boolean
```

#### getter: canRedo

```ts
type canRedo = boolean
```

</details>

<details open>
<summary>TimeTraveller - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                     |
| -------------------------------------------------- | ----------------------------- |
| [`stopTrackingUndo`](#action-stoptrackingundo)     | `() => void`                  |
| [`resumeTrackingUndo`](#action-resumetrackingundo) | `() => void`                  |
| [`addUndoState`](#action-addundostate)             | `(snapshot: unknown) => void` |
| [`initialize`](#action-initialize)                 | `() => void`                  |
| [`undo`](#action-undo)                             | `() => void`                  |
| [`redo`](#action-redo)                             | `() => void`                  |

</details>

<details>
<summary>TimeTraveller - Actions (all signatures)</summary>

#### action: stopTrackingUndo

```ts
type stopTrackingUndo = () => void
```

#### action: resumeTrackingUndo

```ts
type resumeTrackingUndo = () => void
```

#### action: addUndoState

```ts
type addUndoState = (snapshot: unknown) => void
```

#### action: initialize

```ts
type initialize = () => void
```

#### action: undo

```ts
type undo = () => void
```

#### action: redo

```ts
type redo = () => void
```

</details>
