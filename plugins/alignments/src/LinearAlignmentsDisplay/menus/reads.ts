import { lazy } from 'react'

import { checkboxItem, promotableToggleItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { collapseGroupRowsItems } from './groupByMenu.ts'

import type { CollapseGroupRowsModel } from './groupByMenu.ts'
import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

const SetMaxHeightDialog = lazy(
  () => import('../dialogs/SetMaxHeightDialog.tsx'),
)

interface MaxHeightModel {
  maxHeight: number
  setMaxHeight: (height?: number) => void
}

// The pileup row cap is a plain layout limit with no read-specific meaning, so
// it's shared with the synteny display's own "Show..." menu rather than
// re-spelled there (the dialog stays lazy behind this helper).
export function getMaxHeightMenuItem(model: MaxHeightModel) {
  return {
    label: 'Set max layout height...',
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        SetMaxHeightDialog,
        { model, handleClose },
      ])
    },
  }
}

interface ReadsModel extends MaxHeightModel, CollapseGroupRowsModel {
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
  softClippingDisplayTypeDefault: DisplayTypeDefaultControl
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (show: boolean) => void
  mismatchAlpha: boolean
  setMismatchAlpha: (value: boolean) => void
  mismatchAlphaDisplayTypeDefault: DisplayTypeDefaultControl
  drawProperPairs: boolean
  setDrawProperPairs: (v: boolean) => void
  drawSingletons: boolean
  setDrawSingletons: (v: boolean) => void
  showOnlySplitAlignments: boolean
  setShowOnlySplitAlignments: (v: boolean) => void
}

// Visibility of the rendering layers. Sashimi and read-connection controls live
// in their own menus.
//
// The rows are grouped under subHeaders (the pattern `getFeatureHeightMenuItem`
// already uses to separate its two radio groups) because this is the longest
// submenu in the track menu and holds three genuinely different kinds of thing:
// which bands are drawn, how a read's bases are painted, and which reads are
// fetched at all. As one flat list — with pins on two rows and help "?" on five
// — it read as an undifferentiated wall. The headers cost two rows and hide
// nothing; splitting the third group into its own submenu instead would put the
// read-category toggles a hop deeper, and they were deliberately kept out of
// "Filter by..." because they read as visibility (see filters.ts).
export function getReadsMenuItem(model: ReadsModel) {
  return {
    label: 'Show...',
    icon: VisibilityIcon,
    type: 'subMenu' as const,
    subMenu: [
      { type: 'subHeader' as const, label: 'Layers' },
      checkboxItem('Show legend', model.showLegend, () => {
        model.setShowLegend(!model.showLegend)
      }),
      checkboxItem('Show coverage', model.showCoverage, () => {
        model.setShowCoverage(!model.showCoverage)
      }),
      checkboxItem('Show pileup', model.showPileup, () => {
        model.setShowPileup(!model.showPileup)
      }),
      // Only while grouping is in effect, so it sits next to the pileup toggle
      // it modifies rather than in the Group-by dimension list.
      ...collapseGroupRowsItems(model),
      { type: 'subHeader' as const, label: 'Read detail' },
      checkboxItem('Show mismatches', model.showMismatches, () => {
        model.setShowMismatches(!model.showMismatches)
      }),
      promotableToggleItem({
        label: 'Fade low quality mismatches',
        checked: model.mismatchAlpha,
        onToggle: () => {
          model.setMismatchAlpha(!model.mismatchAlpha)
        },
        displayTypeDefault: model.mismatchAlphaDisplayTypeDefault,
      }),
      promotableToggleItem({
        label: 'Show soft clipping',
        checked: model.showSoftClipping,
        onToggle: () => {
          model.setShowSoftClipping(!model.showSoftClipping)
        },
        displayTypeDefault: model.softClippingDisplayTypeDefault,
      }),
      // Every interbase mark — the count bars and the fixed-size triangles
      // alike — draws inside the coverage band (`coveragePassPlan`, and the
      // Canvas2D twin), and the hit test spells the same conjunction. So the
      // dependency is stated here rather than gated on: with coverage off this
      // toggle is inert, and the same sentence is on LGVSyntenyDisplay's
      // corresponding row.
      checkboxItem(
        'Show interbase indicators',
        model.showInterbaseIndicators,
        () => {
          model.setShowInterbaseIndicators(!model.showInterbaseIndicators)
        },
        {
          helpText:
            'Mark insertions and clipping, which occupy no reference base, ' +
            'with a between-base tick. Drawn in the coverage band, so it ' +
            'needs "Show coverage" on.',
        },
      ),
      // Which reads populate the pileup. These change what's fetched (they also
      // thin the coverage histogram), but they read as visibility toggles, so
      // they live in "Show..." rather than a filter submenu.
      { type: 'subHeader' as const, label: 'Which reads' },
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
      checkboxItem(
        'Show only split alignments',
        model.showOnlySplitAlignments,
        () => {
          model.setShowOnlySplitAlignments(!model.showOnlySplitAlignments)
        },
        {
          helpText:
            'Only show reads that are part of a chimeric/split alignment ' +
            '(the aligner emitted a supplementary segment for the read, ' +
            'SAM flag 0x800) — chimeric SV/breakpoint evidence. Grouped by ' +
            'read name, so it applies to a plain pileup too.',
        },
      ),
      // The one action in a menu of toggles, so a divider rather than a header.
      { type: 'divider' as const },
      getMaxHeightMenuItem(model),
    ] satisfies MenuItem[],
  }
}
