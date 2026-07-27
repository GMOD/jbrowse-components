import { useCallback } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { DisplayCrosshairs, TreeSidebar } from '@jbrowse/tree-sidebar'
import { ONSCREEN_AXIS_LEFT_PX } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import WiggleTooltip from '../../shared/WiggleTooltip.tsx'
import { useWiggleMouseHandlers } from '../../shared/useWiggleMouseHandlers.ts'
import { legendRightEdgePx } from '../../shared/wiggleComponentUtils.ts'
import MultiWiggleOverlayLines from '../MultiWiggleOverlayLines.tsx'
import MultiWiggleSvgScales from '../MultiWiggleSvgScales.tsx'
import MultiWiggleHint from './MultiWiggleHint.tsx'
import MultiWiggleLegendOverlay from './MultiWiggleLegendOverlay.tsx'
import { findMultiWiggleHit } from './findHit.ts'

import type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'

type LGV = LinearGenomeViewModel

const MultiWiggleComponent = observer(function MultiWiggleComponent({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startRenderingBackend / stopRenderingBackend / renderNow on
  // the MultiLinearWiggleDisplay model. Sources changes are picked up because
  // installPerRegionLifecycle's encode step reads `self.gpuProps()`, so a
  // gpuProps change re-fires every per-region autorun and re-uploads.
  const view = getContainingView(model) as LGV
  const totalWidth = view.trackWidthPx
  const height = model.height

  const computeHit = useCallback(
    (offsetX: number, offsetY: number) =>
      findMultiWiggleHit(model, view.visibleRegions, offsetX, offsetY),
    [model, view],
  )

  const {
    containerRef,
    clientMouseCoord,
    offsetMouseCoord,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  } = useWiggleMouseHandlers(model, computeHit)

  return (
    <DisplayChrome
      model={model}
      factory={WiggleRenderer}
      ref={containerRef}
      testid="multi-wiggle-display"
      // The clustered frame's only other DOM evidence is the dendrogram canvas,
      // which `showTree: false` removes — so a figure that clusters with the
      // tree hidden had nothing to wait on but a guessed delay. Published here
      // instead, off the same model state the tree reads.
      data-clustered={model.hierarchy ? 'true' : 'false'}
      style={{
        width: totalWidth,
        height,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {({ canvasRef }) => (
        <MultiWiggleBody
          model={model}
          canvasRef={canvasRef}
          totalWidth={totalWidth}
          height={height}
          clientMouseCoord={clientMouseCoord}
          offsetMouseCoord={offsetMouseCoord}
        />
      )}
    </DisplayChrome>
  )
})

const MultiWiggleBody = observer(function MultiWiggleBody({
  model,
  canvasRef,
  totalWidth,
  height,
  clientMouseCoord,
  offsetMouseCoord,
}: {
  model: MultiWiggleDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  totalWidth: number
  height: number
  clientMouseCoord: [number, number]
  offsetMouseCoord: [number, number]
}) {
  const treeShowing = model.showTree && !!model.hierarchy
  const labelOffset = treeShowing ? model.treeAreaWidth : 0

  // Pin the right-aligned legends to the content's right edge, not the full
  // track width (see legendRightEdgePx).
  const view = getContainingView(model) as LGV
  const legendWidth = legendRightEdgePx(view.visibleRegions, totalWidth)

  return (
    <>
      <div>
        <canvas
          ref={canvasRef}
          style={{
            width: totalWidth,
            height,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        />
      </div>

      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          height,
          width: totalWidth,
        }}
      >
        <MultiWiggleSvgScales
          model={model}
          legendRight={legendWidth}
          // past the dendrogram, which paints an opaque panel over the left of
          // the plot and would otherwise swallow the axis
          scalebarLeft={labelOffset + ONSCREEN_AXIS_LEFT_PX}
          labelOffset={labelOffset}
        />

        <MultiWiggleOverlayLines model={model} width={totalWidth} />
      </svg>

      <TreeSidebar model={model} />

      {/* inline hint when the plot would otherwise be a silent blank */}
      <MultiWiggleHint model={model} />

      {/* portals the overlay color legend above the inter-region masks */}
      <MultiWiggleLegendOverlay model={model} />

      {/* the full crosshair, not just a genomic guide: cursor y picks the row
          being read in multi-row mode and a score level in overlay mode, and
          both are hard to eyeball across a tall stack of plots */}
      {model.featureUnderMouse ? (
        <DisplayCrosshairs
          model={model}
          mouseX={offsetMouseCoord[0]}
          mouseY={offsetMouseCoord[1]}
        />
      ) : null}
      <WiggleTooltip model={model} clientMouseCoord={clientMouseCoord} />
    </>
  )
})

export default MultiWiggleComponent
