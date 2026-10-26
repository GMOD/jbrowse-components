import { toggleItem } from '@jbrowse/core/ui/menuItems'
import {
  resetSectionOrderItems,
  groupByRadioMenuItem as sharedGroupByRadioMenuItem,
} from '@jbrowse/display-kit/groupByMenu'

import { isChainFacetable } from '../../shared/groupFeatures.ts'

import type { Facet, ReadDimension } from '../../shared/types.ts'
import type { AlignmentsUnit } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The shared builder, with chain mode as the `offered` rule: chain layout can
// only honor a dimension a chain resolves to one key under, and the worker
// degrades any other to ungrouped (`facetForUnit`), so a menu offering one
// anyway ticks a radio that changes nothing.
export function groupByRadioMenuItem({
  unit = 'read',
  ...rest
}: Omit<
  Parameters<typeof sharedGroupByRadioMenuItem<ReadDimension, string>>[0],
  'offered'
> & {
  unit?: AlignmentsUnit
}) {
  return sharedGroupByRadioMenuItem<ReadDimension, string>({
    ...rest,
    offered: field => unit !== 'chain' || isChainFacetable(field),
  })
}

export interface CollapseSectionsModel {
  canCollapseSections: boolean
  collapseSections: boolean
  setCollapseSections: (flag: boolean) => void
}

// Spread into a display's "Show" menu next to the pileup toggle: collapsing is
// how tall a group is drawn, so it belongs with the layout controls.
//
// Absent rather than disabled when it can't take effect (`canCollapseSections` —
// ungrouped, or chain mode, whose rows are chains). The display's
// `collapseSections` getter is gated on the same rule, so a visible box would
// sit unchecked on a track that defaults it on and do nothing when clicked.
export function collapseSectionsItems(model: CollapseSectionsModel) {
  return (
    model.canCollapseSections
      ? [
          toggleItem(
            'Collapse groups to one row',
            model.collapseSections,
            model.setCollapseSections,
            {
              helpText:
                'Draw each group as a single row instead of a stack, with ' +
                'overlap depth shown as darker shading — the compact reading ' +
                'for a track with many groups. Expanding one group from its ' +
                'label chip opts that group back out to a true stack.',
            },
          ),
        ]
      : []
  ) satisfies MenuItem[]
}

export interface SectionOrderMenuModel {
  effectiveFacet: Facet | undefined
  groupOrder: readonly { key: string; label: string }[]
  setFacetSort: (domain: readonly string[]) => void
}

// The worker is sent no domain, so a reorder refetches nothing. Undefined
// while chain mode degrades the facet to one section.
export function sectionOrderOf(model: SectionOrderMenuModel) {
  const facet = model.effectiveFacet
  return (
    facet && {
      sections: model.groupOrder,
      domain: facet.sort ?? [],
      setDomain: (domain: string[]) => {
        model.setFacetSort(domain)
      },
    }
  )
}

export function sectionOrderResetItems(model: SectionOrderMenuModel) {
  return resetSectionOrderItems(sectionOrderOf(model))
}

export { hiddenGroupsItems } from '@jbrowse/display-kit/groupByMenu'
export type { HiddenGroupsModel } from '@jbrowse/display-kit/groupByMenu'
