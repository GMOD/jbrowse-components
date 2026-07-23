---
id: linearbasicdisplay
title: LinearBasicDisplay
sidebar_label: Display -> LinearBasicDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`canvas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/model.ts).

## Example usage

A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
`tracks`. `displayMode` sets the feature height preset (`normal`, `compact`, or
`superCompact`), or `collapsed` for a single-row overview:

```js
{
  type: 'FeatureTrack',
  trackId: 'genes',
  name: 'Genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/genes.gff3.gz',
  },
  displays: [
    {
      type: 'LinearBasicDisplay',
      displayId: 'genes-LinearBasicDisplay',
      height: 200,
      displayMode: 'compact',
    },
  ],
}
```

## Overview

GPU-accelerated feature display with gene-specific UI on top of the shared
canvas base display (`LinearCanvasBaseDisplay`). This is the GPU stack — despite
the name it does NOT extend `BaseLinearDisplay` (the legacy block stack). See
agent-docs/ARCHITECTURE.md "Display stacks".

## Members

| Member                                                                 | Kind       | Defined by                                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ---------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [geneGlyphNoticeDismissed](#volatile-geneglyphnoticedismissed)         | Volatiles  | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [subfeatureLabels](#getter-subfeaturelabels)                           | Getters    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [geneGlyphMode](#getter-geneglyphmode)                                 | Getters    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [displayDirectionalChevrons](#getter-displaydirectionalchevrons)       | Getters    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [effectiveGeneGlyphMode](#getter-effectivegeneglyphmode)               | Getters    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showGeneGlyphNotice](#getter-showgeneglyphnotice)                     | Getters    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [geneGlyphCollapsed](#getter-geneglyphcollapsed)                       | Getters    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [isGeneLike](#getter-isgenelike)                                       | Getters    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [rpcProps](#method-rpcprops)                                           | Methods    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showSubmenuCheckboxItems](#method-showsubmenucheckboxitems)           | Methods    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showSubmenuRadioGroups](#method-showsubmenuradiogroups)               | Methods    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [trackMenuItems](#method-trackmenuitems)                               | Methods    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [contextMenuItems](#method-contextmenuitems)                           | Methods    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setSubfeatureLabels](#action-setsubfeaturelabels)                     | Actions    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setGeneGlyphMode](#action-setgeneglyphmode)                           | Actions    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [dismissGeneGlyphNotice](#action-dismissgeneglyphnotice)               | Actions    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setShowOnlyGenes](#action-setshowonlygenes)                           | Actions    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setDisplayDirectionalChevrons](#action-setdisplaydirectionalchevrons) | Actions    | LinearBasicDisplay                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [refName](#property-refname)                                           | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [start](#property-start)                                               | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [end](#property-end)                                                   | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [name](#property-name)                                                 | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureId](#property-featureid)                                       | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [configuration](#property-configuration)                               | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [jexlFiltersSetting](#property-jexlfilterssetting)                     | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Runtime "Filter by..." override.                                                                                                                                                                                                                                                                                                                                                                                                              |
| [pinnedFeatureIds](#property-pinnedfeatureids)                         | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Feature ids the user pinned to the top of the layout via the feature right-click menu.                                                                                                                                                                                                                                                                                                                                                        |
| [soloFeatureIds](#property-solofeatureids)                             | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | "Show only these features": the collected set the user builds by ctrl+clicking features (or via the right-click menu).                                                                                                                                                                                                                                                                                                                        |
| [soloApplied](#property-soloapplied)                                   | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Whether the collected soloFeatureIds set is actually isolating the view (worker drops non-members).                                                                                                                                                                                                                                                                                                                                           |
| [hiddenFeatureIds](#property-hiddenfeatureids)                         | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | "Hide this feature" exclusion set (inverse of solo): the worker drops these from layout/drawing.                                                                                                                                                                                                                                                                                                                                              |
| [featureHighlights](#property-featurehighlights)                       | Properties | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Declarative feature highlights, typically seeded by a text search (highlight the gene you searched for).                                                                                                                                                                                                                                                                                                                                      |
| [rpcDataMap](#volatile-rpcdatamap)                                     | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureIdUnderMouse](#volatile-featureidundermouse)                   | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [subfeatureIdUnderMouse](#volatile-subfeatureidundermouse)             | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [mouseoverExtraInformation](#volatile-mouseoverextrainformation)       | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [sequenceHoverPosition](#volatile-sequencehoverposition)               | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | genomic base currently hovered in a feature sequence dialog opened from this display, read by the LGV crosshair overlay                                                                                                                                                                                                                                                                                                                       |
| [contextMenuInfo](#volatile-contextmenuinfo)                           | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [incrementalLayout](#volatile-incrementallayout)                       | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [incrementalLayoutLabelsOnly](#volatile-incrementallayoutlabelsonly)   | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [incrementalLayoutBodiesOnly](#volatile-incrementallayoutbodiesonly)   | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [morphFromTops](#volatile-morphfromtops)                               | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [morphProgress](#volatile-morphprogress)                               | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [morphStartMs](#volatile-morphstartms)                                 | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [morphFromMaxY](#volatile-morphfrommaxy)                               | Volatiles  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [conf](#getter-conf)                                                   | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | the config typed off the concrete schema; `ConfigurationReference` erases `self.configuration` to `any`, so direct reads route through this to stay typed (same move as `BaseAdapter<CONF>`).                                                                                                                                                                                                                                                 |
| [renderState](#getter-renderstate)                                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [labelScrollBucket](#getter-labelscrollbucket)                         | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [DisplayMessageComponent](#getter-displaymessagecomponent)             | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [maxHeight](#getter-maxheight)                                         | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [displayMode](#getter-displaymode)                                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [labelFontSize](#getter-labelfontsize)                                 | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showLabelsMode](#getter-showlabelsmode)                               | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showLabels](#getter-showlabels)                                       | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showDescriptions](#getter-showdescriptions)                           | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showOutline](#getter-showoutline)                                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureColor](#getter-featurecolor)                                   | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [utrColor](#getter-utrcolor)                                           | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [colorByMode](#getter-colorbymode)                                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [colorByAttribute](#getter-colorbyattribute)                           | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [effectiveShowDescriptions](#getter-effectiveshowdescriptions)         | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [selectedFeatureId](#getter-selectedfeatureid)                         | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [colorByCDS](#getter-colorbycds)                                       | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [sequenceAdapter](#getter-sequenceadapter)                             | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [regionKeys](#getter-regionkeys)                                       | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [reversedRegions](#getter-reversedregions)                             | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [pinnedFeatureIdSet](#getter-pinnedfeatureidset)                       | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [resolvedHighlights](#getter-resolvedhighlights)                       | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [highlightedFeatureIdSet](#getter-highlightedfeatureidset)             | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [layoutPinnedFeatureIdSet](#getter-layoutpinnedfeatureidset)           | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [soloFeatureIdSet](#getter-solofeatureidset)                           | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureWidgetType](#getter-featurewidgettype)                         | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [layoutInputs](#getter-layoutinputs)                                   | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Layout inputs shared by the base layout and every fit-escalation layout, minus the per-config label/description reservation flags.                                                                                                                                                                                                                                                                                                            |
| [layoutReady](#getter-layoutready)                                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Whether features can be laid out: data is fetched, in-bounds, and the view is measured.                                                                                                                                                                                                                                                                                                                                                       |
| [baseLaidOutDataMap](#getter-baselaidoutdatamap)                       | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Full reservation (names + descriptions): rendered at fit stage `full` and in non-fit modes, and the first stack `fitStage` probes.                                                                                                                                                                                                                                                                                                            |
| [fitLabelsOnlyLayout](#getter-fitlabelsonlylayout)                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Names reserved, descriptions dropped — the `labels` stage's stack.                                                                                                                                                                                                                                                                                                                                                                            |
| [fitDecimatedSolved](#getter-fitdecimatedsolved)                       | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | The `decimated` stack with its whitespace factor SOLVED to the track height.                                                                                                                                                                                                                                                                                                                                                                  |
| [fitBodiesOnlyLayout](#getter-fitbodiesonlylayout)                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Nothing reserved: bodies packed edge-to-edge (the tightest stack), labels hidden — the `bodies` stage's stack.                                                                                                                                                                                                                                                                                                                                |
| [fitBodyPx](#getter-fitbodypx)                                         | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | The unscaled feature-body height (px): configured `featureHeight` times the display-mode multiplier (what the layout already applied).                                                                                                                                                                                                                                                                                                        |
| [fitMinScale](#getter-fitminscale)                                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Floor on the fit squeeze: the smallest vertical scale that still leaves a feature body at least `MIN_FIT_BOX_PX` tall.                                                                                                                                                                                                                                                                                                                        |
| [fitMaxScale](#getter-fitmaxscale)                                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Ceiling on the fit grow: the largest vertical scale before a feature body exceeds the configured (normal-mode) `featureHeight`.                                                                                                                                                                                                                                                                                                               |
| [fitStage](#getter-fitstage)                                           | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | The resolved fit outcome — which reservation `level` survived, its unscaled `layout`, and the vertical `scale` to fill the track — bundled so the three can never disagree.                                                                                                                                                                                                                                                                   |
| [fitScale](#getter-fitscale)                                           | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Uniform vertical scale for fit mode; 1 unless the resolved stack is being grown to fill the track (> 1) or the bodies stack squeezed to fit (< 1).                                                                                                                                                                                                                                                                                            |
| [laidOutDataMap](#getter-laidoutdatamap)                               | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | What every consumer (hit test, GPU upload, React render) reads: the resolved fit layout, cloned and scaled only when grown or squeezed.                                                                                                                                                                                                                                                                                                       |
| [renderedShowDescriptions](#getter-renderedshowdescriptions)           | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Descriptions are painted only at the `full` stage (and whenever fit is off).                                                                                                                                                                                                                                                                                                                                                                  |
| [renderedShowLabels](#getter-renderedshowlabels)                       | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Names are painted at every stage short of `bodies` (and whenever fit is off), where the packer reserved row height + overhang for the names it kept so they never overlap — including the `decimated` stage, whose per-feature pruning happens inside the layout (dropped names are removed from floatingLabelsData), not via this flag.                                                                                                      |
| [renderDataMap](#getter-renderdatamap)                                 | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [settledMaxY](#getter-settledmaxy)                                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [maxY](#getter-maxy)                                                   | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hasOverflow](#getter-hasoverflow)                                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [contentHeight](#getter-contentheight)                                 | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [scrollableHeight](#getter-scrollableheight)                           | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [naturalContentHeight](#getter-naturalcontentheight)                   | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [grownHeight](#getter-grownheight)                                     | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [height](#getter-height)                                               | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureIdIndex](#getter-featureidindex)                               | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [subfeatureIdIndex](#getter-subfeatureidindex)                         | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hoveredFeature](#getter-hoveredfeature)                               | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hoveredSubfeature](#getter-hoveredsubfeature)                         | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureItemMap](#getter-featureitemmap)                               | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [flatbushIndexes](#getter-flatbushindexes)                             | Getters    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [activeFilters](#method-activefilters)                                 | Methods    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | The filters actually applied, as `jexl:`-prefixed expressions.                                                                                                                                                                                                                                                                                                                                                                                |
| [fitLayoutAt](#method-fitlayoutat)                                     | Methods    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | One fit-escalation candidate: the stack packed with the given label/description reservation, via that config's own memo instance so each keeps stable references across renders.                                                                                                                                                                                                                                                              |
| [getFeatureById](#method-getfeaturebyid)                               | Methods    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [searchFeatureByID](#method-searchfeaturebyid)                         | Methods    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderSvg](#method-rendersvg)                                         | Methods    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showSubmenuMenuItems](#method-showsubmenumenuitems)                   | Methods    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [colorBySubMenuItems](#method-colorbysubmenuitems)                     | Methods    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | The "Color by..." radio choices (solid/strand/attribute).                                                                                                                                                                                                                                                                                                                                                                                     |
| [colorMenuItems](#method-colormenuitems)                               | Methods    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Color-related track menu entries: a single "Color by..." entry whose "Solid color..." choice opens the solid+UTR color picker.                                                                                                                                                                                                                                                                                                                |
| [featureHeightMenuItems](#method-featureheightmenuitems)               | Methods    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | One "Feature height" menu with two independent radio groups, mirroring the alignments display: the size presets (how tall each feature is drawn) and, under a "Track sizing" subheader, how the track responds when there are more features than fit — scroll / expand / squeeze.                                                                                                                                                             |
| [beginYMorph](#action-beginymorph)                                     | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setMorphProgress](#action-setmorphprogress)                           | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [endYMorph](#action-endymorph)                                         | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setRpcData](#action-setrpcdata)                                       | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)           | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [pruneRpcDataMapToVisible](#action-prunerpcdatamaptovisible)           | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [startRenderingBackend](#action-startrenderingbackend)                 | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setHover](#action-sethover)                                           | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearHover](#action-clearhover)                                       | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [closeContextMenu](#action-closecontextmenu)                           | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [togglePinnedFeature](#action-togglepinnedfeature)                     | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [toggleSoloFeature](#action-togglesolofeature)                         | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearSolo](#action-clearsolo)                                         | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hideFeature](#action-hidefeature)                                     | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showAllHidden](#action-showallhidden)                                 | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setFeatureHighlights](#action-setfeaturehighlights)                   | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [addFeatureHighlightForItem](#action-addfeaturehighlightforitem)       | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [removeFeatureHighlightsForId](#action-removefeaturehighlightsforid)   | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearFeatureHighlights](#action-clearfeaturehighlights)               | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [applySolo](#action-applysolo)                                         | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [soloFeature](#action-solofeature)                                     | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearAllFeatureFilters](#action-clearallfeaturefilters)               | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [selectFeature](#action-selectfeature)                                 | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Open the feature-details widget.                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearSelection](#action-clearselection)                               | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setShowLabels](#action-setshowlabels)                                 | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setShowDescriptions](#action-setshowdescriptions)                     | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setJexlFilters](#action-setjexlfilters)                               | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | Sets the runtime filter override (already-`jexl:`-prefixed expressions).                                                                                                                                                                                                                                                                                                                                                                      |
| [setShowOutline](#action-setshowoutline)                               | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setFeatureColor](#action-setfeaturecolor)                             | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setUtrColor](#action-setutrcolor)                                     | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setSequenceHoverPosition](#action-setsequencehoverposition)           | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [openContextMenu](#action-opencontextmenu)                             | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setDisplayMode](#action-setdisplaymode)                               | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setHeightMode](#action-setheightmode)                                 | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [openSetColorDialog](#action-opensetcolordialog)                       | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [openColorByAttributeDialog](#action-opencolorbyattributedialog)       | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [openFilterDialog](#action-openfilterdialog)                           | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [fetchFullFeature](#action-fetchfullfeature)                           | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [isCacheValid](#action-iscachevalid)                                   | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [selectFeatureById](#action-selectfeaturebyid)                         | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [reload](#action-reload)                                               | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [fetchNeeded](#action-fetchneeded)                                     | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [resizeHeight](#action-resizeheight)                                   | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) | A manual drag-resize means the user wants a fixed height; leave grow mode first, otherwise the reactive `height` getter re-derives grownHeight on the next layout change and the drag appears to do nothing.                                                                                                                                                                                                                                  |
| [afterAttach](#action-afterattach)                                     | Actions    | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [id](#property-id)                                                     | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [type](#property-type)                                                 | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [rpcDriverName](#property-rpcdrivername)                               | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)             | Properties | [BaseDisplay](../basedisplay)                         | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL).                                                                                                                                                                                                                                                                                                           |
| [error](#volatile-error)                                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [statusMessage](#volatile-statusmessage)                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [statusProgress](#volatile-statusprogress)                             | Volatiles  | [BaseDisplay](../basedisplay)                         | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                                                                                                                                                                                                                                                                                                                           |
| [parentTrack](#getter-parenttrack)                                     | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [parentDisplay](#getter-parentdisplay)                                 | Getters    | [BaseDisplay](../basedisplay)                         | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                                                              |
| [RenderingComponent](#getter-renderingcomponent)                       | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [DisplayBlurb](#getter-displayblurb)                                   | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [adapterConfig](#getter-adapterconfig)                                 | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [isMinimized](#getter-isminimized)                                     | Getters    | [BaseDisplay](../basedisplay)                         | Returns true if the parent track is minimized.                                                                                                                                                                                                                                                                                                                                                                                                |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)               | Getters    | [BaseDisplay](../basedisplay)                         | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                                                                                                                                                                                                                                                                                                                          |
| [renderingProps](#method-renderingprops)                               | Methods    | [BaseDisplay](../basedisplay)                         | props passed to the renderer's React "Rendering" component.                                                                                                                                                                                                                                                                                                                                                                                   |
| [regionCannotBeRendered](#method-regioncannotberendered)               | Methods    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)         | Actions    | [BaseDisplay](../basedisplay)                         | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                                                                                                                                                                                                     |
| [setStatusMessage](#action-setstatusmessage)                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setError](#action-seterror)                                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setRpcDriverName](#action-setrpcdrivername)                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [scrollTop](#volatile-scrolltop)                                       | Volatiles  | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setScrollTop](#action-setscrolltop)                                   | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setHeight](#action-setheight)                                         | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [heightMode](#getter-heightmode)                                       | Getters    | [HeightModeMixin](../heightmodemixin)                 | The resolved track-height strategy (`fixed`/`grow`/`fit`).                                                                                                                                                                                                                                                                                                                                                                                    |
| [fitTargetHeight](#getter-fittargetheight)                             | Getters    | [HeightModeMixin](../heightmodemixin)                 | The drag-resizable track height as stored in the config slot — the fit target the fit/grow layout scales or packs content into.                                                                                                                                                                                                                                                                                                               |
| [autoHeight](#getter-autoheight)                                       | Getters    | [HeightModeMixin](../heightmodemixin)                 | `grow` mode as a boolean, derived from the unified `heightMode` slot.                                                                                                                                                                                                                                                                                                                                                                         |
| [fitHeightToDisplay](#getter-fitheighttodisplay)                       | Getters    | [HeightModeMixin](../heightmodemixin)                 | `fit` mode as a boolean, derived from the unified `heightMode` slot.                                                                                                                                                                                                                                                                                                                                                                          |
| [loadedRegions](#volatile-loadedregions)                               | Volatiles  | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                                                                                                                                                                                                        |
| [isReady](#getter-isready)                                             | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                                                                                                                                                                                                    |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan.                                                                                                                                                                                                                                                                        |
| [svgReady](#getter-svgready)                                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once an off-screen (SVG) export can safely read this display's data: every visible region has loaded, or the fetch reached a terminal error / too-large state.                                                                                                                                                                                                                                                                           |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                 | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data.                                                                                                                                                                                                                                                                                            |
| [renderBlocks](#getter-renderblocks)                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Shared cached view for every LGV-based GPU display.                                                                                                                                                                                                                                                                                                                                                                                           |
| [displayPhase](#getter-displayphase)                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The display's mutually-exclusive visual state, precedence single-sourced in `computeDisplayPhase`.                                                                                                                                                                                                                                                                                                                                            |
| [rpcPropsCacheKey](#getter-rpcpropscachekey)                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The RPC cache key: the subclass's `rpcProps()` payload serialized to a string, so this getter's value is a primitive and MobX invalidates its observers only when the payload actually changed.                                                                                                                                                                                                                                               |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Derived opt-in for the region-too-large gate: a display that declares a pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one decision, so they can't desync (this replaces the old dev-time "config set but gate off" console.error).                                                                                                                                                                             |
| [setLoadedRegion](#action-setloadedregion)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                                                                                                                                                                                                     |
| [clearAllRpcData](#action-clearallrpcdata)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | full reset: cancels fetch, clears error, loadedRegions, display-specific data, and the canvas-drawn flag.                                                                                                                                                                                                                                                                                                                                     |
| [invalidateLoadedRegions](#action-invalidateloadedregions)             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                                                                                                                                                                                                |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                 | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook: return config to enable byte-estimate gating before fetch.                                                                                                                                                                                                                                                                                                                                                                  |
| [onRegionTooLarge](#action-onregiontoolarge)                           | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (no-op base): called when `regionTooLarge` transitions to true.                                                                                                                                                                                                                                                                                                                                                              |
| [fetchRegions](#action-fetchregions)                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Run a per-region fetch with byte-estimate gating.                                                                                                                                                                                                                                                                                                                                                                                             |
| [userByteLimit](#volatile-userbytelimit)                               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | user-confirmed byte limit after a force-load, disabling the gate.                                                                                                                                                                                                                                                                                                                                                                             |
| [byteEstimate](#volatile-byteestimate)                                 | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                                                                                                                                                                                                                                |
| [measuredSpanBp](#volatile-measuredspanbp)                             | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                                                                                                                                                                                                                                          |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                                                                                                                                                                                                                           |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                                                                                                                                                                                                                          |
| [configForceLoad](#getter-configforceload)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                                                                                                                                                                                                             |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                                                                                                                                                                                                                               |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                                                                                                                                                                                                                                  |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                                                                                                                                                                                                                                        |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                                                                                                                                                                                                                      |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)       | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)         | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                                         |
| [setByteEstimate](#action-setbyteestimate)                             | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Commits the byte estimate and records the span it covers (`measuredSpanBp`) so the derived gate can rescale it to the span on screen.                                                                                                                                                                                                                                                                                                         |
| [raiseForceLoadLimits](#action-raiseforceloadlimits)                   | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | force-load: raise the byte limit past the current request so the gate releases.                                                                                                                                                                                                                                                                                                                                                               |
| [forceLoad](#action-forceload)                                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Raises the byte limit past the current estimate and triggers a reload.                                                                                                                                                                                                                                                                                                                                                                        |
| [canvasDrawn](#volatile-canvasdrawn)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                                                                                                                                            |
| [currentRenderingBackend](#volatile-currentrenderingbackend)           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | current backend reference, updated on context-loss recovery.                                                                                                                                                                                                                                                                                                                                                                                  |
| [renderTick](#volatile-rendertick)                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                                                                                                                              |
| [autorunsInstalled](#volatile-autorunsinstalled)                       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                                                                                                                                    |
| [renderError](#volatile-rendererror)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                                                                                                                                                                                                                                                                   |
| [markCanvasDrawn](#action-markcanvasdrawn)                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [stopRenderingBackend](#action-stoprenderingbackend)                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderNow](#action-rendernow)                                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setRenderError](#action-setrendererror)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | set/clear the render-backend error.                                                                                                                                                                                                                                                                                                                                                                                                           |
| [attachRenderingBackend](#action-attachrenderingbackend)               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                                                                                                                                   |
| [activeStopToken](#volatile-activestoptoken)                           | Volatiles  | [FetchMixin](../fetchmixin)                           | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                                                                     |
| [fetchGeneration](#volatile-fetchgeneration)                           | Volatiles  | [FetchMixin](../fetchmixin)                           | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                                                              |
| [fetchCanceled](#volatile-fetchcanceled)                               | Volatiles  | [FetchMixin](../fetchmixin)                           | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                                                                                                                                                                                                                    |
| [regionStatuses](#volatile-regionstatuses)                             | Volatiles  | [FetchMixin](../fetchmixin)                           | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                                                                                                                                                                                                                                |
| [lastStatusMs](#volatile-laststatusms)                                 | Volatiles  | [FetchMixin](../fetchmixin)                           | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                                                                                                                                                                    |
| [isLoading](#getter-isloading)                                         | Getters    | [FetchMixin](../fetchmixin)                           | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [makeStatusCallback](#method-makestatuscallback)                       | Methods    | [FetchMixin](../fetchmixin)                           | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op.                                                                                                                                                                                                  |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)           | Methods    | [FetchMixin](../fetchmixin)                           | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                                                                                                                                                                                                                              |
| [throttleStatus](#action-throttlestatus)                               | Actions    | [FetchMixin](../fetchmixin)                           | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write.                                                                                                                                                                                                                                                                                                                                                     |
| [resetStatus](#action-resetstatus)                                     | Actions    | [FetchMixin](../fetchmixin)                           | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                                                                                                                                                                                                                  |
| [stopActiveFetch](#action-stopactivefetch)                             | Actions    | [FetchMixin](../fetchmixin)                           | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                                                                                                                                                                                                                      |
| [setRegionStatus](#action-setregionstatus)                             | Actions    | [FetchMixin](../fetchmixin)                           | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                                                                                                                                                                                                                     |
| [cancelFetch](#action-cancelfetch)                                     | Actions    | [FetchMixin](../fetchmixin)                           | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                                                                                                                                                                                                                  |
| [cancelFetchByUser](#action-cancelfetchbyuser)                         | Actions    | [FetchMixin](../fetchmixin)                           | User-initiated cancel from the loading overlay.                                                                                                                                                                                                                                                                                                                                                                                               |
| [beforeDestroy](#action-beforedestroy)                                 | Actions    | [FetchMixin](../fetchmixin)                           | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                                                                                                                                                                                                                          |
| [runFetch](#action-runfetch)                                           | Actions    | [FetchMixin](../fetchmixin)                           | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                                                                                                                                                                                                                  |
| [densityStatsPerRegion](#volatile-densitystatsperregion)               | Volatiles  | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | per-region feature counts (keyed by displayedRegionIndex), so the density verdict is a live max over the visible regions at the current bpPerPx — never a stale fetch-time snapshot.                                                                                                                                                                                                                                                          |
| [userFeatureDensityLimit](#volatile-userfeaturedensitylimit)           | Volatiles  | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | density force-load ceiling; the density-axis counterpart to `RegionTooLargeMixin.userByteLimit`, volatile for the same reason (a force-load must not leak into a saved session).                                                                                                                                                                                                                                                              |
| [densityGateEnabled](#getter-densitygateenabled)                       | Getters    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | Whether the density (features-per-pixel) axis applies.                                                                                                                                                                                                                                                                                                                                                                                        |
| [adapterFetchSizeLimit](#getter-adapterfetchsizelimit)                 | Getters    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | The adapter's own `fetchSizeLimit` slot (undefined when the adapter type has none); `resolveByteLimit` prefers it over the display config.                                                                                                                                                                                                                                                                                                    |
| [visibleFeatureDensityPerPx](#getter-visiblefeaturedensityperpx)       | Getters    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | Current density across the visible regions at the debounced coarseBpPerPx, so the verdict shares the layout cadence and doesn't flicker mid-zoom.                                                                                                                                                                                                                                                                                             |
| [maxFeatureDensity](#getter-maxfeaturedensity)                         | Getters    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | The density budget passed to the worker and used by the derived verdict: undefined (gate off) under a declarative/byte force-load or below AUTO_FORCE_LOAD_BP; otherwise the density force-load ceiling or the config.                                                                                                                                                                                                                        |
| [densityTooLarge](#getter-densitytoolarge)                             | Getters    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [observedMaxDensity](#method-observedmaxdensity)                       | Methods    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | Highest features-per-pixel across the visible regions at `bpPerPx`, from the cached per-region counts.                                                                                                                                                                                                                                                                                                                                        |
| [resolvedByteLimit](#method-resolvedbytelimit)                         | Methods    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | The byte budget the fetch RPC enforces, short-circuiting an over-budget region before downloading features.                                                                                                                                                                                                                                                                                                                                   |
| [setDensityStats](#action-setdensitystats)                             | Actions    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearGateMeasurements](#action-cleargatemeasurements)                 | Actions    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | Drop the whole cached estimate on chromosome navigation (displayedRegion indices get reused, so a stale entry would gate the new region against the wrong stats).                                                                                                                                                                                                                                                                             |
| [commitGateMeasurements](#action-commitgatemeasurements)               | Actions    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | Commit a batch of per-region fetch outcomes: record the per-region byte **max** (not sum — each region is gated against the same per-region budget, so a multi-region view where every region individually fits is never blanked by the cross-region total) and the per-region density, then publish the byte estimate + adapter limit to `RegionTooLargeMixin` so the banner's `resolveByteLimit` picks the same budget the worker gated on. |
| [displayTypeDefaultChanges](#method-displaytypedefaultchanges)         | Methods    | [PromotableDefaultsMixin](../promotabledefaultsmixin) | Effective config differences a track following the default inherits from session-wide defaults (distinct from per-track config edits / trackConfigDeltas).                                                                                                                                                                                                                                                                                    |
| [clearDisplayTypeDefaults](#action-cleardisplaytypedefaults)           | Actions    | [PromotableDefaultsMixin](../promotabledefaultsmixin) | Clear the session-wide defaults reported by `displayTypeDefaultChanges` so this display (and its siblings of the same type) revert to their config values.                                                                                                                                                                                                                                                                                    |

### LinearBasicDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearbasicdisplay).

<details>
<summary>LinearBasicDisplay - Volatiles</summary>

| Member                                                                       | Type    |
| ---------------------------------------------------------------------------- | ------- |
| <span id="volatile-geneglyphnoticedismissed">geneGlyphNoticeDismissed</span> | `false` |

</details>

<details>
<summary>LinearBasicDisplay - Getters</summary>

| Member                                                                         | Type                                 |
| ------------------------------------------------------------------------------ | ------------------------------------ |
| <span id="getter-subfeaturelabels">subfeatureLabels</span>                     | `"none" \| "overlay" \| "below"`     |
| <span id="getter-geneglyphmode">geneGlyphMode</span>                           | `any`                                |
| <span id="getter-displaydirectionalchevrons">displayDirectionalChevrons</span> | `boolean`                            |
| <span id="getter-effectivegeneglyphmode">effectiveGeneGlyphMode</span>         | `"auto" \| "all" \| "longestCoding"` |
| <span id="getter-showgeneglyphnotice">showGeneGlyphNotice</span>               | `boolean`                            |
| <span id="getter-geneglyphcollapsed">geneGlyphCollapsed</span>                 | `boolean`                            |
| <span id="getter-isgenelike">isGeneLike</span>                                 | `boolean`                            |

</details>

<details>
<summary>LinearBasicDisplay - Methods</summary>

| Member                                                                     | Type                                                                                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-rpcprops">rpcProps</span>                                 | `() => { displayConfig: {…}; ... 5 more ...; theme: SerializableThemeArgs \| undefined; }`                                                        |
| <span id="method-showsubmenucheckboxitems">showSubmenuCheckboxItems</span> | `() => MenuItem[]`                                                                                                                                |
| <span id="method-showsubmenuradiogroups">showSubmenuRadioGroups</span>     | `() => MenuItem[]`                                                                                                                                |
| <span id="method-trackmenuitems">trackMenuItems</span>                     | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| CustomMenuItem \| { ...; })[]`      |
| <span id="method-contextmenuitems">contextMenuItems</span>                 | `() => ({…} \| { label: string; icon: OverridableComponent<…> & { ...; }; onClick: () => void; subMenu?: undefined; } \| { ...; } \| { ...; })[]` |

