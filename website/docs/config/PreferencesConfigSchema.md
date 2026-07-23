---
id: preferencesconfigschema
title: PreferencesConfigSchema
sidebar_label: Root -> PreferencesConfigSchema
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/PreferencesConfig.ts).

admin/embedder defaults for user-facing preferences, found on the root config as
`configuration.preferences`. Individual users override these at runtime
(persisted to localStorage) via the session `getPreference` reader; a runtime
override map layered over config defaults, at app scope.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                                                                   | Type                                     | Description                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configuration.preferences.animationMode](#slot-configurationpreferencesanimationmode) | `stringEnum` (system, enabled, disabled) | controls feature-layout animations: 'enabled' always animates (the default), 'system' respects the OS prefers-reduced-motion setting, 'disabled' never animates |
| [configuration.preferences.scrollZoom](#slot-configurationpreferencesscrollzoom)       | `boolean`                                | when true, scrolling the mouse wheel over a track zooms in and out without holding Ctrl.                                                                        |
| [configuration.preferences.useWorkspaces](#slot-configurationpreferencesuseworkspaces) | `boolean`                                | when true, views open in the dockview-based tabbed/tiled workspace layout rather than stacked vertically.                                                       |

<details>
<summary>PreferencesConfigSchema - Slots</summary>

#### slot: configuration.preferences.animationMode

controls feature-layout animations: 'enabled' always animates (the default),
'system' respects the OS prefers-reduced-motion setting, 'disabled' never
animates

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`system`, `enabled`, `disabled`) · **Default:** `'enabled'`

#### slot: configuration.preferences.scrollZoom

when true, scrolling the mouse wheel over a track zooms in and out without
holding Ctrl. Applies globally to all wheel-zoom views.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: configuration.preferences.useWorkspaces

when true, views open in the dockview-based tabbed/tiled workspace layout rather
than stacked vertically. Only the default: a session naming `useWorkspaces`
itself still wins, as does a user's own toggle.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

</details>
