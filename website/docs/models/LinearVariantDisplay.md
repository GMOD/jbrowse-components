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

Similar to feature display, but provides custom widget on feature click. Does
not include gene glyph options since variants are not genes. extends

- [LinearFeatureDisplay](../linearfeaturedisplay)

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
any
// code
configuration: ConfigurationReference(configSchema)
```

#### property: minorAlleleFrequencyFilterSetting

Minor allele frequency filter threshold (0-0.5) When undefined, falls back to
config value

```js
// type signature
IMaybe<ISimpleType<number>>
// code
minorAlleleFrequencyFilterSetting: types.maybe(types.number)
```

### LinearVariantDisplay - Getters

#### getter: minorAlleleFrequencyFilter

Gets the minor allele frequency filter threshold Falls back to config value if
setting is not defined

```js
// type
any
```

#### getter: featureWidgetType

```js
// type
{
  type: string
  id: string
}
```

#### getter: activeFilters

Override to add MAF filter to active filters

```js
// type
string[]
```

### LinearVariantDisplay - Methods

#### method: filterMenuItems

```js
// type signature
filterMenuItems: () => any[]
```

### LinearVariantDisplay - Actions

#### action: setMafFilter

```js
// type signature
setMafFilter: (value: number) => void
```
