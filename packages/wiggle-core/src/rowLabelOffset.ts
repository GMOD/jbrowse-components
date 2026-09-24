import {
  axisDrawn,
  axisGutterLeft,
  axisGutterWidth,
} from '@jbrowse/display-ui/axisPlacement'

import type { YAxis } from '@jbrowse/display-ui'

const AXIS_TO_LABEL_GAP_PX = 4

/**
 * Where row labels start: `offset`, past the dendrogram, or past the axis each
 * row repeats where one draws, since a label grows rightward over the plot.
 * `exportContentLeft` is the export shell's, which moves an axis nothing
 * pushes right into the margin, so the labels follow it there.
 */
export function rowLabelOffset(
  axes: readonly YAxis[],
  offset: number,
  exportContentLeft?: number,
) {
  const axis = axes.find(axisDrawn)
  return axis
    ? Math.max(
        offset,
        axisGutterLeft(axis, 0, 0, exportContentLeft) +
          axisGutterWidth(axis) +
          AXIS_TO_LABEL_GAP_PX,
      )
    : offset
}
