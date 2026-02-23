import { Suspense, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import LegendBar from '../../shared/components/MultiSampleVariantLegendBar.tsx'
import TreeSidebar from '../../shared/components/TreeSidebar.tsx'
import { useMouseTracking } from '../../shared/hooks/useMouseTracking.ts'

import type { LinearVariantMatrixDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const VariantMatrixDisplayComponent = observer(
  function VariantMatrixDisplayComponent(props: {
    model: LinearVariantMatrixDisplayModel
  }) {
    const { model } = props
    const {
      DisplayMessageComponent,
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
      <div
        ref={ref}
        style={{ position: 'relative', height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <LinesConnectingMatrixToGenomicPosition
          model={model}
          crosshairX={inMatrix ? mouseState.x : undefined}
        />
        <div style={{ position: 'absolute', top: lineZoneHeight, left }}>
          <Suspense fallback={null}>
            <DisplayMessageComponent model={model} />
          </Suspense>
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
      </div>
    )
  },
)

export default VariantMatrixDisplayComponent
