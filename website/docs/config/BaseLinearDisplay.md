---
id: baselineardisplay
title: BaseLinearDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/linear-genome-view/src/BaseLinearDisplay/models/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/configSchema.ts)

`BaseLinearDisplay` is a "base" config that is extended by classes like
`LinearBasicDisplay` (used for feature tracks, etc) and `LinearBareDisplay`
(more stripped down than even the basic display, not commonly used)

### BaseLinearDisplay - Identifier

#### slot: explicitIdentifier

### BaseLinearDisplay - Slots

#### slot: fetchSizeLimit

```js
fetchSizeLimit: {
      defaultValue: 1_000_000,
      description:
        "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
      type: 'number',
    }
```

#### slot: height

```js
height: {
      defaultValue: 100,
      description: 'default height for the track',
      type: 'number',
    }
```

#### slot: maxFeatureScreenDensity

```js
maxFeatureScreenDensity: {
      defaultValue: 0.3,
      description:
        'maximum features per pixel that is displayed in the view, used if byte size estimates not available',
      type: 'number',
    }
```

#### slot: mouseover

```js
mouseover: {
      contextVariable: ['feature'],
      defaultValue: `jexl:get(feature,'name')`,
      description: 'text to display when the cursor hovers over a feature',

      type: 'string',
    }
```
