import { interbaseIndicatorsMenuItem } from '@jbrowse/alignments-core/coverageMenuItems'
import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'

import {
  collapseSectionsItems,
  hiddenGroupsItems,
  sectionOrderResetItems,
} from './groupByMenu.ts'
import { sashimiShowItems } from './sashimi.ts'

import type { MismatchOpacityField } from '../../features/mismatch/qualityOpacity.ts'
import type { AlignmentsUnit } from '../constants.ts'
import type {
  CollapseSectionsModel,
  HiddenGroupsModel,
  SectionOrderMenuModel,
} from './groupByMenu.ts'
import type { SashimiModel } from './sashimi.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface ReadsModel
  extends
    CollapseSectionsModel,
    HiddenGroupsModel,
    SectionOrderMenuModel,
    SashimiModel {
  showLegend: boolean
  setShowLegend: (show: boolean) => void
  showCoverage: boolean
  setShowCoverage: (show: boolean) => void
  showPileup: boolean
  setShowPileup: (show: boolean) => void
  showMismatches: boolean
  setShowMismatches: (show: boolean) => void
  showSoftClipping: boolean
  setShowSoftClipping: (show: boolean) => void
  unit: AlignmentsUnit
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (show: boolean) => void
  mismatchOpacityField: MismatchOpacityField | undefined
  setMismatchOpacityField: (field?: MismatchOpacityField) => void
}

// Visibility of the rendering layers. Read connections live in their own menu.
//
// **Layers only.** Which reads exist is "Filter by...": the read categories
// drop reads in the worker rather than hiding drawn ones. What is left here is
// one kind of thing: a switch on something already fetched.
//
// **Toggles only, and flat.** What makes a long menu hard to scan is rows that
// aren't the same kind of thing, not the row count. Adding subHeaders to group
// it was tried and reverted: it bought three groups at the cost of four more
// rows and two more row kinds, which is the opposite trade. The row cap moved to
// "Read height" for the same reason — it was the one action among the
// checkboxes. Anything new here should be a checkbox, or it belongs in another
// menu.
function softClippingItem(model: ReadsModel) {
  return toggleItem(
    'Soft clipping',
    model.showSoftClipping,
    value => {
      model.setShowSoftClipping(value)
    },
    model.unit === 'chain'
      ? {
          disabled: true,
          disabledHelpText:
            'Chain layout does not expand soft clips — uncheck "View as pairs / link supplementary alignments" first',
        }
      : undefined,
  )
}

export function getReadsMenuItems(model: ReadsModel) {
  return makeShowSubMenu([
    toggleItem('Coverage', model.showCoverage, show => {
      model.setShowCoverage(show)
    }),
    toggleItem('Pileup', model.showPileup, show => {
      model.setShowPileup(show)
    }),
    // Only while grouping is in effect, so it sits next to the pileup toggle
    // it modifies rather than in the Group-by dimension list.
    ...collapseSectionsItems(model),
    ...hiddenGroupsItems(model),
    ...sectionOrderResetItems(model),
    toggleItem('Mismatches', model.showMismatches, show => {
      model.setShowMismatches(show)
    }),
    toggleItem(
      'Fade low quality mismatches',
      model.mismatchOpacityField === 'baseQuality',
      fade => {
        model.setMismatchOpacityField(fade ? 'baseQuality' : undefined)
      },
    ),
    // The worker forces soft clipping off in chain mode
    // (`executeRenderAlignmentData`'s `effShowSoftClipping`), so the row greys
    // out there rather than taking a click that draws nothing.
    softClippingItem(model),
    // Greyed rather than hidden, unlike LGVSyntenyDisplay's twin, which
    // defaults `showCoverage` off and so would spend its life greyed;
    // `renderers/interbaseNeedsCoverage.test.ts` is the A/B that the toggle
    // draws nothing with the band hidden.
    interbaseIndicatorsMenuItem(model),
    ...sashimiShowItems(model),
    legendCheckboxItem(model),
  ] satisfies MenuItem[])
}
