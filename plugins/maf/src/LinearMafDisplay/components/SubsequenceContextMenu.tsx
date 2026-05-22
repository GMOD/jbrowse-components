import React from 'react'

import { Menu } from '@jbrowse/core/ui'
import { useTheme } from '@mui/material'

import { openSubsequenceWidget } from '../openSubsequenceWidget.ts'

import type { ContextCoord } from './useDragSelection.ts'
import type { Sample } from '../../types.ts'
import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Right-click menu shown after the user finishes a drag-selection on the MAF
 * canvas. "All rows" opens the subsequence widget for every visible sample;
 * "selected rows" narrows it to the rows the drag rectangle vertically
 * covers.
 */
export default function SubsequenceContextMenu({
  session,
  model,
  view,
  samples,
  rowHeight,
  scrollTop,
  contextCoord,
  setContextCoord,
}: {
  session: AbstractSessionModel
  model: LinearMafDisplayModel
  view: LinearGenomeViewModel
  samples: Sample[] | undefined
  rowHeight: number
  scrollTop: number
  contextCoord: ContextCoord | undefined
  setContextCoord: (c: ContextCoord | undefined) => void
}) {
  const theme = useTheme()
  return (
    <Menu
      open={Boolean(contextCoord)}
      onMenuItemClick={(_, callback) => {
        callback()
        setContextCoord(undefined)
      }}
      onClose={() => {
        setContextCoord(undefined)
      }}
      slotProps={{
        transition: {
          onExit: () => {
            setContextCoord(undefined)
          },
        },
      }}
      anchorReference="anchorPosition"
      anchorPosition={
        contextCoord
          ? { top: contextCoord.coord[1], left: contextCoord.coord[0] }
          : undefined
      }
      style={{ zIndex: theme.zIndex.tooltip }}
      menuItems={[
        {
          label: 'View subsequences (all rows)',
          onClick: () => {
            if (contextCoord && samples) {
              openSubsequenceWidget(
                session,
                model,
                view,
                contextCoord.startX,
                contextCoord.endX,
                samples,
              )
            }
            setContextCoord(undefined)
          },
        },
        {
          label: 'View subsequences (selected rows)',
          onClick: () => {
            if (contextCoord && samples) {
              const minY = Math.min(contextCoord.startY, contextCoord.endY)
              const maxY = Math.max(contextCoord.startY, contextCoord.endY)
              const startRow = Math.floor((minY + scrollTop) / rowHeight)
              const endRow = Math.ceil((maxY + scrollTop) / rowHeight)
              openSubsequenceWidget(
                session,
                model,
                view,
                contextCoord.startX,
                contextCoord.endX,
                samples.slice(startRow, endRow),
              )
            }
            setContextCoord(undefined)
          },
        },
      ]}
    />
  )
}
