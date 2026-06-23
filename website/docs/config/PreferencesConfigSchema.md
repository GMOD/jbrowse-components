---
id: preferencesconfigschema
title: PreferencesConfigSchema
sidebar_label: Root -> PreferencesConfigSchema
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/PreferencesConfig.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/PreferencesConfigSchema.md)

## Overview

admin/embedder defaults for user-facing preferences, found on the root config as
`configuration.preferences`. Individual users override these at runtime
(persisted to localStorage) via the session `getPreference` reader; this mirrors
the display-level `ConfigOverrideMixin` override pattern at app scope.

<details open>
<summary>PreferencesConfigSchema - Slots</summary>

#### slot: configuration.preferences.animationMode

controls feature-layout animations: 'system' respects the OS
prefers-reduced-motion setting, 'enabled' always animates, 'disabled' never
animates

```js
{
  model: types.enumeration('AnimationMode', [
    'system',
    'enabled',
    'disabled',
  ]),
  type: 'stringEnum',
  defaultValue: 'system',
}
```

#### slot: configuration.preferences.scrollZoom

when true, scrolling the mouse wheel over a track zooms in and out without
holding Ctrl. Applies globally to all wheel-zoom views.

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

</details>
