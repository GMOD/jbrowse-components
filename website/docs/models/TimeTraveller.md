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

<details>
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

<details>
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

<details>
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

<details>
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
