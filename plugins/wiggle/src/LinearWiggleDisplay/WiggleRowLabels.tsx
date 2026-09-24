import { SvgRowLabels } from '@jbrowse/tree-sidebar'
import { rowLabelOffset } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { YAxis } from '@jbrowse/wiggle-core'

interface LabelModel {
  sources: {
    name: string
    label?: string
    color?: string
    labelColor?: string
    group?: string
  }[]
  isOverlay: boolean
  effectiveRowHeight: number
  numSources: number
  showRowLabels: boolean
  axes: YAxis[]
}

// Row labels (non-overlay mode), shared by the live WiggleComponent and the SVG
// export so the two can't drift. `labelOffset` is where they start with no
// axis, past the dendrogram.
export default observer(function WiggleRowLabels({
  model,
  labelOffset,
  exportContentLeft,
}: {
  model: LabelModel
  labelOffset: number
  exportContentLeft?: number
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
      labelOffset={rowLabelOffset(model.axes, labelOffset, exportContentLeft)}
    />
  )
})
