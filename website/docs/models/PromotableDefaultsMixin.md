---
id: promotabledefaultsmixin
title: PromotableDefaultsMixin
sidebar_label: Mixin -> PromotableDefaultsMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/PromotableDefaultsMixin.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/PromotableDefaultsMixin.md)

## Overview

The `AbstractDisplayModel` side of `promotable` config slots (see
`@jbrowse/core/configuration` `promotableDefaults.ts`): exposes the
session-default badge hooks the track selector calls polymorphically on any
display. A display whose config schema has any `promotable` slot composes this
so the "affected by a session default" badge and its "clear default" action work
without re-implementing the two delegations per display type.

<details open>
<summary>PromotableDefaultsMixin - Methods</summary>

#### method: sessionDefaultChanges

Effective config differences an un-pinned track inherits from session-wide
defaults (distinct from per-track config edits / trackConfigDeltas). Drives the
"affected by a session default" badge.

```ts
type sessionDefaultChanges = () => TrackConfigChange[]
```

</details>

<details open>
<summary>PromotableDefaultsMixin - Actions</summary>

#### action: clearSessionDefaults

Clear the session-wide defaults reported by `sessionDefaultChanges` so this
display (and its siblings of the same type) revert to their config values. Backs
the "clear default" action on the selector badge.

```ts
type clearSessionDefaults = () => void
```

</details>
