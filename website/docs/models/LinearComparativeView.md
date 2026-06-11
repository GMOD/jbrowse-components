---
id: linearcomparativeview
title: LinearComparativeView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearComparativeView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearComparativeView.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** id, displayName, minimized

**Volatiles:** width

**Getters:** menuItems

**Actions:** setDisplayName, setWidth, setMinimized

### LinearComparativeView - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

Abstract base: never registered or instantiated standalone, always composed into
a concrete subclass (e.g. LinearSyntenyView) that overrides `type` with its own
literal. Kept as `types.string` rather than a literal so subclass models stay
assignable to this base type.

```js
// type signature
ISimpleType<string>
// code
type: types.string
```

#### property: trackSelectorType

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackSelectorType: types.stripDefault(types.string, 'hierarchical')
```

#### property: showIntraviewLinks

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showIntraviewLinks: types.stripDefault(types.boolean, true)
```

#### property: linkViews

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
linkViews: types.stripDefault(types.boolean, false)
```

#### property: interactiveOverlay

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
interactiveOverlay: types.stripDefault(types.boolean, false)
```

#### property: scrollZoom

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
scrollZoom: types.stripDefault(types.boolean, false)
```

#### property: levels

```js
// type signature
IArrayType<IAnyModelType>
// code
levels: types.array(LinearSyntenyViewHelper)
```

#### property: views

currently this is limited to an array of two

```js
// type signature
IArrayType<IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; } & ... 17 more ... & { ...; }, _NotCustomized, { ...; }>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```js
// type signature
IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
viewTrackConfigs: types.stripDefault(
          types.array(pluginManager.pluggableConfigSchemaType('track')),
          [],
        )
```

### LinearComparativeView - Volatiles

#### volatile: width

```js
// type signature
number | undefined
// code
width: undefined as number | undefined
```

### LinearComparativeView - Getters

#### getter: initialized

```js
// type
boolean
```

#### getter: refNames

```js
// type
(string | undefined)[][]
```

#### getter: assemblyNames

```js
// type
string[]
```

### LinearComparativeView - Methods

#### method: isViewCompact

```js
// type signature
isViewCompact: (idx: number) => boolean
```

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming. overridden by subclasses

```js
// type signature
headerMenuItems: () => MenuItem[]
```

#### method: showMenuItems

items for the "Show..." submenu in the header. overridden by subclasses to add
view-specific toggle options

```js
// type signature
showMenuItems: () => MenuItem[]
```

#### method: menuItems

```js
// type signature
menuItems: () => MenuItem[]
```

#### method: rubberBandMenuItems

```js
// type signature
rubberBandMenuItems: () => { label: string; onClick: () => void; }[]
```

### LinearComparativeView - Actions

#### action: reconcileLevels

Reconcile the levels array to the views array: exactly one synteny level per gap
between adjacent views (N views -> N-1 levels). Grows or shrinks from the end,
preserving existing levels and their tracks. The single source of truth for the
views/levels invariant.

```js
// type signature
reconcileLevels: () => void
```

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => void
```

#### action: setViews

```js
// type signature
setViews: (views: ModelCreationType<ExtractCFromProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<...>, [...]>; }, { ...; }>>>[]) => void
```

#### action: removeView

```js
// type signature
removeView: (view: ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<...>, [...]>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>) => void
```

#### action: addView

Push a new genome row. The new trailing level starts with no synteny tracks.

```js
// type signature
addView: (view: ModelCreationType<ExtractCFromProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<...>, [...]>; }, { ...; }>>>) => void
```

#### action: removeLastRow

Drop the bottom genome row and its synteny level. Only terminal removal is
supported: a level's `level` index addresses views[level]/[level+1], so removing
a middle row would require reindexing every level below it. Growth and shrinkage
both happen at the end of the chain.

```js
// type signature
removeLastRow: () => void
```

#### action: setLinkViews

```js
// type signature
setLinkViews: (arg: boolean) => void
```

#### action: setScrollZoom

```js
// type signature
setScrollZoom: (arg: boolean) => void
```

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: (level: number) => Widget
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string, level?: any) => void
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, level?: any, initialSnapshot?: any) => void
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string, level?: any) => void
```

#### action: squareView

```js
// type signature
squareView: () => void
```

#### action: clearView

```js
// type signature
clearView: () => void
```

#### action: toggleCompactView

```js
// type signature
toggleCompactView: (idx: number) => void
```

#### action: compactAllViews

```js
// type signature
compactAllViews: () => void
```

#### action: expandAllViews

```js
// type signature
expandAllViews: () => void
```

#### action: autoScaleLevelHeights

```js
// type signature
autoScaleLevelHeights: () => void
```

#### action: appendRow

Append an assembly to the bottom of the stack and optionally show a synteny
track on the new level connecting it to the previous bottom row. A synteny
dataset is an edge between two adjacent assemblies, so rows are only ever added
at the chain's end.

The new row is created with a LinearGenomeView `init` — its own afterAttach
autorun loads the assembly regions and navigates (whole genome, or `loc` when
given), so we don't reimplement that imperatively here.

```js
// type signature
appendRow: ({ assembly, loc, syntenyTrackId, }: { assembly: string; loc?: string | undefined; syntenyTrackId?: string | undefined; }) => void
```
