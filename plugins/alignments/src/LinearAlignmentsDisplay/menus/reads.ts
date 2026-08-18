import {
  promotableToggleItem,
  showLegendCheckboxItem,
  toggleItem,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'

import { collapseGroupRowsItems } from './groupByMenu.ts'

import type { CollapseGroupRowsModel } from './groupByMenu.ts'
import type { Pin } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

interface ReadsModel extends CollapseGroupRowsModel {
  showLegend: boolean
  setShowLegend: (show: boolean) => void
  showLegendDisplayTypeDefault: Pin
  showCoverage: boolean
  setShowCoverage: (show: boolean) => void
  showPileup: boolean
  setShowPileup: (show: boolean) => void
  showMismatches: boolean
  setShowMismatches: (show: boolean) => void
  showSoftClipping: boolean
  setShowSoftClipping: (show: boolean) => void
  softClippingDisplayTypeDefault: Pin
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (show: boolean) => void
  mismatchAlpha: boolean
  setMismatchAlpha: (value: boolean) => void
  mismatchAlphaDisplayTypeDefault: Pin
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
// **Toggles only, and flat.** This is the longest submenu in the track menu, so
// it is the one that goes unreadable first — and what makes a long menu hard to
// scan is rows that aren't the same kind of thing, not the row count. Adding
// subHeaders to group it was tried and reverted: it bought three groups at the
// cost of four more rows and two more row kinds, which is the opposite trade.
// The row cap moved to "Read height" for the same reason — it was the one
// action among the checkboxes. Anything new here should be a checkbox, or it
// belongs in another menu.
export function getReadsMenuItems(model: ReadsModel) {
  return makeShowSubMenu([
    showLegendCheckboxItem(
      model.showLegend,
      () => {
        model.setShowLegend(!model.showLegend)
      },
      { pin: model.showLegendDisplayTypeDefault },
    ),
    toggleItem('Show coverage', model.showCoverage, model.setShowCoverage),
    toggleItem('Show pileup', model.showPileup, model.setShowPileup),
    // Only while grouping is in effect, so it sits next to the pileup toggle
    // it modifies rather than in the Group-by dimension list.
    ...collapseGroupRowsItems(model),
    toggleItem(
      'Show mismatches',
      model.showMismatches,
      model.setShowMismatches,
      {
        helpText:
          'Uncheck to hide how each read differs from the reference — ' +
          'mismatched bases, insertion markers and deletion bars. Intron ' +
          'lines stay: a spliced read is drawn as separate exon blocks, so ' +
          'the line joining them is what says they are one read.',
      },
    ),
    promotableToggleItem({
      label: 'Fade low quality mismatches',
      checked: model.mismatchAlpha,
      onToggle: () => {
        model.setMismatchAlpha(!model.mismatchAlpha)
      },
      pin: model.mismatchAlphaDisplayTypeDefault,
    }),
    promotableToggleItem({
      label: 'Show soft clipping',
      checked: model.showSoftClipping,
      onToggle: () => {
        model.setShowSoftClipping(!model.showSoftClipping)
      },
      pin: model.softClippingDisplayTypeDefault,
    }),
    // Every interbase mark — the count bars and the fixed-size triangles
    // alike — draws inside the coverage band (`COVERAGE_LAYERS`, and the
    // Canvas2D twin), and the hit test spells the same conjunction. So the
    // dependency is stated here rather than gated on: with coverage off this
    // toggle is inert, and the same sentence is on LGVSyntenyDisplay's
    // corresponding row.
    toggleItem(
      'Show interbase indicators',
      model.showInterbaseIndicators,
      model.setShowInterbaseIndicators,
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
    toggleItem(
      'Show proper pairs',
      model.drawProperPairs,
      model.setDrawProperPairs,
      {
        helpText:
          'Uncheck to hide concordant pairs — those the aligner flagged ' +
          'properly paired (SAM flag 0x2) AND in normal forward/reverse ' +
          '(FR) orientation. Discordant pairs (RR/LL/RL orientation, ' +
          'e.g. inversions or duplications) stay visible even if flagged ' +
          'proper, so structural-variant signal is not lost.',
      },
    ),
    toggleItem(
      'Show reads without a mate',
      model.drawSingletons,
      model.setDrawSingletons,
      {
        helpText:
          'Uncheck to hide reads whose mate or split/supplementary ' +
          'segment was not fetched for the same window, so the read stands ' +
          'alone (samtools calls these "singletons"). Grouped by read name, ' +
          'so it applies to a plain pileup too. "Window", not "view": each ' +
          'displayed region is fetched and grouped on its own, so in a ' +
          'multi-region view (a fusion with one window per partner) a read ' +
          'whose two alignments land in different windows counts as alone ' +
          'in both.',
      },
    ),
    toggleItem(
      'Show only split alignments',
      model.showOnlySplitAlignments,
      model.setShowOnlySplitAlignments,
      {
        helpText:
          'Only show reads that are part of a chimeric/split alignment ' +
          '(the aligner emitted a supplementary segment for the read, ' +
          'SAM flag 0x800) — chimeric SV/breakpoint evidence. Grouped by ' +
          'read name, so it applies to a plain pileup too.',
      },
    ),
  ] satisfies MenuItem[])
}
