---
id: breakpointsplitview
title: BreakpointSplitView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/breakpoint-split-view/src/BreakpointSplitView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BreakpointSplitView.md)

## Docs

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
height: types.optional(types.number, defaultHeight)
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
true
// code
interactiveOverlay: true
```

#### property: showHeader

```js
// type signature
false
// code
showHeader: false
```

#### property: views

```js
// type signature
IArrayType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 15 more ... & { ...; }, ModelCreationType<...>, { ...; }>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### property: init

used for initializing the view from a session snapshot

```js
// type signature
IType<BreakpointSplitViewInit, BreakpointSplitViewInit, BreakpointSplitViewInit>
// code
init: types.frozen<BreakpointSplitViewInit | undefined>()
```

### BreakpointSplitView - Getters

#### getter: hasSomethingToShow

```js
// type
boolean
```

#### getter: initialized

```js
// type
boolean
```

#### getter: showImportForm

```js
// type
boolean
```

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
hasTranslocations: (trackConfigId: string) => boolean
```

#### method: hasPairedFeatures

Paired features similar to breakends, but simpler, like BEDPE

```js
// type signature
hasPairedFeatures: (trackConfigId: string) => boolean
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

#### action: setInteractiveOverlay

```js
// type signature
setInteractiveOverlay: (arg: boolean) => void
```

#### action: setShowIntraviewLinks

```js
// type signature
setShowIntraviewLinks: (arg: boolean) => void
```

#### action: setLinkViews

```js
// type signature
setLinkViews: (arg: boolean) => void
```

#### action: setShowHeader

```js
// type signature
setShowHeader: (arg: boolean) => void
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

#### action: setInit

```js
// type signature
setInit: (init?: BreakpointSplitViewInit) => void
```

#### action: setViews

```js
// type signature
setViews: (viewInits: { loc?: string; assembly: string; tracks?: string[]; }[]) => void
```
