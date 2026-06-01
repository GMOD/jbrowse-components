import VisibilityIcon from '@mui/icons-material/Visibility'

import { getArcDirectionMenuItem } from './readConnections.ts'

import type { ArcDirection, ReadConnectionsMode } from '../constants.ts'

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
  sashimiArcs: ArcDirection
  setSashimiArcs: (mode: ArcDirection) => void

  showCoverage: boolean
  setShowCoverage: (show: boolean) => void
}

export function getReadsMenuItem(model: ReadsModel) {
  return {
    label: 'Show...',
    icon: VisibilityIcon,
    type: 'subMenu' as const,
    subMenu: [
      {
        label: 'Show coverage',
        type: 'checkbox' as const,
        checked: model.showCoverage,
        onClick: () => {
          model.setShowCoverage(!model.showCoverage)
        },
      },
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
        label: 'Show mismatches faded by base quality',
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
        label: 'Show supp. alignments colored by primary strand',
        type: 'checkbox' as const,
        checked: model.flipStrandLongReadChains,
        onClick: () => {
          model.setFlipStrandLongReadChains(!model.flipStrandLongReadChains)
        },
      },
      getArcDirectionMenuItem(model),
    ],
  }
}
