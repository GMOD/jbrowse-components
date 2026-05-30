import { useRef } from 'react'

import {
  DisplayChrome,
  FloatingLegend,
} from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import Crosshair from './MultiSampleVariantCrosshairs.tsx'
import LegendBar from './MultiSampleVariantLegendBar.tsx'
import VariantBody from '../../MultiVariantDisplay/components/VariantComponent.tsx'
import { VariantRenderer } from '../../MultiVariantDisplay/components/VariantRenderer.ts'
import { useMouseTracking } from '../hooks/useMouseTracking.ts'

import type { MultiLinearVariantDisplayModel } from '../../MultiVariantDisplay/model.ts'

const MultiSampleVariantBaseDisplayComponent = observer(
  function MultiSampleVariantBaseDisplayComponent(props: {
    model: MultiLinearVariantDisplayModel
  }) {
    const { model } = props
    const { availableHeight, showTree, showLegend, hierarchy, treeAreaWidth } =
      model
    const ref = useRef<HTMLDivElement>(null)
    const { mouseState, handleMouseMove, handleMouseLeave } =
      useMouseTracking(ref)

    return (
      <DisplayChrome
        model={model}
        factory={VariantRenderer}
        ref={ref}
        data-testid={
          model.canvasDrawn ? 'variant-display-done' : 'variant-display'
        }
        style={{ position: 'relative' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {({ canvasRef, canvas }) => (
          <>
            <TreeSidebar model={model} />
            <svg
              style={{
                position: 'absolute',
                top: 0,
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
            {showLegend ? (
              <FloatingLegend items={model.legendItems()} />
            ) : null}
            <div style={{ position: 'absolute', left: 0 }}>
              <VariantBody model={model} canvasRef={canvasRef} canvas={canvas} />
            </div>
            {mouseState ? (
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

export default MultiSampleVariantBaseDisplayComponent
