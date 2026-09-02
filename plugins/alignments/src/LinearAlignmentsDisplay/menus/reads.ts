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
  isChainMode: boolean
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (show: boolean) => void
  mismatchAlpha: boolean
  setMismatchAlpha: (value: boolean) => void
  mismatchAlphaDisplayTypeDefault: Pin
}

// Visibility of the rendering layers. Sashimi and read-connection controls live
// in their own menus.
//
// **Layers only.** Which reads exist is "Filter by..." — the three read-category
// toggles that used to end this menu (proper pairs, singletons, split
// alignments) drop reads in the worker rather than hiding drawn ones, and now
// live in `filterBy` with the rest of the filters. What is left is one kind of
// thing: a switch on something already fetched.
//
// **Toggles only, and flat.** What makes a long menu hard to scan is rows that
// aren't the same kind of thing, not the row count. Adding subHeaders to group
// it was tried and reverted: it bought three groups at the cost of four more
// rows and two more row kinds, which is the opposite trade. The row cap moved to
// "Read height" for the same reason — it was the one action among the
// checkboxes. Anything new here should be a checkbox, or it belongs in another
// menu.
function softClippingItem(model: ReadsModel) {
  const label = 'Show soft clipping'
  const onToggle = () => {
    model.setShowSoftClipping(!model.showSoftClipping)
  }
  return model.isChainMode
    ? toggleItem(label, model.showSoftClipping, onToggle, {
        disabled: true,
        disabledHelpText:
          'Chain layout does not expand soft clips — uncheck "View as pairs / link supplementary alignments" first',
      })
    : promotableToggleItem({
        label,
        checked: model.showSoftClipping,
        onToggle,
        pin: model.softClippingDisplayTypeDefault,
      })
}

export function getReadsMenuItems(model: ReadsModel) {
  return makeShowSubMenu([
    showLegendCheckboxItem(
      model.showLegend,
      () => {
        model.setShowLegend(!model.showLegend)
      },
      { pin: model.showLegendDisplayTypeDefault },
    ),
    toggleItem('Show coverage', model.showCoverage, show => {
      model.setShowCoverage(show)
    }),
    toggleItem('Show pileup', model.showPileup, show => {
      model.setShowPileup(show)
    }),
    // Only while grouping is in effect, so it sits next to the pileup toggle
    // it modifies rather than in the Group-by dimension list.
    ...collapseGroupRowsItems(model),
    toggleItem(
      'Show mismatches',
      model.showMismatches,
      show => {
        model.setShowMismatches(show)
      },
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
    // The worker forces soft clipping off in chain mode
    // (`executeRenderAlignmentData`'s `effShowSoftClipping`), so the row greys
    // out there rather than taking a click that draws nothing. It sheds its pin
    // while gated: a disabled row's pin is disabled with it (see the interbase
    // row below), and a live-looking pin that takes no click is worse than none.
    softClippingItem(model),
    // Every interbase mark — the count bars and the fixed-size triangles alike
    // — draws inside the coverage band (`COVERAGE_LAYERS`, and the Canvas2D
    // twin), and the hit test spells the same conjunction, so with the band
    // hidden this toggle changes nothing:
    // `renderers/interbaseNeedsCoverage.test.ts` is the A/B that says so
    // through the real draw path.
    //
    // Greyed rather than hidden, unlike LGVSyntenyDisplay's twin. The two
    // displays default `showCoverage` opposite ways, and that is the whole
    // difference: there the row would spend most of its life absent, so hiding
    // it costs nothing, while here the band is on by default and vanishing the
    // row would be the surprise. Greying keeps it discoverable and names the
    // switch — this display's own idiom, shared with the arc-band options.
    //
    // Safe to grey because the row carries no pin. A disabled row's pin is
    // disabled with it (`menuItemAdornment`, deliberately — a live-looking pin
    // in a `pointer-events: none` row takes no click), so gating a PROMOTABLE
    // row also takes away its make-this-the-default control. That is why the
    // rows above, which are promotable, state their dependency and are not
    // gated on it — except soft clipping, which drops the pin for the gate.
    toggleItem(
      'Show interbase indicators',
      model.showInterbaseIndicators,
      show => {
        model.setShowInterbaseIndicators(show)
      },
      {
        disabled: !model.showCoverage,
        disabledHelpText:
          'Interbase marks are drawn in the coverage band — turn on "Show coverage" first',
        helpText:
          'Mark insertions and clipping, which occupy no reference base, ' +
          'with a between-base tick, in the coverage band.',
      },
    ),
  ] satisfies MenuItem[])
}