</details>

<details>
<summary>LinearBasicDisplay - Actions</summary>

| Member                                                                               | Type                                                  |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| <span id="action-setsubfeaturelabels">setSubfeatureLabels</span>                     | `(value: "none" \| "overlay" \| "below") => void`     |
| <span id="action-setgeneglyphmode">setGeneGlyphMode</span>                           | `(value: "auto" \| "all" \| "longestCoding") => void` |
| <span id="action-dismissgeneglyphnotice">dismissGeneGlyphNotice</span>               | `() => void`                                          |
| <span id="action-setshowonlygenes">setShowOnlyGenes</span>                           | `(value: boolean) => void`                            |
| <span id="action-setdisplaydirectionalchevrons">setDisplayDirectionalChevrons</span> | `(value: boolean) => void`                            |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from LinearCanvasBaseDisplay</summary>

[LinearCanvasBaseDisplay →](../linearcanvasbasedisplay)

**Properties**

#### property: jexlFiltersSetting

Runtime "Filter by..." override. When set (even to an empty list) it replaces
the `jexlFilters` config slot; when undefined the config default applies. Stored
as already-`jexl:`-prefixed expressions (runtime convention), unlike the
deferred-evaluation config slot.

```ts
// type signature
type jexlFiltersSetting = IMaybe<IArrayType<ISimpleType<string>>>
// code
jexlFiltersSetting: types.maybe(types.array(types.string))
```

