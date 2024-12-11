---
id: svinspectorview
title: SvInspectorView
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
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
IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 5 more ... & { ...; }, _NotCustomized, ModelSnapshotType<...> | { ...; }>, [...]>
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
IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 7 more ... & { ...; }, _NotCustomized, _NotCustomized>, [...]>
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

### SvInspectorView - Getters

#### getter: assemblyName

```js
// type
string
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
{
  type: string
  features: any
}
```

#### getter: featureRefNames

```js
// type
any[]
```

#### getter: canonicalFeatureRefNameSet

```js
// type
Set<unknown>
```

#### getter: featuresCircularTrackConfiguration

```js
// type
{ type: string; trackId: string; name: string; adapter: any; assemblyNames: any[]; displays: { type: string; displayId: string; onChordClick: string; renderer: { type: string; }; }[]; }
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

#### action: setDisplayedRegions

```js
// type signature
setDisplayedRegions: (regions: Region[]) => void
```

#### action: setOnlyDisplayRelevantRegionsInCircularView

```js
// type signature
setOnlyDisplayRelevantRegionsInCircularView: (val: boolean) => void
```

#### action: resizeHeight

```js
// type signature
resizeHeight: (distance: number) => number
```
