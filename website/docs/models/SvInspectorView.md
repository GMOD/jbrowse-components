---
id: svinspectorview
title: SvInspectorView
sidebar_label: View -> SvInspectorView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`sv-inspector` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/SvInspectorView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`. The `init` shorthand loads a
structural-variant file into the spreadsheet and mirrors the rows as arcs in the
paired circular view; `assembly` resolves coordinates for both:

```js
{
  type: 'SvInspectorView',
  init: {
    assembly: 'hg38',
    uri: 'https://example.com/sv.vcf.gz',
    fileType: 'VCF',
  },
}
```

## Overview

does not extend, but is a combination of a

- [SpreadsheetView](../spreadsheetview)
- [CircularView](../circularview)

## Members

| Member                                                                                             | Kind       | Defined by                        | Description                                                                                           |
| -------------------------------------------------------------------------------------------------- | ---------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                                                                 | Properties | SvInspectorView                   |                                                                                                       |
| [type](#property-type)                                                                             | Properties | SvInspectorView                   |                                                                                                       |
| [height](#property-height)                                                                         | Properties | SvInspectorView                   |                                                                                                       |
| [onlyDisplayRelevantRegionsInCircularView](#property-onlydisplayrelevantregionsincircularview)     | Properties | SvInspectorView                   |                                                                                                       |
| [spreadsheetView](#property-spreadsheetview)                                                       | Properties | SvInspectorView                   |                                                                                                       |
| [circularView](#property-circularview)                                                             | Properties | SvInspectorView                   |                                                                                                       |
| [init](#property-init)                                                                             | Properties | SvInspectorView                   | used for initializing the view from a session snapshot                                                |
| [width](#volatile-width)                                                                           | Volatiles  | SvInspectorView                   |                                                                                                       |
| [SpreadsheetViewReactComponent](#volatile-spreadsheetviewreactcomponent)                           | Volatiles  | SvInspectorView                   |                                                                                                       |
| [CircularViewReactComponent](#volatile-circularviewreactcomponent)                                 | Volatiles  | SvInspectorView                   |                                                                                                       |
| [circularViewOptionsBarHeight](#volatile-circularviewoptionsbarheight)                             | Volatiles  | SvInspectorView                   |                                                                                                       |
| [assemblyName](#getter-assemblyname)                                                               | Getters    | SvInspectorView                   |                                                                                                       |
| [showCircularView](#getter-showcircularview)                                                       | Getters    | SvInspectorView                   |                                                                                                       |
| [features](#getter-features)                                                                       | Getters    | SvInspectorView                   |                                                                                                       |
| [featuresAdapterConfigSnapshot](#getter-featuresadapterconfigsnapshot)                             | Getters    | SvInspectorView                   |                                                                                                       |
| [featureRefNames](#getter-featurerefnames)                                                         | Getters    | SvInspectorView                   |                                                                                                       |
| [currentAssembly](#getter-currentassembly)                                                         | Getters    | SvInspectorView                   |                                                                                                       |
| [canonicalFeatureRefNameSet](#getter-canonicalfeaturerefnameset)                                   | Getters    | SvInspectorView                   |                                                                                                       |
| [variantTrackId](#getter-varianttrackid)                                                           | Getters    | SvInspectorView                   |                                                                                                       |
| [featuresCircularTrackConfiguration](#getter-featurescirculartrackconfiguration)                   | Getters    | SvInspectorView                   |                                                                                                       |
| [menuItems](#method-menuitems)                                                                     | Methods    | SvInspectorView                   |                                                                                                       |
| [setWidth](#action-setwidth)                                                                       | Actions    | SvInspectorView                   |                                                                                                       |
| [setHeight](#action-setheight)                                                                     | Actions    | SvInspectorView                   |                                                                                                       |
| [setOnlyDisplayRelevantRegionsInCircularView](#action-setonlydisplayrelevantregionsincircularview) | Actions    | SvInspectorView                   |                                                                                                       |
| [setInit](#action-setinit)                                                                         | Actions    | SvInspectorView                   |                                                                                                       |
| [resizeHeight](#action-resizeheight)                                                               | Actions    | SvInspectorView                   |                                                                                                       |
| [displayName](#property-displayname)                                                               | Properties | [BaseViewModel](../baseviewmodel) | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| [minimized](#property-minimized)                                                                   | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                       |
| [setDisplayName](#action-setdisplayname)                                                           | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                       |
| [setMinimized](#action-setminimized)                                                               | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                       |

<details>
<summary>SvInspectorView - Properties</summary>

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

<details>
<summary>SvInspectorView - Properties (other undocumented members)</summary>

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

</details>

<details>
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

<details>
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

<details>
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

<details>
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

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseViewModel</summary>

[BaseViewModel →](../baseviewmodel)

**Properties**

#### property: displayName

displayName is displayed in the header of the view, or assembly names being used
if none is specified

```ts
// type signature
type displayName = IMaybe<ISimpleType<string>>
// code
displayName: types.maybe(types.string)
```

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

**Actions**

#### action: setDisplayName

```ts
type setDisplayName = (name: string) => void
```

#### action: setMinimized

```ts
type setMinimized = (flag: boolean) => void
```

</details>
