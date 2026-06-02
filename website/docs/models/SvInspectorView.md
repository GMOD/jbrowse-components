---
id: svinspectorview
title: SvInspectorView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/SvInspectorView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SvInspectorView.md)

## Docs

does not extend, but is a combination of a

- [SpreadsheetView](../spreadsheetview)
- [CircularView](../circularview)

extends

- [BaseViewModel](../baseviewmodel)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** id, displayName, minimized

**Getters:** menuItems

**Actions:** setDisplayName, setWidth, setMinimized

### SvInspectorView - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<"SvInspectorView">
// code
type: types.literal('SvInspectorView')
```

#### property: height

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.optional(types.number, defaultHeight)
```

#### property: onlyDisplayRelevantRegionsInCircularView

```js
// type signature
false
// code
onlyDisplayRelevantRegionsInCircularView: false
```

#### property: spreadsheetView

```js
// type signature
IOptionalIType<IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; }, { ...; }>, { ...; } & ... 6 more ... & { ...; }, _NotCustomized, { ...; } | { ...; }>, [...]>
// code
spreadsheetView: types.optional(SpreadsheetModel, () =>
          SpreadsheetModel.create({
            type: 'SpreadsheetView',
            hideVerticalResizeHandle: true,
          }),
        )
```

#### property: circularView

```js
// type signature
IOptionalIType<IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; }, { ...; }>, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, ModelSnapshotType<...>>, [...]>
// code
circularView: types.optional(CircularModel, () =>
          CircularModel.create({
            type: 'CircularView',
            hideVerticalResizeHandle: true,
            hideTrackSelectorButton: true,
            disableImportForm: true,
          }),
        )
```

#### property: init

used for initializing the view from a session snapshot

```js
// type signature
IType<SvInspectorViewInit | undefined, SvInspectorViewInit | undefined, SvInspectorViewInit | undefined>
// code
init: types.frozen<SvInspectorViewInit | undefined>()
```

### SvInspectorView - Volatiles

#### volatile: width

```js
// type signature
number
// code
width: 800
```

#### volatile: SpreadsheetViewReactComponent

```js
// type signature
ViewComponentType
// code
SpreadsheetViewReactComponent: SpreadsheetViewType.ReactComponent
```

#### volatile: CircularViewReactComponent

```js
// type signature
ViewComponentType
// code
CircularViewReactComponent: CircularViewType.ReactComponent
```

#### volatile: circularViewOptionsBarHeight

```js
// type signature
number
// code
circularViewOptionsBarHeight: 52
```

### SvInspectorView - Getters

#### getter: assemblyName

```js
// type
string | undefined
```

#### getter: showCircularView

```js
// type
boolean
```

#### getter: features

```js
// type
SimpleFeatureSerialized[]
```

#### getter: featuresAdapterConfigSnapshot

```js
// type
{ type: string; features: SimpleFeatureSerialized[]; }
```

#### getter: featureRefNames

```js
// type
string[]
```

#### getter: currentAssembly

```js
// type
(ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { error: unknown; loadingP: Promise<void> | undefined; ... 5 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 12 more ... & IStateTreeNode<...>) | undefined
```

#### getter: canonicalFeatureRefNameSet

```js
// type
Set<string>
```

#### getter: variantTrackId

```js
// type
string
```

#### getter: featuresCircularTrackConfiguration

```js
// type
{ type: string; trackId: string; name: string; adapter: { type: string; features: SimpleFeatureSerialized[]; }; assemblyNames: string[]; displays: { type: string; displayId: string; onChordClick: string; renderer: { ...; }; }[]; }
```

### SvInspectorView - Methods

#### method: menuItems

```js
// type signature
menuItems: () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; }[]
```

### SvInspectorView - Actions

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => void
```

#### action: setHeight

```js
// type signature
setHeight: (newHeight: number) => number
```

#### action: setOnlyDisplayRelevantRegionsInCircularView

```js
// type signature
setOnlyDisplayRelevantRegionsInCircularView: (val: boolean) => void
```

#### action: setInit

```js
// type signature
setInit: (init?: SvInspectorViewInit | undefined) => void
```

#### action: resizeHeight

```js
// type signature
resizeHeight: (distance: number) => number
```
