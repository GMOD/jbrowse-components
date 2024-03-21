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

#### property: interactToggled

```js
// type signature
false
// code
interactToggled: false
```

#### property: linkViews

```js
// type signature
false
// code
linkViews: false
```

#### property: showIntraviewLinks

```js
// type signature
true
// code
showIntraviewLinks: true
```

#### property: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

#### property: type

```js
// type signature
ISimpleType<"BreakpointSplitView">
// code
type: types.literal('BreakpointSplitView')
```

#### property: views

```js
// type signature
IArrayType<IModelType<{ displayName: IMaybe<ISimpleType<string>>; id: IOptionalIType<ISimpleType<string>, [undefined]>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 15 more ... & { ...; }, _NotCustomized, _NotCustomized>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        )
```

### BreakpointSplitView - Getters

#### getter: matchedTracks

Find all track ids that match across multiple views

```js
// type
any[]
```

### BreakpointSplitView - Methods

#### method: exportSvg

creates an svg export and save using FileSaver

```js
// type signature
exportSvg: (opts?: ExportSvgOptions) => Promise<void>
```

#### method: getMatchedFeaturesInLayout

```js
// type signature
getMatchedFeaturesInLayout: (trackConfigId: string, features: Feature[][]) => { feature: Feature; layout: LayoutRecord; level: any; }[][]
```

#### method: getMatchedTracks

Get tracks with a given trackId across multiple views

```js
// type signature
getMatchedTracks: (trackConfigId: string) => any[]
```

#### method: getTrackFeatures

Get a composite map of featureId-\>feature map for a track across multiple views

```js
// type signature
getTrackFeatures: (trackConfigId: string) => Map<string, Feature>
```

#### method: hasTranslocations

Translocation features are handled differently since they do not have a mate
e.g. they are one sided

```js
// type signature
hasTranslocations: (trackConfigId: string) => any
```

#### method: menuItems

```js
// type signature
menuItems: () => ({ label: string; subMenu: MenuItem[]; } | { checked: boolean; label: string; onClick: () => void; type: string; icon?: undefined; } | { checked: boolean; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { ...; }; label: string; onClick: () => void; type: string; } | { ...; })[]
```

### BreakpointSplitView - Actions

#### action: closeView

```js
// type signature
closeView: () => void
```

#### action: removeView

```js
// type signature
removeView: (view: { displayName: string; id: string; minimized: boolean; bpPerPx: number; colorByCDS: boolean; displayedRegions: IMSTArray<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<string>; reversed: IOptionalIType<...>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IStat...
```

#### action: setMatchedTrackFeatures

```js
// type signature
setMatchedTrackFeatures: (obj: Record<string, Feature[][]>) => void
```

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => void
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