#### property: pinnedFeatureIds

Feature ids the user pinned to the top of the layout via the feature right-click
menu. Pinned features are inserted first into the greedy row-packer, so they
hold the topmost rows in their bp range across zoom re-packs (see packRef in
layout.ts). stripDefault so a display with nothing pinned omits the empty array
from its snapshot.

Persisted by uniqueId, which resolves back to the same feature after a plain
reload of the same remote file: every adapter id is `adp-<configHash>` (idMaker
over the config) plus a file byte offset (tabix/BigBed) or a deterministic
full-file parse index (plain GFF3/BED/VCF). Caveat: NOT robust to editing a file
read by a plain (non-tabix) adapter (the indices shift), nor to local blob files
(their handleId changes each session — but a blob can't reload its data across
refresh anyway). Same basis for solo/hiddenFeatureIds.

```ts
// type signature
type pinnedFeatureIds = IOptionalIType<
  IArrayType<ISimpleType<string>>,
  [undefined]
>
// code
pinnedFeatureIds: types.stripDefault(types.array(types.string), [])
```

#### property: soloFeatureIds

"Show only these features": the collected set the user builds by ctrl+clicking
features (or via the right-click menu). Only isolates the view once
`soloApplied` is true — before that it's a highlighted selection that hides
nothing, so the candidates stay clickable. Persistent so a view can be opened
pre-focused declaratively (e.g. collapse-introns seeds it in the new view's
snapshot). stripDefault so an unfocused display omits the empty array from its
snapshot.

