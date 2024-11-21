---
id: linearsnpcoveragedisplay
title: LinearSNPCoverageDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/LinearSNPCoverageDisplay/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearSNPCoverageDisplay/configSchema.ts)

extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearSNPCoverageDisplay - Slots

#### slot: autoscale

```js
autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', ['local']),
        description:
          'performs local autoscaling (no other options for SNP Coverage available)',
      }
```

#### slot: minScore

```js
minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      }
```

#### slot: maxScore

```js
maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      }
```

#### slot: scaleType

```js
scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']),
        description: 'The type of scale to use',
        defaultValue: 'linear',
      }
```

#### slot: inverted

```js
inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      }
```

#### slot: multiTicks

```js
multiTicks: {
        type: 'boolean',
        description: 'Display multiple values for the ticks',
        defaultValue: false,
      }
```

#### slot: renderers

```js
renderers: ConfigurationSchema('RenderersConfiguration', {
        SNPCoverageRenderer: pluginManager.getRendererType(
          'SNPCoverageRenderer',
        )!.configSchema,
      })
```

### LinearSNPCoverageDisplay - Derives from

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
