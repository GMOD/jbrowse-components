import { lazy } from 'react'

import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionWithDeleteTrackConf,
} from '@jbrowse/core/util'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import { checkboxItem } from './menuHelpers.ts'

import type { SortedBy } from '../../shared/types.ts'
import type { GroupByModel } from '../dialogs/GroupByDialog.tsx'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const SortByTagDialog = lazy(() => import('../dialogs/SortByTagDialog.tsx'))
const GroupByDialog = lazy(() => import('../dialogs/GroupByDialog.tsx'))

interface SortByModel {
  sortedBy?: SortedBy
  setSortedBy: (type: string, tag?: string) => void
  clearSortedBy: () => void
  largeFeaturesFirst: boolean
  setLargeFeaturesFirst: (flag: boolean) => void
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

export function getSortByMenuItem(
  model: SortByModel,
  opts?: { disabled?: boolean; disabledHelpText?: string },
) {
  const sortType = model.sortedBy?.type
  const activeLabel = sortType ? INTERBASE_SORT_LABEL[sortType] : undefined
  const interbaseLabel = activeLabel
    ? `${activeLabel} at position`
    : 'Base pair'
  return {
    label: 'Sort by...',
    type: 'subMenu' as const,
    icon: SwapVertIcon,
    disabled: opts?.disabled,
    disabledHelpText: opts?.disabledHelpText,
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
      checkboxItem(
        'Lay out large features first',
        model.largeFeaturesFirst,
        () => {
          model.setLargeFeaturesFirst(!model.largeFeaturesFirst)
        },
        {
          helpText:
            'Place the widest features in the lowest rows instead of by ' +
            'genomic start (ignored while a position sort is active)',
          disabled: !!model.sortedBy,
        },
      ),
    ],
  }
}

// Older sessions' "split into separate tracks" group-by created session tracks
// named `${parentId}-<label>-sessionTrack`; this finds them again so they can
// still be cleaned up (the dialog now only does in-track stacked grouping).
function getGroupChildTrackConfs(model: IAnyStateTreeNode) {
  const parentId = getContainingTrack(model).configuration.trackId
  const prefix = `${parentId}-`
  return (getSession(model).sessionTracks ?? []).filter(
    t =>
      t.trackId !== parentId &&
      t.trackId.startsWith(prefix) &&
      t.trackId.endsWith('-sessionTrack'),
  )
}

function removeGroupTracks(model: IAnyStateTreeNode) {
  const session = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  if (isSessionWithDeleteTrackConf(session)) {
    for (const conf of getGroupChildTrackConfs(model)) {
      view.hideTrack(conf.trackId)
      session.deleteTrackConf(conf)
    }
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
      {
        label: 'Remove grouped tracks',
        disabled: getGroupChildTrackConfs(model).length === 0,
        onClick: () => {
          removeGroupTracks(model)
        },
      },
    ],
  }
}
