---
id: linearvariantdisplay
title: LinearVariantDisplay
toplevel: true
---
extends `LinearBasicDisplay`
very similar to basic display, but provides custom widget on feature click



### LinearVariantDisplay - Properties
#### property: type



```js
// type signature
ISimpleType<"LinearVariantDisplay">
// code
type: types.literal('LinearVariantDisplay')
```

#### property: configuration



```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```








### LinearVariantDisplay - Actions
#### action: selectFeature



```js
// type signature
selectFeature: (feature: Feature) => Promise<void>
```

 
