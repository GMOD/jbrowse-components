---
id: sharedwiggledisplay
title: SharedWiggleDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/wiggle/src/shared/configShared.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/configShared.ts)

extends

- [BaseLinearDisplay](../baselineardisplay)

### SharedWiggleDisplay - Slots

#### slot: autoscale

```js
autoscale: {
        defaultValue: 'local',
        description:
          'global/local using their min/max values or w/ standard deviations (globalsd/localsd)',
        model: types.enumeration('Autoscale type', [
          'global',
          'local',
          'globalsd',
          'localsd',
          'zscore',
        ]),
        type: 'stringEnum',
      }
```

#### slot: inverted

```js
inverted: {
        defaultValue: false,
        description: 'draw upside down',
        type: 'boolean',
      }
```

#### slot: maxScore

```js
maxScore: {
        defaultValue: Number.MAX_VALUE,
        description: 'maximum value for the y-scale',
        type: 'number',
      }
```

#### slot: minScore

```js
minScore: {
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
        type: 'number',
      }
```

#### slot: minimalTicks

```js
minimalTicks: {
        defaultValue: false,
        description: 'use the minimal amount of ticks',
        type: 'boolean',
      }
```

#### slot: numStdDev

```js
numStdDev: {
        defaultValue: 3,
        description:
          'number of standard deviations to use for autoscale types globalsd or localsd',
        type: 'number',
      }
```

#### slot: scaleType

```js
scaleType: {
        defaultValue: 'linear',

        description: 'The type of scale to use',

        model: types.enumeration('Scale type', ['linear', 'log']),

        type: 'stringEnum',
      }
```

### SharedWiggleDisplay - Derives from

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
