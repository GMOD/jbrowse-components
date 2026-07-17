import WorkspacesIcon from '@mui/icons-material/Workspaces'

import type { GroupByType } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// A directly-selectable dimension: picking it calls `onSelect(type)`.
export interface GroupByRadioOption {
  type: GroupByType
  label: string
}

// A dimension that activates through a custom flow rather than a direct select
// — e.g. `tag`, whose radio opens a dialog for the tag name.
export interface GroupByRadioItem extends GroupByRadioOption {
  onClick: () => void
}

// The shared "Group by..." radio submenu for the alignments track menu and
// LGVSyntenyDisplay. Grouping is one dimension at a time, so it's a single radio
// group: "None" (ungroup) plus one radio per offered dimension, the active one
// checked. Mirrors the sort menu's radio shape — the current grouping is visible
// at a glance and a common dimension is one click away, no dialog round-trip.
// `options` select directly via `onSelect`; `extra` radios (appended last) carry
// their own handler, so the two displays can't drift in menu shape.
export function groupByRadioMenuItem({
  current,
  options,
  onSelect,
  onNone,
  extra = [],
}: {
  current: GroupByType | undefined
  options: GroupByRadioOption[]
  onSelect: (type: GroupByType) => void
  onNone: () => void
  extra?: GroupByRadioItem[]
}) {
  const radio = (
    type: GroupByType | undefined,
    label: string,
    onClick: () => void,
  ) => ({ label, type: 'radio' as const, checked: current === type, onClick })
  return {
    label: 'Group by...',
    icon: WorkspacesIcon,
    type: 'subMenu' as const,
    subMenu: [
      radio(undefined, 'None', onNone),
      ...options.map(o =>
        radio(o.type, o.label, () => {
          onSelect(o.type)
        }),
      ),
      ...extra.map(e => radio(e.type, e.label, e.onClick)),
    ] satisfies MenuItem[],
  }
}
