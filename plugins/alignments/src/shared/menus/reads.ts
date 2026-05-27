import VisibilityIcon from '@mui/icons-material/Visibility'

import {
  getFeatureHeightMenuItem,
  getSetMaxHeightMenuItem,
} from './featureSize.ts'

interface ReadsModel {
  featureHeightSetting: number
  featureSpacing: number
  setFeatureHeight: (height?: number) => void
  setFeatureSpacing: (spacing?: number) => void

  maxHeight?: number
  setMaxHeight: (arg?: number) => void

  showMismatches: boolean
  setShowMismatches: (show: boolean) => void
  showSoftClipping: boolean
  toggleSoftClipping: () => void
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (show: boolean) => void

  mismatchAlpha: boolean
  toggleMismatchAlpha: () => void

  showOutlineSetting: boolean
  setShowOutline: (v: boolean | undefined) => void

  flipStrandLongReadChains: boolean
  setFlipStrandLongReadChains: (flag: boolean) => void
}

// Single "Reads" submenu collecting every visual-appearance toggle for the
// pileup body. Density at top (most-used), per-feature show toggles in the
// middle, expert-mode toggles at the bottom, max-height dialog as the
// trailing utility. Replaces the old "Show...", "Set feature height...",
// and most of the "Advanced..." dialog.
export function getReadsMenuItem(model: ReadsModel) {
  return {
    label: 'Reads',
    icon: VisibilityIcon,
    type: 'subMenu' as const,
    subMenu: [
      getFeatureHeightMenuItem(model),
      {
        label: 'Show mismatches',
        type: 'checkbox' as const,
        checked: model.showMismatches,
        onClick: () => {
          model.setShowMismatches(!model.showMismatches)
        },
      },
      {
        label: 'Show soft clipping',
        type: 'checkbox' as const,
        checked: model.showSoftClipping,
        onClick: () => {
          model.toggleSoftClipping()
        },
      },
      {
        label: 'Show interbase indicators',
        type: 'checkbox' as const,
        checked: model.showInterbaseIndicators,
        onClick: () => {
          model.setShowInterbaseIndicators(!model.showInterbaseIndicators)
        },
      },
      {
        label: 'Fade mismatches by base quality',
        type: 'checkbox' as const,
        checked: model.mismatchAlpha,
        onClick: () => {
          model.toggleMismatchAlpha()
        },
      },
      {
        label: 'Show outlines',
        type: 'checkbox' as const,
        checked: model.showOutlineSetting,
        onClick: () => {
          model.setShowOutline(!model.showOutlineSetting)
        },
      },
      {
        label: 'Flip strand of supplementary alignments',
        subLabel:
          'long-read chains: color supplementary segments by the primary alignment’s strand',
        type: 'checkbox' as const,
        checked: model.flipStrandLongReadChains,
        onClick: () => {
          model.setFlipStrandLongReadChains(!model.flipStrandLongReadChains)
        },
      },
      getSetMaxHeightMenuItem(model),
    ],
  }
}
