import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { groupByRadioMenuItem as sharedGroupByRadioMenuItem } from '@jbrowse/display-kit/groupByMenu'

import { isChainGroupable } from '../../shared/groupFeatures.ts'

import type { ReadDimension } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The shared builder, with chain mode as the `offered` rule: chain layout can
// only honor a dimension a chain resolves to one key under, and the worker
// degrades any other to ungrouped (`groupByForMode`), so a menu offering one
// anyway ticks a radio that changes nothing.
export function groupByRadioMenuItem({
  isChainMode = false,
  ...rest
}: Omit<
  Parameters<typeof sharedGroupByRadioMenuItem<ReadDimension, string>>[0],
  'offered'
> & {
  isChainMode?: boolean
}) {
  return sharedGroupByRadioMenuItem<ReadDimension, string>({
    ...rest,
    offered: field => !isChainMode || isChainGroupable(field),
  })
}

export interface CollapseGroupRowsModel {
  canCollapseGroupRows: boolean
  collapseGroupRows: boolean
  setCollapseGroupRows: (flag: boolean) => void
}

// Spread into a display's "Show..." menu next to the pileup toggle: collapsing is
// how tall a group is drawn, so it belongs with the layout controls.
//
// Absent rather than disabled when it can't take effect (`canCollapseGroupRows` —
// ungrouped, or chain mode, whose rows are chains). The display's
// `collapseGroupRows` getter is gated on the same rule, so a visible box would
// sit unchecked on a track that defaults it on and do nothing when clicked.
export function collapseGroupRowsItems(model: CollapseGroupRowsModel) {
  return (
    model.canCollapseGroupRows
      ? [
          toggleItem(
            'Collapse groups to one row',
            model.collapseGroupRows,
            model.setCollapseGroupRows,
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

export { hiddenGroupsItems } from '@jbrowse/display-kit/groupByMenu'
export type { HiddenGroupsModel } from '@jbrowse/display-kit/groupByMenu'
