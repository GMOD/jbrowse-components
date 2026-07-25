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

| Member                                                                                             | Kind       | Defined by                        | Description                                                                                                            |
| -------------------------------------------------------------------------------------------------- | ---------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                                                                 | Properties | SvInspectorView                   |                                                                                                                        |
| [type](#property-type)                                                                             | Properties | SvInspectorView                   |                                                                                                                        |
| [height](#property-height)                                                                         | Properties | SvInspectorView                   |                                                                                                                        |
| [onlyDisplayRelevantRegionsInCircularView](#property-onlydisplayrelevantregionsincircularview)     | Properties | SvInspectorView                   |                                                                                                                        |
| [spreadsheetWidthFraction](#property-spreadsheetwidthfraction)                                     | Properties | SvInspectorView                   | share of the view's width given to the spreadsheet, the rest goes to the circular view.                                |
| [spreadsheetView](#property-spreadsheetview)                                                       | Properties | SvInspectorView                   |                                                                                                                        |
| [circularView](#property-circularview)                                                             | Properties | SvInspectorView                   |                                                                                                                        |
| [init](#property-init)                                                                             | Properties | SvInspectorView                   | used for initializing the view from a session snapshot                                                                 |
| [width](#volatile-width)                                                                           | Volatiles  | SvInspectorView                   |                                                                                                                        |
| [SpreadsheetViewReactComponent](#volatile-spreadsheetviewreactcomponent)                           | Volatiles  | SvInspectorView                   |                                                                                                                        |
| [CircularViewReactComponent](#volatile-circularviewreactcomponent)                                 | Volatiles  | SvInspectorView                   |                                                                                                                        |
| [circularViewOptionsBarHeight](#volatile-circularviewoptionsbarheight)                             | Volatiles  | SvInspectorView                   |                                                                                                                        |
| [currentAssembly](#getter-currentassembly)                                                         | Getters    | SvInspectorView                   |                                                                                                                        |
| [assemblyName](#getter-assemblyname)                                                               | Getters    | SvInspectorView                   |                                                                                                                        |
| [showCircularView](#getter-showcircularview)                                                       | Getters    | SvInspectorView                   | gated on the same condition the spreadsheet renders its grid on, so the circle never appears alongside the import form |
| [features](#getter-features)                                                                       | Getters    | SvInspectorView                   |                                                                                                                        |
| [featuresAdapterConfigSnapshot](#getter-featuresadapterconfigsnapshot)                             | Getters    | SvInspectorView                   |                                                                                                                        |
| [featureRefNames](#getter-featurerefnames)                                                         | Getters    | SvInspectorView                   |                                                                                                                        |
| [canonicalFeatureRefNameSet](#getter-canonicalfeaturerefnameset)                                   | Getters    | SvInspectorView                   |                                                                                                                        |
| [circularDisplayedRegions](#getter-circulardisplayedregions)                                       | Getters    | SvInspectorView                   | the regions the paired circular view should show.                                                                      |
| [variantTrackId](#getter-varianttrackid)                                                           | Getters    | SvInspectorView                   |                                                                                                                        |
| [featuresCircularTrackConfiguration](#getter-featurescirculartrackconfiguration)                   | Getters    | SvInspectorView                   |                                                                                                                        |
| [menuItems](#method-menuitems)                                                                     | Methods    | SvInspectorView                   |                                                                                                                        |
| [setWidth](#action-setwidth)                                                                       | Actions    | SvInspectorView                   |                                                                                                                        |
| [setHeight](#action-setheight)                                                                     | Actions    | SvInspectorView                   |                                                                                                                        |
| [setOnlyDisplayRelevantRegionsInCircularView](#action-setonlydisplayrelevantregionsincircularview) | Actions    | SvInspectorView                   |                                                                                                                        |
| [resizeSpreadsheetWidth](#action-resizespreadsheetwidth)                                           | Actions    | SvInspectorView                   | move the divider between the two subviews.                                                                             |
| [setInit](#action-setinit)                                                                         | Actions    | SvInspectorView                   |                                                                                                                        |
| [resizeHeight](#action-resizeheight)                                                               | Actions    | SvInspectorView                   |                                                                                                                        |
| [displayName](#property-displayname)                                                               | Properties | [BaseViewModel](../baseviewmodel) | displayName is displayed in the header of the view, or assembly names being used if none is specified                  |
| [minimized](#property-minimized)                                                                   | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                        |
| [setDisplayName](#action-setdisplayname)                                                           | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                        |
| [setMinimized](#action-setminimized)                                                               | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                        |

<details>
<summary>SvInspectorView - Properties</summary>

#### property: spreadsheetWidthFraction

share of the view's width given to the spreadsheet, the rest goes to the
circular view. Persisted so dragging the divider survives both a window resize
and a session reload

```ts
// type signature
type spreadsheetWidthFraction = IOptionalIType<ISimpleType<number>, [undefined]>
// code
spreadsheetWidthFraction: types.stripDefault(types.number, 0.66)
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

<details>
<summary>SvInspectorView - Properties (other undocumented members)</summary>

| Member                                                                                                       | Type                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="property-id">id</span>                                                                             | `IOptionalIType<ISimpleType<string>, [undefined]>`                                                                                   |
| <span id="property-type">type</span>                                                                         | `ISimpleType<"SvInspectorView">`                                                                                                     |
| <span id="property-height">height</span>                                                                     | `IOptionalIType<ISimpleType<number>, [undefined]>`                                                                                   |
| <span id="property-onlydisplayrelevantregionsincircularview">onlyDisplayRelevantRegionsInCircularView</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                                                                                  |
| <span id="property-spreadsheetview">spreadsheetView</span>                                                   | `IOptionalIType<IModelType<_OverrideProps<…>, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, { ...; } \| { ...; }>, [...]>`   |
| <span id="property-circularview">circularView</span>                                                         | `IOptionalIType<IModelType<_OverrideProps<…>, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, ModelSnapshotType<...>>, [...]>` |

</details>

<details>
<summary>SvInspectorView - Volatiles</summary>

| Member                                                                                 | Type                |
| -------------------------------------------------------------------------------------- | ------------------- |
| <span id="volatile-width">width</span>                                                 | `number`            |
| <span id="volatile-spreadsheetviewreactcomponent">SpreadsheetViewReactComponent</span> | `ViewComponentType` |
| <span id="volatile-circularviewreactcomponent">CircularViewReactComponent</span>       | `ViewComponentType` |
| <span id="volatile-circularviewoptionsbarheight">circularViewOptionsBarHeight</span>   | `number`            |

</details>

<details>
<summary>SvInspectorView - Getters</summary>

#### getter: showCircularView

gated on the same condition the spreadsheet renders its grid on, so the circle
never appears alongside the import form

```ts
type showCircularView = boolean
```

#### getter: circularDisplayedRegions

the regions the paired circular view should show. An empty relevant-set means
the features aren't parsed yet, so show everything rather than an empty circle

```ts
type circularDisplayedRegions = BasicRegion[] | undefined
```

</details>

<details>
<summary>SvInspectorView - Getters (other undocumented members)</summary>

| Member                                                                                         | Type                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="getter-currentassembly">currentAssembly</span>                                       | `(ModelInstanceTypeProps<…> & {…} & ... 12 more ... & IStateTreeNode<…>) \| undefined`                                                                                                |
| <span id="getter-assemblyname">assemblyName</span>                                             | `string \| undefined`                                                                                                                                                                 |
| <span id="getter-features">features</span>                                                     | `SimpleFeatureSerialized[]`                                                                                                                                                           |
| <span id="getter-featuresadapterconfigsnapshot">featuresAdapterConfigSnapshot</span>           | `{ type: string; features: SimpleFeatureSerialized[]; }`                                                                                                                              |
| <span id="getter-featurerefnames">featureRefNames</span>                                       | `string[]`                                                                                                                                                                            |
| <span id="getter-canonicalfeaturerefnameset">canonicalFeatureRefNameSet</span>                 | `Set<string>`                                                                                                                                                                         |
| <span id="getter-varianttrackid">variantTrackId</span>                                         | `string`                                                                                                                                                                              |
| <span id="getter-featurescirculartrackconfiguration">featuresCircularTrackConfiguration</span> | `{ type: string; trackId: string; name: string; adapter: {…}; assemblyNames: string[]; displays: { type: string; displayId: string; onChordClick: string; renderer: { ...; }; }[]; }` |

</details>

<details>
<summary>SvInspectorView - Methods</summary>

| Member                                       | Type                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-menuitems">menuItems</span> | `() => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; }[]` |

</details>

<details>
<summary>SvInspectorView - Actions</summary>

#### action: resizeSpreadsheetWidth

move the divider between the two subviews. Stored as a fraction so the width
binding can reapply it, rather than resizing the subviews directly and having
the next parent resize overwrite it

```ts
type resizeSpreadsheetWidth = (distance: number) => void
```

</details>

<details>
<summary>SvInspectorView - Actions (other undocumented members)</summary>

| Member                                                                                                           | Type                                                |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| <span id="action-setwidth">setWidth</span>                                                                       | `(newWidth: number) => void`                        |
| <span id="action-setheight">setHeight</span>                                                                     | `(newHeight: number) => number`                     |
| <span id="action-setonlydisplayrelevantregionsincircularview">setOnlyDisplayRelevantRegionsInCircularView</span> | `(val: boolean) => void`                            |
| <span id="action-setinit">setInit</span>                                                                         | `(init?: SvInspectorViewInit \| undefined) => void` |
| <span id="action-resizeheight">resizeHeight</span>                                                               | `(distance: number) => number`                      |

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

| Member                                         | Type                                                |
| ---------------------------------------------- | --------------------------------------------------- |
| <span id="property-minimized">minimized</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

**Actions**

| Member                                                 | Type                      |
| ------------------------------------------------------ | ------------------------- |
| <span id="action-setdisplayname">setDisplayName</span> | `(name: string) => void`  |
| <span id="action-setminimized">setMinimized</span>     | `(flag: boolean) => void` |

</details>
