---
id: svinspectorview
title: SvInspectorView
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[plugins/sv-inspector/src/SvInspectorView/models/SvInspectorView.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/SvInspectorView/models/SvInspectorView.ts)

## Docs

combination of a spreadsheetview and a circularview

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
height: types.optional(
          types.refinement(
            'SvInspectorViewHeight',
            types.number,
            n => n >= minHeight,
          ),
          defaultHeight,
        )
```

#### property: onlyDisplayRelevantRegionsInCircularView

```js
// type signature
false
// code
onlyDisplayRelevantRegionsInCircularView: false
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

#### property: spreadsheetView

```js
// type signature
IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 4 more ... & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
spreadsheetView: types.optional(SpreadsheetModel, () =>
          SpreadsheetModel.create({
            type: 'SpreadsheetView',
            hideViewControls: true,
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

#### getter: selectedRows

```js
// type
any
```

#### getter: assemblyName

```js
// type
any
```

#### getter: showCircularView

```js
// type
boolean
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

#### getter: featuresCircularTrackConfiguration

```js
// type
{ type: string; trackId: string; name: string; adapter: any; assemblyNames: any[]; displays: { type: string; displayId: string; onChordClick: string; renderer: { type: string; }; }[]; }
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

#### action: setImportMode

```js
// type signature
setImportMode: () => void
```

#### action: setDisplayMode

```js
// type signature
setDisplayMode: () => void
```

#### action: closeView

```js
// type signature
closeView: () => void
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
