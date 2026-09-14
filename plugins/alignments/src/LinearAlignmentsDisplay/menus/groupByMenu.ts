import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { groupByRadioMenuItem as sharedGroupByRadioMenuItem } from '@jbrowse/display-kit/groupByMenu'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { isChainGroupableType } from '../../shared/groupFeatures.ts'

import type {
  GroupByType,
  ParameterlessGroupByType,
} from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The shared builder, with chain mode as the `offered` rule: chain layout can
// only honor a dimension a chain resolves to one key under, and the worker
// degrades any other to ungrouped (`groupByForMode`), so a menu offering one
// anyway ticks a radio that changes nothing.
export function groupByRadioMenuItem({
  isChainMode = false,
  ...rest
}: Omit<
  Parameters<
    typeof sharedGroupByRadioMenuItem<ParameterlessGroupByType, GroupByType>
  >[0],
  'offered'
> & {
  isChainMode?: boolean
}) {
  return sharedGroupByRadioMenuItem<ParameterlessGroupByType, GroupByType>({
    ...rest,
    offered: type => !isChainMode || isChainGroupableType(type),
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

export interface HiddenGroupsModel {
  hiddenGroups: { size: number }
  showAllGroups: () => void
}

// The way back from the label chip's "Hide this group". Spread into the same
// "Show..." menu as `collapseGroupRowsItems`, and absent while nothing is
// hidden — a row that reads "Show hidden groups (0)" is a row about a feature
// most tracks never use.
//
// A menu row and not a chip, because a hidden lane draws no chip: the stack it
// left is the only thing still on screen, and one lane hidden out of two leaves
// nothing that names the missing one.
export function hiddenGroupsItems(model: HiddenGroupsModel) {
  const { size } = model.hiddenGroups
  return (
    size > 0
      ? [
          {
            label: `Show ${size} hidden group${size > 1 ? 's' : ''}`,
            icon: VisibilityIcon,
            onClick: () => {
              model.showAllGroups()
            },
          },
        ]
      : []
  ) satisfies MenuItem[]
}
