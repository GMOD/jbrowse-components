import { useCallback, useState } from 'react'

import { ContextMenu } from '@jbrowse/core/ui'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { useWiggleMouseHandlers } from '@jbrowse/plugin-wiggle'
import {
  CrossHatches,
  YSCALEBAR_LABEL_OFFSET,
  YScaleBarOverlay,
} from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { ManhattanRenderer } from '../ManhattanRenderer.ts'
import { findManhattanHit } from '../findManhattanHit.ts'
import HoverHighlight from './HoverHighlight.tsx'
import LdColorLegend from './LdColorLegend.tsx'
import LdIndexWarning from './LdIndexWarning.tsx'
import TooltipComponent from './TooltipComponent.tsx'

import type { ManhattanHit } from '../findManhattanHit.ts'
import type { ManhattanDisplayModel } from './manhattanDisplayTypes.ts'
import type { ContextMenuAnchor } from '@jbrowse/core/ui'

// The right-clicked point and the SNP it resolved to, held together so the menu
// can't be anchored without a hit to build it from.
interface ManhattanContextMenu {
  anchor: ContextMenuAnchor
  hit: ManhattanHit
}

const LinearManhattanDisplayComponent = observer(
  function LinearManhattanDisplayComponent({
    model,
  }: {
    model: ManhattanDisplayModel
  }) {
    const { lgv, height } = model
    const width = lgv.trackWidthPx
    const [contextMenu, setContextMenu] = useState<ManhattanContextMenu>()

    // renderState is always defined; an empty rpcDataMap/flatbush set simply
    // yields no hit, so no separate loading guard is needed. The offsetY passed
    // by the shared handler is measured from the DisplayChrome top, so subtract
    // the y-axis label band to land in the canvas' coordinate space.
    const computeHit = useCallback(
      (offsetX: number, offsetY: number) =>
        findManhattanHit(
          offsetX,
          offsetY - YSCALEBAR_LABEL_OFFSET,
          model.renderBlocks,
          model.rpcDataMap,
          model.flatbushes,
          model.renderState,
          model.regionRefNames,
        ),
      [model],
    )

    const {
      containerRef,
      clientMouseCoord,
      handleMouseMove,
      handleMouseLeave,
      handleClick,
    } = useWiggleMouseHandlers(model, computeHit)

    function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const hit = computeHit(
          event.clientX - rect.left,
          event.clientY - rect.top,
        )
        if (hit) {
          event.preventDefault()
          // clear the hover tooltip so it doesn't stay stuck behind the menu
          model.setFeatureUnderMouse(undefined)
          setContextMenu({
            anchor: { clientX: event.clientX, clientY: event.clientY },
            hit,
          })
        }
      }
    }

    return (
      <DisplayChrome
        model={model}
        factory={ManhattanRenderer}
        ref={containerRef}
        testid="manhattan-display"
        style={{ width, height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={event => {
          handleContextMenu(event)
        }}
      >
        {({ canvasRef }) => (
          <ManhattanBody
            model={model}
            canvasRef={canvasRef}
            width={width}
            height={height}
            clientMouseCoord={clientMouseCoord}
            contextMenu={contextMenu}
            setContextMenu={setContextMenu}
          />
        )}
      </DisplayChrome>
    )
  },
)

const ManhattanBody = observer(function ManhattanBody({
  model,
  canvasRef,
  width,
  height,
  clientMouseCoord,
  contextMenu,
  setContextMenu,
}: {
  model: ManhattanDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  width: number
  height: number
  clientMouseCoord: [number, number]
  contextMenu?: ManhattanContextMenu
  setContextMenu: (v?: ManhattanContextMenu) => void
}) {
  const { ticks, featureUnderMouse, showCrossHatches, ldColoringActive } = model
  const ldMode = ldColoringActive && model.canvasDrawn && model.showLdLegend

  return (
    <>
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
      {ticks ? <YScaleBarOverlay ticks={ticks} height={height} /> : null}
      {showCrossHatches && ticks ? (
        <CrossHatches ticks={ticks} width={width} height={height} />
      ) : null}
      {featureUnderMouse ? (
        <HoverHighlight
          screenX={featureUnderMouse.screenX}
          screenY={featureUnderMouse.screenY}
          width={width}
          height={height}
          pointDiameterPx={model.scatterPointSize}
        />
      ) : null}
      {ldMode ? (
        <LdColorLegend
          onDismiss={() => {
            model.setShowLdLegend(false)
          }}
        />
      ) : null}
      {model.indexSnpMissing ? (
        <LdIndexWarning
          offsetTop={YSCALEBAR_LABEL_OFFSET}
          offscreen={model.indexSnpOffscreen}
        />
      ) : null}
      <TooltipComponent model={model} clientMouseCoord={clientMouseCoord} />
      <ContextMenu
        anchor={contextMenu?.anchor}
        menuItems={() =>
          contextMenu ? model.contextMenuItems(contextMenu.hit) : []
        }
        onClose={() => {
          setContextMenu(undefined)
        }}
      />
    </>
  )
})

export default LinearManhattanDisplayComponent
