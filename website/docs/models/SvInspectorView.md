---
id: svinspectorview
title: SvInspectorView
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/sv-inspector/src/SvInspectorView/models/SvInspectorView.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/SvInspectorView/models/SvInspectorView.ts)

does not extend, but is a combination of a

- [SpreadsheetView](../spreadsheetview)
- [CircularView](../circularview)

extends

- [BaseViewModel](../baseviewmodel)

### SvInspectorView - Properties

#### property: circularView

```js
// type signature
IOptionalIType<IModelType<{ displayName: IMaybe<ISimpleType<string>>; id: IOptionalIType<ISimpleType<string>, [undefined]>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 7 more ... & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
circularView: types.optional(CircularModel, () =>
          CircularModel.create({
            disableImportForm: true,
            hideTrackSelectorButton: true,
            hideVerticalResizeHandle: true,
            type: 'CircularView',
          }),
        )
```

#### property: height

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.optional(
          types.refinement(
            'SvInspectorViewHeight',
            types.number,
            n => n >= minHeight,
          ),
          defaultHeight,
        )
```

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: mode

switch specifying whether we are showing the import wizard or the spreadsheet in
our viewing area

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
mode: types.optional(
          types.enumeration('SvInspectorViewMode', ['import', 'display']),
          'import',
        )
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
IOptionalIType<IModelType<{ displayName: IMaybe<ISimpleType<string>>; id: IOptionalIType<ISimpleType<string>, [undefined]>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 5 more ... & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
spreadsheetView: types.optional(SpreadsheetModel, () =>
          SpreadsheetModel.create({
            hideVerticalResizeHandle: true,
            type: 'SpreadsheetView',
          }),
        )
```

#### property: type

```js
// type signature
ISimpleType<"SvInspectorView">
// code
type: types.literal('SvInspectorView')
```

### SvInspectorView - Getters

#### getter: assemblyName

```js
// type
any
```

#### getter: featureRefNames

```js
// type
any[]
```

#### getter: features

```js
// type
any
```

#### getter: featuresAdapterConfigSnapshot

```js
// type
{
  features: any
  type: string
}
```

#### getter: featuresCircularTrackConfiguration

```js
// type
{ adapter: any; assemblyNames: any[]; displays: { displayId: string; onChordClick: string; renderer: { type: string; }; type: string; }[]; name: string; trackId: string; type: string; }
```

#### getter: selectedRows

```js
// type
any
```

#### getter: showCircularView

```js
// type
boolean
```

### SvInspectorView - Methods

#### method: menuItems

```js
// type signature
menuItems: () => { icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; label: string; onClick: () => void; }[]
```

### SvInspectorView - Actions

#### action: closeView

```js
// type signature
closeView: () => void
```

#### action: setDisplayMode

```js
// type signature
setDisplayMode: () => void
```

#### action: setDisplayedRegions

```js
// type signature
setDisplayedRegions: (regions: Region[]) => void
```

#### action: setHeight

```js
// type signature
setHeight: (newHeight: number) => number
```

#### action: setImportMode

```js
// type signature
setImportMode: () => void
```

#### action: setOnlyDisplayRelevantRegionsInCircularView

```js
// type signature
setOnlyDisplayRelevantRegionsInCircularView: (val: boolean) => void
```

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => void
```

#### action: resizeHeight

```js
// type signature
resizeHeight: (distance: number) => number
```
