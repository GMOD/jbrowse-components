import { alpha, useTheme } from '@mui/material'

// orientation definitions from igv.js, see also
// https://software.broadinstitute.org/software/igv/interpreting_pair_orientations
type PairDirection = 'LR' | 'LL' | 'RR' | 'RL'
type OrientationMap = Partial<Record<string, PairDirection>>

export const orientationTypes: {
  fr: OrientationMap
  rf: OrientationMap
  ff: OrientationMap
} = {
  fr: {
    F1R2: 'LR',
    F2R1: 'LR',

    F1F2: 'LL',
    F2F1: 'LL',

    R1R2: 'RR',
    R2R1: 'RR',

    R1F2: 'RL',
    R2F1: 'RL',
  },

  rf: {
    R1F2: 'LR',
    R2F1: 'LR',

    R1R2: 'LL',
    R2R1: 'LL',

    F1F2: 'RR',
    F2F1: 'RR',

    F1R2: 'RL',
    F2R1: 'RL',
  },

  ff: {
    F2F1: 'LR',
    R1R2: 'LR',

    F2R1: 'LL',
    R1F2: 'LL',

    R2F1: 'RR',
    F1R2: 'RR',

    R2R1: 'RL',
    F1F2: 'RL',
  },
}

export function getPairDirection(pair_orientation?: string) {
  return orientationTypes.fr[pair_orientation ?? '']
}

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
      const r = getPairDirection(f.pair_orientation)
      const abnormal = r !== undefined && r !== 'LR'
      return { abnormal, color: abnormal ? colors[r] : unknown }
    },
    getLongReadOrientation(s1: number, s2: number) {
      if (s1 === -1 && s2 === 1) {
        return { abnormal: true, color: colors.RR }
      }
      if (s1 === 1 && s2 === -1) {
        return { abnormal: true, color: colors.LL }
      }
      return { abnormal: false, color: unknown }
    },
  }
}
