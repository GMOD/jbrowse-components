import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { colord } from '@jbrowse/core/util/colord'
import { observer } from 'mobx-react'

import { LD_FILTER_CATEGORIES } from '../../shared/ldFilterCategories.ts'

import type { FilterStats, LDMethod } from '../../VariantRPC/getLDMatrix.ts'
import type { SharedLDModel } from '../shared.ts'

// Structural, so the text is assertable without building a display — the same
// arrangement `buildLDTrackMenuItems` uses for the track menu's shape.
export interface LDStatusSelf {
  filterStats: FilterStats | undefined
  isPrecomputedLD: boolean
  ldMethod: LDMethod | undefined
  loadedLDWindow: number | undefined
}

/**
 * What the triangle on screen covers, in the order a reader needs it: how many
 * variants are on the axis, how the numbers were derived, and how far apart two
 * variants may be for their pair to have been computed at all.
 *
 * The parts are assembled as a list rather than concatenated inline because a
 * pre-computed matrix has only the last of them — a PLINK file carries no
 * per-variant genotypes, so there are no filter counts and no estimator to
 * name, but `maxVariantSeparation` windows it exactly as it windows a VCF.
 */
export function ldStatusParts({
  filterStats,
  isPrecomputedLD,
  ldMethod,
  loadedLDWindow,
}: LDStatusSelf) {
  const parts: string[] = []
  const stats = isPrecomputedLD ? undefined : filterStats
  if (stats) {
    const dropped = LD_FILTER_CATEGORIES.filter(c => stats[c.key] > 0)
    const reasons =
      dropped.length > 0
        ? ` (${dropped.map(c => `${stats[c.key]} ${c.label}`).join(', ')})`
        : ''
    parts.push(
      `${stats.passedVariants} / ${stats.totalVariants} variants shown${reasons}`,
    )
    // The ESTIMATOR, not the file. `ldMethod: 'composite'` is honoured on a
    // phased callset — that is what the slot exists for — so "unphased" here
    // described data that may well be phased.
    if (ldMethod === 'phased') {
      parts.push('LD: phased haplotypes (exact)')
    } else if (ldMethod === 'composite') {
      parts.push('LD: composite (Weir)')
    }
  }
  // Nothing in the plot says a window is in force: a pair past it is not drawn,
  // and against a light theme an in-band pair at r² = 0 — the ramp's white end,
  // at full alpha — is the same pixel as the background those undrawn cells
  // leave. So long-range LD, the case worth looking for, reads as absent rather
  // than as unmeasured unless the window is named somewhere.
  if (loadedLDWindow !== undefined) {
    parts.push(`pairs up to ${loadedLDWindow} variants apart`)
  }
  return parts
}

const LDStatusBar = observer(function LDStatusBar({
  model,
}: {
  model: SharedLDModel
}) {
  // Themed, not hardcoded: this badge sits over the triangle, so a fixed white
  // pill with grey text is a bright block in a dark session.
  const palette = usePalette()
  const parts = ldStatusParts(model)
  if (parts.length === 0) {
    return null
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 2,
        left: 4,
        fontSize: 10,
        color: palette.text.secondary,
        background: colord(palette.background.default)
          .alpha(0.75)
          .toRgbString(),
        padding: '1px 4px',
        borderRadius: 3,
        pointerEvents: 'none',
      }}
    >
      {parts.join(' · ')}
    </div>
  )
})

export default LDStatusBar
