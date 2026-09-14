import WorkspacesIcon from '@mui/icons-material/Workspaces'

import type { MenuItem } from '@jbrowse/core/ui'

/**
 * #api display-kit
 * A directly selectable dimension: picking it calls `onSelect(type)`. No help
 * text, and typed without the field so that stays a compile error rather than
 * a convention: the menu reserves a help column across every row as soon as
 * one row carries one, and a dimension needing a sentence is better renamed.
 */
export interface GroupByRadioOption<T extends string> {
  type: T
  label: string
}

/**
 * #api display-kit
 * A dimension that activates through its own flow rather than a direct select,
 * such as a tag whose radio opens a dialog for the tag name.
 */
export interface GroupByRadioItem<T extends string> {
  type: T
  label: string
  onClick: () => void
}

// A stored dimension this menu doesn't offer ticks "None" rather than leaving
// the group blank, so no caller filters `current` against what it passed in.
function checkedType<T extends string>(
  current: T | undefined,
  offered: readonly { type: T }[],
) {
  return offered.some(o => o.type === current) ? current : undefined
}

/**
 * #api display-kit
 * The "Group by..." radio submenu every in-track grouping shares. Grouping is
 * one dimension at a time, so it is a single radio group, "None" plus one per
 * offered dimension, mirroring a sort menu where the current choice is visible
 * at a glance and a common one is a click away with no dialog round-trip.
 * `options` select directly through `onSelect`; `extra` radios carry their own
 * handler. `offered` drops the dimensions the display cannot honor right now,
 * so a radio never ticks a choice that changes nothing. `X` is the extras'
 * type space, wider than `T` where a dimension only a dialog can pick exists.
 */
export function groupByRadioMenuItem<T extends string, X extends string = T>({
  current,
  options,
  onSelect,
  onNone,
  extra = [],
  offered = () => true,
}: {
  current: T | X | undefined
  options: GroupByRadioOption<T>[]
  onSelect: (type: T) => void
  onNone: () => void
  extra?: GroupByRadioItem<X>[]
  offered?: (type: T | X) => boolean
}) {
  const dimensions = options.filter(o => offered(o.type))
  const extras = extra.filter(e => offered(e.type))
  const checked = checkedType<T | X>(current, [...dimensions, ...extras])
  // Direct selects keep the menu open; `extra` radios open a dialog, so they
  // dismiss it, the rule the sort and color menus' tag rows follow.
  const radio = (
    o: { type?: T | X; label: string },
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
