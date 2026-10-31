import { ContextMenu } from '@jbrowse/core/ui'
import { getEnv, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { openSubsequenceWidget } from '../openSubsequenceWidget.ts'
import { ZOOM_IN_FOR_BAND, zoomGatedItem } from '../trackMenuItems.ts'
import { rowSpanAtY } from './mafHitTest.ts'
import {
  mafSyntenyLaunchItems,
  sampleNavigationItems,
  selectedRowTargets,
} from './sampleNavigationItems.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { ContextCoord } from './useDragSelection.ts'

function rowTargetItems(
  model: LinearMafDisplayModel,
  contextCoord: ContextCoord,
) {
  const session = getSession(model)
  const { pluginManager } = getEnv(model)
  const targets = selectedRowTargets(session, model, contextCoord)
  return [
    ...sampleNavigationItems(session, model, targets, pluginManager),
    ...mafSyntenyLaunchItems(session, model, targets, pluginManager),
  ]
}

/**
 * Right-click menu after a drag-selection on the MAF canvas: submenus so each
 * destination is one row however many species the drag covers. "Selected rows"
 * narrows to the rows the rectangle vertically covers, via `rowSpanAtY`,
 * matching the hover hit test.
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
  const { sources, clusterableSources, coarseTierActive } = model
  // Both entries need the per-base alignment, so both are off past the summary
  // tier's floor, like the track menu's subsequence entry.
  const zoomHint = coarseTierActive ? ZOOM_IN_FOR_BAND : undefined
  const { startRow, endRow } = contextCoord
    ? rowSpanAtY(model, contextCoord.startY, contextCoord.endY)
    : { startRow: 0, endRow: 0 }
  const selectedRows = sources.slice(startRow, endRow)
  const openRows = (rows: typeof sources) => {
    if (contextCoord) {
      openSubsequenceWidget(
        getSession(model),
        model,
        model.view,
        contextCoord.startX,
        contextCoord.endX,
        rows,
      )
    }
  }
  return (
    <ContextMenu
      anchor={contextCoord?.anchor}
      onClose={() => {
        setContextCoord(undefined)
      }}
      menuItems={[
        {
          label: 'View subsequences',
          subMenu: [
            zoomGatedItem(
              {
                label: 'All rows',
                onClick: () => {
                  openRows(clusterableSources)
                },
              },
              zoomHint,
            ),
            zoomGatedItem(
              {
                label: 'Selected rows',
                onClick: () => {
                  openRows(selectedRows)
                },
              },
              zoomHint ??
                (selectedRows.length
                  ? undefined
                  : 'the selection covers no row'),
            ),
          ],
        },
        ...(contextCoord ? rowTargetItems(model, contextCoord) : []),
      ]}
    />
  )
})

export default SubsequenceContextMenu
