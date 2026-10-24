---
id: syntenycolorsmixin
title: SyntenyColorsMixin
description: "The color settings every view drawing synteny tracks shares — the linear synteny view, the dotplot and the circular view: TrackColorsMixin's encoding and palette, the encoding.opacity it fades by and…"
sidebar_label: Mixin -> SyntenyColorsMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyColorsMixin.ts).

The color settings every view drawing synteny tracks shares — the linear
synteny view, the dotplot and the circular view: `TrackColorsMixin`'s
`encoding` and palette, the `encoding.opacity` it fades by and the
`filter`, over the tracks
the view draws. A view supplies `syntenyTracks()`,
its opacity default and, optionally, the field it paints by until told
otherwise.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<details class="inherited-members" data-pagefind-ignore>
<summary>4 inherited properties from 3 models</summary>

From [TrackColorsMixin](../trackcolorsmixin): <span id="property-encoding">[`encoding`](../trackcolorsmixin#property-encoding)</span>, <span id="property-trackcolors">[`trackColors`](../trackcolorsmixin#property-trackcolors)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="property-parkedcolors">[`parkedColors`](../parkedcolormixin#property-parkedcolors)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="property-filter">[`filter`](../syntenyfiltermixin#property-filter)</span>

</details>

## Volatiles

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited volatile from one model</summary>

From [TrackColorsMixin](../trackcolorsmixin): <span id="volatile-seenattributeranges">[`seenAttributeRanges`](../trackcolorsmixin#volatile-seenattributeranges)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-defaultopacity">**defaultOpacity**</span><br><code>number</code> | The constant opacity a reset returns to: low on the synteny view for dense whole-genome hairballs, opaque on the dotplot. |
| <span id="getter-opacitysetting">**opacitySetting**</span><br><code>SyntenyOpacitySnapshot</code> | `encoding.opacity` as its snapshot holds it. |
| <span id="getter-opacityfade">**opacityFade**</span><br><code>SyntenyOpacitySnapshot &#124; undefined</code> | What the color pass fades each alignment by: the field's mapping with its range as shares of `opacityLevel`, or undefined while `encoding.opacity` draws its constant, so the slider recolors nothing either way. |
| <span id="getter-opacitylevel">**opacityLevel**</span><br><code>number</code> | The opacity every alignment draws at before a field's fade: the shader's uniform (`opacityLevel`). |
| <span id="getter-opacityfield">**opacityField**</span><br><code>string &#124; undefined</code> | The field `encoding.opacity` fades by, undefined while it draws its constant. |

<details class="inherited-members" data-pagefind-ignore>
<summary>18 inherited getters from 3 models</summary>

From [TrackColorsMixin](../trackcolorsmixin): <span id="getter-colorsetting">[`colorSetting`](../trackcolorsmixin#getter-colorsetting)</span>, <span id="getter-impliedcolorfield">[`impliedColorField`](../trackcolorsmixin#getter-impliedcolorfield)</span>, <span id="getter-colorpaint">[`colorPaint`](../trackcolorsmixin#getter-colorpaint)</span>, <span id="getter-colorvalue">[`colorValue`](../trackcolorsmixin#getter-colorvalue)</span>, <span id="getter-colordomain">[`colorDomain`](../trackcolorsmixin#getter-colordomain)</span>, <span id="getter-colorrange">[`colorRange`](../trackcolorsmixin#getter-colorrange)</span>, <span id="getter-colorableattributes">[`colorableAttributes`](../trackcolorsmixin#getter-colorableattributes)</span>, <span id="getter-attributeranges">[`attributeRanges`](../trackcolorsmixin#getter-attributeranges)</span>, <span id="getter-colorabletracks">[`colorableTracks`](../trackcolorsmixin#getter-colorabletracks)</span>, <span id="getter-trackcolorassignments">[`trackColorAssignments`](../trackcolorsmixin#getter-trackcolorassignments)</span>, <span id="getter-colorfield">[`colorField`](../trackcolorsmixin#getter-colorfield)</span>, <span id="getter-hideunlabelled">[`hideUnlabelled`](../trackcolorsmixin#getter-hideunlabelled)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../trackcolorsmixin#getter-haslegendkey)</span>, <span id="getter-colorlegendchips">[`colorLegendChips`](../trackcolorsmixin#getter-colorlegendchips)</span>, <span id="getter-colorscales">[`colorScales`](../trackcolorsmixin#getter-colorscales)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="getter-parkedcolor">[`parkedColor`](../parkedcolormixin#getter-parkedcolor)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="getter-predicates">[`predicates`](../syntenyfiltermixin#getter-predicates)</span>, <span id="getter-minlength">[`minLength`](../syntenyfiltermixin#getter-minlength)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-syntenytracks">**syntenyTracks**</span><br><code>() =&gt; ComparativeTrackModel[]</code> | Overridable hook: every synteny track in the view, in paint order. |
| <span id="method-colorabletrackconfigs">**colorableTrackConfigs**</span><br><code>() =&gt; { trackId: string; name: string; }[]</code> |  |
| <span id="method-colorableattributenames">**colorableAttributeNames**</span><br><code>() =&gt; string[]</code> | The columns the tracks declare in their adapter's `attributeColumns` (the ortholog-table adapter's slot), one color mode each. |
| <span id="method-legendalpha">**legendAlpha**</span><br><code>() =&gt; number</code> | The plot's opacity composites the key's chips, as it does the alignments. |

<details class="inherited-members" data-pagefind-ignore>
<summary>8 inherited methods from 3 models</summary>

From [TrackColorsMixin](../trackcolorsmixin): <span id="method-loadedattributeranges">[`loadedAttributeRanges`](../trackcolorsmixin#method-loadedattributeranges)</span>, <span id="method-legendcigarops">[`legendCigarOps`](../trackcolorsmixin#method-legendcigarops)</span>, <span id="method-colorsurface">[`colorSurface`](../trackcolorsmixin#method-colorsurface)</span>, <span id="method-offersreferencecolor">[`offersReferenceColor`](../trackcolorsmixin#method-offersreferencecolor)</span>, <span id="method-shapeshowsstrand">[`shapeShowsStrand`](../trackcolorsmixin#method-shapeshowsstrand)</span>, <span id="method-trackcolorfor">[`trackColorFor`](../trackcolorsmixin#method-trackcolorfor)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="method-parkedcolorof">[`parkedColorOf`](../parkedcolormixin#method-parkedcolorof)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="method-lowerbound">[`lowerBound`](../syntenyfiltermixin#method-lowerbound)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setopacity">**setOpacity**</span><br><code>(value: number) =&gt; void</code> | The opacity slider: the constant, or under a field its range scaled so its most opaque end equals `value`. |
| <span id="action-setopacityfield">**setOpacityField**</span><br><code>(field: string &#124; undefined) =&gt; void</code> | Fade by `field` from the current opacity down to 0.3 of it, or with undefined draw every alignment at the opacity the fade reached. |

<details class="inherited-members" data-pagefind-ignore>
<summary>12 inherited actions from 3 models</summary>

From [TrackColorsMixin](../trackcolorsmixin): <span id="action-observeattributeranges">[`observeAttributeRanges`](../trackcolorsmixin#action-observeattributeranges)</span>, <span id="action-resetattributeranges">[`resetAttributeRanges`](../trackcolorsmixin#action-resetattributeranges)</span>, <span id="action-sethideunlabelled">[`setHideUnlabelled`](../trackcolorsmixin#action-sethideunlabelled)</span>, <span id="action-setcolorfield">[`setColorField`](../trackcolorsmixin#action-setcolorfield)</span>, <span id="action-setcolorvalue">[`setColorValue`](../trackcolorsmixin#action-setcolorvalue)</span>, <span id="action-opensolidcolordialog">[`openSolidColorDialog`](../trackcolorsmixin#action-opensolidcolordialog)</span>, <span id="action-setcolordomain">[`setColorDomain`](../trackcolorsmixin#action-setcolordomain)</span>, <span id="action-settrackcolor">[`setTrackColor`](../trackcolorsmixin#action-settrackcolor)</span>, <span id="action-cleartrackcolors">[`clearTrackColors`](../trackcolorsmixin#action-cleartrackcolors)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="action-parkcolor">[`parkColor`](../parkedcolormixin#action-parkcolor)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="action-setfilter">[`setFilter`](../syntenyfiltermixin#action-setfilter)</span>, <span id="action-setlowerbound">[`setLowerBound`](../syntenyfiltermixin#action-setlowerbound)</span>

</details>
