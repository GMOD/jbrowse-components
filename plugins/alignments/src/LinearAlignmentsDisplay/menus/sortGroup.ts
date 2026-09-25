import { lazy } from 'react'

import { capitalizeFirst, getDialogHost } from '@jbrowse/core/util'
import { sectionOrderMenuItems } from '@jbrowse/display-kit/groupByMenu'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import { TAG_FIELD_PREFIX, facetTag } from '../../shared/groupByLabels.ts'
import {
  GROUP_BY_DIMENSIONS,
  isReadDimension,
  pickGroupByOptions,
} from '../../shared/groupFeatures.ts'
import { isInterbaseType } from '../../shared/types.ts'
import { groupByRadioMenuItem } from './groupByMenu.ts'

import type { GroupBy, SortedBy } from '../../shared/types.ts'
import type { GroupByDialogModel } from '../dialogs/GroupByDialog.tsx'
import type { RadioMenuItem } from '@jbrowse/core/ui'

const TagDialog = lazy(() => import('../dialogs/TagDialog.tsx'))
const GroupByDialog = lazy(() => import('../dialogs/GroupByDialog.tsx'))

interface SortByModel {
  sortedBy?: SortedBy
  setSortedBy: (type: string, tag?: string) => void
  largeFeaturesFirst: boolean
  splicedReadsFirst: boolean
  setLayoutOrder: (order: LayoutOrder) => void
}

// One ordering at a time, so a single radio group. Most modes write a `sortedBy`
// type; "Longest reads first" and "Spliced reads first" are the
// `largeFeaturesFirst` / `splicedReadsFirst` layout flags, folded in as peer
// radios because they compete for the same ordering. "Start location" is the
// unsorted default, so it doubles as the reset — no separate "Clear".
//
// The three non-slot orderings go through `setLayoutOrder`, one write for the
// whole radio group. `setSortedByAtPosition` drops both flags as it writes `sortedBy`, so
// a sort that never lands (no valid center line, a cancelled tag dialog) leaves
// the ordering alone instead of unchecking every radio.
//
// Strand / base pair / tag anchor on the center-line column, which `setSortedBy`
// reveals when applied. Interbase types from the context menu's "sort at
// position" keep "Base pair" checked.
//
// Callers pick the applicable modes and the label noun (like pickColorOptions):
// alignments takes every mode with 'read'; LGVSyntenyDisplay drops base pair /
// tag — a PAF block has neither per-base sequence nor SAM tags — and uses
// 'feature'. The noun is held lower-case because it also lands mid-label
// ("Longest reads first"); rows that lead with it capitalize through
// `capitalizeFirst`.

// The orderings held as layout flags rather than a `sortedBy` slot, and so the
// argument `setLayoutOrder` takes.
export type LayoutOrder = 'position' | 'length' | 'spliced'

export type SortMode = LayoutOrder | 'strand' | 'basePair' | 'tag'

const ALL_SORT_MODES: SortMode[] = [
  'position',
  'length',
  'spliced',
  'strand',
  'basePair',
  'tag',
]

// Spliced-first outranks largest-first in the layout too, so a config setting
// both reads as the one that takes effect.
function getSortMode(model: SortByModel): SortMode {
  const type = model.sortedBy?.type
  return type === undefined
    ? model.splicedReadsFirst
      ? 'spliced'
      : model.largeFeaturesFirst
        ? 'length'
        : 'position'
    : type === 'strand' || type === 'tag'
      ? type
      : type === 'basePair' || isInterbaseType(type)
        ? 'basePair'
        : 'position'
}

export function getSortByMenuItem(
  model: SortByModel,
  opts?: {
    noun?: string
    modes?: SortMode[]
    // Why an ordering can't take effect, or absent when it can — the gate is
    // derived from it rather than passed alongside, so the menu cannot grey out
    // without naming the switch that brings it back. LGVSyntenyDisplay passes
    // nothing: its ordering is always live.
    disabledHelpText?: string
  },
) {
  const noun = opts?.noun ?? 'read'
  const modes = opts?.modes ?? ALL_SORT_MODES
  // A stored ordering this menu doesn't offer — a base-pair or tag sort saved
  // against a display that later curated them away (LGVSyntenyDisplay) — falls
  // back to the unsorted default rather than leaving every radio blank, the same
  // rule `checkedType` applies to the group-by radios.
  const stored = getSortMode(model)
  const mode = modes.includes(stored) ? stored : 'position'
  // Name the tag once one is picked ("Tag (HP)..."), like the color menu's tag
  // radio: tag is the only mode whose choice has a parameter, and it was
  // otherwise invisible without reopening the dialog.
  const sortTag =
    model.sortedBy?.type === 'tag' ? model.sortedBy.tag : undefined
  // Rows that only write an ordering keep the menu open by their radio type;
  // `tag` opens a dialog, so it passes false — the one asymmetry in the group,
  // and the only thing spelled out per row.
  const radio = (
    m: SortMode,
    label: string,
    onClick: () => void,
    keepMenuOpen?: boolean,
  ): RadioMenuItem => ({
    label,
    type: 'radio',
    checked: mode === m,
    keepMenuOpen,
    onClick,
  })
  const items: Record<SortMode, RadioMenuItem> = {
    position: radio('position', 'Start location', () => {
      model.setLayoutOrder('position')
    }),
    length: radio('length', `Longest ${noun}s first`, () => {
      model.setLayoutOrder('length')
    }),
    spliced: radio('spliced', `Spliced ${noun}s first`, () => {
      model.setLayoutOrder('spliced')
    }),
    strand: radio('strand', `${capitalizeFirst(noun)} strand`, () => {
      model.setSortedBy('strand')
    }),
    basePair: radio('basePair', 'Base pair', () => {
      model.setSortedBy('basePair')
    }),
    tag: radio(
      'tag',
      sortTag ? `Tag (${sortTag})...` : 'Tag...',
      () => {
        queueSortByTagDialog(model, sortTag, tag => {
          model.setSortedBy('tag', tag)
        })
      },
      false,
    ),
  }
  return {
    label: 'Sort by...',
    type: 'subMenu' as const,
    icon: SwapVertIcon,
    disabled: opts?.disabledHelpText !== undefined,
    disabledHelpText: opts?.disabledHelpText,
    subMenu: modes.map(m => items[m]),
  }
}

