import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

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

export function getGroupByMenuItem(model: GroupByModel) {
  return {
    label: 'Group by...',
    type: 'subMenu' as const,
    icon: WorkspacesIcon,
    subMenu: [
      {
        label: 'Group by...',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            GroupByDialog,
            { model, handleClose },
          ])
        },
      },
      {
        label: 'Ungroup (this track)',
        disabled: !model.groupBy,
        onClick: () => {
          model.setGroupBy(undefined)
        },
      },
    ],
  }
}
