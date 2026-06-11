import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import FilterListIcon from '@mui/icons-material/FilterList'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { checkboxItem } from './menuHelpers.ts'
import { getArcDirectionMenuItem } from './readConnections.ts'

import type { ReadConnectionsMode } from '../constants.ts'

const SetSashimiScoreDialog = lazy(
  () => import('../dialogs/SetSashimiScoreDialog.tsx'),
)

interface ReadsModel {
  showLegend: boolean
  setShowLegend: (show: boolean | undefined) => void
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
  showOutline: boolean
  setShowOutline: (v: boolean | undefined) => void
  flipStrandLongReadChains: boolean
  setFlipStrandLongReadChains: (flag: boolean) => void
  showSashimiArcs: boolean
  toggleSashimiArcs: () => void
  minSashimiScore: number
  setMinSashimiScore: (score: number) => void
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
      checkboxItem('Show legend', model.showLegend, () => {
        model.setShowLegend(!model.showLegend)
      }),
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
      checkboxItem('Show sashimi arcs', model.showSashimiArcs, () => {
        model.toggleSashimiArcs()
      }),
      {
        label: 'Filter sashimi arcs by score...',
        icon: FilterListIcon,
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SetSashimiScoreDialog,
            { model, handleClose },
          ])
        },
      },
      checkboxItem(
        'Show read links as bezier curves',
        model.showBezierConnections,
        () => {
          model.setShowBezierConnections(!model.showBezierConnections)
        },
      ),
      getArcDirectionMenuItem(model),
      {
        label: 'Advanced',
        type: 'subMenu' as const,
        subMenu: [
          checkboxItem(
            'Show off-screen mate connections',
            model.drawLongRange,
            () => {
              model.setDrawLongRange(!model.drawLongRange)
            },
            {
              helpText:
                'draw an arc to a read whose mate is not loaded in the current view (off-screen or on another chromosome); the arc renders as vertical lines at this zoom',
            },
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
