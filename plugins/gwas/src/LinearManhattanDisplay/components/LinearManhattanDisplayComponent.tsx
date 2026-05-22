import { useCallback, useState } from 'react'

import { ErrorOverlay } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { useGpuBackend } from '@jbrowse/core/util/useGpuBackend'
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

import { ManhattanRenderer } from '../ManhattanRenderer.ts'
import { findManhattanHit } from '../findManhattanHit.ts'
import HoverHighlight from './HoverHighlight.tsx'
import TooltipComponent from './TooltipComponent.tsx'

import type { ManhattanDisplayModel } from './manhattanDisplayTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const COORD0: [number, number] = [0, 0]

const LinearManhattanDisplayComponent = observer(
  function LinearManhattanDisplayComponent({
    model,
  }: {
    model: ManhattanDisplayModel
  }) {
    const { canvasRef, error, retry } = useGpuBackend(ManhattanRenderer, model)
    const view = getContainingView(model) as LGV
    const [clientMouseCoord, setClientMouseCoord] = useState(COORD0)

    const hitTest = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const state = model.renderState
        if (!state) {
          return undefined
        }
        return findManhattanHit(
          event.clientX - rect.left,
          event.clientY - rect.top - YSCALEBAR_LABEL_OFFSET,
          model.renderBlocks,
          model.rpcDataMap,
          state,
          model.regionRefNames,
        )
      },
      [model],
    )

    const handleMouseMove = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        setClientMouseCoord([event.clientX, event.clientY])
        model.setFeatureUnderMouse(hitTest(event))
      },
      [model, hitTest],
    )

    const handleMouseLeave = useCallback(() => {
      model.setFeatureUnderMouse(undefined)
    }, [model])

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        const hit = hitTest(event)
        if (hit) {
          model.selectFeature(hit)
        }
      },
      [model, hitTest],
    )

    const width = view.trackWidthPx
    const height = model.height
    const { ticks, featureUnderMouse, displayCrossHatches } = model
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
        data-testid={model.canvasDrawn ? 'manhattan-gpu-done' : 'manhattan-gpu'}
        style={{ position: 'relative', width, height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
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
        {ticks ? (
          <YScaleBarOverlay
            ticks={ticks}
            height={height}
            scalebarLeft={scalebarLeft}
          />
        ) : null}
        {displayCrossHatches && ticks ? (
          <CrossHatches ticks={ticks} width={width} height={height} />
        ) : null}
        {featureUnderMouse ? (
          <HoverHighlight
            screenX={featureUnderMouse.screenX}
            screenY={featureUnderMouse.screenY}
            width={width}
            height={height}
          />
        ) : null}
        <TooltipComponent model={model} clientMouseCoord={clientMouseCoord} />
        <DisplayErrorBar model={model} />
        <DisplayLoadingOverlay model={model} />
      </div>
    )
  },
)

export default LinearManhattanDisplayComponent
