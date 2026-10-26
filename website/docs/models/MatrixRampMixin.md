---
id: matrixrampmixin
title: MatrixRampMixin
description: "A matrix display's encoding.color as it paints: the painted field through its preset's ramp (colorEncoding), that ramp's scheme, direction and 256-entry table (colorScheme, colorReverse, colorRamp),…"
sidebar_label: Mixin -> MatrixRampMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/MatrixRampMixin.ts).

A matrix display's `encoding.color` as it paints: the painted field through its preset's ramp (`colorEncoding`), that ramp's scheme, direction and 256-entry table (`colorScheme`, `colorReverse`, `colorRamp`), the domain and middle stop it spans over the display's `colorExtent` (`colorDomain`, `colorMidNorm`), all four as the painters read them (`matrixColor`), the legend's ramp (`rampColorScales`), and the scheme pick (`setColorScheme`). A display that may paint a field other than the written one, because the file could not serve it, answers `paintedColorField`; one whose values follow the data, rather than a statistic's fixed range, answers `colorExtent`

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-paintedcolorfield">**paintedColorField**</span><br><code>F</code> | Overridable hook: the field the loaded cells are, the written one unless the display overrides it with what the file served. |
| <span id="getter-colorextent">**colorExtent**</span><br><code>readonly [number, number]</code> | Overridable hook: what an unset end of the domain follows, the unit interval unless the display overrides it with its loaded values. |
| <span id="getter-colorencoding">**colorEncoding**</span><br><code>MatrixColorEncoding&lt;F&gt;</code> | The color channel under the painted field's preset, with an unset `scale.reverse` turning round a scheme dark at its low end, since an unpainted cell is the page behind the matrix. The preset's scheme, and its direction with it, fill whichever continuous scale is written: `withPreset` drops a preset whose scale differs, which would leave the Log toggle painting no field's scheme, or observed/expected's enrichment blue. |
| <span id="getter-colorscaletype">**colorScaleType**</span><br><code>"linear" &#124; "log" &#124; "symlog"</code> |  |
| <span id="getter-colorscheme">**colorScheme**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>"blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma"…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>"blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "redyellowblue" &#124; "viridis"</code></pre></dialog></span> |  |
| <span id="getter-colorreverse">**colorReverse**</span><br><code>boolean</code> | `scale.reverse`, or where unset whether the scheme runs dark at its low end. |
| <span id="getter-colorramp">**colorRamp**</span><br><code>Uint8Array&lt;ArrayBufferLike&gt;</code> | The ramp's 256 entries: the GPU's texture, the Canvas2D fill and the legend read this one table. It reads `colorScheme` and `colorReverse` rather than the encoding, so a domain edit re-uploads no texture. |
| <span id="getter-colorscale">**colorScale**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ domain: [number, number]; lut: Uint8Array&lt;ArrayBufferLike&gt;; m…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ domain: [number, number]; lut: Uint8Array&lt;ArrayBufferLike&gt;; midNorm: number; colorOf: (value: number) =&gt; number; }</code></pre></dialog></span> | `colorEncoding` over `colorExtent`: each pinned end holds and an open one follows the extent, as the mark display's ramps do. |
| <span id="getter-colordomain">**colorDomain**</span><br><code>[number, number]</code> |  |
| <span id="getter-colormidnorm">**colorMidNorm**</span><br><code>number</code> | Where `domainMid` sits on the normalized ramp, 0.5 unset, so a diverging scheme centres on it and equal distances from it take equal colors. |
| <span id="getter-matrixcolor">**matrixColor**</span><br><code>MatrixColorState</code> |  |
| <span id="getter-colorfieldtitle">**colorFieldTitle**</span><br><code>string</code> | The painted field's own key title, from its preset. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-rampcolorscales">**rampColorScales**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>({ id, title, extent: { min, max }, }: { id: string; title: str…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>({ id, title, extent: { min, max }, }: { id: string; title: string; extent: { min?: number &#124; undefined; max: number; }; }) =&gt; ColorScale[]</code></pre></dialog></span> | The legend's ramp, once there is a domain to span: its bottom where the scale paints it, a log scale's floor included, titled by `encoding.color.legend.title` where written, else `title`. An end of the domain the loaded values run past reads `≤` or `≥`; an unset `min` is the key's own bottom. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setcolorscheme">**setColorScheme**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(scheme: "blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox"…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(scheme: "blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "redyellowblue" &#124; "viridis") =&gt; void</code></pre></dialog></span> | The scheme, with `reverse` back to unset so it follows the scheme. The painted field's own scheme writes `scheme` unset, so it keeps following the field. |