```ts
// type signature
type soloFeatureIds = IOptionalIType<
  IArrayType<ISimpleType<string>>,
  [undefined]
>
// code
soloFeatureIds: types.stripDefault(types.array(types.string), [])
```

#### property: soloApplied

Whether the collected soloFeatureIds set is actually isolating the view (worker
drops non-members). Decoupled from collection so building a multi-feature set
doesn't hide the features mid-build.

```ts
// type signature
type soloApplied = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
soloApplied: types.stripDefault(types.boolean, false)
```

#### property: hiddenFeatureIds

"Hide this feature" exclusion set (inverse of solo): the worker drops these from
layout/drawing. Applies immediately per feature — no collect-then-apply.
Persistent like the solo set, so a hidden feature stays hidden across
reload/session save. stripDefault so a display with nothing hidden omits the
empty array from its snapshot.

```ts
// type signature
type hiddenFeatureIds = IOptionalIType<
  IArrayType<ISimpleType<string>>,
  [undefined]
>
// code
hiddenFeatureIds: types.stripDefault(types.array(types.string), [])
```

#### property: featureHighlights

Declarative feature highlights, typically seeded by a text search (highlight the
gene you searched for). Each entry pins a feature by its span+name signature
rather than its uniqueId — a search result carries no uniqueId to persist
(unlike solo/hidden/pinned, which come from a click on a rendered feature and so
DO have a reload-stable id) — and is resolved against rendered features on the
main thread. stripDefault so a display with no highlights omits it from
snapshot.

```ts
// type signature
type featureHighlights = IOptionalIType<IArrayType<IModelType<…>>, [...]>
// code
featureHighlights: types.stripDefault(
            types.array(FeatureHighlightModel),
            [],
          )
```

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-refname">refName</span>             | `ISimpleType<string>`                                 |
| <span id="property-start">start</span>                 | `IMaybe<ISimpleType<number>>`                         |
| <span id="property-end">end</span>                     | `IMaybe<ISimpleType<number>>`                         |
| <span id="property-name">name</span>                   | `IMaybe<ISimpleType<string>>`                         |
| <span id="property-featureid">featureId</span>         | `IMaybe<ISimpleType<string>>`                         |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<AnyConfigurationSchemaType>` |

**Volatiles**

#### volatile: sequenceHoverPosition

genomic base currently hovered in a feature sequence dialog opened from this
display, read by the LGV crosshair overlay

```ts
// type signature
type sequenceHoverPosition = SequenceHoverPosition | undefined
// code
sequenceHoverPosition: undefined as SequenceHoverPosition | undefined
```

| Member                                                                             | Type                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="volatile-rpcdatamap">rpcDataMap</span>                                   | `ObservableMap<number, LoadedFeatureData>`                                                                                                       |
| <span id="volatile-featureidundermouse">featureIdUnderMouse</span>                 | `string \| null`                                                                                                                                 |
| <span id="volatile-subfeatureidundermouse">subfeatureIdUnderMouse</span>           | `string \| null`                                                                                                                                 |
| <span id="volatile-mouseoverextrainformation">mouseoverExtraInformation</span>     | `string \| undefined`                                                                                                                            |
| <span id="volatile-contextmenuinfo">contextMenuInfo</span>                         | `{ item: FlatbushItem; subfeature?: SubfeatureInfo \| undefined; displayedRegionIndex: number; clientX: number; clientY: number; } \| undefined` |
| <span id="volatile-incrementallayout">incrementalLayout</span>                     | `(rpcDataMap: ReadonlyMap<number, FeatureDataResult>, inputs: LayoutInputs) => Map<number, FeatureDataResult>`                                   |
| <span id="volatile-incrementallayoutlabelsonly">incrementalLayoutLabelsOnly</span> | `(rpcDataMap: ReadonlyMap<number, FeatureDataResult>, inputs: LayoutInputs) => Map<number, FeatureDataResult>`                                   |
| <span id="volatile-incrementallayoutbodiesonly">incrementalLayoutBodiesOnly</span> | `(rpcDataMap: ReadonlyMap<number, FeatureDataResult>, inputs: LayoutInputs) => Map<number, FeatureDataResult>`                                   |
| <span id="volatile-morphfromtops">morphFromTops</span>                             | `Map<string, number> \| undefined`                                                                                                               |
| <span id="volatile-morphprogress">morphProgress</span>                             | `number`                                                                                                                                         |
| <span id="volatile-morphstartms">morphStartMs</span>                               | `number`                                                                                                                                         |
| <span id="volatile-morphfrommaxy">morphFromMaxY</span>                             | `number`                                                                                                                                         |

**Getters**

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so direct reads route through this to stay typed
(same move as `BaseAdapter<CONF>`).

```ts
type conf = ModelInstanceTypeProps<Record<…>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: layoutInputs

Layout inputs shared by the base layout and every fit-escalation layout, minus
the per-config label/description reservation flags. One source so the candidate
layouts can't drift on bpPerPx / region keys / display mode / pins.

```ts
type layoutInputs = {
  bpPerPx: number
  regionKeys: Map<number, string>
  reversedRegions: Set<number>
  displayMode: DisplayMode
  pinnedFeatureIds: ReadonlySet<string>
}
```

#### getter: layoutReady

Whether features can be laid out: data is fetched, in-bounds, and the view is
measured. The shared readiness guard for every layout getter — an empty stack
until then, so the GPU upload autorun has nothing to push and view-geometry
getters aren't read before the view is measured.

```ts
type layoutReady = boolean
```

#### getter: baseLaidOutDataMap

Full reservation (names + descriptions): rendered at fit stage `full` and in
non-fit modes, and the first stack `fitStage` probes.

```ts
type baseLaidOutDataMap = Map<number, FeatureDataResult>
```

#### getter: fitLabelsOnlyLayout

Names reserved, descriptions dropped — the `labels` stage's stack. With
descriptions already off (config, or the auto density gate) this rung's
reservation is the base one, so reuse that stack by reference rather than
packing a byte-identical copy into a second memo.

```ts
type fitLabelsOnlyLayout = Map<number, FeatureDataResult>
```

#### getter: fitDecimatedSolved

The `decimated` stack with its whitespace factor SOLVED to the track height. A
name is kept only where the feature has at least `factor ×` its label width in
neighbor whitespace (plus pinned/highlighted, always); the factor is
binary-searched so the packed stack just fits `fitTargetHeight`. This fills the
height with as many non-overlapping names as fit — rather than snapping between
a few fixed rungs — because stack height is monotone in the factor (higher
factor drops more names → shorter), so the search keeps the SMALLEST fitting
factor, i.e. the MOST names. It decimates by isolation, not feature
size/"importance" (no reliable importance signal — a tiny miRNA can outrank a
large pseudogene), so it just maximizes how many readable names fit. Both the ~8
trial factors and the committed layout go through the same pure
`computeLaidOutData` at a factor: the committed stack is _byte-identical_ to the
probe that was measured against `trackHeight`, so the height the solve fits is
exactly the height `resolveFitLadder` sees. It deliberately does NOT reuse the
incremental memo here — the memo seeds each re-pack with the previous layout's
rows (`captureFeatureTops`), and seeding a new factor's (different) label set
from the old factor's rows packs the stack taller than the fresh probe, pushing
the committed stack over `trackHeight` and making the ladder wrongly fall
through to `bodies` (every label vanishing as the track grows). When even
`FIT_MAX_ROOM_FACTOR` overflows, the `labels` stack is returned — it overflows
(that is why the ladder reached this rung), so `resolveFitLadder` descends to
`bodies`, and reusing a stack already packed spares the solve one more pack that
would only be discarded.

With names off entirely there is nothing to decimate — every factor packs the
`labels` stack (see keepFeatureLabel's `showLabels` guard) — so the solve is
skipped and that stack reused, turning the ~9 probes this rung costs into zero
on exactly the dense tracks where the auto density gate hides names and fit mode
is most used.

```ts
type fitDecimatedSolved = Map<number, FeatureDataResult>
```

#### getter: fitBodiesOnlyLayout

Nothing reserved: bodies packed edge-to-edge (the tightest stack), labels hidden
— the `bodies` stage's stack. With names already off this is what the `labels`
rung packed, so reuse that stack by reference instead of re-packing it into a
third memo.

```ts
type fitBodiesOnlyLayout = Map<number, FeatureDataResult>
```

#### getter: fitBodyPx

The unscaled feature-body height (px): configured `featureHeight` times the
display-mode multiplier (what the layout already applied). Basis for the fit
squeeze/grow scale floors.

```ts
type fitBodyPx = number
```

#### getter: fitMinScale

Floor on the fit squeeze: the smallest vertical scale that still leaves a
feature body at least `MIN_FIT_BOX_PX` tall. When bodies would pack tighter than
this the squeeze stops here and the surplus scrolls instead of vanishing.

```ts
type fitMinScale = number
```

#### getter: fitMaxScale

Ceiling on the fit grow: the largest vertical scale before a feature body
exceeds the configured (normal-mode) `featureHeight`. A sparse stack grows to
fill the track only until its bodies reach their normal height, so fit never
makes a feature taller than it would be outside fit mode. In normal display mode
fitBodyPx already is the normal height, pinning the scale at 1 (no grow, surplus
stays whitespace); a compact mode (fitBodyPx below normal) may grow back up to —
but not past — the normal height.

This is exactly `1 / multiplier`: the grow target is the normal `featureHeight`
and the laid-out body is `featureHeight * multiplier`, so `featureHeight`
cancels and the ceiling is purely the display mode's compact ratio (1 in normal
mode → no grow).

```ts
type fitMaxScale = number
```

