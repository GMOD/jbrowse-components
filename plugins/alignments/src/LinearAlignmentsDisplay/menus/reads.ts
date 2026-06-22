import VisibilityIcon from '@mui/icons-material/Visibility'

import { checkboxItem } from './menuHelpers.ts'
import {
  getArcDirectionMenuItem,
  getSashimiDirectionMenuItem,
} from './readConnections.ts'

import type { ReadConnectionsMode, SashimiArcsMode } from '../constants.ts'

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
  showSashimiArcs: boolean
  setShowSashimiArcs: (show: boolean) => void
  showSashimiLabels: boolean
  setShowSashimiLabels: (show: boolean) => void
  sashimiArcsMode: SashimiArcsMode
  setSashimiArcsMode: (mode: SashimiArcsMode) => void
  showBezierConnections: boolean
  setShowBezierConnections: (flag: boolean) => void
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  drawLongRange: boolean
  setDrawLongRange: (draw: boolean) => void
  drawInter: boolean
  setDrawInter: (draw: boolean) => void
  drawSingletons?: boolean
  drawProperPairs?: boolean
  setDrawSingletons?: (arg: boolean) => void
  setDrawProperPairs?: (arg: boolean) => void
}

export function getReadsMenuItem(
  model: ReadsModel,
  opts: { showPairFilters?: boolean },
) {
  const showPairFilters = opts.showPairFilters ?? false
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
      checkboxItem('Show sashimi arcs', model.showSashimiArcs, () => {
        model.setShowSashimiArcs(!model.showSashimiArcs)
      }),
      checkboxItem(
        'Show sashimi labels',
        model.showSashimiLabels,
        () => {
          model.setShowSashimiLabels(!model.showSashimiLabels)
        },
        { disabled: !model.showSashimiArcs },
      ),
      getSashimiDirectionMenuItem(model),
      ...(showPairFilters
        ? [
            checkboxItem(
              'Show singletons',
              model.drawSingletons ?? false,
              () => {
                model.setDrawSingletons?.(!model.drawSingletons)
              },
            ),
            checkboxItem(
              'Show proper pairs',
              model.drawProperPairs ?? false,
              () => {
                model.setDrawProperPairs?.(!model.drawProperPairs)
              },
            ),
          ]
        : []),
      getArcDirectionMenuItem(model),
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
            'Show read links as bezier curves',
            model.showBezierConnections,
            () => {
              model.setShowBezierConnections(!model.showBezierConnections)
            },
          ),
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
