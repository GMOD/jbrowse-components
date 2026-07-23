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

It re-declares the `type`/`configuration`/`ignorePromotedDefaults` members it
reads (`compose` merges them last-wins with the concrete display's own
declarations, all originating in BaseDisplay) so `self` is typed as a promotable
display and the two delegations stay cast-free.

## Members

| Member                                                         | Kind       | Defined by              | Description                                                                                                                                                |
| -------------------------------------------------------------- | ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                         | Properties | PromotableDefaultsMixin |                                                                                                                                                            |
| [configuration](#property-configuration)                       | Properties | PromotableDefaultsMixin |                                                                                                                                                            |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)     | Properties | PromotableDefaultsMixin |                                                                                                                                                            |
| [displayTypeDefaultChanges](#method-displaytypedefaultchanges) | Methods    | PromotableDefaultsMixin | Effective config differences a track following the default inherits from session-wide defaults (distinct from per-track config edits / trackConfigDeltas). |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults) | Actions    | PromotableDefaultsMixin |                                                                                                                                                            |
| [clearDisplayTypeDefaults](#action-cleardisplaytypedefaults)   | Actions    | PromotableDefaultsMixin | Clear the session-wide defaults reported by `displayTypeDefaultChanges` so this display (and its siblings of the same type) revert to their config values. |

<details>
<summary>PromotableDefaultsMixin - Properties</summary>

| Member                                                                   | Type                                                  |
| ------------------------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-type">type</span>                                     | `ISimpleType<string>`                                 |
| <span id="property-configuration">configuration</span>                   | `IConfigurationReference<AnyConfigurationSchemaType>` |
| <span id="property-ignorepromoteddefaults">ignorePromotedDefaults</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>`   |

</details>

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

<details>
<summary>PromotableDefaultsMixin - Actions (other undocumented members)</summary>

| Member                                                                       | Type                      |
| ---------------------------------------------------------------------------- | ------------------------- |
| <span id="action-setignorepromoteddefaults">setIgnorePromotedDefaults</span> | `(flag: boolean) => void` |

</details>
