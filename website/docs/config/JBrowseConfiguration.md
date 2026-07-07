---
id: jbrowseconfiguration
title: JBrowseConfiguration
sidebar_label: Root -> JBrowseConfiguration
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseConfig/RootConfiguration.ts).

## Overview

this is the entry under the `configuration` key e.g.

```json
{
  assemblies,
  tracks,
  configuration: { these entries here  }
}
```

| Slot                                                                  | Type           | Description |
| --------------------------------------------------------------------- | -------------- | ----------- |
| [configuration.rpc](#slot-configurationrpc)                           |                |             |
| [configuration.disableAnalytics](#slot-configurationdisableanalytics) | `boolean`      |             |
| [configuration.preferences](#slot-configurationpreferences)           |                |             |
| [configuration.theme](#slot-configurationtheme)                       | `frozen`       |             |
| [configuration.extraThemes](#slot-configurationextrathemes)           | `frozen`       |             |
| [configuration.logoPath](#slot-configurationlogopath)                 | `fileLocation` |             |

<details>
<summary>JBrowseConfiguration - Slots</summary>

#### slot: configuration.rpc

```js
RpcManager.configSchema
```

#### slot: configuration.disableAnalytics

**Type:** `boolean` · **Default:** `false` · _advanced_

#### slot: configuration.preferences

```js
PreferencesConfigSchemaFactory()
```

#### slot: configuration.theme

**Type:** `frozen` · **Default:** `{}`

#### slot: configuration.extraThemes

**Type:** `frozen` · **Default:** `{}` · _advanced_

#### slot: configuration.logoPath

**Type:** `fileLocation` · **Default:**
`{ uri: '', locationType: 'UriLocation' }` · _advanced_

</details>
