import { OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'
import VisibilityIcon from '@mui/icons-material/Visibility'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import { facetForField } from './FacetWritesMixin.ts'

import type { WrittenFacet } from './FacetWritesMixin.ts'
import type { Plot } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'

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
 * such as a tag whose radio opens a dialog for the tag name, or one only a
 * config can name, which shows checked and cannot be picked.
 */
export type GroupByRadioItem<T extends string> =
  | { type: T; label: string; onClick: () => void }
  | { type: T; label: string; disabledHelpText: string }

// A stored dimension no radio names, a field only a config wrote, gets a
// checked, disabled radio of its own, so the menu never ticks "None" over a
// grouped track. One `offered` drops ticks "None": the display cannot honor it.
function storedRadio<T extends string>(
  current: T | undefined,
  radios: readonly { type: T }[],
  offered: (type: T) => boolean,
): GroupByRadioItem<T>[] {
  return current === undefined ||
    !offered(current) ||
    radios.some(o => o.type === current)
    ? []
    : [
        {
          type: current,
          label: current,
          disabledHelpText: "Set in the track's config",
        },
      ]
}

/**
 * The "Group by" radio submenu every in-track grouping shares. Grouping is
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
  const offeredExtras = extra.filter(e => offered(e.type))
  const extras: GroupByRadioItem<T | X>[] = [
    ...offeredExtras,
    ...storedRadio(current, [...dimensions, ...offeredExtras], offered),
  ]
  const checked = [...dimensions, ...extras].some(o => o.type === current)
    ? current
    : undefined
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
  const extraRadio = (e: GroupByRadioItem<T | X>) =>
    'onClick' in e
      ? radio(e, e.onClick, false)
      : {
          ...radio(e, () => {}),
          disabled: true,
          disabledHelpText: e.disabledHelpText,
        }
  return {
    label: 'Group by',
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
      ...extras.map(extraRadio),
    ] satisfies MenuItem[],
  }
}

/**
 * Whether grouping by `field` also colors by it, absent the user's say: yes
 * over the track's own color, and yes where the color already paints `field`.
 * A hand-picked constant or another field stays, and so does the plain fill
 * under a per-base layer (`underBaseLayer`), whose marks read against it.
 */
export function colorsWithGrouping({
  value,
  colorField,
  field,
  underBaseLayer = false,
}: {
  value: unknown
  colorField: string | undefined
  field: string | undefined
  underBaseLayer?: boolean
}) {
  return (
    (value === undefined && colorField === undefined && !underBaseLayer) ||
    (colorField !== undefined && colorField === field)
  )
}

/**
 * A Group by choice as plot settings, which its Apply writes and its Edit plot
 * button shows: the facet by `facetForField`, none for no field, and `color`
 * where the choice writes one.
 */
export function groupByPlotOf(
  written: WrittenFacet,
  field: string | undefined,
  color: ColorSlots | undefined,
): Plot {
  return {
    facet: field ? facetForField(written, field) : null,
    ...(color ? { encoding: { color } } : {}),
  }
}

export interface HiddenGroupsModel {
  hiddenGroups: { size: number }
  showAllGroups: () => void
}

/**
 * The menu's way back from a chip's hide button, beside the topmost chip's
 * "N hidden" button. Spread into a display's "Show" menu, and absent while
 * nothing is hidden: a row reading "Show hidden groups (0)" is a row about a
 * feature most tracks never use.
 */
export function hiddenGroupsItems(model: HiddenGroupsModel) {
  return showHiddenItems(model.hiddenGroups.size, 'group', () => {
    model.showAllGroups()
  })
}

export function showHiddenItems(
  count: number,
  noun: 'group' | SectionNoun,
  show: () => void,
) {
  return (
    count > 0
      ? [
          {
            label: `Show ${count} hidden ${noun}${count > 1 ? 's' : ''}`,
            icon: VisibilityIcon,
            onClick: show,
          },
        ]
      : []
  ) satisfies MenuItem[]
}

/**
 * What the section-order menu reads and writes: the sections drawn, in
 * stacking order and without the hidden ones, and the facet's `sort`, the
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

// The domain pins only what it names, so a move writes the whole drawn order
// or the unpinned sections re-sort under it. The overflow section holds
// whichever values fall past the cap in each region, so it names no value to
// pin and stays last.
function writeSectionMove(
  model: Pick<SectionOrderModel, 'sections' | 'domain' | 'setDomain'>,
  key: string,
  to: number,
) {
  if (key !== OVERFLOW_GROUP_KEY) {
    const keys = model.sections
      .map(s => s.key)
      .filter(k => k !== OVERFLOW_GROUP_KEY)
    model.setDomain(mergeDomain(model.domain, moveSectionTo(keys, key, to)))
  }
}

export function moveSectionOnto(
  model: Pick<SectionOrderModel, 'sections' | 'domain' | 'setDomain'>,
  key: string,
  ontoKey: string,
) {
  const to = model.sections.findIndex(s => s.key === ontoKey)
  if (to >= 0 && key !== ontoKey) {
    writeSectionMove(model, key, to)
  }
}

export function resetSectionOrderItems(
  model: Pick<SectionOrderModel, 'domain' | 'setDomain'> | undefined,
) {
  return model && model.domain.length > 0
    ? [resetOrderItem(model, 'section')]
    : []
}

/**
 * Move up / Move down / Hide for one section, off the order drawn now.
 * `keepMenuOpen`, because moving a section two places is two clicks; the rows'
 * disabled marks update live.
 */
export function sectionMenuItems(
  model: SectionOrderModel,
  key: string,
  noun: SectionNoun,
): MenuItem[] {
  const keys = model.sections.map(s => s.key)
  const i = keys.indexOf(key)
  const write = (to: number) => {
    writeSectionMove(model, key, to)
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

/** @deprecated use sectionMenuItems */
export const sectionRowMenuItems = sectionMenuItems

/** Dead while the domain pins nothing. */
export function resetOrderItem(
  model: Pick<SectionOrderModel, 'domain' | 'setDomain'>,
  noun: SectionNoun,
) {
  return {
    label: `Reset ${noun} order`,
    disabled: model.domain.length === 0,
    onClick: () => {
      model.setDomain([])
    },
  } satisfies MenuItem
}
