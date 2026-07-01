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
