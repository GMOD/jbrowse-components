---
id: linearvariantdisplay
title: LinearVariantDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearVariantDisplay.md)

## Docs

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
