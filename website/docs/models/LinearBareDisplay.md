---
id: linearbaredisplay
title: LinearBareDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearBareDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearBareDisplay.md)

## Docs

Legacy block-stack display for `BasicTrack`: `BaseLinearDisplay` plus a
pluggable `renderer` slot. Not commonly used; the GPU `LinearBasicDisplay` is
the default feature display. See agent-docs/TRACK_DISPLAY_CONCEPTS.md.

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
features, featureUnderMouse, searchFeatureByID

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

### LinearBareDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearBareDisplay">
// code
type: types.literal('LinearBareDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### LinearBareDisplay - Getters

#### getter: rendererConfig

```js
// type
any
```

#### getter: rendererTypeName

```js
// type
any
```

### LinearBareDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```
