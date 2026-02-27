import { Suspense, useRef, useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from './MultiSampleVariantCrosshairs.tsx'
import LegendBar from './MultiSampleVariantLegendBar.tsx'
import TreeSidebar from './TreeSidebar.tsx'
import { useMouseTracking } from '../hooks/useMouseTracking.ts'

import type { MultiSampleVariantBaseModel } from '../MultiSampleVariantBaseModel.ts'

type Model = MultiSampleVariantBaseModel & {
  DisplayMessageComponent: React.ComponentType<any>
}

const MultiSampleVariantBaseDisplayComponent = observer(
  function MultiSampleVariantBaseDisplayComponent(props: { model: Model }) {
    const { model } = props
    const {
      DisplayMessageComponent,
      availableHeight,
      showTree,
      showLegend,
      hierarchy,
      treeAreaWidth,
    } = model
    const ref = useRef<HTMLDivElement>(null)
    const { mouseState, handleMouseMove, handleMouseLeave } =
      useMouseTracking(ref)
    const [contextCoord, setContextCoord] = useState<
      [number, number] | undefined
    >()

    return (
      <div
        ref={ref}
        data-testid="variant-display"
        style={{ position: 'relative' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onContextMenu={e => {
          if (model.contextMenuFeature) {
            e.preventDefault()
            setContextCoord([e.clientX, e.clientY])
          }
        }}
      >
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
        {showLegend ? <FloatingLegend items={model.legendItems()} /> : null}
        <div style={{ position: 'absolute', left: 0 }}>
          <Suspense fallback={null}>
            <DisplayMessageComponent model={model} />
          </Suspense>
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
        {contextCoord ? (
          <Menu
            open
            onMenuItemClick={(_, callback) => {
              callback()
              setContextCoord(undefined)
            }}
            onClose={() => {
              setContextCoord(undefined)
              model.setContextMenuFeature(undefined)
            }}
            slotProps={{
              transition: {
                onExit: () => {
                  setContextCoord(undefined)
                  model.setContextMenuFeature(undefined)
                },
              },
            }}
            anchorReference="anchorPosition"
            anchorPosition={{
              top: contextCoord[1],
              left: contextCoord[0],
            }}
            menuItems={model.contextMenuItems()}
          />
        ) : null}
      </div>
    )
  },
)

export default MultiSampleVariantBaseDisplayComponent
