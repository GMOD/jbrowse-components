import { AXIS_GUTTER_WIDTH_PX, axisGutterLeft } from '@jbrowse/display-ui'
import { SvgRowLabels } from '@jbrowse/tree-sidebar'
import { axisDrawn } from '@jbrowse/wiggle-core'
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

// Row labels (non-overlay mode), shared by the live WiggleComponent and
// the SVG export so the two can't drift. The per-row axes are the chrome's, off
// `valueScales`, and they take the fixed-width strip at the left of each row:
// a sample name can be arbitrarily long, so the labels start after that strip
// and keep growing rightward over the plot. `labelOffset` is where they would
// start with no axis — past the dendrogram. `exportContentLeft` is the export
// shell's, which moves an axis nothing pushes right into the margin, so the
// labels follow it there.
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
  const axis = model.axes.find(axisDrawn)
  return (
    <SvgRowLabels
      sources={sources}
      rowHeight={effectiveRowHeight}
      labelOffset={
        axis
          ? Math.max(
              labelOffset,
              axisGutterLeft({ left: axis.left }, 0, 0, exportContentLeft) +
                AXIS_GUTTER_WIDTH_PX +
                AXIS_TO_LABEL_GAP_PX,
            )
          : labelOffset
      }
    />
  )
})
