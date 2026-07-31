import React from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { openSubsequenceWidget } from '../openSubsequenceWidget.ts'
import { rowSpanAtY } from './mafHitTest.ts'
import { sampleNavigationItems } from './sampleNavigationItems.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { ContextCoord } from './useDragSelection.ts'

/**
 * Right-click menu shown after the user finishes a drag-selection on the MAF
 * canvas. "All rows" opens the subsequence widget for every visible sample;
 * "selected rows" narrows it to the rows the drag rectangle vertically covers
 * (via the shared `rowSpanAtY`, so the selection lands on the same rows the
 * hover hit-test would report).
 */
const SubsequenceContextMenu = observer(function SubsequenceContextMenu({
  model,
  contextCoord,
  setContextCoord,
}: {
  model: LinearMafDisplayModel
  contextCoord: ContextCoord | undefined
  setContextCoord: (c: ContextCoord | undefined) => void
}) {
  const theme = useTheme()
  const { samples } = model
  const openRows = (rows: typeof samples) => {
    if (contextCoord && rows) {
      openSubsequenceWidget(
        getSession(model),
        model,
        model.lgv,
        contextCoord.startX,
        contextCoord.endX,
        rows,
      )
    }
    setContextCoord(undefined)
  }
  return (
    <Menu
      open={Boolean(contextCoord)}
      onMenuItemClick={callback => {
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
            openRows(samples)
          },
        },
        {
          label: 'View subsequences (selected rows)',
          onClick: () => {
            const { startRow, endRow } = contextCoord
              ? rowSpanAtY(model, contextCoord.startY, contextCoord.endY)
              : { startRow: 0, endRow: 0 }
            openRows(samples?.slice(startRow, endRow))
          },
        },
        ...(contextCoord
          ? sampleNavigationItems(getSession(model), model, contextCoord)
          : []),
      ]}
    />
  )
})

export default SubsequenceContextMenu
