---
id: linearsnpcoveragedisplay
title: LinearSNPCoverageDisplay
toplevel: true
---

#### slot: autoscale
```js

      /**
       * !slot
       */
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

      /**
       * !slot
       */
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      }
```
#### slot: maxScore
```js

      /**
       * !slot
       */
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      }
```
#### slot: scaleType
```js

      /**
       * !slot
       */
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']), // todo zscale
        description: 'The type of scale to use',
        defaultValue: 'linear',
      }
```
#### slot: inverted
```js

      /**
       * !slot
       */ inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      }
```
#### slot: multiTicks
```js

      /**
       * !slot
       */
      multiTicks: {
        type: 'boolean',
        description: 'Display multiple values for the ticks',
        defaultValue: false,
      }
```
#### slot: renderers
```js

      /**
       * !slot
       */
      renderers: ConfigurationSchema('RenderersConfiguration', {
        SNPCoverageRenderer: pluginManager.getRendererType(
          'SNPCoverageRenderer',
        ).configSchema,
      })
```
#### derives from: 
```js

      /**
       * !baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema
```
