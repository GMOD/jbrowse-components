import { SvgRowLabels } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

interface LabelModel {
  sources: {
    name: string
    label?: string
    rowColor?: string
  }[]
  effectiveRowHeight: number
  drawsRowLabels: boolean
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
  const { sources, effectiveRowHeight, drawsRowLabels } = model
  return drawsRowLabels ? (
    <SvgRowLabels
      sources={sources}
      rowHeight={effectiveRowHeight}
      labelOffset={labelOffset}
      backdrop="wash"
    />
  ) : null
})
