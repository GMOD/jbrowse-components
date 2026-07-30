import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import {
  GROUP_BY_DIMENSIONS,
  pickGroupByOptions,
} from '../../shared/groupFeatures.ts'
import { isInterbaseType } from '../../shared/types.ts'
import { groupByRadioMenuItem } from './groupByMenu.ts'
import { capitalizeFirst } from './menuHelpers.ts'

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
// 'feature'.

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
  if (type === undefined) {
    return model.largeFeaturesFirst ? 'length' : 'position'
  }
  return type === 'strand' || type === 'tag'
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
  const mode = getSortMode(model)
  const items: Record<SortMode, RadioMenuItem> = {
    position: {
      label: 'Start location',
      type: 'radio',
      checked: mode === 'position',
      keepMenuOpen: true,
      onClick: () => {
        model.setLargeFeaturesFirst(false)
        model.clearSortedBy()
      },
    },
    length: {
      label: `Longest ${noun}s first`,
      type: 'radio',
      checked: mode === 'length',
      keepMenuOpen: true,
      onClick: () => {
        model.clearSortedBy()
        model.setLargeFeaturesFirst(true)
      },
    },
    strand: {
      label: `${capitalizeFirst(noun)} strand`,
      type: 'radio',
      checked: mode === 'strand',
      keepMenuOpen: true,
      onClick: () => {
        model.setSortedBy('strand')
      },
    },
    basePair: {
      label: 'Base pair',
      type: 'radio',
      checked: mode === 'basePair',
      keepMenuOpen: true,
      onClick: () => {
        model.setSortedBy('basePair')
      },
    },
    // Opens a dialog for the tag name, so this one closes the menu.
    tag: {
      label: 'Tag...',
      type: 'radio',
      checked: mode === 'tag',
      onClick: () => {
        getSession(model).queueDialog(handleClose => [
          SortByTagDialog,
          {
            handleClose,
            onSubmit: (tag: string) => {
              model.setSortedBy('tag', tag)
            },
          },
        ])
      },
    },
  }
  return {
    label: 'Sort by...',
    type: 'subMenu' as const,
    icon: SwapVertIcon,
    disabled: opts?.disabled,
    disabledHelpText: opts?.disabledHelpText,
    subMenu: (opts?.modes ?? ALL_SORT_MODES).map(m => items[m]),
  }
}

// Dimensions this display offers: non-hidden ones in registry order, and in chain
// mode only the chain-consistent ones (every read of a chain shares one key),
// matching the worker guard (`groupByForMode`). `tag` is dropped because it needs
// a tag name, so it is added back below as a dialog-opener rather than a direct
// select.
function offeredGroupByTypes(isChainMode: boolean) {
  return Object.values(GROUP_BY_DIMENSIONS)
    .filter(
      d => !d.hidden && d.type !== 'tag' && (!isChainMode || d.chainConsistent),
    )
    .map(d => d.type)
}

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
  return groupByRadioMenuItem({
    current: model.groupBy?.type,
    options: pickGroupByOptions(...offeredGroupByTypes(model.isChainMode)),
    onSelect: type => {
      model.setGroupBy({ type })
    },
    onNone: () => {
      model.setGroupBy(undefined)
    },
    extra: [
      {
        type: 'tag',
        label: 'Tag...',
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
