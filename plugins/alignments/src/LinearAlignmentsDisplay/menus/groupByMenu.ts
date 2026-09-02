import { toggleItem } from '@jbrowse/core/ui/menuItems'
import VisibilityIcon from '@mui/icons-material/Visibility'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import { isChainGroupableType } from '../../shared/groupFeatures.ts'

import type {
  GroupByType,
  ParameterlessGroupByType,
} from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// A directly-selectable dimension: picking it calls `onSelect(type)`.
//
// No help text, and typed without the field so that stays a compile error rather
// than a convention: the menu reserves a help column across every row as soon as
// one row carries one, and a dimension needing a sentence is better renamed.
export interface GroupByRadioOption {
  type: ParameterlessGroupByType
  label: string
}

// A dimension that activates through a custom flow rather than a direct select
// — e.g. `tag`, whose radio opens a dialog for the tag name. Not a
// `GroupByRadioOption`, because the dimensions needing a flow are exactly the
// ones `onSelect` cannot write: `tag` takes a parameter.
export interface GroupByRadioItem {
  type: GroupByType
  label: string
  onClick: () => void
}

// Which radio to tick. A stored dimension this menu doesn't offer — a per-read
// grouping saved before chain mode was on, or a `hidden` one like mateAssembly
// owned by another display's menu — ticks "None" rather than leaving the group
// blank, so no caller has to filter `current` against what it passed in.
function checkedType(
  current: GroupByType | undefined,
  offered: { type: GroupByType }[],
) {
  return offered.some(o => o.type === current) ? current : undefined
}

// The chain-mode rule, applied HERE rather than by each caller: chain layout can
// only honor a dimension a chain resolves to one key under, and the worker
// degrades any other to ungrouped (`groupByForMode`), so a menu offering one
// anyway ticks a radio that changes nothing. Alongside `checkedType`, the second
// rule no call site should have to remember.
function offered<T extends { type: GroupByType }>(
  options: T[],
  isChainMode: boolean,
) {
  return isChainMode
    ? options.filter(o => isChainGroupableType(o.type))
    : options
}

// The shared "Group by..." radio submenu for the alignments track menu and
// LGVSyntenyDisplay. Grouping is one dimension at a time, so it is a single radio
// group — "None" plus one per offered dimension — mirroring the sort menu, where
// the current choice is visible at a glance and a common one is a click away with
// no dialog round-trip. `options` select directly via `onSelect`; `extra` radios
// carry their own handler, so the two displays can't drift in menu shape.
//
// Dimensions only: a group's drawn height is `collapseGroupRowsItems`, which
// belongs in "Show..." with the other layout toggles.
export function groupByRadioMenuItem({
  current,
  options,
  onSelect,
  onNone,
  extra = [],
  isChainMode = false,
}: {
  current: GroupByType | undefined
  options: GroupByRadioOption[]
  onSelect: (type: ParameterlessGroupByType) => void
  onNone: () => void
  extra?: GroupByRadioItem[]
  isChainMode?: boolean
}) {
  const dimensions = offered(options, isChainMode)
  const extras = offered(extra, isChainMode)
  const checked = checkedType(current, [...dimensions, ...extras])
  // Direct selects keep the menu open; `extra` radios open a dialog, so they
  // dismiss it — the rule the sort and color menus' tag rows follow.
  const radio = (
    o: { type?: GroupByType; label: string },
    onClick: () => void,
    keepMenuOpen?: boolean,
  ) => ({
    label: o.label,
    type: 'radio' as const,
    checked: checked === o.type,
    keepMenuOpen,
    onClick,
  })
  return {
    label: 'Group by...',
    icon: WorkspacesIcon,
    type: 'subMenu' as const,
    subMenu: [
      radio({ label: 'None' }, onNone, true),
      ...dimensions.map(o =>
        radio(
          o,
          () => {
            onSelect(o.type)
          },
          true,
        ),
      ),
      // `false`, not omitted: `staysOpenOnClick` defaults a radio to staying
      // open, which leaves both menus standing over the dialog it just opened.
      ...extras.map(e => radio(e, e.onClick, false)),
    ] satisfies MenuItem[],
  }
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