// Dimensions this display offers: the non-hidden ones, in registry order. A tag
// is added below as a dialog-opener rather than a direct select. Chain mode's
// narrowing is not here — `groupByRadioMenuItem` applies it to whatever it is
// handed, so this display and LGVSyntenyDisplay can't answer it differently.
// Built once, like the synteny menu's own list: the registry is a module
// constant, so a menu open cannot produce a different answer.
const GROUP_OPTIONS = pickGroupByOptions(
  ...Object.values(GROUP_BY_DIMENSIONS).flatMap(d =>
    d.hidden ? [] : [d.field],
  ),
)

// The dialog's surface plus what the radios themselves need. The same node is
// passed on to GroupByDialog, so it has to be a superset.
export interface GroupByMenuModel extends GroupByDialogModel {
  isChainMode: boolean
}

export interface SectionOrderMenuModel {
  effectiveFacet: GroupBy | undefined
  groupOrder: readonly { key: string; label: string }[]
  setFacet: (facet?: GroupBy) => void
  hideGroup: (key: string) => void
}

// The sort-by-tag dialog both sort surfaces open: the track menu sorts at the
// center line, the read's right-click menu at the clicked column.
export function queueSortByTagDialog(
  host: Parameters<typeof getDialogHost>[0],
  initialTag: string | undefined,
  sort: (tag: string) => void,
) {
  getDialogHost(host).queueDialog(handleClose => [
    TagDialog,
    {
      title: 'Sort by tag',
      prompt: 'Pick or enter a tag to sort by',
      initialTag,
      onSubmit: sort,
      handleClose,
    },
  ])
}

// The Sections submenu is the runtime half of `facet.domain`: a move writes
// the facet back with the drawn order as its domain, which refetches nothing,
// since the worker is sent no domain. Absent while chain mode degrades the
// facet to one section.
export function getSectionOrderMenuItems(model: SectionOrderMenuModel) {
  const facet = model.effectiveFacet
  return facet
    ? sectionOrderMenuItems({
        sections: model.groupOrder,
        domain: facet.domain ?? [],
        setDomain: domain => {
          model.setFacet({ ...facet, domain })
        },
        hideGroup: model.hideGroup,
      })
    : []
}

// Every offered dimension selects directly; a tag needs its name (+ optional
// color-by-tag), so it goes last as a dialog-opener — mirroring the sort menu's
// "Tag...". Its radio is the tag prefix, which no field can equal. A field
// written in config that no radio names gets a checked, disabled radio of its
// own, so the menu never ticks "None" over a grouped track.
export function getGroupByMenuItem(model: GroupByMenuModel) {
  const field = model.facet?.field
  const tag = facetTag(field)
  const other =
    field !== undefined && tag === undefined && !isReadDimension(field)
      ? field
      : undefined
  return groupByRadioMenuItem({
    current: tag === undefined ? field : TAG_FIELD_PREFIX,
    options: GROUP_OPTIONS,
    isChainMode: model.isChainMode,
    onSelect: field => {
      model.setFacet({ field })
    },
    onNone: () => {
      model.setFacet(undefined)
    },
    extra: [
      {
        type: TAG_FIELD_PREFIX,
        label: tag ? `Tag (${tag})...` : 'Tag...',
        onClick: () => {
          getDialogHost(model).queueDialog(handleClose => [
            GroupByDialog,
            { model, handleClose },
          ])
        },
      },
      ...(other === undefined
        ? []
        : [
            {
              type: other,
              label: other,
              disabledHelpText: "Set in the track's config",
            },
          ]),
    ],
  })
}
