---
id: syntenyviewmixin
title: SyntenyViewMixin
description: "What the linear synteny and dotplot views share beyond SyntenyColorsMixin: the level-of-detail tier every track draws at, and a color key the reader closes per mode."
sidebar_label: Mixin -> SyntenyViewMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyViewMixin.ts).

What the linear synteny and dotplot views share beyond `SyntenyColorsMixin`:
the level-of-detail tier every track draws at, and a color key the reader
closes per mode.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-data">**data**</span><br><code>data: types.stripDefault(syntenyDataConfigSchema, {})</code> | What the fetch reads, a [](/docs/config/syntenydata) object: `resolution` picks a tiered file's stored tier. One value for the view, so every track draws at the same tier. |
| <span id="property-legend">**legend**</span><br><code>legend: types.stripDefault(legendConfigSchema, {})</code> | Whether the view draws its color key, a [](/docs/config/legend) object. The key's close button hides it for the current mode only and is never saved. |

<details class="inherited-members" data-pagefind-ignore>
<summary>4 inherited properties from 3 models</summary>

From [TrackColorsMixin](../trackcolorsmixin): <span id="property-encoding">[`encoding`](../trackcolorsmixin#property-encoding)</span>, <span id="property-trackcolors">[`trackColors`](../trackcolorsmixin#property-trackcolors)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="property-parkedcolors">[`parkedColors`](../parkedcolormixin#property-parkedcolors)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="property-filter">[`filter`](../syntenyfiltermixin#property-filter)</span>

</details>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-colorlegenddismissedfor">**colorLegendDismissedFor**</span><br><code>string &#124; undefined</code> | The field whose legend the reader closed. The legend comes back with the next field that has one, so a dismissal is scoped to the field it was made in rather than being a setting to find again. |

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited volatile from one model</summary>

From [TrackColorsMixin](../trackcolorsmixin): <span id="volatile-seenattributeranges">[`seenAttributeRanges`](../trackcolorsmixin#volatile-seenattributeranges)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-haslodcapableadapter">**hasLodCapableAdapter**</span><br><code>boolean</code> | Whether any track's adapter has tiers to switch between, which gates the "Level of detail" setting. |
| <span id="getter-resolution">**resolution**</span><br><code>LodMode</code> | `data.resolution`: the stored tier every track fetches. |
| <span id="getter-showlegend">**showLegend**</span><br><code>boolean</code> | The legend-host half of `LegendMixin` a view needs: whether the key draws, which is `legend.show`, the mode having a key, and the reader not having closed it in this mode. `ChromeLegend` and `SvgLegend` read it. |
| <span id="getter-legendspec">**legendSpec**</span><br><code>LegendSpec</code> | The key `ChromeLegend` draws on screen and `SvgLegend` in the export. |

<details class="inherited-members" data-pagefind-ignore>
<summary>23 inherited getters from 4 models</summary>

From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="getter-defaultopacity">[`defaultOpacity`](../syntenycolorsmixin#getter-defaultopacity)</span>, <span id="getter-opacitysetting">[`opacitySetting`](../syntenycolorsmixin#getter-opacitysetting)</span>, <span id="getter-opacityfade">[`opacityFade`](../syntenycolorsmixin#getter-opacityfade)</span>, <span id="getter-opacitylevel">[`opacityLevel`](../syntenycolorsmixin#getter-opacitylevel)</span>, <span id="getter-opacityfield">[`opacityField`](../syntenycolorsmixin#getter-opacityfield)</span>

From [TrackColorsMixin](../trackcolorsmixin): <span id="getter-colorsetting">[`colorSetting`](../trackcolorsmixin#getter-colorsetting)</span>, <span id="getter-impliedcolorfield">[`impliedColorField`](../trackcolorsmixin#getter-impliedcolorfield)</span>, <span id="getter-colorpaint">[`colorPaint`](../trackcolorsmixin#getter-colorpaint)</span>, <span id="getter-colorvalue">[`colorValue`](../trackcolorsmixin#getter-colorvalue)</span>, <span id="getter-colordomain">[`colorDomain`](../trackcolorsmixin#getter-colordomain)</span>, <span id="getter-colorrange">[`colorRange`](../trackcolorsmixin#getter-colorrange)</span>, <span id="getter-colorableattributes">[`colorableAttributes`](../trackcolorsmixin#getter-colorableattributes)</span>, <span id="getter-attributeranges">[`attributeRanges`](../trackcolorsmixin#getter-attributeranges)</span>, <span id="getter-colorabletracks">[`colorableTracks`](../trackcolorsmixin#getter-colorabletracks)</span>, <span id="getter-trackcolorassignments">[`trackColorAssignments`](../trackcolorsmixin#getter-trackcolorassignments)</span>, <span id="getter-colorfield">[`colorField`](../trackcolorsmixin#getter-colorfield)</span>, <span id="getter-hideunlabelled">[`hideUnlabelled`](../trackcolorsmixin#getter-hideunlabelled)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../trackcolorsmixin#getter-haslegendkey)</span>, <span id="getter-colorlegendchips">[`colorLegendChips`](../trackcolorsmixin#getter-colorlegendchips)</span>, <span id="getter-colorscales">[`colorScales`](../trackcolorsmixin#getter-colorscales)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="getter-parkedcolor">[`parkedColor`](../parkedcolormixin#getter-parkedcolor)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="getter-predicates">[`predicates`](../syntenyfiltermixin#getter-predicates)</span>, <span id="getter-minlength">[`minLength`](../syntenyfiltermixin#getter-minlength)</span>

</details>

## Methods

<details class="inherited-members" data-pagefind-ignore>
<summary>12 inherited methods from 4 models</summary>

From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="method-syntenytracks">[`syntenyTracks`](../syntenycolorsmixin#method-syntenytracks)</span>, <span id="method-colorabletrackconfigs">[`colorableTrackConfigs`](../syntenycolorsmixin#method-colorabletrackconfigs)</span>, <span id="method-colorableattributenames">[`colorableAttributeNames`](../syntenycolorsmixin#method-colorableattributenames)</span>, <span id="method-legendalpha">[`legendAlpha`](../syntenycolorsmixin#method-legendalpha)</span>

From [TrackColorsMixin](../trackcolorsmixin): <span id="method-loadedattributeranges">[`loadedAttributeRanges`](../trackcolorsmixin#method-loadedattributeranges)</span>, <span id="method-legendcigarops">[`legendCigarOps`](../trackcolorsmixin#method-legendcigarops)</span>, <span id="method-colorsurface">[`colorSurface`](../trackcolorsmixin#method-colorsurface)</span>, <span id="method-offersreferencecolor">[`offersReferenceColor`](../trackcolorsmixin#method-offersreferencecolor)</span>, <span id="method-shapeshowsstrand">[`shapeShowsStrand`](../trackcolorsmixin#method-shapeshowsstrand)</span>, <span id="method-trackcolorfor">[`trackColorFor`](../trackcolorsmixin#method-trackcolorfor)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="method-parkedcolorof">[`parkedColorOf`](../parkedcolormixin#method-parkedcolorof)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="method-lowerbound">[`lowerBound`](../syntenyfiltermixin#method-lowerbound)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setresolution">**setResolution**</span><br><code>(resolution: LodMode) =&gt; void</code> |  |
| <span id="action-setshowlegend">**setShowLegend**</span><br><code>(show: boolean) =&gt; void</code> | The legend host's setter: closing the key hides it for this mode only, so picking another mode brings its key up. |
| <span id="action-setlegendshow">**setLegendShow**</span><br><code>(show: boolean) =&gt; void</code> | The "Show legend" checkbox: writes `legend.show`, and showing it brings back a key closed in this mode. |
| <span id="action-dismisslegendsection">**dismissLegendSection**</span><br><code>() =&gt; void</code> | One section is the whole key here. |

<details class="inherited-members" data-pagefind-ignore>
<summary>14 inherited actions from 4 models</summary>

From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="action-setopacity">[`setOpacity`](../syntenycolorsmixin#action-setopacity)</span>, <span id="action-setopacityfield">[`setOpacityField`](../syntenycolorsmixin#action-setopacityfield)</span>

From [TrackColorsMixin](../trackcolorsmixin): <span id="action-observeattributeranges">[`observeAttributeRanges`](../trackcolorsmixin#action-observeattributeranges)</span>, <span id="action-resetattributeranges">[`resetAttributeRanges`](../trackcolorsmixin#action-resetattributeranges)</span>, <span id="action-sethideunlabelled">[`setHideUnlabelled`](../trackcolorsmixin#action-sethideunlabelled)</span>, <span id="action-setcolorfield">[`setColorField`](../trackcolorsmixin#action-setcolorfield)</span>, <span id="action-setcolorvalue">[`setColorValue`](../trackcolorsmixin#action-setcolorvalue)</span>, <span id="action-opensolidcolordialog">[`openSolidColorDialog`](../trackcolorsmixin#action-opensolidcolordialog)</span>, <span id="action-setcolordomain">[`setColorDomain`](../trackcolorsmixin#action-setcolordomain)</span>, <span id="action-settrackcolor">[`setTrackColor`](../trackcolorsmixin#action-settrackcolor)</span>, <span id="action-cleartrackcolors">[`clearTrackColors`](../trackcolorsmixin#action-cleartrackcolors)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="action-parkcolor">[`parkColor`](../parkedcolormixin#action-parkcolor)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="action-setfilter">[`setFilter`](../syntenyfiltermixin#action-setfilter)</span>, <span id="action-setlowerbound">[`setLowerBound`](../syntenyfiltermixin#action-setlowerbound)</span>

</details>
