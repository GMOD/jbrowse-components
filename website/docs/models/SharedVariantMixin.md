---
id: sharedvariantmixin
title: SharedVariantMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/shared/SharedVariantMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SharedVariantMixin.md)

## Docs

### SharedVariantMixin - Properties

#### property: selectedRendering

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
selectedRendering: types.optional(types.string, '')
```

#### property: summaryScoreMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
summaryScoreMode: types.maybe(types.string)
```

#### property: rendererTypeNameState

```js
// type signature
IMaybe<ISimpleType<string>>
// code
rendererTypeNameState: types.maybe(types.string)
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

### SharedVariantMixin - Getters

#### getter: adapterTypeName

```js
// type
any
```

#### getter: rendererTypeNameSimple

```js
// type
any
```

#### getter: filters

subclasses can define these, as snpcoverage track does

```js
// type
any
```

#### getter: adapterCapabilities

```js
// type
string[]
```

### SharedVariantMixin - Actions

#### action: selectFeature

this overrides the BaseLinearDisplayModel to avoid popping up a feature detail
display, but still sets the feature selection on the model so listeners can
detect a click

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: setRendererType

```js
// type signature
setRendererType: (val: string) => void
```

#### action: reload

```js
// type signature
reload: () => Promise<void>
```
