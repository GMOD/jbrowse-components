---
id: syntenyviewmixin
title: SyntenyViewMixin
description: "What the linear synteny and dotplot views share beyond SyntenyColorsMixin: the level-of-detail tier every track draws at, and a colour key the reader closes per mode."
sidebar_label: Mixin -> SyntenyViewMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyViewMixin.ts).

What the linear synteny and dotplot views share beyond `SyntenyColorsMixin`:
the level-of-detail tier every track draws at, and a colour key the reader
closes per mode.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-lodmode">**lodMode**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>lodMode: types.stripDefault( types.enumeration&lt;LodMode&gt;('LodMod…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>lodMode: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.enumeration&lt;LodMode&gt;('LodMode', ['auto', 'fine', 'coarse']),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'auto',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | Level-of-detail tier selection for PIF adapters. 'auto' uses the adapter's bpPerPx threshold; 'fine' forces the per-row CIGAR tier (t/q); 'coarse' forces the tier whose CIGAR is folded to its large indels (T/Q) when present. One value for the view, so every track draws at the same tier. |

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="property-opacity">[`opacity`](../syntenycolorsmixin#property-opacity)</span>, <span id="property-minalignmentlength">[`minAlignmentLength`](../syntenycolorsmixin#property-minalignmentlength)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="property-color">[`color`](../trackcolorsmixin#property-color)</span>, <span id="property-trackcolors">[`trackColors`](../trackcolorsmixin#property-trackcolors)</span>, <span id="property-hideunlabelled">[`hideUnlabelled`](../trackcolorsmixin#property-hideunlabelled)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-colorlegenddismissedfor">**colorLegendDismissedFor**</span><br><code>string &#124; undefined</code> | The field whose legend the reader closed. The legend comes back with the next field that has one, so a dismissal is scoped to the field it was made in rather than being a setting to find again. |

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="volatile-seenattributeranges">[`seenAttributeRanges`](../trackcolorsmixin#volatile-seenattributeranges)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-haslodcapableadapter">**hasLodCapableAdapter**</span><br><code>boolean</code> | Whether any track's adapter has tiers to switch between, which gates the "Level of detail" setting. |
| <span id="getter-showlegend">**showLegend**</span><br><code>boolean</code> | The legend-host half of `LegendMixin` a view needs: whether the key draws, which is the mode having one and the reader not having closed it in this mode. `ChromeLegend` and `SvgLegend` read it. |
| <span id="getter-legendspec">**legendSpec**</span><br><code>LegendSpec</code> | The key `ChromeLegend` draws on screen and `SvgLegend` in the export. |

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="getter-defaultopacity">[`defaultOpacity`](../syntenycolorsmixin#getter-defaultopacity)</span>, <span id="getter-opacitysetting">[`opacitySetting`](../syntenycolorsmixin#getter-opacitysetting)</span>, <span id="getter-opacityfade">[`opacityFade`](../syntenycolorsmixin#getter-opacityfade)</span>, <span id="getter-opacitylevel">[`opacityLevel`](../syntenycolorsmixin#getter-opacitylevel)</span>, <span id="getter-opacityfield">[`opacityField`](../syntenycolorsmixin#getter-opacityfield)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="getter-colorsetting">[`colorSetting`](../trackcolorsmixin#getter-colorsetting)</span>, <span id="getter-colorramp">[`colorRamp`](../trackcolorsmixin#getter-colorramp)</span>, <span id="getter-colorvalue">[`colorValue`](../trackcolorsmixin#getter-colorvalue)</span>, <span id="getter-colordomain">[`colorDomain`](../trackcolorsmixin#getter-colordomain)</span>, <span id="getter-colorrange">[`colorRange`](../trackcolorsmixin#getter-colorrange)</span>, <span id="getter-colorableattributes">[`colorableAttributes`](../trackcolorsmixin#getter-colorableattributes)</span>, <span id="getter-attributeranges">[`attributeRanges`](../trackcolorsmixin#getter-attributeranges)</span>, <span id="getter-colorabletracks">[`colorableTracks`](../trackcolorsmixin#getter-colorabletracks)</span>, <span id="getter-trackcolorassignments">[`trackColorAssignments`](../trackcolorsmixin#getter-trackcolorassignments)</span>, <span id="getter-colorfield">[`colorField`](../trackcolorsmixin#getter-colorfield)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../trackcolorsmixin#getter-haslegendkey)</span>, <span id="getter-colorlegendchips">[`colorLegendChips`](../trackcolorsmixin#getter-colorlegendchips)</span>, <span id="getter-colorscales">[`colorScales`](../trackcolorsmixin#getter-colorscales)</span></span>

## Methods

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="method-syntenytracks">[`syntenyTracks`](../syntenycolorsmixin#method-syntenytracks)</span>, <span id="method-colorabletrackconfigs">[`colorableTrackConfigs`](../syntenycolorsmixin#method-colorabletrackconfigs)</span>, <span id="method-colorableattributenames">[`colorableAttributeNames`](../syntenycolorsmixin#method-colorableattributenames)</span>, <span id="method-legendalpha">[`legendAlpha`](../syntenycolorsmixin#method-legendalpha)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="method-loadedattributeranges">[`loadedAttributeRanges`](../trackcolorsmixin#method-loadedattributeranges)</span>, <span id="method-legendcigarops">[`legendCigarOps`](../trackcolorsmixin#method-legendcigarops)</span>, <span id="method-colorsurface">[`colorSurface`](../trackcolorsmixin#method-colorsurface)</span>, <span id="method-offersreferencecolor">[`offersReferenceColor`](../trackcolorsmixin#method-offersreferencecolor)</span>, <span id="method-shapeshowsstrand">[`shapeShowsStrand`](../trackcolorsmixin#method-shapeshowsstrand)</span>, <span id="method-trackcolorfor">[`trackColorFor`](../trackcolorsmixin#method-trackcolorfor)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setlodmode">**setLodMode**</span><br><code>(value: LodMode) =&gt; void</code> |  |
| <span id="action-setshowlegend">**setShowLegend**</span><br><code>(show: boolean) =&gt; void</code> | The legend host's setter: closing the key hides it for this mode only, so picking another mode brings its key up. |
| <span id="action-dismisslegendsection">**dismissLegendSection**</span><br><code>() =&gt; void</code> | One section is the whole key here. |

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="action-setopacity">[`setOpacity`](../syntenycolorsmixin#action-setopacity)</span>, <span id="action-setopacityfield">[`setOpacityField`](../syntenycolorsmixin#action-setopacityfield)</span>, <span id="action-setminalignmentlength">[`setMinAlignmentLength`](../syntenycolorsmixin#action-setminalignmentlength)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="action-observeattributeranges">[`observeAttributeRanges`](../trackcolorsmixin#action-observeattributeranges)</span>, <span id="action-resetattributeranges">[`resetAttributeRanges`](../trackcolorsmixin#action-resetattributeranges)</span>, <span id="action-sethideunlabelled">[`setHideUnlabelled`](../trackcolorsmixin#action-sethideunlabelled)</span>, <span id="action-setcolorfield">[`setColorField`](../trackcolorsmixin#action-setcolorfield)</span>, <span id="action-setcolordomain">[`setColorDomain`](../trackcolorsmixin#action-setcolordomain)</span>, <span id="action-settrackcolor">[`setTrackColor`](../trackcolorsmixin#action-settrackcolor)</span>, <span id="action-cleartrackcolors">[`clearTrackColors`](../trackcolorsmixin#action-cleartrackcolors)</span></span>
