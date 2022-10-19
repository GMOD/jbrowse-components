---
id: linearwiggledisplay
title: LinearWiggleDisplay
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
        model: types.enumeration('Autoscale type', [
          'global',
          'local',
          'globalsd',
          'localsd',
          'zscore',
        ]),
        description:
          'global/local using their min/max values or w/ standard deviations (globalsd/localsd)',
      }
```
#### slot: minimalTicks
```js


      /**
       * !slot
       */
      minimalTicks: {
        type: 'boolean',
        defaultValue: false,
        description: 'use the minimal amount of ticks',
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
#### slot: numStdDev
```js

      /**
       * !slot
       */
      numStdDev: {
        type: 'number',
        description:
          'number of standard deviations to use for autoscale types globalsd or localsd',
        defaultValue: 3,
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
       */
      inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      }
```
#### slot: defaultRendering
```js


      /**
       * !slot
       */
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['density', 'xyplot', 'line']),
        defaultValue: 'xyplot',
      }
```
#### slot: renderers
```js

      /**
       * !slot
       */
      renderers: ConfigurationSchema('RenderersConfiguration', {
        DensityRenderer: DensityRendererConfigSchema,
        XYPlotRenderer: XYPlotRendererConfigSchema,
        LinePlotRenderer: LinePlotRendererConfigSchema,
      })
```
#### derives from: 
```js

      /**
       * !baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema
```
