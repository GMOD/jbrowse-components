import VisibilityIcon from '@mui/icons-material/Visibility'

import { checkboxItem } from './menuHelpers.ts'
import { getArcDirectionMenuItem } from './readConnections.ts'

import type { LinkedReadsMode, ReadConnectionsMode } from '../constants.ts'

interface ReadsModel {
  showCoverage: boolean
  setShowCoverage: (show: boolean) => void
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
  showOutlineSetting: boolean
  setShowOutline: (v: boolean | undefined) => void
  flipStrandLongReadChains: boolean
  setFlipStrandLongReadChains: (flag: boolean) => void
  showSashimiArcs: boolean
  toggleSashimiArcs: () => void
  linkedReads: LinkedReadsMode
  setLinkedReads: (mode: LinkedReadsMode) => void
  showBezierConnections: boolean
  setShowBezierConnections: (flag: boolean) => void
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  drawLongRange: boolean
  setDrawLongRange: (draw: boolean) => void
  drawInter: boolean
  setDrawInter: (draw: boolean) => void
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
      checkboxItem(
        'Show low-frequency mismatches',
        model.showLowFreqMismatches,
        () => {
          model.toggleShowLowFreqMismatches()
        },
      ),
      checkboxItem('Show outlines', model.showOutlineSetting, () => {
        model.setShowOutline(!model.showOutlineSetting)
      }),
      checkboxItem(
        'Color supplementary alignments by primary strand',
        model.flipStrandLongReadChains,
        () => {
          model.setFlipStrandLongReadChains(!model.flipStrandLongReadChains)
        },
      ),
      checkboxItem('Show sashimi arcs', model.showSashimiArcs, () => {
        model.toggleSashimiArcs()
      }),
      checkboxItem('Bezier curves', model.showBezierConnections, () => {
        model.setShowBezierConnections(!model.showBezierConnections)
      }),
      getArcDirectionMenuItem(model),
      {
        label: 'Advanced',
        type: 'subMenu' as const,
        subMenu: [
          checkboxItem(
            'Show long-range pairs',
            model.drawLongRange,
            () => {
              model.setDrawLongRange(!model.drawLongRange)
            },
            { helpText: 'reads >100 kb apart or with off-screen mates' },
          ),
          checkboxItem(
            'Show inter-chromosomal pairs',
            model.drawInter,
            () => {
              model.setDrawInter(!model.drawInter)
            },
            { helpText: 'reads whose mate maps to a different chromosome' },
          ),
        ],
      },
    ],
  }
}
