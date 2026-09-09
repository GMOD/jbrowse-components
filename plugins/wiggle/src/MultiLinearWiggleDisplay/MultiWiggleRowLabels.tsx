import { SvgRowLabels } from '@jbrowse/tree-sidebar'
import { AXIS_GUTTER_WIDTH_PX, axisDrawn } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { YAxis } from '@jbrowse/wiggle-core'

const AXIS_TO_LABEL_GAP_PX = 4

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

// Row labels (non-overlay mode), shared by the live MultiWiggleComponent and
// the SVG export so the two can't drift. The per-row axes are the chrome's, off
// `valueScales`, and they take the fixed-width strip at the left of each row:
// a sample name can be arbitrarily long, so the labels start after that strip
// and keep growing rightward over the plot. `labelOffset` is where they would
// start with no axis — past the dendrogram.
export default observer(function MultiWiggleRowLabels({
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
  const axis = model.axes.find(axisDrawn)
  return (
    <SvgRowLabels
      sources={sources}
      rowHeight={effectiveRowHeight}
      labelOffset={
        axis
          ? Math.max(
              labelOffset,
              (axis.left ?? 0) + AXIS_GUTTER_WIDTH_PX + AXIS_TO_LABEL_GAP_PX,
            )
          : labelOffset
      }
    />
  )
})
