---
id: matrixrampmixin
title: MatrixRampMixin
description: "A matrix display's encoding.color as it paints: the painted field through its preset's ramp (colorEncoding), that ramp's scheme, direction and 256-entry table (colorScheme, colorReverse, colorRamp),…"
sidebar_label: Mixin -> MatrixRampMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/MatrixRampMixin.ts).

A matrix display's `encoding.color` as it paints: the painted field through its preset's ramp (`colorEncoding`), that ramp's scheme, direction and 256-entry table (`colorScheme`, `colorReverse`, `colorRamp`), the domain and middle stop it spans over the display's `colorExtent` (`colorDomain`, `colorMidNorm`), all four as the painters read them (`matrixColor`), the legend's ramp (`rampColorScales`), and the scheme pick (`setColorScheme`) through the `ColorWritesMixin` it composes. Under a `threshold` scale the intervals (`colorBins`) paint through a table of one band each, the display handing the painters each value at its interval's centre (`binnedColorValues`), and the key lists the intervals. A display that may paint a field other than the written one, because the file could not serve it, answers `paintedColorField`; one whose values follow the data, rather than a statistic's fixed range, answers `colorExtent`

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited property from one model</summary>

From [ParkedColorMixin](../parkedcolormixin): <span id="property-parkedcolors">[`parkedColors`](../parkedcolormixin#property-parkedcolors)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-paintedcolorfield">**paintedColorField**</span><br><code>F</code> | Overridable hook: the field the loaded cells are, the written one unless the display overrides it with what the file served. |
| <span id="getter-colorextent">**colorExtent**</span><br><code>readonly [number, number]</code> | Overridable hook: what an unset end of the domain follows, the unit interval unless the display overrides it with its loaded values. |
| <span id="getter-paintedcolorsetting">**paintedColorSetting**</span><br><code>ColorSetting</code> | `encoding.color`'s painted members as written. |
| <span id="getter-colorencoding">**colorEncoding**</span><br><code>MatrixColorEncoding&lt;F&gt;</code> | The color channel under the painted field's preset, with an unset `scale.reverse` turning round a scheme dark at its low end, since an unpainted cell is the page behind the matrix. The preset's scheme, and its direction with it, fill whichever continuous scale is written: `withPreset` drops a preset whose scale differs, which would leave the Log toggle painting no field's scheme, or observed/expected's enrichment blue. |
| <span id="getter-colorscaletype">**colorScaleType**</span><br><code>"linear" &#124; "log" &#124; "symlog"</code> |  |
| <span id="getter-colorscheme">**colorScheme**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>"blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma"…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>"blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "redyellowblue" &#124; "viridis"</code></pre></dialog></span> |  |
| <span id="getter-colorreverse">**colorReverse**</span><br><code>boolean</code> | `scale.reverse`, or where unset whether the scheme runs dark at its low end. |
| <span id="getter-schemeramp">**schemeRamp**</span><br><code>Uint8Array&lt;ArrayBufferLike&gt;</code> | The scheme's 256 entries, read off `colorScheme` and `colorReverse` rather than the encoding, so a domain edit re-uploads no texture. |
| <span id="getter-colorbins">**colorBins**</span><br><code>MatrixColorBins &#124; undefined</code> | Under a `threshold` scale, its intervals: the `domain` cuts and a `range` color each, an interval `range` leaves unnamed sampling the scheme evenly from its low end. |
| <span id="getter-colorramp">**colorRamp**</span><br><code>Uint8Array&lt;ArrayBufferLike&gt;</code> | The 256 entries the GPU's texture, the Canvas2D fill and the legend read: the scheme's ramp, or under a threshold one band per interval. |
| <span id="getter-colorscale">**colorScale**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ domain: [number, number]; lut: Uint8Array&lt;ArrayBufferLike&gt;; m…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ domain: [number, number]; lut: Uint8Array&lt;ArrayBufferLike&gt;; midNorm: number; colorOf: (value: number) =&gt; number; }</code></pre></dialog></span> | `colorEncoding` over `colorExtent`: each pinned end holds and an open one follows the extent, as the mark display's ramps do. |
| <span id="getter-colordomain">**colorDomain**</span><br><code>[number, number]</code> |  |
| <span id="getter-colormidnorm">**colorMidNorm**</span><br><code>number</code> | Where `domainMid` sits on the normalized ramp, 0.5 unset, so a diverging scheme centres on it and equal distances from it take equal colors. |
| <span id="getter-matrixcolor">**matrixColor**</span><br><code>MatrixColorState</code> |  |
| <span id="getter-colorfieldtitle">**colorFieldTitle**</span><br><code>string</code> | The painted field's own key title, from its preset. |

<details class="inherited-members" data-pagefind-ignore>
<summary>3 inherited getters from 2 models</summary>

From [ColorWritesMixin](../colorwritesmixin): <span id="getter-writtencolor">[`writtenColor`](../colorwritesmixin#getter-writtencolor)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="getter-parkedcolor">[`parkedColor`](../parkedcolormixin#getter-parkedcolor)</span>, <span id="getter-parkedidentity">[`parkedIdentity`](../parkedcolormixin#getter-parkedidentity)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-rampcolorscales">**rampColorScales**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>({ id, title, extent: { min, max }, }: { id: string; title: str…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>({ id, title, extent: { min, max }, }: { id: string; title: string; extent: { min?: number &#124; undefined; max: number; }; }) =&gt; ColorScale[]</code></pre></dialog></span> | The legend's ramp, once there is a domain to span: its bottom where the scale paints it, a log scale's floor included, titled by `encoding.color.legend.title` where written, else `title`; under a threshold, its intervals, highest first under `legend.descending`. An end of the domain the loaded values run past reads `≤` or `≥`; an unset `min` is the key's own bottom. |

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited method from one model</summary>

From [ParkedColorMixin](../parkedcolormixin): <span id="method-parkedcolorof">[`parkedColorOf`](../parkedcolormixin#method-parkedcolorof)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setcolorscheme">**setColorScheme**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(scheme: "blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox"…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(scheme: "blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "redyellowblue" &#124; "viridis") =&gt; void</code></pre></dialog></span> | The scheme (`colorByScheme`), the painted field's preset naming the scheme that follows the field. |

<details class="inherited-members" data-pagefind-ignore>
<summary>7 inherited actions from 2 models</summary>

From [ColorWritesMixin](../colorwritesmixin): <span id="action-colorbyfield">[`colorByField`](../colorwritesmixin#action-colorbyfield)</span>, <span id="action-setcolorvalue">[`setColorValue`](../colorwritesmixin#action-setcolorvalue)</span>, <span id="action-colorbyidentity">[`colorByIdentity`](../colorwritesmixin#action-colorbyidentity)</span>, <span id="action-colorbyscheme">[`colorByScheme`](../colorwritesmixin#action-colorbyscheme)</span>, <span id="action-pickdefaultcolor">[`pickDefaultColor`](../colorwritesmixin#action-pickdefaultcolor)</span>, <span id="action-picksolidcolor">[`pickSolidColor`](../colorwritesmixin#action-picksolidcolor)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="action-parkcolor">[`parkColor`](../parkedcolormixin#action-parkcolor)</span>

</details>
