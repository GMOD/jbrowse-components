import VisibilityIcon from '@mui/icons-material/Visibility'

import { checkboxItem } from './menuHelpers.ts'
import { getArcDirectionMenuItem } from './readConnections.ts'

import type { ReadConnectionsMode } from '../constants.ts'

interface ReadsModel {
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

  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  showSashimiArcs: boolean

  showCoverage: boolean
  setShowCoverage: (show: boolean) => void
}

export function getReadsMenuItem(model: ReadsModel) {
  return {
    label: 'Show...',
    icon: VisibilityIcon,
    type: 'subMenu' as const,
    subMenu: [
      checkboxItem('Show coverage', model.showCoverage, () => {
        model.setShowCoverage(!model.showCoverage)
      }),
      checkboxItem('Show mismatches', model.showMismatches, () => {
        model.setShowMismatches(!model.showMismatches)
      }),
      checkboxItem('Show soft clipping', model.showSoftClipping, () => {
        model.toggleSoftClipping()
      }),
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
      checkboxItem('Show outlines', model.showOutlineSetting, () => {
        model.setShowOutline(!model.showOutlineSetting)
      }),
      checkboxItem(
        'Show supp. alignments colored by primary strand',
        model.flipStrandLongReadChains,
        () => {
          model.setFlipStrandLongReadChains(!model.flipStrandLongReadChains)
        },
      ),
      getArcDirectionMenuItem(model),
    ],
  }
}
