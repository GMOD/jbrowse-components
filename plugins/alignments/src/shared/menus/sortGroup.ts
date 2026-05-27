import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import type { SortedBy } from '../types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SortByTagDialog = lazy(
  () => import('../../LinearAlignmentsDisplay/components/SortByTagDialog.tsx'),
)
const GroupByDialog = lazy(
  () => import('../../LinearAlignmentsDisplay/components/GroupByDialog.tsx'),
)

interface SortByModel {
  sortedBy?: SortedBy
  setSortedBy: (type: string) => void
  clearSelected: () => void
}

export function getSortByMenuItem(model: SortByModel) {
  const sortType = model.sortedBy?.type
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
        label: 'Base pair',
        type: 'radio' as const,
        checked: sortType === 'basePair',
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
      { type: 'divider' as const },
      {
        label: 'Clear sort',
        disabled: !model.sortedBy,
        onClick: () => {
          model.clearSelected()
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
