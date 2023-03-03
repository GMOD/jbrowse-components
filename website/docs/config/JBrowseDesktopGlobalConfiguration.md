---
id: jbrowsedesktopglobalconfiguration
title: JBrowseDesktopGlobalConfiguration
toplevel: true
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

## Source file

[products/jbrowse-desktop/src/jbrowseConfigSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/jbrowseConfigSchema.ts)

## Docs

configuration here appears as a "configuration" object on the root of
config.json

### JBrowseDesktopGlobalConfiguration - Slots

#### slot: rpc

```js
rpc: RpcManager.configSchema
```

#### slot: highResolutionScaling

```js
highResolutionScaling: {
      type: 'number',
      defaultValue: 2,
    }
```

#### slot: featureDetails.sequenceTypes

```js
sequenceTypes: {
        type: 'stringArray',
        defaultValue: ['mRNA', 'transcript', 'gene'],
      }
```

#### slot: disableAnalytics

```js
disableAnalytics: {
      type: 'boolean',
      defaultValue: false,
    }
```

#### slot: theme

```js
theme: {
      type: 'frozen',
      defaultValue: {},
    }
```

#### slot: extraThemes

```js
extraThemes: {
      type: 'frozen',
      defaultValue: {},
    }
```

#### slot: logoPath

```js
logoPath: {
      type: 'fileLocation',
      defaultValue: { uri: '', locationType: 'UriLocation' },
    }
```
