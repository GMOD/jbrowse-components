import { paintInsertionLabels } from '@jbrowse/alignments-core'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { mafInsertionParams } from '../../LinearMafRenderer/mafMarks.ts'

import type {
  MafGPURenderState,
  MafUploadPayload,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * The insertion markers' counts over the rows, which the insertion mark draws
 * on either backend. Positioned in the rows container, so the band's origin is
 * its top rather than the canvas's.
 */
const InsertionsOverlay = observer(function InsertionsOverlay({
  payloads,
  renderBlocks,
  renderState,
  width,
  height,
}: {
  payloads: ReadonlyMap<number, MafUploadPayload>
  renderBlocks: RenderBlock[]
  renderState: MafGPURenderState
  width: number
  height: number
}) {
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        paintInsertionLabels(
          ctx,
          renderBlocks,
          block => payloads.get(block.displayedRegionIndex)?.insertions,
          { canvasWidth: width, canvasHeight: height },
          mafInsertionParams({ ...renderState, rowsTop: 0 }),
        )
      }}
    />
  )
})

export default InsertionsOverlay