#### getter: fitStage

The resolved fit outcome — which reservation `level` survived, its unscaled
`layout`, and the vertical `scale` to fill the track — bundled so the three can
never disagree. The ladder keeps the least reduction whose _unscaled_ stack fits
the track height: `full` (names + descriptions), else `labels` (drop
descriptions), else `decimated` at a whitespace factor solved to the height
(`fitDecimatedSolved` — keeps as many non-overlapping names as fit, filling the
space continuously), else `bodies` (drop names too, pack tight) when even the
tightest decimation overflows. The kept rung is then scaled to fill the track:
grown up to `fitMaxScale` when it fits with room to spare, but never past the
normal feature height — so in normal display mode grow is pinned at 1 and spare
space stays whitespace, while a compact mode may enlarge back up to normal; or —
only at the last `bodies` rung — squeezed down to `fitMinScale` and scrolled if
even that overflows. Non-fit modes stay at `full`, scale 1. Read off the
unscaled candidate heights so it can't feed back on its own `scale`. The ladder
walk + scale math live in `resolveFitLadder`.

```ts
type fitStage = FitStage
```

#### getter: fitScale

Uniform vertical scale for fit mode; 1 unless the resolved stack is being grown
to fill the track (> 1) or the bodies stack squeezed to fit (< 1).

```ts
type fitScale = number
```

#### getter: laidOutDataMap

What every consumer (hit test, GPU upload, React render) reads: the resolved fit
layout, cloned and scaled only when grown or squeezed. A fit stack shorter than
the track stays top-anchored at y=0 (the surplus is bottom whitespace), so a
relayout — an isoform collapse, a filter — packs back up against the top instead
of jumping to a re-centered offset. Returned by reference off the untransformed
path (scale 1) so the incremental-layout upload diff and Y-morph idle check stay
intact.

```ts
type laidOutDataMap = Map<number, FeatureDataResult>
```

#### getter: renderedShowDescriptions

Descriptions are painted only at the `full` stage (and whenever fit is off).
Every render-time consumer — label draw and the highlight/hit/SVG label-width
reservation — reads this so a box never reserves width for a description it
won't draw.

```ts
type renderedShowDescriptions = any
```

#### getter: renderedShowLabels

Names are painted at every stage short of `bodies` (and whenever fit is off),
where the packer reserved row height + overhang for the names it kept so they
never overlap — including the `decimated` stage, whose per-feature pruning
happens inside the layout (dropped names are removed from floatingLabelsData),
not via this flag. At the `bodies` stage nothing is reserved, so all names are
hidden rather than drawn on top of the boxes. Every render-time consumer reads
this so hidden names reserve nothing.

```ts
type renderedShowLabels = boolean
```

| Member                                                                       | Type                                                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| <span id="getter-renderstate">renderState</span>                             | `{ scrollY: number; canvasWidth: number; canvasHeight: number; }`                |
| <span id="getter-labelscrollbucket">labelScrollBucket</span>                 | `number`                                                                         |
| <span id="getter-displaymessagecomponent">DisplayMessageComponent</span>     | `LazyExoticComponent<({ model, }: LinearBasicDisplayComponentProps) => Element>` |
| <span id="getter-maxheight">maxHeight</span>                                 | `any`                                                                            |
| <span id="getter-displaymode">displayMode</span>                             | `DisplayMode`                                                                    |
| <span id="getter-labelfontsize">labelFontSize</span>                         | `number`                                                                         |
| <span id="getter-showlabelsmode">showLabelsMode</span>                       | `any`                                                                            |
| <span id="getter-showlabels">showLabels</span>                               | `boolean`                                                                        |
| <span id="getter-showdescriptions">showDescriptions</span>                   | `any`                                                                            |
| <span id="getter-showoutline">showOutline</span>                             | `boolean`                                                                        |
| <span id="getter-featurecolor">featureColor</span>                           | `any`                                                                            |
| <span id="getter-utrcolor">utrColor</span>                                   | `string`                                                                         |
| <span id="getter-colorbymode">colorByMode</span>                             | `"strand" \| "attribute" \| "solid"`                                             |
| <span id="getter-colorbyattribute">colorByAttribute</span>                   | `string`                                                                         |
| <span id="getter-effectiveshowdescriptions">effectiveShowDescriptions</span> | `any`                                                                            |
| <span id="getter-selectedfeatureid">selectedFeatureId</span>                 | `string \| undefined`                                                            |
| <span id="getter-colorbycds">colorByCDS</span>                               | `boolean`                                                                        |
| <span id="getter-sequenceadapter">sequenceAdapter</span>                     | `any`                                                                            |
| <span id="getter-regionkeys">regionKeys</span>                               | `Map<number, string>`                                                            |
| <span id="getter-reversedregions">reversedRegions</span>                     | `Set<number>`                                                                    |
| <span id="getter-pinnedfeatureidset">pinnedFeatureIdSet</span>               | `ReadonlySet<string>`                                                            |
| <span id="getter-resolvedhighlights">resolvedHighlights</span>               | `ResolvedHighlights`                                                             |
| <span id="getter-highlightedfeatureidset">highlightedFeatureIdSet</span>     | `ReadonlySet<string>`                                                            |
| <span id="getter-layoutpinnedfeatureidset">layoutPinnedFeatureIdSet</span>   | `ReadonlySet<string>`                                                            |
| <span id="getter-solofeatureidset">soloFeatureIdSet</span>                   | `ReadonlySet<string>`                                                            |
| <span id="getter-featurewidgettype">featureWidgetType</span>                 | `{ type: string; id: string; }`                                                  |
| <span id="getter-renderdatamap">renderDataMap</span>                         | `Map<number, FeatureDataResult>`                                                 |
| <span id="getter-settledmaxy">settledMaxY</span>                             | `number`                                                                         |
| <span id="getter-maxy">maxY</span>                                           | `number`                                                                         |
| <span id="getter-hasoverflow">hasOverflow</span>                             | `boolean`                                                                        |
| <span id="getter-contentheight">contentHeight</span>                         | `number`                                                                         |
| <span id="getter-scrollableheight">scrollableHeight</span>                   | `number`                                                                         |
| <span id="getter-naturalcontentheight">naturalContentHeight</span>           | `number`                                                                         |
| <span id="getter-grownheight">grownHeight</span>                             | `number`                                                                         |
| <span id="getter-height">height</span>                                       | `number`                                                                         |
| <span id="getter-featureidindex">featureIdIndex</span>                       | `Map<string, FlatbushItem>`                                                      |
| <span id="getter-subfeatureidindex">subfeatureIdIndex</span>                 | `Map<string, SubfeatureInfo>`                                                    |
| <span id="getter-hoveredfeature">hoveredFeature</span>                       | `FlatbushItem \| null`                                                           |
| <span id="getter-hoveredsubfeature">hoveredSubfeature</span>                 | `SubfeatureInfo \| null`                                                         |
| <span id="getter-featureitemmap">featureItemMap</span>                       | `Map<string, FeatureItemEntry>`                                                  |
| <span id="getter-flatbushindexes">flatbushIndexes</span>                     | `Map<number, FlatbushRegionIndexes>`                                             |

**Methods**

#### method: activeFilters

The filters actually applied, as `jexl:`-prefixed expressions. The runtime
override shadows the config slot when set; otherwise the deferred-evaluation
`jexlFilters` config slot is prefixed on read. This is the single source of
truth for both the worker (via rpcProps) and the "Filter by..." dialog (so
existing config filters show up and are editable).

```ts
type activeFilters = () => string[]
```

#### method: fitLayoutAt

One fit-escalation candidate: the stack packed with the given label/description
reservation, via that config's own memo instance so each keeps stable references
across renders. Empty until initialized/in-bounds, so the GPU upload autorun has
nothing to push.

```ts
type fitLayoutAt = (memo: (rpcDataMap: ReadonlyMap<number, FeatureDataResult>, inputs: LayoutInputs) => Map<number, FeatureDataResult>, showLabels: boolean, showDescriptions: boolean) => Map<...>
```

#### method: colorBySubMenuItems

The "Color by..." radio choices (solid/strand/attribute). Split out so
subclasses can reuse them while assembling their own color menu.

```ts
type colorBySubMenuItems = () => {
  label: string
  type: 'radio'
  checked: boolean
  onClick: () => void
}[]
```

#### method: colorMenuItems

Color-related track menu entries: a single "Color by..." entry whose "Solid
color..." choice opens the solid+UTR color picker. Subclasses (e.g. variants)
override to drop the gene-oriented UTR picker.

```ts
type colorMenuItems = () => { label: string; icon: OverridableComponent<…> & { muiName: string; }; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; }[]
```

#### method: featureHeightMenuItems

One "Feature height" menu with two independent radio groups, mirroring the
alignments display: the size presets (how tall each feature is drawn) and, under
a "Track sizing" subheader, how the track responds when there are more features
than fit — scroll / expand / squeeze. The two axes are orthogonal, so picking a
size never changes the mode and vice versa. Shared by every canvas display
(genes, variants).

```ts
type featureHeightMenuItems = () => {
  label: string
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string }
  subMenu: MenuItem[]
}[]
```

