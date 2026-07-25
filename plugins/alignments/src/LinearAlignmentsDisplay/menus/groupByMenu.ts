import WorkspacesIcon from '@mui/icons-material/Workspaces'

import { checkboxItem } from './menuHelpers.ts'

import type { GroupByType } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// A directly-selectable dimension: picking it calls `onSelect(type)`.
export interface GroupByRadioOption {
  type: GroupByType
  label: string
  helpText?: string
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

// The shared "Group by..." radio submenu for the alignments track menu and
// LGVSyntenyDisplay. Grouping is one dimension at a time, so it's a single radio
// group: "None" (ungroup) plus one radio per offered dimension, the active one
// checked. Mirrors the sort menu's radio shape — the current grouping is visible
// at a glance and a common dimension is one click away, no dialog round-trip.
// `options` select directly via `onSelect`; `extra` radios (appended last) carry
// their own handler, so the two displays can't drift in menu shape.
// `collapseRows` appends the "One row per group" checkbox below the radios,
// because it modifies them: it is how tall each group they produce is drawn, not
// a dimension of its own.
export function groupByRadioMenuItem({
  current,
  options,
  onSelect,
  onNone,
  extra = [],
  collapseRows,
}: {
  current: GroupByType | undefined
  options: GroupByRadioOption[]
  onSelect: (type: GroupByType) => void
  onNone: () => void
  extra?: GroupByRadioItem[]
  collapseRows?: { checked: boolean; onToggle: () => void }
}) {
  const checked = checkedType(current, [...options, ...extra])
  // Direct selects keep the menu open; `extra` radios open a dialog, so they
  // dismiss it.
  const radio = (
    o: { type?: GroupByType; label: string; helpText?: string },
    onClick: () => void,
    keepMenuOpen?: boolean,
  ) => ({
    label: o.label,
    helpText: o.helpText,
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
      ...options.map(o =>
        radio(
          o,
          () => {
            onSelect(o.type)
          },
          true,
        ),
      ),
      ...extra.map(e => radio(e, e.onClick)),
      ...(collapseRows
        ? [
            { type: 'divider' as const },
            checkboxItem(
              'One row per group',
              collapseRows.checked,
              collapseRows.onToggle,
              {
                helpText:
                  'Draw each group as a single band, shading overlapping ' +
                  'features darker instead of stacking them. Expand one group ' +
                  'back to a full stack from its label.',
              },
            ),
          ]
        : []),
    ] satisfies MenuItem[],
  }
}
