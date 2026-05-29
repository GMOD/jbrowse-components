---
id: lineararcdisplay
title: LinearArcDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearArcDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearArcDisplay.md)

## Docs

extends

- [BaseLinearDisplay](../baselineardisplay)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseLinearDisplay](../baselineardisplay)

**Properties:** blockState, configuration, showLegend, showTooltips

**Volatiles:** featureIdUnderMouse, subfeatureIdUnderMouse, contextMenuFeature

**Getters:** DisplayMessageComponent, blockType, blockDefinitions, renderDelay,
TooltipComponent, selectedFeatureId, featureWidgetType, showTooltipsEnabled,
features, featureUnderMouse, layoutFeatures, getFeatureOverlapping,
getFeatureByID, searchFeatureByID, floatingLabelData

**Methods:** legendItems, svgLegendWidth, getFeatureById, trackMenuItems,
contextMenuItems, renderingProps, renderProps, renderSvg

**Actions:** addBlock, deleteBlock, selectFeature, navToFeature,
clearFeatureSelection, setFeatureIdUnderMouse, setSubfeatureIdUnderMouse,
setContextMenuFeature, setMouseoverExtraInformation, setShowLegend,
setShowTooltips, reload, selectFeatureById, setContextMenuFeatureById

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
rendererType, DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** heightPreConfig

**Volatiles:** scrollTop

**Actions:** setScrollTop, setHeight, resizeHeight

### LinearArcDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearArcDisplay">
// code
type: types.literal('LinearArcDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: displayMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
displayMode: types.maybe(types.string)
```

### LinearArcDisplay - Getters

#### getter: blockType

```js
// type
string
```

#### getter: renderDelay

```js
// type
number
```

#### getter: rendererTypeName

```js
// type
any
```

#### getter: displayModeSetting

```js
// type
any
```

#### getter: rendererConfig

```js
// type
any
```

### LinearArcDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### LinearArcDisplay - Actions

#### action: setDisplayMode

```js
// type signature
setDisplayMode: (flag: string) => void
```
