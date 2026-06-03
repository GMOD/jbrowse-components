import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import type { SortedBy } from '../../shared/types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SortByTagDialog = lazy(() => import('../dialogs/SortByTagDialog.tsx'))
const GroupByDialog = lazy(() => import('../dialogs/GroupByDialog.tsx'))

interface SortByModel {
  sortedBy?: SortedBy
  setSortedBy: (type: string, tag?: string) => void
  clearSortedBy: () => void
}

// Keys double as the membership set for the "Base pair" radio: a sort on any of
// these (basePair set by clicking the radio, or insertion/softclip/hardclip set
// by a context-menu "sort at position") keeps the radio checked and surfaces the
// active type in its label so users see what's active and know how to clear it.
const INTERBASE_SORT_LABEL: Record<string, string> = {
  basePair: 'Base pair',
  insertion: 'Insertion',
  softclip: 'Soft clip',
  hardclip: 'Hard clip',
}

export function getSortByMenuItem(model: SortByModel) {
  const sortType = model.sortedBy?.type
  const activeLabel = sortType ? INTERBASE_SORT_LABEL[sortType] : undefined
  const interbaseLabel = activeLabel
    ? `${activeLabel} at position`
    : 'Base pair'
  return {
    label: 'Sort by...',
    icon: SwapVertIcon,
    subMenu: [
      {
        label: 'Start location',
        type: 'radio' as const,
        checked: sortType === 'position',
        onClick: () => {
          model.setSortedBy('position')
        },
      },
      {
        label: 'Read strand',
        type: 'radio' as const,
        checked: sortType === 'strand',
        onClick: () => {
          model.setSortedBy('strand')
        },
      },
      {
        label: interbaseLabel,
        type: 'radio' as const,
        checked: !!activeLabel,
        subLabel:
          'tip: right-click a base / indel / clip to sort at that position',
        onClick: () => {
          model.setSortedBy('basePair')
        },
      },
      {
        label: 'Sort by tag...',
        type: 'radio' as const,
        checked: sortType === 'tag',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SortByTagDialog,
            { model, handleClose },
          ])
        },
      },
      {
        label: 'Clear sort',
        disabled: !model.sortedBy,
        onClick: () => {
          model.clearSortedBy()
        },
      },
    ],
  }
}

export function getGroupByMenuItem(model: IAnyStateTreeNode) {
  return {
    label: 'Group by...',
    icon: WorkspacesIcon,
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        GroupByDialog,
        { model, handleClose },
      ])
    },
  }
}
