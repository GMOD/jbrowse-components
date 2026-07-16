import { useCallback } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import MultiWiggleLegendOverlay from './MultiWiggleLegendOverlay.tsx'
import { findMultiWiggleHit } from './findHit.ts'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import WiggleTooltip from '../../shared/WiggleTooltip.tsx'
import { useWiggleMouseHandlers } from '../../shared/useWiggleMouseHandlers.ts'
import { legendRightEdgePx } from '../../shared/wiggleComponentUtils.ts'
import MultiWiggleOverlayLines from '../MultiWiggleOverlayLines.tsx'
import MultiWiggleSvgScales from '../MultiWiggleSvgScales.tsx'

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
  const scalebarLeft = model.scalebarOverlapLeft
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
          canvasWidth={legendWidth}
          scalebarLeft={Math.max(scalebarLeft, 50)}
          labelOffset={labelOffset}
        />

        <MultiWiggleOverlayLines model={model} width={totalWidth} />
      </svg>

      <TreeSidebar model={model} />

      {/* portals the overlay color legend above the inter-region masks */}
      <MultiWiggleLegendOverlay model={model} />

      <WiggleTooltip
        model={model}
        height={height}
        clientMouseCoord={clientMouseCoord}
        offsetMouseCoord={offsetMouseCoord}
      />
    </>
  )
})

export default MultiWiggleComponent
