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

## Docs

extends

- [BaseViewModel](../baseviewmodel)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** id, displayName, minimized

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

```js
// type signature
ISimpleType<"LinearComparativeView">
// code
type: types.literal('LinearComparativeView')
```

#### property: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

#### property: showIntraviewLinks

```js
// type signature
true
// code
showIntraviewLinks: true
```

#### property: linkViews

```js
// type signature
false
// code
linkViews: false
```

#### property: interactiveOverlay

```js
// type signature
false
// code
interactiveOverlay: false
```

#### property: scrollZoom

```js
// type signature
false
// code
scrollZoom: false
```

#### property: levels

```js
// type signature
IArrayType<IAnyModelType>
// code
levels: types.array(LinearSyntenyViewHelper!)
```

#### property: views

currently this is limited to an array of two

```js
// type signature
IArrayType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; } & { ...; }, { ...; } & ... 17 more ... & { ...; }, ModelCreationType<...>, { ...; }>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```js
// type signature
IArrayType<IAnyModelType>
// code
viewTrackConfigs: types.array(
          pluginManager.pluggableConfigSchemaType('track'),
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

#### volatile: isLoading

Set to true when the view is being initialized from a launch spec to avoid
showing the import form during loading

```js
// type signature
false
// code
isLoading: false
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

#### getter: loadingMessage

```js
// type
'Loading' | undefined
```

#### getter: showLoading

Whether to show a loading indicator instead of the import form or view

```js
// type
boolean
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

#### action: setIsLoading

```js
// type signature
setIsLoading: (arg: boolean) => void
```

#### action: setViews

```js
// type signature
setViews: (views: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; } & { ...; }>>[]) => void
```

#### action: removeView

```js
// type signature
removeView: (view: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; } & { ...; }> & ... 19 more ... & IStateTreeNode<...>) => void
```

#### action: addView

Push a new genome row. The new trailing level starts with no synteny tracks.

```js
// type signature
addView: (view: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; } & { ...; }>>) => void
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
