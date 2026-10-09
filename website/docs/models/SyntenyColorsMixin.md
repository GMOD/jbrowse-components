---
id: syntenycolorsmixin
title: SyntenyColorsMixin
description: "The color settings every view drawing synteny tracks shares — the linear synteny view, the dotplot and the circular view: TrackColorsMixin's color object and palette, the opacity object and the…"
sidebar_label: Mixin -> SyntenyColorsMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyColorsMixin.ts).

The color settings every view drawing synteny tracks shares — the linear
synteny view, the dotplot and the circular view: `TrackColorsMixin`'s color
object and palette, the `opacity` object and the shortest alignment drawn,
over the tracks the view says it draws. A view supplies `syntenyTracks()`,
its opacity default and, optionally, the field it paints by until told
otherwise.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-opacity">**opacity**</span><br><code>opacity: types.stripDefault(syntenyOpacityConfigSchema, {})</code> | The opacity every alignment draws at, a [](/docs/config/syntenyopacity) object: a number for all of them, or a field each carries read into opacities, `{ field: "identity" }` or a column the tracks declare. Unset, the view's default: low on the synteny view for dense whole-genome hairballs, opaque on the dotplot. |
| <span id="property-minalignmentlength">**minAlignmentLength**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>minAlignmentLength: types.stripDefault( types.number, DEFAULT_M…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>minAlignmentLength: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;DEFAULT_MIN_ALIGNMENT_LENGTH,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | Hide alignment blocks shorter than this many bp, which cuts whole-genome hairball noise. |

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="property-color">[`color`](../trackcolorsmixin#property-color)</span>, <span id="property-trackcolors">[`trackColors`](../trackcolorsmixin#property-trackcolors)</span>, <span id="property-hideunlabelled">[`hideUnlabelled`](../trackcolorsmixin#property-hideunlabelled)</span></span>

## Volatiles

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="volatile-seenattributeranges">[`seenAttributeRanges`](../trackcolorsmixin#volatile-seenattributeranges)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-defaultopacity">**defaultOpacity**</span><br><code>number</code> | The constant opacity a reset returns to. |
| <span id="getter-opacitysetting">**opacitySetting**</span><br><code>SyntenyOpacitySnapshot</code> | The `opacity` object as its snapshot holds it. |
| <span id="getter-opacityfade">**opacityFade**</span><br><code>SyntenyOpacitySnapshot &#124; undefined</code> | What the color pass fades each alignment by: the field's mapping with its range as shares of `opacityLevel`, or undefined while `opacity` draws its constant, so the slider recolors nothing either way. |
| <span id="getter-opacitylevel">**opacityLevel**</span><br><code>number</code> | The opacity every alignment draws at before a field's fade: the shader's uniform (`opacityLevel`). |
| <span id="getter-opacityfield">**opacityField**</span><br><code>string</code> | The field `opacity` fades by, `''` while it draws its constant. |

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="getter-colorsetting">[`colorSetting`](../trackcolorsmixin#getter-colorsetting)</span>, <span id="getter-colorpaint">[`colorPaint`](../trackcolorsmixin#getter-colorpaint)</span>, <span id="getter-colorvalue">[`colorValue`](../trackcolorsmixin#getter-colorvalue)</span>, <span id="getter-colordomain">[`colorDomain`](../trackcolorsmixin#getter-colordomain)</span>, <span id="getter-colorrange">[`colorRange`](../trackcolorsmixin#getter-colorrange)</span>, <span id="getter-colorableattributes">[`colorableAttributes`](../trackcolorsmixin#getter-colorableattributes)</span>, <span id="getter-attributeranges">[`attributeRanges`](../trackcolorsmixin#getter-attributeranges)</span>, <span id="getter-colorabletracks">[`colorableTracks`](../trackcolorsmixin#getter-colorabletracks)</span>, <span id="getter-trackcolorassignments">[`trackColorAssignments`](../trackcolorsmixin#getter-trackcolorassignments)</span>, <span id="getter-colorfield">[`colorField`](../trackcolorsmixin#getter-colorfield)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../trackcolorsmixin#getter-haslegendkey)</span>, <span id="getter-colorlegendchips">[`colorLegendChips`](../trackcolorsmixin#getter-colorlegendchips)</span>, <span id="getter-colorscales">[`colorScales`](../trackcolorsmixin#getter-colorscales)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-syntenytracks">**syntenyTracks**</span><br><code>() =&gt; ComparativeTrackModel[]</code> | Overridable hook: every synteny track in the view, in paint order. |
| <span id="method-colorabletrackconfigs">**colorableTrackConfigs**</span><br><code>() =&gt; { trackId: string; name: string; }[]</code> |  |
| <span id="method-colorableattributenames">**colorableAttributeNames**</span><br><code>() =&gt; string[]</code> | The columns the tracks declare in their adapter's `attributeColumns` (the ortholog-table adapter's slot), one color mode each. |
| <span id="method-legendalpha">**legendAlpha**</span><br><code>() =&gt; number</code> | The key's chips are composited by the plot's opacity, as the alignments are. |

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="method-loadedattributeranges">[`loadedAttributeRanges`](../trackcolorsmixin#method-loadedattributeranges)</span>, <span id="method-legendcigarops">[`legendCigarOps`](../trackcolorsmixin#method-legendcigarops)</span>, <span id="method-colorsurface">[`colorSurface`](../trackcolorsmixin#method-colorsurface)</span>, <span id="method-offersreferencecolor">[`offersReferenceColor`](../trackcolorsmixin#method-offersreferencecolor)</span>, <span id="method-shapeshowsstrand">[`shapeShowsStrand`](../trackcolorsmixin#method-shapeshowsstrand)</span>, <span id="method-trackcolorfor">[`trackColorFor`](../trackcolorsmixin#method-trackcolorfor)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setopacity">**setOpacity**</span><br><code>(value: number) =&gt; void</code> | The opacity slider: the constant, or under a field its range scaled so its most opaque end lands on `value`. |
| <span id="action-setopacityfield">**setOpacityField**</span><br><code>(field: string) =&gt; void</code> | Fade by `field` from the current opacity down to 0.3 of it, or with `''` draw every alignment at the opacity the fade reached. |
| <span id="action-setminalignmentlength">**setMinAlignmentLength**</span><br><code>(value: number) =&gt; void</code> |  |

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="action-observeattributeranges">[`observeAttributeRanges`](../trackcolorsmixin#action-observeattributeranges)</span>, <span id="action-resetattributeranges">[`resetAttributeRanges`](../trackcolorsmixin#action-resetattributeranges)</span>, <span id="action-sethideunlabelled">[`setHideUnlabelled`](../trackcolorsmixin#action-sethideunlabelled)</span>, <span id="action-setcolorfield">[`setColorField`](../trackcolorsmixin#action-setcolorfield)</span>, <span id="action-setcolordomain">[`setColorDomain`](../trackcolorsmixin#action-setcolordomain)</span>, <span id="action-settrackcolor">[`setTrackColor`](../trackcolorsmixin#action-settrackcolor)</span>, <span id="action-cleartrackcolors">[`clearTrackColors`](../trackcolorsmixin#action-cleartrackcolors)</span></span>
