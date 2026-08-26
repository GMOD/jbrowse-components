import { useCallback, useState } from 'react'

import { ContextMenu, useMouseState } from '@jbrowse/core/ui'
import { eventPoint } from '@jbrowse/core/util/eventPoint'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { wiggleMouseHandlers } from '@jbrowse/plugin-wiggle'
import {
  CrossHatches,
  ScoreRules,
  YScaleBarOverlay,
  axisPlotBox,
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
import type { ContextMenuAnchor, MouseTracker } from '@jbrowse/core/ui'

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
    const { height, canvasWidthPx: width } = model
    const [contextMenu, setContextMenu] = useState<ManhattanContextMenu>()

    // renderState is always defined; an empty rpcDataMap/flatbush set simply
    // yields no hit, so no separate loading guard is needed. The offsetY passed
    // by the shared handler is measured from the DisplayChrome top, so subtract
    // the canvas' own top — off the same `axisPlotBox` that positions it — to
    // land in its coordinate space.
    const plotTop = axisPlotBox(height).yTop
    const computeHit = useCallback(
      (offsetX: number, offsetY: number) =>
        findManhattanHit(
          offsetX,
          offsetY - plotTop,
          model.renderBlocks,
          model.rpcDataMap,
          model.flatbushes,
          model.renderState,
          model.regionRefNames,
        ),
      [model, plotTop],
    )

    const { onPointerPosition, onClick } = wiggleMouseHandlers(
      model,
      computeHit,
    )

    function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
      // `eventPoint` measures against `currentTarget` — the chrome container,
      // which is the box the tracker measures against too, so the right-click
      // and the hover resolve the same hit
      const { x, y } = eventPoint(event)
      const hit = computeHit(x, y)
      if (hit) {
        event.preventDefault()
        // clear the hover tooltip so it doesn't stay stuck behind the menu
        model.setHoveredFeature(undefined)
        setContextMenu({
          anchor: { clientX: event.clientX, clientY: event.clientY },
          hit,
        })
      }
    }

    return (
      <DisplayChrome
        model={model}
        factory={ManhattanRenderer}
        testid="manhattan-display"
        // inherited from `DisplayContainer` until it was deleted; kept verbatim
        style={{ width, height, whiteSpace: 'nowrap', textAlign: 'left' }}
        onPointerPosition={onPointerPosition}
        onClick={onClick}
        onContextMenu={event => {
          handleContextMenu(event)
        }}
      >
        {({ canvasRef, mouseTracker }) => (
          <ManhattanBody
            model={model}
            canvasRef={canvasRef}
            width={width}
            height={height}
            mouseTracker={mouseTracker}
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
  mouseTracker,
  contextMenu,
  setContextMenu,
}: {
  model: ManhattanDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  width: number
  height: number
  mouseTracker: MouseTracker
  contextMenu?: ManhattanContextMenu
  setContextMenu: (v?: ManhattanContextMenu) => void
}) {
  // read here rather than beside the handlers, so a mousemove re-renders this
  // body instead of the whole DisplayChrome above it
  const mouseState = useMouseState(mouseTracker)
  const {
    ticks,
    hoveredFeature,
    showCrossHatches,
    ldColoringActive,
    scoreRuleMarks,
  } = model
  const ldMode = ldColoringActive && model.canvasDrawn && model.showLdLegend
  const plotBox = axisPlotBox(height)

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          width,
          // the box `ticks` places itself in, so a tick lands on its data —
          // both ends off the one helper, as the wiggle body does, rather than
          // the height from it and the top from the raw constant
          height: plotBox.plotHeight,
          position: 'absolute',
          left: 0,
          top: plotBox.yTop,
        }}
      />
      {ticks ? (
        <YScaleBarOverlay ticks={ticks} height={height} width={width} />
      ) : null}
      {showCrossHatches && ticks ? (
        <CrossHatches ticks={ticks} width={width} height={height} />
      ) : null}
      {scoreRuleMarks.length > 0 ? (
        <ScoreRules marks={scoreRuleMarks} width={width} height={height} />
      ) : null}
      {hoveredFeature ? (
        <HoverHighlight
          screenX={hoveredFeature.screenX}
          screenY={hoveredFeature.screenY}
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
          offsetTop={plotBox.yTop}
          offscreen={model.indexSnpOffscreen}
        />
      ) : null}
      <TooltipComponent model={model} mouseState={mouseState} />
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
