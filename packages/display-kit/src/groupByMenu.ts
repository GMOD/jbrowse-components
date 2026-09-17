import SwapVertIcon from '@mui/icons-material/SwapVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import type { MenuItem } from '@jbrowse/core/ui'

/**
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

export interface HiddenGroupsModel {
  hiddenGroups: { size: number }
  showAllGroups: () => void
}

/**
 * The menu's way back from a chip's hide button, beside the topmost chip's
 * "N hidden" button. Spread into a display's "Show..." menu, and absent while
 * nothing is hidden: a row reading "Show hidden groups (0)" is a row about a
 * feature most tracks never use.
 */
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

/**
 * What the section-order menu reads and writes: the sections drawn, in
 * stacking order and without the hidden ones, and the facet's `domain`, the
 * declared order every stacking display sorts through. A write names the
 * whole drawn order, so the sections stay where the reader put them as the
 * data under them changes.
 */
export interface SectionOrderModel {
  sections: readonly { key: string; label: string }[]
  domain: readonly string[]
  setDomain: (domain: string[]) => void
  hideGroup: (key: string) => void
}

// A synteny stack calls its sections lanes, and builds its own lane menu
// around these rows.
const HIDE_LABELS = {
  section: 'Hide section',
  lane: 'Hide lane',
} as const

export type SectionNoun = keyof typeof HIDE_LABELS

/**
 * The domain a reorder writes: the sections it names, in their new order,
 * plus the ones the current domain pins that it could not see (hidden, or
 * absent from the fetched window), each spliced back at the index it held.
 * Without the merge a move on one section dropped every unseen one back to
 * the sorted tail.
 */
export function mergeDomain(
  previous: readonly string[],
  next: readonly string[],
) {
  const named = new Set(next)
  const out = [...next]
  previous.forEach((key, i) => {
    if (!named.has(key)) {
      out.splice(Math.min(i, out.length), 0, key)
    }
  })
  return out
}

/** `order` with `key` moved to index `to`, clamped to the ends. */
export function moveSectionTo(
  order: readonly string[],
  key: string,
  to: number,
) {
  const from = order.indexOf(key)
  if (from < 0) {
    return [...order]
  }
  const out = [...order]
  out.splice(from, 1)
  out.splice(Math.max(0, Math.min(to, out.length)), 0, key)
  return out
}

/**
 * Move up / Move down / Hide for one section, off the order drawn now. A move
 * writes the WHOLE drawn order: the domain pins what it names and leaves the
 * rest to the default sort, so pinning one section would let the others
 * re-sort under it between two moves. `keepMenuOpen`, because moving a
 * section two places is two clicks; the rows' disabled marks update live.
 */
export function sectionRowMenuItems(
  model: SectionOrderModel,
  key: string,
  noun: SectionNoun,
): MenuItem[] {
  const keys = model.sections.map(s => s.key)
  const i = keys.indexOf(key)
  const write = (to: number) => {
    model.setDomain(mergeDomain(model.domain, moveSectionTo(keys, key, to)))
  }
  return [
    {
      label: 'Move up',
      disabled: i <= 0,
      keepMenuOpen: true,
      onClick: () => {
        write(i - 1)
      },
    },
    {
      label: 'Move down',
      disabled: i < 0 || i === keys.length - 1,
      keepMenuOpen: true,
      onClick: () => {
        write(i + 1)
      },
    },
    {
      label: HIDE_LABELS[noun],
      disabled: keys.length < 2,
      keepMenuOpen: true,
      onClick: () => {
        model.hideGroup(key)
      },
    },
  ]
}

/**
 * The "Sections" submenu every stacking display offers once it has two: one
 * row per section with its moves, and a reset to the default order that is
 * dead while the domain pins nothing. The runtime half of `domain`, so a
 * reader reorders what a config author declares.
 */
export function sectionOrderMenuItems(model: SectionOrderModel): MenuItem[] {
  const { sections } = model
  if (sections.length < 2) {
    return []
  }
  return [
    {
      label: 'Sections',
      icon: SwapVertIcon,
      subMenu: [
        ...sections.map(({ key, label }) => ({
          label,
          subMenu: sectionRowMenuItems(model, key, 'section'),
        })),
        { type: 'divider' },
        {
          label: 'Reset section order',
          disabled: model.domain.length === 0,
          onClick: () => {
            model.setDomain([])
          },
        },
      ],
    },
  ]
}
