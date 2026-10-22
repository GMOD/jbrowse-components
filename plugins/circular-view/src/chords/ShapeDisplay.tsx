import { awaitSvgReady, throwOnExportErrors } from '@jbrowse/core/svg/svgReady'
import { observer } from 'mobx-react'

import ChordDisplayFrame from './ChordDisplayFrame.tsx'
import ShapePaths from './ShapePaths.tsx'

import type { ShapeDisplayModel } from './types.ts'

/**
 * A chord display on screen: the canvas holds the resting shapes, and this
 * draws the hovered and selected ones over it inside the display's frame.
 */
const ShapeDisplay = observer(function ShapeDisplay({
  display,
}: {
  display: ShapeDisplayModel
}) {
  return (
    <ChordDisplayFrame display={display}>
      <ShapePaths
        display={display}
        testid={display.shapesTestId}
        only="highlighted"
      />
    </ChordDisplayFrame>
  )
})

// a radial display has no box to draw an error in, so a track whose data
// would not load fails the export instead
export async function renderShapesSvg(display: ShapeDisplayModel) {
  await awaitSvgReady(display)
  throwOnExportErrors([display.displayError])
  return display.ready ? (
    <ShapePaths display={display} testid={display.shapesTestId} only="all" />
  ) : null
}

export default ShapeDisplay