| Member                                                             | Type                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="method-getfeaturebyid">getFeatureById</span>             | `(featureId: string) => FlatbushItem \| undefined`                                                                                                           |
| <span id="method-searchfeaturebyid">searchFeatureByID</span>       | `(id: string) => readonly [number, number, number, number] \| undefined`                                                                                     |
| <span id="method-rendersvg">renderSvg</span>                       | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<ReactElement<unknown, string \| JSXElementConstructor<any>> \| Iterable<...> \| AwaitedReactNode>` |
| <span id="method-showsubmenumenuitems">showSubmenuMenuItems</span> | `() => MenuItem[]`                                                                                                                                           |

**Actions**

#### action: selectFeature

Open the feature-details widget. The adapter's header metadata (VCF INFO/FORMAT
descriptions, etc.) is fetched first and passed as `descriptions` so the widget
can label attribute rows and — for the variant widget — resolve the ANN/CSQ
column names; without it that table renders headerless. CoreGetMetadata returns
null for adapters that expose none, so this is a no-op for those tracks.

```ts
type selectFeature = (feature: Feature) => void
```

#### action: setJexlFilters

Sets the runtime filter override (already-`jexl:`-prefixed expressions). Pass
undefined to clear it and fall back to the config `jexlFilters` slot.

```ts
type setJexlFilters = (filters?: string[] | undefined) => void
```

#### action: resizeHeight

A manual drag-resize means the user wants a fixed height; leave grow mode first,
otherwise the reactive `height` getter re-derives grownHeight on the next layout
change and the drag appears to do nothing. Read the displayed (grown) height
before flipping and write `grown + distance` directly — the grow-exit bake skips
when the slot is written during the exit, so this delta isn't clobbered (a plain
`superResizeHeight` would read the stale slot post-flip and lose it).

```ts
type resizeHeight = (distance: number) => number
```

| Member                                                                             | Type                                                                                                                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-beginymorph">beginYMorph</span>                                   | `(fromTops: Map<string, number>, fromMaxY: number) => void`                                                                                     |
| <span id="action-setmorphprogress">setMorphProgress</span>                         | `(t: number) => void`                                                                                                                           |
| <span id="action-endymorph">endYMorph</span>                                       | `() => void`                                                                                                                                    |
| <span id="action-setrpcdata">setRpcData</span>                                     | `(displayedRegionIndex: number, data: FeatureDataResult, loadedBpPerPx: number, region: Region) => void`                                        |
| <span id="action-cleardisplayspecificdata">clearDisplaySpecificData</span>         | `() => void`                                                                                                                                    |
| <span id="action-prunerpcdatamaptovisible">pruneRpcDataMapToVisible</span>         | `(visibleDisplayedRegionIndices: Set<number>) => void`                                                                                          |
| <span id="action-startrenderingbackend">startRenderingBackend</span>               | `(backend: CanvasFeatureRenderingBackend) => void`                                                                                              |
| <span id="action-sethover">setHover</span>                                         | `(featureId: string \| null, subfeatureId: string \| null, tooltip: string \| undefined) => void`                                               |
| <span id="action-clearhover">clearHover</span>                                     | `() => void`                                                                                                                                    |
| <span id="action-closecontextmenu">closeContextMenu</span>                         | `() => void`                                                                                                                                    |
| <span id="action-togglepinnedfeature">togglePinnedFeature</span>                   | `(featureId: string) => void`                                                                                                                   |
| <span id="action-togglesolofeature">toggleSoloFeature</span>                       | `(featureId: string) => void`                                                                                                                   |
| <span id="action-clearsolo">clearSolo</span>                                       | `() => void`                                                                                                                                    |
| <span id="action-hidefeature">hideFeature</span>                                   | `(featureId: string) => void`                                                                                                                   |
| <span id="action-showallhidden">showAllHidden</span>                               | `() => void`                                                                                                                                    |
| <span id="action-setfeaturehighlights">setFeatureHighlights</span>                 | `(highlights: FeatureHighlight[]) => void`                                                                                                      |
| <span id="action-addfeaturehighlightforitem">addFeatureHighlightForItem</span>     | `(target: HighlightTarget, refName: string) => void`                                                                                            |
| <span id="action-removefeaturehighlightsforid">removeFeatureHighlightsForId</span> | `(featureId: string) => void`                                                                                                                   |
| <span id="action-clearfeaturehighlights">clearFeatureHighlights</span>             | `() => void`                                                                                                                                    |
| <span id="action-applysolo">applySolo</span>                                       | `() => void`                                                                                                                                    |
| <span id="action-solofeature">soloFeature</span>                                   | `(featureId: string) => void`                                                                                                                   |
| <span id="action-clearallfeaturefilters">clearAllFeatureFilters</span>             | `() => void`                                                                                                                                    |
| <span id="action-clearselection">clearSelection</span>                             | `() => void`                                                                                                                                    |
| <span id="action-setshowlabels">setShowLabels</span>                               | `(value: "auto" \| "off" \| "on") => void`                                                                                                      |
| <span id="action-setshowdescriptions">setShowDescriptions</span>                   | `(value: boolean) => void`                                                                                                                      |
| <span id="action-setshowoutline">setShowOutline</span>                             | `(value: boolean) => void`                                                                                                                      |
| <span id="action-setfeaturecolor">setFeatureColor</span>                           | `(color?: string \| undefined) => void`                                                                                                         |
| <span id="action-setutrcolor">setUtrColor</span>                                   | `(color?: string \| undefined) => void`                                                                                                         |
| <span id="action-setsequencehoverposition">setSequenceHoverPosition</span>         | `(pos: SequenceHoverPosition \| undefined) => void`                                                                                             |
| <span id="action-opencontextmenu">openContextMenu</span>                           | `(featureInfo: FlatbushItem, displayedRegionIndex: number, clientX: number, clientY: number, subfeature?: SubfeatureInfo \| undefined) => void` |
| <span id="action-setdisplaymode">setDisplayMode</span>                             | `(value: DisplayMode) => void`                                                                                                                  |
| <span id="action-setheightmode">setHeightMode</span>                               | `(mode: HeightMode) => void`                                                                                                                    |
| <span id="action-opensetcolordialog">openSetColorDialog</span>                     | `(showUtrColor?: any) => void`                                                                                                                  |
| <span id="action-opencolorbyattributedialog">openColorByAttributeDialog</span>     | `() => void`                                                                                                                                    |
| <span id="action-openfilterdialog">openFilterDialog</span>                         | `() => void`                                                                                                                                    |
| <span id="action-fetchfullfeature">fetchFullFeature</span>                         | `(featureId: string, displayedRegionIndex: number) => Promise<SimpleFeature \| undefined>`                                                      |
| <span id="action-iscachevalid">isCacheValid</span>                                 | `(displayedRegionIndex: number) => boolean`                                                                                                     |
| <span id="action-selectfeaturebyid">selectFeatureById</span>                       | `(featureId: string, subfeatureInfo: SubfeatureInfo \| undefined, displayedRegionIndex: number) => void`                                        |
| <span id="action-reload">reload</span>                                             | `() => Promise<void>`                                                                                                                           |
| <span id="action-fetchneeded">fetchNeeded</span>                                   | `(needed: { region: Region; displayedRegionIndex: number; }[]) => void`                                                                         |
| <span id="action-afterattach">afterAttach</span>                                   | `() => void`                                                                                                                                    |

</details>

<details>
<summary>Derived from BaseDisplay</summary>

[BaseDisplay →](../basedisplay)

**Properties**

#### property: ignorePromotedDefaults

true for a display that arrived inside a session received from someone else (a
share link, an encoded/json session, a `spec-` URL). Such a display resolves its
`promotable` config slots from its own config only, never from this browser's
promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the
received session is a record of what the sender saw, and a local preference
silently repainting it would make it a lie. A track opened _afterwards_ in that
same session is a fresh track of this user's, so it never gets the flag and
picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user
deliberately makes the display follow a default.

```ts
// type signature
type ignorePromotedDefaults = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
ignorePromotedDefaults: types.stripDefault(types.boolean, false)
```

| Member                                                 | Type                                               |
| ------------------------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>                       | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-type">type</span>                   | `ISimpleType<string>`                              |
| <span id="property-rpcdrivername">rpcDriverName</span> | `IMaybe<ISimpleType<string>>`                      |

**Volatiles**

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate. Set alongside `statusMessage` by
`setStatusMessage`; a display that never shows a bar simply leaves it undefined.

```ts
// type signature
type statusProgress = number | undefined
// code
statusProgress: undefined as number | undefined
```

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-error">error</span>                 | `unknown`             |
| <span id="volatile-statusmessage">statusMessage</span> | `string \| undefined` |

**Getters**

#### getter: parentDisplay

Returns the parent display if this display is nested within another display
(e.g., PileupDisplay inside LinearAlignmentsDisplay)

```ts
type parentDisplay =
  | { type?: string | undefined; effectiveRpcDriverName?: string | undefined }
  | undefined
