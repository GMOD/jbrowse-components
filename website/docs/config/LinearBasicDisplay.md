---
id: linearbasicdisplay
title: LinearBasicDisplay
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

### LinearBasicDisplay - Slots

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

## LinearBasicDisplay - Derives from

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
