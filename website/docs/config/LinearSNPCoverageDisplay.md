---
id: linearsnpcoveragedisplay
title: LinearSNPCoverageDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/LinearSNPCoverageDisplay/models/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearSNPCoverageDisplay/models/configSchema.ts)

extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearSNPCoverageDisplay - Slots

#### slot: autoscale

```js
autoscale: {
        defaultValue: 'local',
        description:
          'performs local autoscaling (no other options for SNP Coverage available)',
        model: types.enumeration('Autoscale type', ['local']),
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

#### slot: multiTicks

```js
multiTicks: {
        defaultValue: false,
        description: 'Display multiple values for the ticks',
        type: 'boolean',
      }
```

#### slot: renderers

```js
renderers: ConfigurationSchema('RenderersConfiguration', {
  SNPCoverageRenderer: pluginManager.getRendererType('SNPCoverageRenderer')
    .configSchema,
})
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

### LinearSNPCoverageDisplay - Derives from

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
