import { useCallback, useRef, useState } from 'react'

import { ErrorOverlay } from '@jbrowse/core/ui'
import { getContainingView, useGpuBackend } from '@jbrowse/core/util'
import {
  DisplayErrorBar,
  DisplayLoadingOverlay,
} from '@jbrowse/plugin-linear-genome-view'
import {
  CrossHatches,
  YSCALEBAR_LABEL_OFFSET,
  YScaleBarOverlay,
} from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import WiggleTooltip from './WiggleTooltip.tsx'
import { findHit } from './findHit.ts'
import ScoreLegend from '../../shared/ScoreLegend.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import { hitTestMouse } from '../../shared/wiggleComponentUtils.ts'

import type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const COORD0: [number, number] = [0, 0]

const WiggleComponent = observer(function WiggleComponent({
  model,
}: {
  model: WiggleDisplayModel
}) {
  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startBackend / stopBackend / renderNow on the
  // LinearWiggleDisplay model. This component is just a thin bridge that
  // plugs the canvas and the backend into those model actions.
  const { canvasRef, error, retry } = useGpuBackend(WiggleRenderer, model)

  const view = getContainingView(model) as LGV

  const [offsetMouseCoord, setOffsetMouseCoord] = useState(COORD0)
  const [clientMouseCoord, setClientMouseCoord] = useState(COORD0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        setOffsetMouseCoord([offsetX, event.clientY - rect.top])
        setClientMouseCoord([event.clientX, event.clientY])

        const { rpcDataMap, summaryScoreMode } = model
        const hit = hitTestMouse(view.visibleRegions, rpcDataMap, offsetX)
        const result = hit?.data.sources[0]
          ? findHit(
              hit.data.sources[0],
              hit.bp,
              hit.region.refName,
              summaryScoreMode,
            )
          : undefined
        model.setFeatureUnderMouse(result)
      }
    },
    [model, view],
  )

  const handleMouseLeave = useCallback(() => {
    model.setFeatureUnderMouse(undefined)
  }, [model])

  const width = view.trackWidthPx
  const height = model.height
  const scalebarLeft = model.scalebarOverlapLeft

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width}
        height={height}
        onRetry={() => {
          retry()
        }}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      data-testid={model.canvasDrawn ? 'wiggle-display-done' : 'wiggle-display'}
      style={{ position: 'relative', width, height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        style={{
          width,
          height: height - 2 * YSCALEBAR_LABEL_OFFSET,
          position: 'absolute',
          left: 0,
          top: YSCALEBAR_LABEL_OFFSET,
        }}
      />
      {model.isDensityMode && model.domain ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            height: 16,
            width,
          }}
        >
          <ScoreLegend
            domain={model.domain}
            scaleType={model.scaleType}
            canvasWidth={width}
          />
        </svg>
      ) : model.ticks ? (
        <YScaleBarOverlay
          ticks={model.ticks}
          height={height}
          scalebarLeft={scalebarLeft}
        />
      ) : null}
      {model.displayCrossHatches && model.ticks ? (
        <CrossHatches ticks={model.ticks} width={width} height={height} />
      ) : null}
      <WiggleTooltip
        model={model}
        clientMouseCoord={clientMouseCoord}
        offsetMouseCoord={offsetMouseCoord}
        height={height}
      />
      <DisplayErrorBar model={model} />
      <DisplayLoadingOverlay model={model} />
    </div>
  )
})

export default WiggleComponent

export type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'
