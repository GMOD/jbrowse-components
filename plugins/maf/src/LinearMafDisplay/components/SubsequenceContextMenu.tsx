import { ContextMenu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { openSubsequenceWidget } from '../openSubsequenceWidget.ts'
import { rowSpanAtY } from './mafHitTest.ts'
import {
  mafSyntenyLaunchItems,
  sampleNavigationItems,
  selectedRowTargets,
} from './sampleNavigationItems.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { RowTargets } from './sampleNavigationItems.ts'
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
function rowTargetItems(model: LinearMafDisplayModel, targets: RowTargets) {
  const session = getSession(model)
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
  const { samples } = model
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
            openRows(samples.slice(startRow, endRow))
          },
        },
        ...(contextCoord
          ? rowTargetItems(model, selectedRowTargets(model, contextCoord))
          : []),
      ]}
    />
  )
})

export default SubsequenceContextMenu
