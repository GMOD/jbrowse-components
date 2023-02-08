---
id: jbrowsewebconfiguration
title: JBrowseWebConfiguration
toplevel: true
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

## Source file

[products/jbrowse-web/src/jbrowseModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/jbrowseModel.ts)

## Docs

configuration here appears as a "configuration" object on the root of
config.json

### JBrowseWebConfiguration - Slots

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

#### slot: shareURL

```js
shareURL: {
          type: 'string',
          defaultValue: 'https:
        }
```

#### slot: featureDetails.sequenceTypes

```js
sequenceTypes: {
            type: 'stringArray',
            defaultValue: ['mRNA', 'transcript', 'gene', 'CDS'],
          }
```

#### slot: formatDetails.feature

```js
feature: {
            type: 'frozen',
            description: 'adds extra fields to the feature details',
            defaultValue: {},
            contextVariable: ['feature'],
          }
```

#### slot: formatDetails.subfeatures

```js
subfeatures: {
            type: 'frozen',
            description: 'adds extra fields to the subfeatures of a feature',
            defaultValue: {},
            contextVariable: ['feature'],
          }
```

#### slot: formatDetails.depth

```js
depth: {
            type: 'number',
            defaultValue: 2,
            description: 'depth to iterate on subfeatures',
          }
```

#### slot: formatAbout.conf

```js
config: {
            type: 'frozen',
            description: 'formats configuration object in about dialog',
            defaultValue: {},
            contextVariable: ['config'],
          }
```

#### slot: formatAbout.hideUris

```js
hideUris: {
            type: 'boolean',
            defaultValue: false,
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
theme: { type: 'frozen', defaultValue: {} }
```

#### slot: extraThemes

```js
extraThemes: { type: 'frozen', defaultValue: {} }
```

#### slot: logoPath

```js
logoPath: {
          type: 'fileLocation',
          defaultValue: { uri: '', locationType: 'UriLocation' },
        }
```