```

#### getter: isMinimized

Returns true if the parent track is minimized. Used to skip expensive operations
like autoruns when track is not visible.

```ts
type isMinimized = boolean
```

#### getter: effectiveRpcDriverName

Returns the effective RPC driver name with hierarchical fallback:

1. This display's explicit rpcDriverName
2. Parent display's effectiveRpcDriverName (for nested displays)
3. Track config's rpcDriverName

```ts
type effectiveRpcDriverName = any
```

| Member                                                         | Type                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| <span id="getter-parenttrack">parentTrack</span>               | `AbstractTrackModel`                                                                            |
| <span id="getter-renderingcomponent">RenderingComponent</span> | `FC<…>`                                                                                         |
| <span id="getter-displayblurb">DisplayBlurb</span>             | `FC<{ model: ModelInstanceTypeProps<…> & { ...; } & { ...; } & IStateTreeNode<...>; }> \| null` |
| <span id="getter-adapterconfig">adapterConfig</span>           | `any`                                                                                           |

**Methods**

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<…> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

| Member                                                                 | Type         |
| ---------------------------------------------------------------------- | ------------ |
| <span id="method-regioncannotberendered">regionCannotBeRendered</span> | `() => null` |

**Actions**

#### action: setIgnorePromotedDefaults

see the `ignorePromotedDefaults` property

```ts
type setIgnorePromotedDefaults = (flag: boolean) => void
```

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="action-setstatusmessage">setStatusMessage</span> | `(status?: RpcStatus \| undefined) => void` |
| <span id="action-seterror">setError</span>                 | `(error?: unknown) => void`                 |
| <span id="action-setrpcdrivername">setRpcDriverName</span> | `(rpcDriverName: string) => void`           |

</details>

<details>
<summary>Derived from TrackHeightMixin</summary>

[TrackHeightMixin →](../trackheightmixin)

**Volatiles**

| Member                                         | Type     |
| ---------------------------------------------- | -------- |
| <span id="volatile-scrolltop">scrollTop</span> | `number` |

**Actions**

| Member                                             | Type                                |
| -------------------------------------------------- | ----------------------------------- |
| <span id="action-setscrolltop">setScrollTop</span> | `(scrollTop: number) => void`       |
| <span id="action-setheight">setHeight</span>       | `(displayHeight: number) => number` |

</details>

<details>
<summary>Derived from HeightModeMixin</summary>

[HeightModeMixin →](../heightmodemixin)

**Getters**

#### getter: heightMode

The resolved track-height strategy (`fixed`/`grow`/`fit`). Promotable sentinel
slot: getConf walks the customized-track -> session-default -> `fixed` cascade
and never returns the `inherit` sentinel.

```ts
type heightMode = HeightMode
```

#### getter: fitTargetHeight

The drag-resizable track height as stored in the config slot — the fit target
the fit/grow layout scales or packs content into. Read there instead of the
reactive `height` getter to break the grow-mode cycle
(`height`->grownHeight->layout->height). Equals `height` in fixed/fit.

```ts
type fitTargetHeight = number
```

#### getter: autoHeight

`grow` mode as a boolean, derived from the unified `heightMode` slot.

```ts
type autoHeight = boolean
```

#### getter: fitHeightToDisplay

`fit` mode as a boolean, derived from the unified `heightMode` slot.

```ts
type fitHeightToDisplay = boolean
```

</details>

<details>
<summary>Derived from MultiRegionDisplayMixin</summary>

[MultiRegionDisplayMixin →](../multiregiondisplaymixin)

**Volatiles**

#### volatile: loadedRegions

regions whose data has been fetched and committed, keyed by
displayedRegionIndex; populated only after the fetch work callback returns

```ts
// type signature
type loadedRegions = ObservableMap<number, Region>
// code
loadedRegions: observable.map<number, Region>()
```

**Getters**

#### getter: isReady

true once the canvas has painted and no fetch is in flight

```ts
type isReady = boolean
```

#### getter: viewportWithinLoadedData

true when every visible block lies within an already-fetched region — i.e. the
viewport shows data we actually loaded, not the stale fringe left after a
zoom-out/pan. Drives the loading overlay through the pre-refetch debounce.
Spatial only; see CLAUDE.md for why this is exact and for the
resolution-staleness gap.

```ts
type viewportWithinLoadedData = boolean
```

#### getter: svgReady

true once an off-screen (SVG) export can safely read this display's data: every
visible region has loaded, or the fetch reached a terminal error / too-large
state. Off-screen renderers gate on it via `awaitSvgReady(model)` instead of
inlining the condition. Regions stream in one at a time, so gating on
`viewportWithinLoadedData` (not the first datum) is what keeps
multi-region/whole-genome exports complete; `loadedRegions.size` guards the
vacuously-true empty-viewport case.

```ts
type svgReady = boolean
```

#### getter: svgReadyExtraTerminal

Overridable hook (default false): a subclass returns true to mark an extra
terminal state where off-screen export can proceed with no loaded data. Sequence
sets it when zoomed past base resolution — it renders a static "zoom in" message
and fetches nothing, so `svgReady` would otherwise never resolve.

```ts
type svgReadyExtraTerminal = boolean
```

#### getter: renderBlocks

Shared cached view for every LGV-based GPU display. A single displayedRegion may
produce multiple render blocks (shared GPU buffer, different scissor clips on
screen). Plugins that want to suppress rendering in certain states (e.g. no
domain yet) can override this getter to return [] — the autorun lifecycle will
then issue an empty-blocks render that clears the canvas.

```ts
type renderBlocks = RenderBlock[]
```

#### getter: displayPhase

The display's mutually-exclusive visual state, precedence single-sourced in
`computeDisplayPhase`. Here `loading` means data isn't ready yet, or stale data
(viewport past loaded) is still on screen through the pre-refetch debounce.

```ts
type displayPhase = DisplayPhase
```

#### getter: rpcPropsCacheKey

The RPC cache key: the subclass's `rpcProps()` payload serialized to a string,
so this getter's value is a primitive and MobX invalidates its observers only
when the payload actually changed. Building the payload touches far more
observables than it returns — canvas builds it from a whole config snapshot
(`resolvePromotableConfigSnapshot`), which reads every slot on the display
config — so an observer of the raw call would refetch on purely main-thread
settings (showLabels, heightMode, a compact/normal displayMode flip) that the
payload deliberately excludes. A fresh object would also never compare equal.
`''` for a display with no `rpcProps` (the SettingsInvalidate autorun isn't
installed there).

```ts
type rpcPropsCacheKey = string
```

#### getter: derivedRegionTooLargeEnabled

Derived opt-in for the region-too-large gate: a display that declares a
pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one
decision, so they can't desync (this replaces the old dev-time "config set but
gate off" console.error). Displays that capture the estimate through a custom
fetch (LD, arc) or fold the byte check into their feature RPC (canvas) leave
`getByteEstimateConfig` null and flip this true themselves.

Guarded on `view.initialized`: `getByteEstimateConfig` reads `visibleBp` (which
throws pre-init), and this getter is read from menu code before first paint.
Pre-init the banner never shows anyway, so `false` is right.

```ts
type derivedRegionTooLargeEnabled = boolean
```

**Actions**

#### action: setLoadedRegion

Action wrapper so callers after async boundaries stay in MST strict mode.

```ts
type setLoadedRegion = (displayedRegionIndex: number, region: Region) => void
```

#### action: clearAllRpcData

full reset: cancels fetch, clears error, loadedRegions, display-specific data,
and the canvas-drawn flag. The too-large gate is derived (a pure function of the
cached estimate × viewport), so it needs no explicit clear here — it
self-releases when the viewport changes.

```ts
type clearAllRpcData = () => void
```

#### action: invalidateLoadedRegions

lighter reset: cancels fetch and clears loadedRegions, leaving error and
regionTooLarge intact

```ts
type invalidateLoadedRegions = () => void
```

#### action: getByteEstimateConfig

Overridable hook: return config to enable byte-estimate gating before fetch.

```ts
type getByteEstimateConfig = () => ByteEstimateConfig | null
```

#### action: onRegionTooLarge

Overridable hook (no-op base): called when `regionTooLarge` transitions to true.
Displays with transient hover/tooltip state override it to clear that state —
the too-large banner replaces the rendered content, so a lingering hover would
otherwise pin to a now-hidden feature. Wired to the `ClearHoverOnRegionTooLarge`
autorun, fired by the derived too-large gate.

```ts
type onRegionTooLarge = () => void
```

#### action: fetchRegions

Run a per-region fetch with byte-estimate gating. Marks regions as loaded only
AFTER the work callback has populated display-specific data (rpcDataMap,
cellData, etc) so the GPU upload autorun sees committed data when it observes
loadedRegions.

```ts
type fetchRegions = (
  needed: { region: Region; displayedRegionIndex: number }[],
  work: (ctx: FetchContext) => Promise<void>,
) => Promise<void>
```

</details>

<details>
<summary>Derived from RegionTooLargeMixin</summary>

[RegionTooLargeMixin →](../regiontoolargemixin)

**Volatiles**

#### volatile: userByteLimit

user-confirmed byte limit after a force-load, disabling the gate. Volatile, not
persisted: the interactive force-load button is a transient "show me this now"
action and must not leak a raised gate into a saved or shared session. The
declarative, session-scoped escape hatch is instead the `forceLoad` config slot
(set per-session via a session spec, or baked into a track config for
embedded/notebook views).

```ts
// type signature
type userByteLimit = number | undefined
// code
userByteLimit: undefined as number | undefined
```

#### volatile: byteEstimate

Last byte estimate reported for this display, with the adapter's own
`fetchSizeLimit` and `alwaysRender` flag. Its `bytes` covers `measuredSpanBp`,
not the span on screen now. Survives `clearAllRpcData` so an ordinary viewport
change doesn't flicker the banner; only chromosome navigation drops it.

```ts
// type signature
type byteEstimate = RegionByteEstimate | undefined
// code
byteEstimate: undefined as RegionByteEstimate | undefined
```

#### volatile: measuredSpanBp

The span the current `byteEstimate` was measured over, so the derived gate can
rescale it to the span on screen now. Written by `setByteEstimate`; ignored
unless `derivedRegionTooLargeEnabled`.

```ts
// type signature
type measuredSpanBp = number | undefined
// code
measuredSpanBp: undefined as number | undefined
```

**Getters**

#### getter: configuredFetchSizeLimit

The composing display's configured `fetchSizeLimit`, read straight from its
config. Only evaluated when the derived gate is enabled (guarded by
`derivedRegionTooLargeEnabled`), and every derived display extends
`baseLinearDisplayConfigSchema`, which owns the slot — so the read is always
valid where it fires. A display with a bespoke source can still override it.

```ts
type configuredFetchSizeLimit = number
```

#### getter: densityTooLargeForDerivedGate

Extra (non-byte) too-large axis folded into the derived verdict — canvas
overrides it with its feature-density gate. Byte-only derived displays leave it
false.

```ts
type densityTooLargeForDerivedGate = boolean
```

#### getter: configForceLoad

Declarative force-load: when true the display always renders regardless of
region size / feature density (the config-driven equivalent of the force-load
button). Read straight from the `forceLoad` config slot on
`baseLinearDisplayConfigSchema` (same guard/ownership as
`configuredFetchSizeLimit`), so every opt-in display honors it without
per-display wiring.

```ts
type configForceLoad = boolean
```

#### getter: estimatedBytesForVisibleSpan

How many bytes we estimate a fetch of the span on screen right now would pull,
obtained by rescaling the stored estimate from the span it was measured over
(`measuredSpanBp`). Rescaling is what makes the derived verdict a pure function
of the current view and lets it self-release on zoom-in — without it a large
zoomed-out estimate stays above the limit forever and gates refetch. Only
meaningful when `derivedRegionTooLargeEnabled`.

```ts
type estimatedBytesForVisibleSpan = number | undefined
```

#### getter: tooLargeStatus

Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then
bytes-over-limit, then the density axis), fed the scaled estimate so the byte
gate self-releases on zoom-in. Same helper as every other gating path so the
banner text can't drift.

```ts
type tooLargeStatus = RegionTooLargeStatus
```

#### getter: regionTooLarge

The verdict the whole mixin exists to produce: true when the estimated download
for the span on screen exceeds the resolved byte budget, or when the display's
own density axis trips. Derived, so it releases itself on zoom-in. Always false
for a display that hasn't opted in via `derivedRegionTooLargeEnabled`. The fetch
autoruns hold off while it is true, and `DisplayChrome` renders the banner from
it.

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

Which axis tripped, as banner text: the estimated download size, or "Too many
features". Empty string when the region isn't too large.

```ts
type regionTooLargeReason = string
```

**Methods**

#### method: regionCannotBeRenderedText

Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the
display chrome via `TooLargeMessage`, not the model.

```ts
type regionCannotBeRenderedText = () => '' | 'Force load to see features'
```

**Actions**

#### action: setByteEstimate

Commits the byte estimate and records the span it covers (`measuredSpanBp`) so
the derived gate can rescale it to the span on screen. Harmless for non-gated
displays (they ignore it).

```ts
type setByteEstimate = (estimate?: RegionByteEstimate | undefined) => void
```

#### action: raiseForceLoadLimits

force-load: raise the byte limit past the current request so the gate releases.
Prefers the estimate for the span on screen now, so it clears even if the view
zoomed out since the measurement; a display with the derived gate off has no
such estimate and falls back to the measured-span number. Canvas (which also has
a density force-load) overrides this entirely.

```ts
type raiseForceLoadLimits = (estimate?: RegionByteEstimate | undefined) => void
```

#### action: forceLoad

Raises the byte limit past the current estimate and triggers a reload. The
display chrome calls this via TooLargeMessage's force-load button; concrete
display models override reload() to do the actual refetch.

```ts
type forceLoad = () => void
```

</details>

<details>
<summary>Derived from RenderLifecycleMixin</summary>

[RenderLifecycleMixin →](../renderlifecyclemixin)

**Volatiles**

#### volatile: canvasDrawn

flips true on first paint; read by test selectors to detect render

```ts
// type signature
type canvasDrawn = false
// code
canvasDrawn: false
```

#### volatile: currentRenderingBackend

current backend reference, updated on context-loss recovery. Typed `unknown`
(not generic `B`) on purpose: this mixin is composed by every display via a
non-generic factory, so the per-display backend type `B` isn't known here — it's
supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the
autoruns. Don't "fix" the cast.

```ts
// type signature
type currentRenderingBackend = undefined
// code
currentRenderingBackend: undefined
```

#### volatile: renderTick

counter the render autorun observes; bumped to force a re-render

```ts
// type signature
type renderTick = number
// code
renderTick: 0
```

#### volatile: autorunsInstalled

guards attachRenderingBackend so the autorun pair spawns once per instance

```ts
// type signature
type autorunsInstalled = false
// code
autorunsInstalled: false
```

#### volatile: renderError

the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.
Single source of truth for the render-error terminal state:
`useRenderingBackend` writes it from the canvas-init mechanism so the model —
not React-local hook state — owns every terminal state. Read by `displayPhase`
(whose `renderError` term outranks `loading`, suppressing the scrim) and by
`DisplayChrome` (shows the retry overlay).

```ts
// type signature
type renderError = undefined
// code
renderError: undefined
```

**Actions**

#### action: setRenderError

set/clear the render-backend error. Called by `useRenderingBackend`: with the
error when the canvas factory rejects (or context-loss re-init fails), and with
`undefined` on successful (re)init and on retry.

```ts
type setRenderError = (error: unknown) => void
```

#### action: attachRenderingBackend

attach a GPU/Canvas2D backend and install the upload + render autorun pair
(idempotent — re-calling only swaps the backend)

```ts
type attachRenderingBackend = <B>(
  backend: B,
  cbs: RenderingBackendCallbacks<B>,
) => void
```

| Member                                                             | Type         |
| ------------------------------------------------------------------ | ------------ |
| <span id="action-markcanvasdrawn">markCanvasDrawn</span>           | `() => void` |
| <span id="action-resetcanvasdrawn">resetCanvasDrawn</span>         | `() => void` |
| <span id="action-stoprenderingbackend">stopRenderingBackend</span> | `() => void` |
| <span id="action-rendernow">renderNow</span>                       | `() => void` |

</details>

<details>
<summary>Derived from FetchMixin</summary>

[FetchMixin →](../fetchmixin)

**Volatiles**

#### volatile: activeStopToken

stop token of the in-flight fetch, or undefined when idle

```ts
// type signature
type activeStopToken = StopToken | undefined
// code
activeStopToken: undefined as StopToken | undefined
```

#### volatile: fetchGeneration

bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the
staleness epoch inside runFetch

```ts
// type signature
type fetchGeneration = number
// code
fetchGeneration: 0
```

#### volatile: fetchCanceled

true after the user explicitly cancels a load (the loading overlay's cancel
button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`,
it does not retrigger the fetch autoruns — so the load stays stopped until the
user retries (`reload`) or the viewport changes. Any new fetch clears it
(`runFetch` resets it at the start).

