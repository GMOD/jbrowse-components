import {
  isAbnormalPairDirection,
  pairDirection,
  splitInversion,
} from '@jbrowse/alignments-core'
import { alpha, useTheme } from '@mui/material'

import type { PairDirection } from '@jbrowse/alignments-core'

const pairOrientationLabels: Record<PairDirection, string> = {
  LR: 'normal (concordant) pair orientation',
  LL: 'same-strand pair orientation (LL) — possible inversion',
  RR: 'same-strand pair orientation (RR) — possible inversion',
  RL: 'outward-facing pair orientation (RL) — possible duplication/insertion',
}

// Maps the shared orientation categories (@jbrowse/alignments-core) to MUI theme
// colors + labels for the SVG overlay; the alignments GPU/arc/linked-read paths
// map the same categories to palette indices instead.
export function useOrientationColor() {
  const { palette } = useTheme()
  const { pairLR, pairRL, pairLL, pairRR } = palette.alignmentFill
  const colors: Record<PairDirection, string> = {
    LR: alpha(pairLR, 0.8),
    RL: alpha(pairRL, 0.8),
    LL: alpha(pairLL, 0.8),
    RR: alpha(pairRR, 0.8),
  }
  const unknown = alpha(palette.text.secondary, 0.8)

  return {
    getPairedOrientation(f: { pair_orientation?: string }) {
      const r = pairDirection(f.pair_orientation)
      const abnormal = isAbnormalPairDirection(r)
      return {
        abnormal,
        color: r && abnormal ? colors[r] : unknown,
        label: r ? pairOrientationLabels[r] : 'unknown pair orientation',
      }
    },
    getLongReadOrientation(s1: number, s2: number) {
      // 'rf' (rev→fwd) and 'fr' (fwd→rev) are both inversions; they take
      // distinct hues (RR/LL) so the two flip directions read differently.
      const inv = splitInversion(s1, s2)
      return inv
        ? {
            abnormal: true,
            color: inv === 'rf' ? colors.RR : colors.LL,
            label: 'strand-flip split read — possible inversion',
          }
        : {
            abnormal: false,
            color: unknown,
            label: 'co-linear split read (same strand)',
          }
    },
  }
}
