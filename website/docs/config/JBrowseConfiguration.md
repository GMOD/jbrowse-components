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

| Slot                                                            | Type     | Description                                                                                                                 |
| --------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| [configuration.rpc](#slot-configurationrpc)                     |          | configuration for the RPC system that runs data adapters in web workers, see RpcOptions                                     |
| [configuration.formatDetails](#slot-configurationformatdetails) |          | jexl callbacks that add or reformat fields shown in the feature details panel, see FormatDetails                            |
| [configuration.formatAbout](#slot-configurationformatabout)     |          | jexl callbacks that add or reformat fields shown in a track's About dialog, see FormatAbout                                 |
| [configuration.hierarchical](#slot-configurationhierarchical)   |          | configuration for the hierarchical track selector, controlling sorting and default categories, see HierarchicalConfigSchema |
| [configuration.preferences](#slot-configurationpreferences)     |          | user preferences such as scroll-to-zoom and animation behavior, see PreferencesConfigSchema                                 |
| [configuration.theme](#slot-configurationtheme)                 | `frozen` | Material UI theme overrides applied to the JBrowse UI                                                                       |

<details>
<summary>Advanced slots (4)</summary>

| Slot                                                                  | Type           | Description                                                                                      |
| --------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| [configuration.shareURL](#slot-configurationshareurl)                 | `string`       | URL of the session-sharing backend used by the Share button, a JBrowse-hosted service by default |
| [configuration.disableAnalytics](#slot-configurationdisableanalytics) | `boolean`      | disables collection of anonymous usage analytics                                                 |
| [configuration.extraThemes](#slot-configurationextrathemes)           | `frozen`       | additional named themes the user can switch between                                              |
| [configuration.logoPath](#slot-configurationlogopath)                 | `fileLocation` | path to a custom logo image displayed in the app header                                          |

</details>

<details>
<summary>JBrowseConfiguration - Slots</summary>

#### slot: configuration.rpc

configuration for the RPC system that runs data adapters in web workers, see
RpcOptions

```js
RpcManager.configSchema
```

#### slot: configuration.formatDetails

jexl callbacks that add or reformat fields shown in the feature details panel,
see FormatDetails

```js
FormatDetailsConfigSchemaFactory()
```

#### slot: configuration.formatAbout

jexl callbacks that add or reformat fields shown in a track's About dialog, see
FormatAbout

```js
FormatAboutConfigSchemaFactory()
```

#### slot: configuration.shareURL

URL of the session-sharing backend used by the Share button, a JBrowse-hosted
service by default

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`DEFAULT_SHARE_URL` · _advanced_

#### slot: configuration.disableAnalytics

disables collection of anonymous usage analytics

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: configuration.hierarchical

configuration for the hierarchical track selector, controlling sorting and
default categories, see HierarchicalConfigSchema

```js
HierarchicalConfigSchemaFactory()
```

#### slot: configuration.preferences

user preferences such as scroll-to-zoom and animation behavior, see
PreferencesConfigSchema

```js
PreferencesConfigSchemaFactory()
```

#### slot: configuration.theme

Material UI theme overrides applied to the JBrowse UI

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

#### slot: configuration.extraThemes

additional named themes the user can switch between

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`
· _advanced_

#### slot: configuration.logoPath

path to a custom logo image displayed in the app header

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '', locationType: 'UriLocation' }` · _advanced_

</details>
