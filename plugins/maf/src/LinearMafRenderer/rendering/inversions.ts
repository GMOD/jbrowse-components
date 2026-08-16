import { alpha } from '@jbrowse/core/ui/palette'
import { withClip } from '@jbrowse/render-core/canvas2dUtils'

import type { InversionMarker } from '../../LinearMafDisplay/components/computeVisibleInversions.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const HATCH_SPACING = 4

/**
 * Draw the inversion (strand-flip) indicator over each block that aligns
 * inverted relative to its scaffold's consensus orientation: a translucent
 * diagonal hatch for texture (alpha baked into the color, since the shared SVG
 * canvas has no `globalAlpha`) plus a full-opacity outline so even a 1–2 bp block
 * still reads. Translucent fill keeps the underlying base/codon/identity
 * rendering visible — this is an overlay, not a mode. `color` is the shared
 * long-read inversion color so the cue matches elsewhere.
 */
export function drawInversions(
  ctx: Ctx2D,
  markers: InversionMarker[],
  color: string,
) {
  const hatchColor = alpha(color, 0.55)
  for (const m of markers) {
    const right = m.xLeft + m.width
    const bottom = m.rowTop + m.h
    withClip(ctx, m.xLeft, m.rowTop, m.width, m.h, () => {
      ctx.strokeStyle = hatchColor
      ctx.lineWidth = 1
      // Diagonal hatch across the clipped block band, as one path rather than a
      // `stroke()` per line. The lines are parallel, 1px wide and
      // `HATCH_SPACING` apart, so none of them overlaps another and stroking
      // them together composites identically — which is only true because they
      // don't overlap: the fill is translucent, so a shared path is what stops a
      // crossing from reading darker than the rest. A wide inverted block on a
      // deep alignment is hundreds of lines, and a rearranged pangenome has many
      // such blocks.
      ctx.beginPath()
      for (let x = m.xLeft - m.h; x < right; x += HATCH_SPACING) {
        ctx.moveTo(x, bottom)
        ctx.lineTo(x + m.h, m.rowTop)
      }
      ctx.stroke()
    })
    // Full-opacity outline marks the block extent (visible even when narrow).
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(m.xLeft, m.rowTop + 1, Math.max(m.width, 2), m.h - 2)
  }
}
