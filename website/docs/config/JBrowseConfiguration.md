---
id: jbrowseconfiguration
title: JBrowseConfiguration
sidebar_label: Root -> JBrowseConfiguration
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseConfig/RootConfiguration.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/JBrowseConfiguration.md)

## Overview

this is the entry under the `configuration` key e.g.

```json
{
  assemblies,
  tracks,
  configuration: { these entries here  }
}
```

<details open>
<summary>JBrowseConfiguration - Slots</summary>

#### slot: configuration.rpc

```js
RpcManager.configSchema
```

#### slot: configuration.highResolutionScaling

```js
{
  type: 'number',
  defaultValue: 2,
}
```

#### slot: configuration.disableAnalytics

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

#### slot: configuration.extendDefaultSessionWithUrlParams

when true, URL params like `&loc=` navigate within the configured defaultSession
(preserving its tracks and settings) instead of starting a fresh session

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

#### slot: configuration.theme

```js
{
  type: 'frozen',
  defaultValue: {},
}
```

#### slot: configuration.extraThemes

```js
{
  type: 'frozen',
  defaultValue: {},
}
```

#### slot: configuration.logoPath

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '',
    locationType: 'UriLocation',
  },
}
```

</details>
