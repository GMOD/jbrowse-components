---
id: heightmodemixin
title: HeightModeMixin
sidebar_label: Mixin -> HeightModeMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/HeightModeMixin.ts).

## Overview

The resolved track-height views every display with a promotable `heightMode`
config slot shares (the canvas feature display, the alignments display), so the
fixed/grow/fit vocabulary is identical by construction rather than by two call
sites that happen to agree. Each display layers its own `grownHeight` and
`height` override on top — those differ (canvas fits a feature stack, alignments
a grouped pileup) — but the flags below are pure functions of the slot.

`heightMode` is the single source of truth (resolved through the promotable
session-default cascade); `autoHeight`/`fitHeightToDisplay` are plain-flag
conveniences derived from it. `fitTargetHeight` is the raw drag-resizable
`height` slot, read by the fit/grow layout machinery INSTEAD of the reactive
`height` getter: in grow mode `height` returns the content-derived grown height,
so routing the layout through it would make that height depend on itself (a MobX
computed cycle). In fixed/fit mode `fitTargetHeight` equals `height`.

## Members

| Member                                           | Kind    | Defined by      | Description                                                                                                                     |
| ------------------------------------------------ | ------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [heightMode](#getter-heightmode)                 | Getters | HeightModeMixin | The resolved track-height strategy (`fixed`/`grow`/`fit`).                                                                      |
| [fitTargetHeight](#getter-fittargetheight)       | Getters | HeightModeMixin | The drag-resizable track height as stored in the config slot — the fit target the fit/grow layout scales or packs content into. |
| [autoHeight](#getter-autoheight)                 | Getters | HeightModeMixin | `grow` mode as a boolean, derived from the unified `heightMode` slot.                                                           |
| [fitHeightToDisplay](#getter-fitheighttodisplay) | Getters | HeightModeMixin | `fit` mode as a boolean, derived from the unified `heightMode` slot.                                                            |

<details>
<summary>HeightModeMixin - Getters</summary>

#### getter: heightMode

The resolved track-height strategy (`fixed`/`grow`/`fit`). Promotable sentinel
slot: getConf walks the customized-track -> session-default -> `fixed` cascade
and never returns the `inherit` sentinel.

```ts
type heightMode = HeightMode
```

#### getter: fitTargetHeight

The drag-resizable track height as stored in the config slot — the fit target
the fit/grow layout scales or packs content into. Read there instead of the
reactive `height` getter to break the grow-mode cycle
(`height`->grownHeight->layout->height). Equals `height` in fixed/fit.

```ts
type fitTargetHeight = number
```

#### getter: autoHeight

`grow` mode as a boolean, derived from the unified `heightMode` slot.

```ts
type autoHeight = boolean
```

#### getter: fitHeightToDisplay

`fit` mode as a boolean, derived from the unified `heightMode` slot.

```ts
type fitHeightToDisplay = boolean
```

</details>
