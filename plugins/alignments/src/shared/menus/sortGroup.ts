import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SortByTagDialog = lazy(
  () => import('../../LinearAlignmentsDisplay/components/SortByTagDialog.tsx'),
)
const GroupByDialog = lazy(
  () => import('../../LinearAlignmentsDisplay/components/GroupByDialog.tsx'),
)

interface SortByModel {
  setSortedBy: (type: string) => void
  clearSelected: () => void
}

export function getSortByMenuItem(model: SortByModel) {
  return {
    label: 'Sort by...',
    icon: SwapVertIcon,
    subMenu: [
      {
        label: 'Start location',
        onClick: () => {
          model.setSortedBy('position')
        },
      },
      {
        label: 'Read strand',
        onClick: () => {
          model.setSortedBy('strand')
        },
      },
      {
        label: 'Base pair',
        onClick: () => {
          model.setSortedBy('basePair')
        },
      },
      {
        label: 'Sort by tag...',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SortByTagDialog,
            { model, handleClose },
          ])
        },
      },
      {
        label: 'Clear sort',
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
