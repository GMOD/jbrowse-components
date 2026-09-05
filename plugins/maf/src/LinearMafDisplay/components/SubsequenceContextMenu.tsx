import { ContextMenu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
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

/**
 * Right-click menu shown after the user finishes a drag-selection on the MAF
 * canvas. "All rows" opens the subsequence widget for every visible sample;
 * "selected rows" narrows it to the rows the drag rectangle vertically covers
 * (via the shared `rowSpanAtY`, so the selection lands on the same rows the
 * hover hit-test would report).
 */
// The two lists the selection's rows lead to, built from one pass over them
// rather than one each: the same pair the track menu offers over the visible
// region.
function rowTargetItems(
  model: LinearMafDisplayModel,
  contextCoord: ContextCoord,
) {
  const session = getSession(model)
  const targets = selectedRowTargets(session, model, contextCoord)
  return [
    ...sampleNavigationItems(session, model, targets),
    ...mafSyntenyLaunchItems(session, model, targets),
  ]
}

const SubsequenceContextMenu = observer(function SubsequenceContextMenu({
  model,
  contextCoord,
  setContextCoord,
}: {
  model: LinearMafDisplayModel
  contextCoord: ContextCoord | undefined
  setContextCoord: (c: ContextCoord | undefined) => void
}) {
  const { samples, showSummary } = model
  // Both entries reach the per-base alignment the summary tier exists not to
  // download, so both are off past its floor — the same override the track
  // menu's own subsequence entry and the two band toggles carry.
  const zoomHint = showSummary ? ZOOM_IN_FOR_BAND : undefined
  const openRows = (rows: typeof samples) => {
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
        zoomGatedItem(
          {
            label: 'View subsequences (all rows)',
            onClick: () => {
              openRows(samples)
            },
          },
          zoomHint,
        ),
        zoomGatedItem(
          {
            label: 'View subsequences (selected rows)',
            onClick: () => {
              const { startRow, endRow } = contextCoord
                ? rowSpanAtY(model, contextCoord.startY, contextCoord.endY)
                : { startRow: 0, endRow: 0 }
              openRows(samples.slice(startRow, endRow))
            },
          },
          zoomHint,
        ),
        ...(contextCoord ? rowTargetItems(model, contextCoord) : []),
      ]}
    />
  )
})

export default SubsequenceContextMenu
