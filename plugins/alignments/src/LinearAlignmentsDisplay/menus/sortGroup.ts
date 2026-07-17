import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import { groupByRadioMenuItem } from './groupByMenu.ts'
import { GROUP_BY_DIMENSIONS } from '../../shared/groupFeatures.ts'
import { isInterbaseType } from '../../shared/types.ts'

import type { SortedBy } from '../../shared/types.ts'
import type { GroupByModel } from '../dialogs/GroupByDialog.tsx'
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

// The pileup has exactly one ordering at a time, so the sort menu is a single
// radio group. Most modes map to a `sortedBy` type; "Longest reads first" is the
// odd one out — it's a layout-order flag (`largeFeaturesFirst`), mutually
// exclusive with a sort (a sort overrides it), so folding it in as a peer radio
// keeps the group honest. Picking any mode clears whichever mechanism the other
// modes use, so the two config slots never both hold state. "Start location" is
// the default/unsorted order, so it doubles as the reset — no separate "Clear".
//
// Strand / base pair / tag all anchor on the read column under the view's center
// line, so `setSortedBy` reveals the center line when applied (the label doesn't
// need to spell out the mechanic). A base-pair sort can also come from a
// context-menu "sort at position"; those interbase types keep "Base pair"
// checked.
//
// Callers pick which modes apply to their data and the noun the labels read in
// (like pickColorOptions for the color menu): a plain alignments pileup takes
// every mode with noun 'read'; LGVSyntenyDisplay drops base pair / tag — PAF
// blocks carry neither per-base sequence nor SAM tags — and reads 'feature'.

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
  function setSort(type: string) {
    model.setLargeFeaturesFirst(false)
    model.setSortedBy(type)
  }
  const items: Record<SortMode, RadioMenuItem> = {
    position: {
      label: 'Start location',
      type: 'radio',
      checked: mode === 'position',
      onClick: () => {
        model.setLargeFeaturesFirst(false)
        model.clearSortedBy()
      },
    },
    length: {
      label: `Longest ${noun}s first`,
      type: 'radio',
      checked: mode === 'length',
      onClick: () => {
        model.clearSortedBy()
        model.setLargeFeaturesFirst(true)
      },
    },
    strand: {
      label: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} strand`,
      type: 'radio',
      checked: mode === 'strand',
      onClick: () => {
        setSort('strand')
      },
    },
    basePair: {
      label: 'Base pair',
      type: 'radio',
      checked: mode === 'basePair',
      onClick: () => {
        setSort('basePair')
      },
    },
    tag: {
      label: 'Tag...',
      type: 'radio',
      checked: mode === 'tag',
      onClick: () => {
        model.setLargeFeaturesFirst(false)
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

// Non-hidden dimensions in registry order; chain mode keeps only the
// chain-consistent ones (every read of a chain shares one key), matching the
// worker guard. Every dimension selects directly except `tag`, which needs a tag
// name (+ optional color-by-tag), so it goes last as a dialog-opener — mirroring
// the sort menu's "Tag...". A stored dimension no longer offered (an old per-read
// grouping now in chain mode, degraded to ungrouped in the worker) checks "None"
// rather than leaving the group blank.
export function getGroupByMenuItem(model: GroupByModel) {
  const dims = Object.values(GROUP_BY_DIMENSIONS).filter(
    d => !d.hidden && (!model.isChainMode || d.chainConsistent),
  )
  const stored = model.groupBy?.type
  return groupByRadioMenuItem({
    current: stored && dims.some(d => d.type === stored) ? stored : undefined,
    options: dims.filter(d => d.type !== 'tag'),
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
