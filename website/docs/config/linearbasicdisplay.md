---
id: linearbasicdisplay
title: LinearBasicDisplay
toplevel: true
---

### Slots

#### slot: mouseover

```js
mouseover: {
        type: 'string',
        description: 'what to display in a given mouseover',
        defaultValue: `jexl:get(feature,'name')`,

        contextVariable: ['feature'],
      }
```

#### slot: renderer

```js
renderer: pluginManager.pluggableConfigSchemaType('renderer')
```

## Derives from

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
