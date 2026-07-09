import { lazy } from 'react'

import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionWithDeleteTrackConf,
} from '@jbrowse/core/util'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import { isInterbaseType } from '../../shared/types.ts'

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

// The pileup has exactly one ordering at a time, so the sort menu is a single
// radio group. Most modes map to a `sortedBy` type; "Longest reads first" is the
// odd one out — it's a layout-order flag (`largeFeaturesFirst`), mutually
// exclusive with a sort (a sort overrides it), so folding it in as a peer radio
// keeps the group honest. Picking any mode clears whichever mechanism the other
// modes use, so the two config slots never both hold state. "Start location" is
// the default/unsorted order, so it doubles as the reset — no separate "Clear".
//
// A base-pair sort can also be set by a context-menu "sort at position" on a
// specific base/indel/clip; those interbase types keep the "Base pair" radio
// checked (that pileup is still ordered by what's under the center line).

type SortMode = 'position' | 'strand' | 'basePair' | 'tag' | 'length'

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
  opts?: { disabled?: boolean; disabledHelpText?: string },
) {
  const mode = getSortMode(model)
  function setSort(type: string) {
    model.setLargeFeaturesFirst(false)
    model.setSortedBy(type)
  }
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
        checked: mode === 'position',
        onClick: () => {
          model.setLargeFeaturesFirst(false)
          model.clearSortedBy()
        },
      },
      {
        label: 'Read strand',
        type: 'radio' as const,
        checked: mode === 'strand',
        onClick: () => {
          setSort('strand')
        },
      },
      {
        label: 'Base under center line',
        type: 'radio' as const,
        checked: mode === 'basePair',
        onClick: () => {
          setSort('basePair')
        },
      },
      {
        label: 'Tag...',
        type: 'radio' as const,
        checked: mode === 'tag',
        onClick: () => {
          model.setLargeFeaturesFirst(false)
          getSession(model).queueDialog(handleClose => [
            SortByTagDialog,
            { model, handleClose },
          ])
        },
      },
      {
        label: 'Longest reads first',
        type: 'radio' as const,
        checked: mode === 'length',
        onClick: () => {
          model.clearSortedBy()
          model.setLargeFeaturesFirst(true)
        },
      },
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
