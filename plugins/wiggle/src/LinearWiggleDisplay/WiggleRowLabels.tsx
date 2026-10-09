import { SvgRowLabels } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

interface LabelModel {
  sources: {
    name: string
    label?: string
    rowColor?: string
  }[]
  isOverlay: boolean
  effectiveRowHeight: number
  numSources: number
  showRowLabels: boolean
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
  const { sources, isOverlay, effectiveRowHeight, numSources, showRowLabels } =
    model
  if (numSources <= 1 || isOverlay || !showRowLabels) {
    return null
  }
  return (
    <SvgRowLabels
      sources={sources}
      rowHeight={effectiveRowHeight}
      labelOffset={labelOffset}
      backdrop="wash"
    />
  )
})
