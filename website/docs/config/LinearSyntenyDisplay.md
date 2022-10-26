---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

## Docs

### LinearSyntenyDisplay - Slots

#### slot: trackIds

currently unused

```js
trackIds: {
        type: 'stringArray',
        defaultValue: [],
      }
```

#### slot: renderer

```js
renderer: types.optional(pluginManager.pluggableConfigSchemaType('renderer'), {
  type: 'LinearSyntenyRenderer',
})
```

#### slot: middle

currently unused

```js
middle: { type: 'boolean', defaultValue: true }
```

## LinearSyntenyDisplay - Derives from

this refers to the base linear comparative display

```js
baseConfiguration: baseConfigFactory(pluginManager)
```
