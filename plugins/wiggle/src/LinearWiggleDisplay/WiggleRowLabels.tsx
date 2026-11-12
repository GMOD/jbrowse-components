import { SvgRowColumnLabels, SvgRowLabels } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import type { RowAnnotationColumn } from '@jbrowse/tree-sidebar'

interface LabelModel {
  drawnRows: {
    name: string
    label?: string
    rowColor?: string
  }[]
  effectiveRowHeight: number
  drawsRowLabels: boolean
  rowAnnotationColors: readonly RowAnnotationColumn[]
  rowColumnLabels: readonly string[]
}

// Row labels (non-overlay mode) for the live WiggleComponent, starting past the
// dendrogram at `labelOffset`; the axis sits past them.
export default observer(function WiggleRowLabels({
  model,
  labelOffset,
}: {
  model: LabelModel
  labelOffset: number
}) {
  const { drawnRows, effectiveRowHeight, drawsRowLabels, rowAnnotationColors } =
    model
  return drawsRowLabels ? (
    <>
      <SvgRowLabels
        rows={drawnRows}
        rowHeight={effectiveRowHeight}
        labelOffset={labelOffset}
        backdrop="wash"
        annotations={rowAnnotationColors}
      />
      <SvgRowColumnLabels
        labels={model.rowColumnLabels}
        rows={drawnRows}
        rowHeight={effectiveRowHeight}
        labelOffset={labelOffset}
        annotations={rowAnnotationColors}
      />
    </>
  ) : null
})
