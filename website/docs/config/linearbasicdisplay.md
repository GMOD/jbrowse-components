---
id: linearbasicdisplay
title: LinearBasicDisplay
toplevel: true
---

#### slot: mouseover
```js

      /**
       * !slot
       */
      mouseover: {
        type: 'string',
        description: 'what to display in a given mouseover',
        defaultValue: `jexl:get(feature,'name')`,

        contextVariable: ['feature'],
      }
```
#### slot: renderer
```js

      /**
       * !slot
       */
      renderer: pluginManager.pluggableConfigSchemaType('renderer')
```
#### derives from: 
```js

      /**
       * !baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema
```