```ts
// type signature
type fetchCanceled = false
// code
fetchCanceled: false
```

#### volatile: regionStatuses

latest status of each concurrent in-flight operation, keyed by an arbitrary id
(the canvas display uses displayedRegionIndex). Plain bookkeeping — not read
reactively; setRegionStatus derives the observable statusMessage/statusProgress
from it on every update so N parallel region fetches aggregate into one bar
instead of clobbering.

```ts
// type signature
type regionStatuses = Map<number, RpcStatus>
// code
regionStatuses: new Map<number, RpcStatus>()
```

#### volatile: lastStatusMs

Date.now() of the last applied status write; the status callbacks gate on it to
throttle a high-frequency progress stream.

```ts
// type signature
type lastStatusMs = number
// code
lastStatusMs: 0
```

**Getters**

#### getter: isLoading

true while a fetch is active

```ts
type isLoading = boolean
```

**Methods**

#### method: makeStatusCallback

An RPC `statusCallback` bound to this display: forwards progress to the shared
`statusMessage`, guarded by `isAlive` so a callback that fires after the node is
torn down (RPCs resolve their status stream asynchronously) is a safe no-op.
Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard
at every call site.

```ts
type makeStatusCallback = () => (status: RpcStatus) => void
```

#### method: makeRegionStatusCallback

Per-region variant of `makeStatusCallback`: routes progress through
`setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one
status bar instead of clobbering each other. Same `isAlive` guard.

```ts
type makeRegionStatusCallback = (key: number) => (status: RpcStatus) => void
```

**Actions**

#### action: throttleStatus

Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last
status write. A leading-edge throttle: sparse updates pass straight through,
dense progress bursts are thinned so the loading overlay stops re-rendering
faster than the view animates. The final status doesn't need a trailing flush —
fetch completion clears it via `resetStatus`.

```ts
type throttleStatus = (apply: () => void) => void
```

#### action: resetStatus

Drop the active stop token and clear all status bookkeeping. Shared by both
cancel paths and runFetch's cleanup.

```ts
type resetStatus = () => void
```

#### action: stopActiveFetch

Abort the in-flight fetch (if any) and clear its status. The shared preamble of
both cancel paths; the difference between them is only what they do to
`fetchCanceled` / `fetchGeneration` afterward.

```ts
type stopActiveFetch = () => void
```

#### action: setRegionStatus

Record one concurrent operation's latest status (keyed) and recompute the shared
statusMessage/statusProgress as the aggregate across all in-flight keys. Pass
undefined to drop a key. Used by displays that fan a single fetch out into
parallel per-region RPCs.

```ts
type setRegionStatus = (key: number, status?: RpcStatus | undefined) => void
```

#### action: cancelFetch

cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers
can retrigger fetch autoruns even when nothing was in flight). This is the
_internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any
user-cancel flag so the retrigger actually re-fetches.

```ts
type cancelFetch = () => void
```

#### action: cancelFetchByUser

User-initiated cancel from the loading overlay. Stops the in-flight fetch and
lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump
fetchGeneration — so the fetch autoruns don't immediately restart the load. The
user retries via `reload` (the overlay's retry button), or it clears on the next
viewport change.

```ts
type cancelFetchByUser = () => void
```

#### action: beforeDestroy

Release an in-flight fetch's stop token on teardown. Without this, a display
destroyed mid-fetch (track/view closed while loading) never revokes its token —
a blob-URL leak on the non-SAB fallback path — and never signals the worker to
abort the now-useless work. MST auto-chains lifecycle hooks, so a composing
display can still define its own beforeDestroy.

```ts
type beforeDestroy = () => void
```

#### action: runFetch

Run a cancel-safe fetch (cancels any prior). The work callback gets a
FetchContext with a stopToken to forward to the RPC and an isStale() check to
short-circuit commits once the user has moved on. Abort errors are swallowed;
others are stored in `error` if not stale.

```ts
type runFetch = (work: (ctx: FetchContext) => Promise<void>) => Promise<void>
```

</details>

<details>
<summary>Derived from CanvasFeatureGateMixin</summary>

[CanvasFeatureGateMixin →](../canvasfeaturegatemixin)

**Volatiles**

#### volatile: densityStatsPerRegion

per-region feature counts (keyed by displayedRegionIndex), so the density
verdict is a live max over the visible regions at the current bpPerPx — never a
stale fetch-time snapshot. Survives viewport-change clears; dropped on
chromosome nav by `clearGateMeasurements`.

```ts
// type signature
type densityStatsPerRegion = ObservableMap<number, RegionDensityStats>
// code
densityStatsPerRegion: observable.map<number, RegionDensityStats>()
```

#### volatile: userFeatureDensityLimit

density force-load ceiling; the density-axis counterpart to
`RegionTooLargeMixin.userByteLimit`, volatile for the same reason (a force-load
must not leak into a saved session).

```ts
// type signature
type userFeatureDensityLimit = number | undefined
// code
userFeatureDensityLimit: undefined as number | undefined
```

**Getters**

#### getter: densityGateEnabled

Whether the density (features-per-pixel) axis applies. Byte-only displays
override this to `false`: e.g. `LinearMultiRowFeatureDisplay` paints features
into fixed lanes, so a high total feature count is not a per-glyph render cost —
only the download (byte) budget should gate it.

```ts
type densityGateEnabled = boolean
```

#### getter: adapterFetchSizeLimit

The adapter's own `fetchSizeLimit` slot (undefined when the adapter type has
none); `resolveByteLimit` prefers it over the display config.

```ts
type adapterFetchSizeLimit = number | undefined
```

#### getter: visibleFeatureDensityPerPx

Current density across the visible regions at the debounced coarseBpPerPx, so
the verdict shares the layout cadence and doesn't flicker mid-zoom.

```ts
type visibleFeatureDensityPerPx = number
```

#### getter: maxFeatureDensity

The density budget passed to the worker and used by the derived verdict:
undefined (gate off) under a declarative/byte force-load or below
AUTO_FORCE_LOAD_BP; otherwise the density force-load ceiling or the config.

```ts
type maxFeatureDensity = number | undefined
```

| Member                                                   | Type      |
| -------------------------------------------------------- | --------- |
| <span id="getter-densitytoolarge">densityTooLarge</span> | `boolean` |

**Methods**

#### method: observedMaxDensity

Highest features-per-pixel across the visible regions at `bpPerPx`, from the
cached per-region counts.

```ts
type observedMaxDensity = (bpPerPx: number) => number
```

#### method: resolvedByteLimit

The byte budget the fetch RPC enforces, short-circuiting an over-budget region
before downloading features. Undefined (unlimited) under force-load or below the
gate floor; otherwise whatever `resolveByteLimit` picks from the three tiers
(user force-load → adapter limit → display config).

```ts
type resolvedByteLimit = () => number | undefined
```

**Actions**

#### action: clearGateMeasurements

Drop the whole cached estimate on chromosome navigation (displayedRegion indices
get reused, so a stale entry would gate the new region against the wrong stats).
Driven by the mixin's own `afterAttach` below — no composing display has to wire
it up.

```ts
type clearGateMeasurements = () => void
```

#### action: commitGateMeasurements

Commit a batch of per-region fetch outcomes: record the per-region byte **max**
(not sum — each region is gated against the same per-region budget, so a
multi-region view where every region individually fits is never blanked by the
cross-region total) and the per-region density, then publish the byte estimate +
adapter limit to `RegionTooLargeMixin` so the banner's `resolveByteLimit` picks
the same budget the worker gated on.

```ts
type commitGateMeasurements = (measurements: RegionGateMeasurement[]) => void
```

| Member                                                   | Type                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| <span id="action-setdensitystats">setDensityStats</span> | `(displayedRegionIndex: number, stats: RegionDensityStats) => void` |

</details>

<details>
<summary>Derived from PromotableDefaultsMixin</summary>

[PromotableDefaultsMixin →](../promotabledefaultsmixin)

**Methods**

#### method: displayTypeDefaultChanges

Effective config differences a track following the default inherits from
session-wide defaults (distinct from per-track config edits /
trackConfigDeltas). Drives the "affected by a session default" badge.

```ts
type displayTypeDefaultChanges = () => TrackConfigChange[]
```

**Actions**

#### action: clearDisplayTypeDefaults

Clear the session-wide defaults reported by `displayTypeDefaultChanges` so this
display (and its siblings of the same type) revert to their config values. Backs
the "clear default" action on the selector badge.

```ts
type clearDisplayTypeDefaults = () => void
```

</details>
