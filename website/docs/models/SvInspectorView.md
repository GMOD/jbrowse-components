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

| Member                                                                                             | Kind       | Description                                            |
| -------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| [id](#property-id)                                                                                 | Properties |                                                        |
| [type](#property-type)                                                                             | Properties |                                                        |
| [height](#property-height)                                                                         | Properties |                                                        |
| [onlyDisplayRelevantRegionsInCircularView](#property-onlydisplayrelevantregionsincircularview)     | Properties |                                                        |
| [spreadsheetView](#property-spreadsheetview)                                                       | Properties |                                                        |
| [circularView](#property-circularview)                                                             | Properties |                                                        |
| [init](#property-init)                                                                             | Properties | used for initializing the view from a session snapshot |
| [width](#volatile-width)                                                                           | Volatiles  |                                                        |
| [SpreadsheetViewReactComponent](#volatile-spreadsheetviewreactcomponent)                           | Volatiles  |                                                        |
| [CircularViewReactComponent](#volatile-circularviewreactcomponent)                                 | Volatiles  |                                                        |
| [circularViewOptionsBarHeight](#volatile-circularviewoptionsbarheight)                             | Volatiles  |                                                        |
| [assemblyName](#getter-assemblyname)                                                               | Getters    |                                                        |
| [showCircularView](#getter-showcircularview)                                                       | Getters    |                                                        |
| [features](#getter-features)                                                                       | Getters    |                                                        |
| [featuresAdapterConfigSnapshot](#getter-featuresadapterconfigsnapshot)                             | Getters    |                                                        |
| [featureRefNames](#getter-featurerefnames)                                                         | Getters    |                                                        |
| [currentAssembly](#getter-currentassembly)                                                         | Getters    |                                                        |
| [canonicalFeatureRefNameSet](#getter-canonicalfeaturerefnameset)                                   | Getters    |                                                        |
| [variantTrackId](#getter-varianttrackid)                                                           | Getters    |                                                        |
| [featuresCircularTrackConfiguration](#getter-featurescirculartrackconfiguration)                   | Getters    |                                                        |
| [menuItems](#method-menuitems)                                                                     | Methods    |                                                        |
| [setWidth](#action-setwidth)                                                                       | Actions    |                                                        |
| [setHeight](#action-setheight)                                                                     | Actions    |                                                        |
| [setOnlyDisplayRelevantRegionsInCircularView](#action-setonlydisplayrelevantregionsincircularview) | Actions    |                                                        |
| [setInit](#action-setinit)                                                                         | Actions    |                                                        |
| [resizeHeight](#action-resizeheight)                                                               | Actions    |                                                        |

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
