---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
toplevel: true
---

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
