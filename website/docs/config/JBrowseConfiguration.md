---
id: jbrowseconfiguration
title: JBrowseConfiguration
sidebar_label: Root -> JBrowseConfiguration
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseConfig/RootConfiguration.ts).

this is the entry under the `configuration` key e.g.

```json
{
  assemblies,
  tracks,
  configuration: { these entries here  }
}
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                                        | Type     | Description |
| ----------------------------------------------------------- | -------- | ----------- |
| [configuration.rpc](#slot-configurationrpc)                 |          |             |
| [configuration.preferences](#slot-configurationpreferences) |          |             |
| [configuration.theme](#slot-configurationtheme)             | `frozen` |             |

<details>
<summary>Advanced slots (3)</summary>

| Slot                                                                  | Type           | Description |
| --------------------------------------------------------------------- | -------------- | ----------- |
| [configuration.disableAnalytics](#slot-configurationdisableanalytics) | `boolean`      |             |
| [configuration.extraThemes](#slot-configurationextrathemes)           | `frozen`       |             |
| [configuration.logoPath](#slot-configurationlogopath)                 | `fileLocation` |             |

</details>

<details>
<summary>JBrowseConfiguration - Slots</summary>

#### slot: configuration.rpc

```js
RpcManager.configSchema
```

#### slot: configuration.disableAnalytics

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: configuration.preferences

```js
PreferencesConfigSchemaFactory()
```

#### slot: configuration.theme

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

#### slot: configuration.extraThemes

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`
· _advanced_

#### slot: configuration.logoPath

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '', locationType: 'UriLocation' }` · _advanced_

</details>
