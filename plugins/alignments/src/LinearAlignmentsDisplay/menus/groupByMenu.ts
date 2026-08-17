import { toggleItem } from '@jbrowse/core/ui/menuItems'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import { isChainGroupableType } from '../../shared/groupFeatures.ts'

import type { GroupByType } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// A directly-selectable dimension: picking it calls `onSelect(type)`.
//
// Label only, no help text: the menu reserves a help column across every row as
// soon as one row carries one, and a dimension that needs a sentence to explain
// it is better renamed. The radios are typed without the field rather than
// merely left empty, so that stays a compile error instead of a convention.
export interface GroupByRadioOption {
  type: GroupByType
  label: string
}

// A dimension that activates through a custom flow rather than a direct select
// — e.g. `tag`, whose radio opens a dialog for the tag name.
export interface GroupByRadioItem extends GroupByRadioOption {
  onClick: () => void
}

// Which radio to tick. A stored dimension this menu doesn't offer — a per-read
// grouping saved before chain mode was turned on (the worker degrades it to
// ungrouped), or a `hidden` dimension like mateAssembly owned by another display's
// menu — ticks "None" rather than leaving the whole group blank. Resolved here, so
// no caller has to remember to filter `current` against what it passed in.
function checkedType(
  current: GroupByType | undefined,
  offered: GroupByRadioOption[],
) {
  return offered.some(o => o.type === current) ? current : undefined
}

// The chain-mode rule, applied HERE rather than by each caller: chain layout can
// only honor a dimension where every read of a chain resolves to one key, and the
// worker degrades any other to ungrouped (`groupByForMode`). A menu offering one
// anyway ticks a radio that changes nothing — which is what LGVSyntenyDisplay's
// menu did, since it passes a fixed option list and so had no filter of its own.
// Alongside `checkedType`, this is the second rule no call site should have to
// remember, and both belong to the shape this builder exists to keep identical.
function offered<T extends GroupByRadioOption>(
  options: T[],
  isChainMode: boolean,
) {
  return isChainMode
    ? options.filter(o => isChainGroupableType(o.type))
    : options
}

// The shared "Group by..." radio submenu for the alignments track menu and
// LGVSyntenyDisplay. Grouping is one dimension at a time, so it's a single radio
// group: "None" (ungroup) plus one radio per offered dimension, the active one
// checked. Mirrors the sort menu's radio shape — the current grouping is visible
// at a glance and a common dimension is one click away, no dialog round-trip.
// `options` select directly via `onSelect`; `extra` radios (appended last) carry
// their own handler, so the two displays can't drift in menu shape.
//
// Dimensions only. `collapseGroupRowsItems` below used to sit under these radios,
// where a row reading "One row per group" looked like a description of grouping
// rather than a separate toggle; it is a group's drawn height, so it lives in
// "Show..." with the other layout toggles.
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
  onSelect: (type: GroupByType) => void
  onNone: () => void
  extra?: GroupByRadioItem[]
  isChainMode?: boolean
}) {
  const dimensions = offered(options, isChainMode)
  const extras = offered(extra, isChainMode)
  const checked = checkedType(current, [...dimensions, ...extras])
  // Direct selects keep the menu open; `extra` radios open a dialog, so they
  // dismiss it — same rule the sort and color menus' tag rows follow.
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
      // open, so leaving it unset left the track menu and this submenu standing
      // over the dialog the row had just opened.
      ...extras.map(e => radio(e, e.onClick, false)),
    ] satisfies MenuItem[],
  }
}

export interface CollapseGroupRowsModel {
  canCollapseGroupRows: boolean
  collapseGroupRows: boolean
  setCollapseGroupRows: (flag: boolean) => void
}

// Spread into a display's "Show..." menu, next to the pileup toggle: collapsing
// is how tall a group is drawn, so it belongs with the layout controls and not
// among the dimension radios.
//
// Absent rather than disabled when it can't take effect (`canCollapseGroupRows`
// — ungrouped, or chain mode, whose rows are chains). The display's
// `collapseGroupRows` getter is gated on the same rule, so ungrouped it reads
// `false` whatever the slot holds; a visible box then sat unchecked on a track
// that defaults it on (LGVSyntenyDisplay) and clicking it changed nothing.
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
