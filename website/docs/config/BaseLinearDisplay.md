---
id: baselineardisplay
title: BaseLinearDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/linear-genome-view/src/BaseLinearDisplay/models/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/configSchema.ts)

`BaseLinearDisplay` is a "base" config that is extended by other configs
including

- `LinearBasicDisplay` (used for feature tracks, etc)
- `LinearBareDisplay` (more stripped down than even the basic display, not
  commonly used)

### BaseLinearDisplay - Identifier

#### slot: explicitIdentifier

### BaseLinearDisplay - Slots

#### slot: maxFeatureScreenDensity

```js
maxFeatureScreenDensity: {
      type: 'number',
      description:
        'maximum features per pixel that is displayed in the view, used if byte size estimates not available',
      defaultValue: 0.3,
    }
```

#### slot: fetchSizeLimit

```js
fetchSizeLimit: {
      type: 'number',
      defaultValue: 1_000_000,
      description:
        "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
    }
```

#### slot: height

```js
height: {
      type: 'number',
      defaultValue: 100,
      description: 'default height for the track',
    }
```

#### slot: mouseover

```js
mouseover: {
      type: 'string',
      description: 'text to display when the cursor hovers over a feature',
      defaultValue: `jexl:get(feature,'name')`,

      contextVariable: ['feature'],
    }
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

```js
jexlFilters: {
      type: 'stringArray',
      description:
        'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
      defaultValue: [],
    }
```
