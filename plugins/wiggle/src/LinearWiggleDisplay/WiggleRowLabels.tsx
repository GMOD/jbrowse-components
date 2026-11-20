import { SvgRowColumnLabels, SvgRowLabels } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import type { LabelledRow, RowAnnotationColumn } from '@jbrowse/tree-sidebar'

interface LabelModel {
  labelledRows: LabelledRow[]
  effectiveRowHeight: number
  drawsRowLabels: boolean
  rowAnnotationColors: readonly RowAnnotationColumn[]
  rowColumnLabels: readonly string[]
  rowSubtitles: ReadonlyMap<string, string>
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
  const {
    labelledRows,
    effectiveRowHeight,
    drawsRowLabels,
    rowAnnotationColors,
  } = model
  return drawsRowLabels ? (
    <>
      <SvgRowLabels
        rows={labelledRows}
        rowHeight={effectiveRowHeight}
        labelOffset={labelOffset}
        backdrop="wash"
        annotations={rowAnnotationColors}
        subtitles={model.rowSubtitles}
        columnLabels={model.rowColumnLabels}
      />
      <SvgRowColumnLabels
        labels={model.rowColumnLabels}
        rows={labelledRows}
        rowHeight={effectiveRowHeight}
        labelOffset={labelOffset}
        annotations={rowAnnotationColors}
      />
    </>
  ) : null
})
