import { useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import {
  DisplayChrome,
  FloatingLegend,
} from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import VariantMatrixBody from './VariantMatrixComponent.tsx'
import { VariantMatrixRenderer } from './VariantMatrixRenderer.ts'
import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import LegendBar from '../../shared/components/MultiSampleVariantLegendBar.tsx'
import { useMouseTracking } from '../../shared/hooks/useMouseTracking.ts'

import type { LinearVariantMatrixDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const VariantMatrixDisplayComponent = observer(
  function VariantMatrixDisplayComponent(props: {
    model: LinearVariantMatrixDisplayModel
  }) {
    const { model } = props
    const {
      lineZoneHeight,
      height,
      availableHeight,
      showTree,
      showLegend,
      hierarchy,
      treeAreaWidth,
    } = model
    const view = getContainingView(model) as LinearGenomeViewModel
    const left = Math.max(0, -view.offsetPx)
    const ref = useRef<HTMLDivElement>(null)
    const { mouseState, handleMouseMove, handleMouseLeave } =
      useMouseTracking(ref)
    const inMatrix = mouseState && mouseState.y > lineZoneHeight

    return (
      <DisplayChrome
        model={model}
        factory={VariantMatrixRenderer}
        ref={ref}
        testid="variant-matrix-display"
        style={{ position: 'relative', height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {({ canvasRef, canvas }) => (
          <>
            <LinesConnectingMatrixToGenomicPosition
              model={model}
              crosshairX={inMatrix ? mouseState.x : undefined}
            />
            <div style={{ position: 'absolute', top: lineZoneHeight, left }}>
              <VariantMatrixBody
                model={model}
                canvasRef={canvasRef}
                canvas={canvas}
              />
            </div>
            <TreeSidebar model={model} />
            <svg
              style={{
                position: 'absolute',
                top: lineZoneHeight,
                left: 0,
                width: '100%',
                height: availableHeight,
                zIndex: 100,
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >
              <g
                transform={`translate(${showTree && hierarchy ? treeAreaWidth : 0})`}
              >
                <LegendBar model={model} />
              </g>
            </svg>
            {showLegend ? <FloatingLegend items={model.legendItems()} /> : null}
            {inMatrix ? (
              <Crosshair
                mouseX={mouseState.x}
                mouseY={mouseState.y}
                offsetX={mouseState.offsetX}
                offsetY={mouseState.offsetY}
                model={model}
              />
            ) : null}
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default VariantMatrixDisplayComponent
