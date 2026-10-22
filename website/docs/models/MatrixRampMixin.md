---
id: matrixrampmixin
title: MatrixRampMixin
description: "A matrix display's color as it paints: the painted field through its preset's ramp (colorEncoding), that ramp's scheme, direction and 256-entry table (colorScheme, colorReverse, colorRamp), and the…"
sidebar_label: Mixin -> MatrixRampMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/MatrixRampMixin.ts).

A matrix display's `color` as it paints: the painted field through its preset's ramp (`colorEncoding`), that ramp's scheme, direction and 256-entry table (`colorScheme`, `colorReverse`, `colorRamp`), and the scheme pick (`setColorScheme`). A display that may paint a field other than the written one, because the file could not serve it, answers `paintedColorField`. The domain stays the display's: one follows the loaded values, another spans its statistic's fixed range

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-paintedcolorfield">**paintedColorField**</span><br><code>F</code> | Overridable hook: the field the loaded cells are, the written one unless the display overrides it with what the file served. |
| <span id="getter-colorencoding">**colorEncoding**</span><br><code>MatrixColorEncoding&lt;F&gt;</code> | The `color` object under the painted field's preset, with an unset `reverse` turning round a scheme dark at its low end, since an unpainted cell is the page behind the matrix. The preset's scheme fills whichever continuous scale is written: `withPreset` drops a preset whose scale differs, which would leave the Log toggle painting no field's scheme. |
| <span id="getter-colorscaletype">**colorScaleType**</span><br><code>"linear" &#124; "log" &#124; "symlog"</code> |  |
| <span id="getter-colorscheme">**colorScheme**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>"blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma"…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>"blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "redyellowblue" &#124; "viridis"</code></pre></dialog></span> |  |
| <span id="getter-colorreverse">**colorReverse**</span><br><code>boolean</code> | `color.reverse`, or where unset whether the scheme runs dark at its low end. |
| <span id="getter-colorramp">**colorRamp**</span><br><code>Uint8Array&lt;ArrayBufferLike&gt;</code> | The ramp's 256 entries: the GPU's texture, the Canvas2D fill and the legend read this one table. It reads `colorScheme` and `colorReverse` rather than the encoding, so a domain edit re-uploads no texture. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setcolorscheme">**setColorScheme**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(scheme: "blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox"…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(scheme: "blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "redyellowblue" &#124; "viridis") =&gt; void</code></pre></dialog></span> | The scheme, with `reverse` back to unset so it follows the scheme. The painted field's own scheme writes `scheme` unset, so it keeps following the field. |
