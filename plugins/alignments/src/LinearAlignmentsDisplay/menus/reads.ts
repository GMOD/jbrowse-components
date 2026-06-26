import VisibilityIcon from '@mui/icons-material/Visibility'

import { checkboxItem } from './menuHelpers.ts'

import type { MenuItem } from '@jbrowse/core/ui'

interface ReadsModel {
  showLegend: boolean
  setShowLegend: (show: boolean | undefined) => void
  showCoverage: boolean
  setShowCoverage: (show: boolean) => void
  showPileup: boolean
  setShowPileup: (show: boolean) => void
  showMismatches: boolean
  setShowMismatches: (show: boolean) => void
  showSoftClipping: boolean
  toggleSoftClipping: () => void
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (show: boolean) => void
  mismatchAlpha: boolean
  toggleMismatchAlpha: () => void
  showLowFreqMismatches: boolean
  toggleShowLowFreqMismatches: () => void
  showOutline: boolean
  setShowOutline: (v: boolean | undefined) => void
  flipStrandLongReadChains: boolean
  setFlipStrandLongReadChains: (flag: boolean) => void
  colorSupplementaryChains: boolean
  setColorSupplementaryChains: (flag: boolean) => void
}

// Visibility of the rendering layers. Sashimi and read-connection controls live
// in their own menus.
export function getReadsMenuItem(model: ReadsModel) {
  return {
    label: 'Show...',
    icon: VisibilityIcon,
    type: 'subMenu' as const,
    subMenu: [
      checkboxItem('Show legend', model.showLegend, () => {
        model.setShowLegend(!model.showLegend)
      }),
      checkboxItem('Show coverage', model.showCoverage, () => {
        model.setShowCoverage(!model.showCoverage)
      }),
      checkboxItem('Show pileup', model.showPileup, () => {
        model.setShowPileup(!model.showPileup)
      }),
      checkboxItem('Show mismatches', model.showMismatches, () => {
        model.setShowMismatches(!model.showMismatches)
      }),
      checkboxItem('Show soft clipping', model.showSoftClipping, () => {
        model.toggleSoftClipping()
      }),
      {
        label: 'Advanced',
        type: 'subMenu' as const,
        // less-common toggles, kept out of the top-level Show list so it
        // doesn't grow unwieldy
        subMenu: [
          checkboxItem(
            'Show interbase indicators',
            model.showInterbaseIndicators,
            () => {
              model.setShowInterbaseIndicators(!model.showInterbaseIndicators)
            },
          ),
          checkboxItem(
            'Show mismatches faded by base quality',
            model.mismatchAlpha,
            () => {
              model.toggleMismatchAlpha()
            },
          ),
          checkboxItem(
            'Show low-frequency mismatches',
            model.showLowFreqMismatches,
            () => {
              model.toggleShowLowFreqMismatches()
            },
          ),
          checkboxItem('Show outlines', model.showOutline, () => {
            model.setShowOutline(!model.showOutline)
          }),
          checkboxItem(
            'Color supplementary alignments by primary strand',
            model.flipStrandLongReadChains,
            () => {
              model.setFlipStrandLongReadChains(!model.flipStrandLongReadChains)
            },
          ),
          checkboxItem(
            'Color supplementary chains orange',
            model.colorSupplementaryChains,
            () => {
              model.setColorSupplementaryChains(!model.colorSupplementaryChains)
            },
          ),
        ],
      },
    ] satisfies MenuItem[],
  }
}
