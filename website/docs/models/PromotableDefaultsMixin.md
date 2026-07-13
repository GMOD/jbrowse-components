---
id: promotabledefaultsmixin
title: PromotableDefaultsMixin
sidebar_label: Mixin -> PromotableDefaultsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/PromotableDefaultsMixin.tsx).

## Overview

The `AbstractDisplayModel` side of `promotable` config slots (see
`@jbrowse/core/configuration` `promotableDefaults.ts`): exposes the
session-default badge hooks the track selector calls polymorphically on any
display. A display whose config schema has any `promotable` slot composes this
so the "affected by a session default" badge and its "clear default" action work
without re-implementing the two delegations per display type.

## Members

| Member                                                         | Kind    | Defined by              | Description                                                                                                                                                                                                        |
| -------------------------------------------------------------- | ------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [displayTypeDefaultChanges](#method-displaytypedefaultchanges) | Methods | PromotableDefaultsMixin | Effective config differences a track following the default inherits from session-wide defaults (distinct from per-track config edits / trackConfigDeltas). Drives the "affected by a session default" badge.       |
| [clearDisplayTypeDefaults](#action-cleardisplaytypedefaults)   | Actions | PromotableDefaultsMixin | Clear the session-wide defaults reported by `displayTypeDefaultChanges` so this display (and its siblings of the same type) revert to their config values. Backs the "clear default" action on the selector badge. |

<details>
<summary>PromotableDefaultsMixin - Methods</summary>

#### method: displayTypeDefaultChanges

Effective config differences a track following the default inherits from
session-wide defaults (distinct from per-track config edits /
trackConfigDeltas). Drives the "affected by a session default" badge.

```ts
type displayTypeDefaultChanges = () => TrackConfigChange[]
```

</details>

<details>
<summary>PromotableDefaultsMixin - Actions</summary>

#### action: clearDisplayTypeDefaults

Clear the session-wide defaults reported by `displayTypeDefaultChanges` so this
display (and its siblings of the same type) revert to their config values. Backs
the "clear default" action on the selector badge.

```ts
type clearDisplayTypeDefaults = () => void
```

</details>
