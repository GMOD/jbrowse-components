---
id: preferencesconfigschema
title: PreferencesConfigSchema
sidebar_label: Root -> PreferencesConfigSchema
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/PreferencesConfig.ts).

## Overview

admin/embedder defaults for user-facing preferences, found on the root config as
`configuration.preferences`. Individual users override these at runtime
(persisted to localStorage) via the session `getPreference` reader; a runtime
override map layered over config defaults, at app scope.

<details open>
<summary>PreferencesConfigSchema - Slots</summary>

#### slot: configuration.preferences.animationMode

controls feature-layout animations: 'enabled' always animates (the default),
'system' respects the OS prefers-reduced-motion setting, 'disabled' never
animates

**Type:** `stringEnum` (one of `system`, `enabled`, `disabled`) · **Default:**
`'enabled'`

#### slot: configuration.preferences.scrollZoom

when true, scrolling the mouse wheel over a track zooms in and out without
holding Ctrl. Applies globally to all wheel-zoom views.

**Type:** `boolean` · **Default:** `false`

</details>
