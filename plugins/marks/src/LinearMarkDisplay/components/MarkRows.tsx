import { axisGutterLeft, axisGutterWidth } from '@jbrowse/display-ui'
import {
  RowLabelsOverlay,
  TreeSidebar,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { axisDrawn } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { MarkDisplayModel } from './markDisplayTypes.ts'

const AXIS_TO_LABEL_GAP_PX = 4

/**
 * Where the row labels start: past the dendrogram, and past the axis each row
 * repeats where one draws, since a label grows rightward over the plot.
 */
export function rowLabelOffset(
  model: Pick<
    MarkDisplayModel,
    'axes' | 'showTree' | 'hierarchy' | 'treeAreaWidth'
  >,
  exportContentLeft?: number,
) {
  const offset = treeSidebarOffset(model)
  const axis = model.axes.find(axisDrawn)
  return axis
    ? Math.max(
        offset,
        axisGutterLeft(axis, 0, 0, exportContentLeft) +
          axisGutterWidth(axis) +
          AXIS_TO_LABEL_GAP_PX,
      )
    : offset
}

/** The rows' labels and dendrogram, over the plot's rows. */
const MarkRows = observer(function MarkRows({
  model,
  yTop,
  plotHeight,
}: {
  model: MarkDisplayModel
  yTop: number
  plotHeight: number
}) {
  return model.drawsRows ? (
    <>
      <RowLabelsOverlay
        testId="mark-row-labels"
        sources={model.sources}
        rowHeight={model.effectiveRowHeight}
        labelOffset={rowLabelOffset(model)}
        width={model.canvasWidthPx}
        height={plotHeight}
        top={yTop}
        showLabels={model.showRowLabels}
      />
      <TreeSidebar model={model} />
    </>
  ) : null
})

export default MarkRows
