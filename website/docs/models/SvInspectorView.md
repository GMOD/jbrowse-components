---
id: svinspectorview
title: SvInspectorView
sidebar_label: View -> SvInspectorView
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

## Overview

does not extend, but is a combination of a

- [SpreadsheetView](../spreadsheetview)
- [CircularView](../circularview)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** [id](../baseviewmodel#property-id),
[displayName](../baseviewmodel#property-displayname),
[minimized](../baseviewmodel#property-minimized)

**Volatiles:** [width](../baseviewmodel#volatile-width)

**Getters:** [menuItems](../baseviewmodel#getter-menuitems)

**Actions:** [setDisplayName](../baseviewmodel#action-setdisplayname),
[setWidth](../baseviewmodel#action-setwidth),
[setMinimized](../baseviewmodel#action-setminimized)

<details open>
<summary>SvInspectorView - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<'SvInspectorView'>
// code
type: types.literal('SvInspectorView')
```

#### property: height

```ts
// type signature
type height = IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.stripDefault(types.number, defaultHeight)
```

#### property: onlyDisplayRelevantRegionsInCircularView

```ts
// type signature
type onlyDisplayRelevantRegionsInCircularView = IOptionalIType<
  ISimpleType<boolean>,
  [undefined]
>
// code
onlyDisplayRelevantRegionsInCircularView: types.stripDefault(
  types.boolean,
  false,
)
```

#### property: spreadsheetView

```ts
// type signature
type spreadsheetView = IOptionalIType<IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, { ...; } | { ...; }>, [...]>
// code
spreadsheetView: types.optional(SpreadsheetModel, () =>
          SpreadsheetModel.create({
            type: 'SpreadsheetView',
            hideVerticalResizeHandle: true,
          }),
        )
```

#### property: circularView

```ts
// type signature
type circularView = IOptionalIType<IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, ModelSnapshotType<...>>, [...]>
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

```ts
// type signature
type init = IType<
  SvInspectorViewInit | undefined,
  SvInspectorViewInit | undefined,
  SvInspectorViewInit | undefined
>
// code
init: types.frozen<SvInspectorViewInit | undefined>()
```

</details>

<details open>
<summary>SvInspectorView - Volatiles</summary>

#### volatile: width

```ts
// type signature
type width = number
// code
width: 800
```

#### volatile: SpreadsheetViewReactComponent

```ts
// type signature
type SpreadsheetViewReactComponent = ViewComponentType
// code
SpreadsheetViewReactComponent: SpreadsheetViewType.ReactComponent
```

#### volatile: CircularViewReactComponent

```ts
// type signature
type CircularViewReactComponent = ViewComponentType
// code
CircularViewReactComponent: CircularViewType.ReactComponent
```

#### volatile: circularViewOptionsBarHeight

```ts
// type signature
type circularViewOptionsBarHeight = number
// code
circularViewOptionsBarHeight: 52
```

</details>

<details open>
<summary>SvInspectorView - Getters</summary>

#### getter: assemblyName

```ts
type assemblyName = string | undefined
```

#### getter: showCircularView

```ts
type showCircularView = boolean
```

#### getter: features

```ts
type features = SimpleFeatureSerialized[]
```

#### getter: featuresAdapterConfigSnapshot

```ts
type featuresAdapterConfigSnapshot = {
  type: string
  features: SimpleFeatureSerialized[]
}
```

#### getter: featureRefNames

```ts
type featureRefNames = string[]
```

#### getter: currentAssembly

```ts
type currentAssembly = (ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { error: unknown; loadingP: Promise<void> | undefined; ... 7 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 12 more ... & IStateTreeNode<...>) | undefined
```

#### getter: canonicalFeatureRefNameSet

```ts
type canonicalFeatureRefNameSet = Set<string>
```

#### getter: variantTrackId

```ts
type variantTrackId = string
```

#### getter: featuresCircularTrackConfiguration

```ts
type featuresCircularTrackConfiguration = { type: string; trackId: string; name: string; adapter: { type: string; features: SimpleFeatureSerialized[]; }; assemblyNames: string[]; displays: { type: string; displayId: string; onChordClick: string; renderer: { ...; }; }[]; }
```

</details>

<details open>
<summary>SvInspectorView - Methods</summary>

#### method: menuItems

```ts
type menuItems = () => {
  label: string
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string }
  onClick: () => void
}[]
```

</details>

<details open>
<summary>SvInspectorView - Actions</summary>

#### action: setWidth

```ts
type setWidth = (newWidth: number) => void
```

#### action: setHeight

```ts
type setHeight = (newHeight: number) => number
```

#### action: setOnlyDisplayRelevantRegionsInCircularView

```ts
type setOnlyDisplayRelevantRegionsInCircularView = (val: boolean) => void
```

#### action: setInit

```ts
type setInit = (init?: SvInspectorViewInit | undefined) => void
```

#### action: resizeHeight

```ts
type resizeHeight = (distance: number) => number
```

</details>
