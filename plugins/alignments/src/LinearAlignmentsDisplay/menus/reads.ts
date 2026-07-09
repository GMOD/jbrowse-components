import { lazy } from 'react'

import { promotableToggleItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { checkboxItem } from './menuHelpers.ts'

import type { SessionDefaultControl } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

const SetMaxHeightDialog = lazy(
  () => import('../dialogs/SetMaxHeightDialog.tsx'),
)

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
  setShowSoftClipping: (show: boolean) => void
  softClippingSessionDefault: SessionDefaultControl
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (show: boolean) => void
  mismatchAlpha: boolean
  setMismatchAlpha: (value: boolean) => void
  mismatchAlphaSessionDefault: SessionDefaultControl
  drawProperPairs: boolean
  setDrawProperPairs: (v: boolean) => void
  drawSingletons: boolean
  setDrawSingletons: (v: boolean) => void
  maxHeight: number
  setMaxHeight: (height?: number) => void
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
      promotableToggleItem({
        label: 'Fade mismatches by base quality',
        checked: model.mismatchAlpha,
        onToggle: () => {
          model.setMismatchAlpha(!model.mismatchAlpha)
        },
        sessionDefault: model.mismatchAlphaSessionDefault,
      }),
      promotableToggleItem({
        label: 'Show soft clipping',
        checked: model.showSoftClipping,
        onToggle: () => {
          model.setShowSoftClipping(!model.showSoftClipping)
        },
        sessionDefault: model.softClippingSessionDefault,
      }),
      {
        label: 'Advanced',
        type: 'subMenu' as const,
        // less-common toggles, kept out of the top-level Show list so it
        // doesn't grow unwieldy
        subMenu: [
          // Which reads populate the pileup. These change what's fetched (they
          // also thin the coverage histogram), but they read as visibility
          // toggles, so they live in "Show..." rather than a filter submenu.
          checkboxItem(
            'Show proper pairs',
            model.drawProperPairs,
            () => {
              model.setDrawProperPairs(!model.drawProperPairs)
            },
            {
              helpText:
                'Uncheck to hide concordant pairs — those the aligner flagged ' +
                'properly paired (SAM flag 0x2) AND in normal forward/reverse ' +
                '(FR) orientation. Discordant pairs (RR/LL/RL orientation, ' +
                'e.g. inversions or duplications) stay visible even if flagged ' +
                'proper, so structural-variant signal is not lost.',
            },
          ),
          checkboxItem(
            'Show reads without a mate',
            model.drawSingletons,
            () => {
              model.setDrawSingletons(!model.drawSingletons)
            },
            {
              helpText:
                'Uncheck to hide reads whose mate or split/supplementary ' +
                'segment is not present in the view, so the read stands alone ' +
                '(samtools calls these "singletons"). Grouped by read name, so ' +
                'it applies to a plain pileup too.',
            },
          ),
          { type: 'divider' as const },
          checkboxItem(
            'Show interbase indicators',
            model.showInterbaseIndicators,
            () => {
              model.setShowInterbaseIndicators(!model.showInterbaseIndicators)
            },
          ),
          {
            label: 'Set max layout height...',
            onClick: () => {
              getSession(model).queueDialog(handleClose => [
                SetMaxHeightDialog,
                {
                  model,
                  handleClose,
                },
              ])
            },
          },
        ],
      },
    ] satisfies MenuItem[],
  }
}
