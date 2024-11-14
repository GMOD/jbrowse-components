---
id: breakpointsplitview
title: BreakpointSplitView
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/breakpoint-split-view/src/BreakpointSplitView/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/breakpoint-split-view/src/BreakpointSplitView/model.ts)

extends

- [BaseViewModel](../baseviewmodel)

### BreakpointSplitView - Properties

#### property: type

```js
// type signature
ISimpleType<"BreakpointSplitView">
// code
type: types.literal('BreakpointSplitView')
```

#### property: height

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.optional(
          types.refinement(
            'viewHeight',
            types.number,
            (n: number) => n >= minHeight,
          ),
          defaultHeight,
        )
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

#### property: interactToggled

```js
// type signature
false
// code
interactToggled: false
```

#### property: views

```js
// type signature
IArrayType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 15 more ... & { ...; }, ModelCreationType<...>, _NotCustomized>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
            .stateModel as LinearGenomeViewStateModel,
        )
```

### BreakpointSplitView - Getters

#### getter: matchedTracks

Find all track ids that match across multiple views, or return just the single
view's track if only a single row is used

```js
// type
(IMSTArray<IAnyType> & IStateTreeNode<IArrayType<IAnyType>>) | { configuration: { trackId: string; }; }[]
```

### BreakpointSplitView - Methods

#### method: exportSvg

creates an svg export and save using FileSaver

```js
// type signature
exportSvg: (opts?: ExportSvgOptions) => Promise<void>
```

#### method: getMatchedTracks

Get tracks with a given trackId across multiple views

```js
// type signature
getMatchedTracks: (trackConfigId: string) => any[]
```

#### method: hasTranslocations

Translocation features are handled differently since they do not have a mate
e.g. they are one sided

```js
// type signature
hasTranslocations: (trackConfigId: string) => any
```

#### method: hasPairedFeatures

Paired features similar to breakends, but simpler, like BEDPE

```js
// type signature
hasPairedFeatures: (trackConfigId: string) => any
```

#### method: getTrackFeatures

Get a composite map of featureId-\>feature map for a track across multiple views

```js
// type signature
getTrackFeatures: (trackConfigId: string) => Map<string, Feature>
```

#### method: getMatchedFeaturesInLayout

```js
// type signature
getMatchedFeaturesInLayout: (trackConfigId: string, features: Feature[][]) => { feature: Feature; layout: LayoutRecord; level: any; clipPos: number; }[][]
```

#### method: menuItems

```js
// type signature
menuItems: () => ({ label: string; subMenu: MenuItem[]; } | { label: string; onClick: () => void; type?: undefined; checked?: undefined; icon?: undefined; } | { label: string; type: string; checked: boolean; onClick: () => void; icon?: undefined; } | { ...; } | { ...; })[]
```

### BreakpointSplitView - Actions

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => void
```

#### action: removeView

```js
// type signature
removeView: (view: { id: string; displayName: string; minimized: boolean; type: string; offsetPx: number; bpPerPx: number; displayedRegions: Region[] & IStateTreeNode<IOptionalIType<IType<Region[], Region[], Region[]>, [...]>>; ... 11 more ...; showTrackOutlines: boolean; } & ... 18 more ... & IStateTreeNode<...>) => void
```

#### action: toggleInteract

```js
// type signature
toggleInteract: () => void
```

#### action: toggleIntraviewLinks

```js
// type signature
toggleIntraviewLinks: () => void
```

#### action: toggleLinkViews

```js
// type signature
toggleLinkViews: () => void
```

#### action: setMatchedTrackFeatures

```js
// type signature
setMatchedTrackFeatures: (obj: Record<string, Feature[][]>) => void
```

#### action: reverseViewOrder

```js
// type signature
reverseViewOrder: () => void
```
