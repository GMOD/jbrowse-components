---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/configSchemaF.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LGVSyntenyDisplay.md)

## Overview

extends config
- [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so this page is self-contained.

### Inherited from [LinearAlignmentsDisplay](../linearalignmentsdisplay)

#### slot: featureHeight

```js
featureHeight: {
        type: 'number',
        defaultValue: 7,
        description: 'Height of each feature (read) in pixels',
      }
```

#### slot: featureSpacing

```js
featureSpacing: {
        type: 'number',
        defaultValue: 1,
        description: 'Spacing between features in pixels',
      }
```

#### slot: readConnectionsLineWidth

```js
readConnectionsLineWidth: {
        type: 'number',
        defaultValue: 1,
        description: 'Line width for read-connection arcs/lines in pixels',
      }
```

#### slot: maxHeight

```js
maxHeight: {
        type: 'number',
        defaultValue: 6000,
        description:
          'Maximum pixel height of the pileup layout; reads beyond this are not stacked (coverage still reflects true depth)',
      }
```

#### slot: height

```js
height: {
        type: 'number',
        defaultValue: 250,
      }
```

#### slot: colorBy

```js
colorBy: {
        type: 'frozen',
        defaultValue: { type: 'normal' },
        description: 'Color scheme for reads',
      }
```

#### slot: filterBy

```js
filterBy: {
        type: 'frozen',
        defaultValue: {
          flagInclude: 0,
          flagExclude: 1540,
        },
        description: 'Filter settings for reads',
      }
```

#### slot: autoscale

```js
autoscale: {
        type: 'stringEnum',
        model: types.enumeration('Coverage autoscale type', [
          'local',
          'localsd',
        ]),
        defaultValue: 'local',
        description: 'Coverage autoscale type',
      }
```

#### slot: minScore

```js
minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'Minimum coverage depth bound',
      }
```

#### slot: maxScore

```js
maxScore: {
        type: 'number',
        defaultValue: Number.MAX_VALUE,
        description: 'Maximum coverage depth bound',
      }
```

#### slot: scaleType

```js
scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Coverage scale type', ['linear', 'log']),
        defaultValue: 'linear',
        description: 'Coverage scale type (linear or log)',
      }
```

#### slot: numStdDev

```js
numStdDev: {
        type: 'number',
        defaultValue: 3,
        description: 'Number of standard deviations for localsd autoscale',
      }
```

### Inherited from [BaseLinearDisplay](../baselineardisplay)

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
      defaultValue: `jexl:mouseoverExtraInformation||get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')`,
      contextVariable: ['feature', 'mouseoverExtraInformation'],
    }
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with
jexl at runtime rather than being stored with jexl in the config

```js
jexlFilters: {
      type: 'stringArray',
      description:
        'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
      defaultValue: [],
    }
```

### LGVSyntenyDisplay - Derives from

- [LinearAlignmentsDisplay](../linearalignmentsdisplay)

```js
baseConfiguration:
        linearAlignmentsDisplayConfigSchemaFactory(pluginManager)
```
