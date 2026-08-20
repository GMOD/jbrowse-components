import { lazy } from 'react'

import { capitalizeFirst, getSession } from '@jbrowse/core/util'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import {
  GROUP_BY_DIMENSIONS,
  pickGroupByOptions,
} from '../../shared/groupFeatures.ts'
import { isInterbaseType } from '../../shared/types.ts'
import { groupByRadioMenuItem } from './groupByMenu.ts'

import type { SortedBy } from '../../shared/types.ts'
import type { GroupByDialogModel } from '../dialogs/GroupByDialog.tsx'
import type { RadioMenuItem } from '@jbrowse/core/ui'

const SortByTagDialog = lazy(() => import('../dialogs/SortByTagDialog.tsx'))
const GroupByDialog = lazy(() => import('../dialogs/GroupByDialog.tsx'))

interface SortByModel {
  sortedBy?: SortedBy
  setSortedBy: (type: string, tag?: string) => void
  clearSortedBy: () => void
  largeFeaturesFirst: boolean
  setLargeFeaturesFirst: (flag: boolean) => void
}

// One ordering at a time, so a single radio group. Most modes write a `sortedBy`
// type; "Longest reads first" is the `largeFeaturesFirst` layout flag, folded in
// as a peer radio because it competes for the same ordering. "Start location" is
// the unsorted default, so it doubles as the reset — no separate "Clear".
//
// Only the `length` radio clears the other slot here. `setSortSlot` drops
// `largeFeaturesFirst` as it writes `sortedBy`, so a sort that never lands (no
// valid center line, a cancelled tag dialog) leaves the ordering alone instead of
// unchecking every radio.
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

export type SortMode = 'position' | 'strand' | 'basePair' | 'tag' | 'length'

const ALL_SORT_MODES: SortMode[] = [
  'position',
  'length',
  'strand',
  'basePair',
  'tag',
]

function getSortMode(model: SortByModel): SortMode {
  const type = model.sortedBy?.type
  return type === undefined
    ? model.largeFeaturesFirst
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
    disabled?: boolean
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
      model.setLargeFeaturesFirst(false)
      model.clearSortedBy()
    }),
    length: radio('length', `Longest ${noun}s first`, () => {
      model.clearSortedBy()
      model.setLargeFeaturesFirst(true)
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
        getSession(model).queueDialog(handleClose => [
          SortByTagDialog,
          {
            handleClose,
            initialTag: sortTag,
            onSubmit: (tag: string) => {
              model.setSortedBy('tag', tag)
            },
          },
        ])
      },
      false,
    ),
  }
  return {
    label: 'Sort by...',
    type: 'subMenu' as const,
    icon: SwapVertIcon,
    disabled: opts?.disabled,
    disabledHelpText: opts?.disabledHelpText,
    subMenu: modes.map(m => items[m]),
  }
}

// Dimensions this display offers: the non-hidden ones, in registry order. `tag`
// is dropped because it needs a tag name, so it is added back below as a
// dialog-opener rather than a direct select. Chain mode's narrowing is not here —
// `groupByRadioMenuItem` applies it to whatever it is handed, so this display and
// LGVSyntenyDisplay can't answer it differently. Built once, like the synteny
// menu's own list: the registry is a module constant, so a menu open cannot
// produce a different answer.
const GROUP_OPTIONS = pickGroupByOptions(
  ...Object.values(GROUP_BY_DIMENSIONS)
    .filter(d => !d.hidden && d.type !== 'tag')
    .map(d => d.type),
)

// The dialog's surface plus what the radios themselves need. The same node is
// passed on to GroupByDialog, so it has to be a superset.
export type GroupByMenuModel = GroupByDialogModel & {
  isChainMode: boolean
}

// Every offered dimension selects directly except `tag`, which needs a tag name
// (+ optional color-by-tag), so it goes last as a dialog-opener — mirroring the
// sort menu's "Tag...". `groupByRadioMenuItem` resolves which radio is ticked
// against what it was handed, so a stored-but-unoffered dimension ticks "None"
// here without this call site restating the rule.
export function getGroupByMenuItem(model: GroupByMenuModel) {
  const { groupBy } = model
  // Named like the sort and color menus' tag rows once a tag is picked.
  const groupTag = groupBy?.type === 'tag' ? groupBy.tag : undefined
  return groupByRadioMenuItem({
    current: groupBy?.type,
    options: GROUP_OPTIONS,
    isChainMode: model.isChainMode,
    onSelect: type => {
      model.setGroupBy({ type })
    },
    onNone: () => {
      model.setGroupBy(undefined)
    },
    extra: [
      {
        type: 'tag',
        label: groupTag ? `Tag (${groupTag})...` : 'Tag...',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            GroupByDialog,
            { model, handleClose },
          ])
        },
      },
    ],
  })
}
