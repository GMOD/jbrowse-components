---
id: linearvariantdisplay
title: LinearVariantDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/variants/src/LinearVariantDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantDisplay/model.ts)

similar to basic display, but provides custom widget on feature click extends

- [LinearBasicDisplay](../linearbasicdisplay)

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
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

### LinearVariantDisplay - Actions

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => Promise<void>
```
