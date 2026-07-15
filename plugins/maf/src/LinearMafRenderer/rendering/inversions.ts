import { alpha } from '@mui/material'

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
    ctx.save()
    ctx.beginPath()
    ctx.rect(m.xLeft, m.rowTop, m.width, m.h)
    ctx.clip()
    ctx.strokeStyle = hatchColor
    ctx.lineWidth = 1
    // Diagonal hatch across the clipped block band.
    for (let x = m.xLeft - m.h; x < right; x += HATCH_SPACING) {
      ctx.beginPath()
      ctx.moveTo(x, bottom)
      ctx.lineTo(x + m.h, m.rowTop)
      ctx.stroke()
    }
    ctx.restore()
    // Full-opacity outline marks the block extent (visible even when narrow).
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(m.xLeft, m.rowTop + 1, Math.max(m.width, 2), m.h - 2)
  }
}
