---
id: diagonalizeprogressmixin
title: DiagonalizeProgressMixin
sidebar_label: Mixin -> DiagonalizeProgressMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/DiagonalizeProgressMixin.ts).

## Overview

The auto-diagonalize lifecycle state shared by the comparative views
(LinearSyntenyView, DotplotView): the in-flight wait, its live RPC status and
stop token, and the two flags that gate `settled` so a screenshot or browser
test can't capture a pre-reorder hairball.

`withDiagonalizeProgress` drives the first three; the requested/complete pair is
set by the view's own init autorun, which is the only thing that knows a reorder
was asked for. Composed rather than duplicated so both views report progress,
cancel, and gate identically.

## Members

| Member                                                             | Kind      | Defined by               | Description                                                                                                                                  |
| ------------------------------------------------------------------ | --------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [awaitingAutoDiagonalize](#volatile-awaitingautodiagonalize)       | Volatiles | DiagonalizeProgressMixin | True while the init autorun is waiting on the diagonalize RPC.                                                                               |
| [autoDiagonalizeRequested](#volatile-autodiagonalizerequested)     | Volatiles | DiagonalizeProgressMixin | Set true as soon as an init-time autoDiagonalize is requested, before any render can paint.                                                  |
| [autoDiagonalizeComplete](#volatile-autodiagonalizecomplete)       | Volatiles | DiagonalizeProgressMixin | Set true only after the init-time diagonalize pass RESOLVES successfully.                                                                    |
| [diagonalizeStatus](#volatile-diagonalizestatus)                   | Volatiles | DiagonalizeProgressMixin | Live status from the auto-diagonalize RPC (download %, parse, algorithm phase) shown on the reordering spinner; undefined outside that wait. |
| [diagonalizeStopToken](#volatile-diagonalizestoptoken)             | Volatiles | DiagonalizeProgressMixin | Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort it; undefined when none is running.                         |
| [diagonalizeSettled](#getter-diagonalizesettled)                   | Getters   | DiagonalizeProgressMixin | The diagonalize half of a view's `settled` gate: either no reorder was requested, or the one that was has completed.                         |
| [setAwaitingAutoDiagonalize](#action-setawaitingautodiagonalize)   | Actions   | DiagonalizeProgressMixin |                                                                                                                                              |
| [setAutoDiagonalizeRequested](#action-setautodiagonalizerequested) | Actions   | DiagonalizeProgressMixin |                                                                                                                                              |
| [setAutoDiagonalizeComplete](#action-setautodiagonalizecomplete)   | Actions   | DiagonalizeProgressMixin |                                                                                                                                              |
| [setDiagonalizeStatus](#action-setdiagonalizestatus)               | Actions   | DiagonalizeProgressMixin |                                                                                                                                              |
| [setDiagonalizeStopToken](#action-setdiagonalizestoptoken)         | Actions   | DiagonalizeProgressMixin |                                                                                                                                              |
| [cancelAutoDiagonalize](#action-cancelautodiagonalize)             | Actions   | DiagonalizeProgressMixin | Abort an in-flight auto-diagonalize; `withDiagonalizeProgress`'s finally clears the wait flag, revealing the (undiagonalized) view.          |

<details>
<summary>DiagonalizeProgressMixin - Volatiles</summary>

#### volatile: awaitingAutoDiagonalize

True while the init autorun is waiting on the diagonalize RPC. Gates the canvas
off — otherwise the user watches an undiagonalized hairball flash before the
reorder kicks in.

```ts
// type signature
type awaitingAutoDiagonalize = false
// code
awaitingAutoDiagonalize: false
```

#### volatile: autoDiagonalizeRequested

Set true as soon as an init-time autoDiagonalize is requested, before any render
can paint. Gates `diagonalizeSettled` so a capture can't commit the pre-reorder
view during the view-building await window, before `awaitingAutoDiagonalize`
flips.

```ts
// type signature
type autoDiagonalizeRequested = false
// code
autoDiagonalizeRequested: false
```

#### volatile: autoDiagonalizeComplete

Set true only after the init-time diagonalize pass RESOLVES successfully. If the
reorder is skipped or throws this stays false, so `diagonalizeSettled` never
reports done on an undiagonalized view — the capture fails loudly (times out)
instead of committing a hairball.

```ts
// type signature
type autoDiagonalizeComplete = false
// code
autoDiagonalizeComplete: false
```

#### volatile: diagonalizeStatus

Live status from the auto-diagonalize RPC (download %, parse, algorithm phase)
shown on the reordering spinner; undefined outside that wait.

```ts
// type signature
type diagonalizeStatus = RpcStatus | undefined
// code
diagonalizeStatus: undefined as RpcStatus | undefined
```

#### volatile: diagonalizeStopToken

Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort
it; undefined when none is running.

```ts
// type signature
type diagonalizeStopToken = StopToken | undefined
// code
diagonalizeStopToken: undefined as StopToken | undefined
```

</details>

<details>
<summary>DiagonalizeProgressMixin - Getters</summary>

#### getter: diagonalizeSettled

The diagonalize half of a view's `settled` gate: either no reorder was
requested, or the one that was has completed.

```ts
type diagonalizeSettled = boolean
```

</details>

<details>
<summary>DiagonalizeProgressMixin - Actions</summary>

#### action: cancelAutoDiagonalize

Abort an in-flight auto-diagonalize; `withDiagonalizeProgress`'s finally clears
the wait flag, revealing the (undiagonalized) view.

```ts
type cancelAutoDiagonalize = () => void
```

</details>

<details>
<summary>DiagonalizeProgressMixin - Actions (other undocumented members)</summary>

| Member                                                                           | Type                                     |
| -------------------------------------------------------------------------------- | ---------------------------------------- |
| <span id="action-setawaitingautodiagonalize">setAwaitingAutoDiagonalize</span>   | `(arg: boolean) => void`                 |
| <span id="action-setautodiagonalizerequested">setAutoDiagonalizeRequested</span> | `(arg: boolean) => void`                 |
| <span id="action-setautodiagonalizecomplete">setAutoDiagonalizeComplete</span>   | `(arg: boolean) => void`                 |
| <span id="action-setdiagonalizestatus">setDiagonalizeStatus</span>               | `(arg?: RpcStatus \| undefined) => void` |
| <span id="action-setdiagonalizestoptoken">setDiagonalizeStopToken</span>         | `(arg?: StopToken \| undefined) => void` |

</details>
