---
id: linearvariantdisplay
title: LinearVariantDisplay
toplevel: true
---

extends `LinearBasicDisplay`
very similar to basic display, but provides custom widget on feature click

### Properties

#### properties: type

```js
// type signature
ISimpleType<"LinearVariantDisplay">
// code
type: types.literal('LinearVariantDisplay')
```

#### properties: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### Actions

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => Promise<void>
```
