import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
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

const COORD0: [number, number] = [0, 0]

const LinearManhattanDisplayComponent = observer(
  function LinearManhattanDisplayComponent({
    model,
  }: {
    model: ManhattanDisplayModel
  }) {
    const { view, height } = model
    const width = view.trackWidthPx
    const [clientMouseCoord, setClientMouseCoord] = useState(COORD0)
    const [contextMenu, setContextMenu] = useState<{
      coord: [number, number]
      hit: ManhattanHit
    }>()

    function hitAt(event: React.MouseEvent<HTMLDivElement>) {
      // renderState is always defined; an empty rpcDataMap/flatbush set simply
      // yields no hit, so no separate loading guard is needed here.
      const rect = event.currentTarget.getBoundingClientRect()
      return findManhattanHit(
        event.clientX - rect.left,
        event.clientY - rect.top - YSCALEBAR_LABEL_OFFSET,
        model.renderBlocks,
        model.rpcDataMap,
        model.flatbushes,
        model.renderState,
        model.regionRefNames,
      )
    }

    function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
      setClientMouseCoord([event.clientX, event.clientY])
      model.setFeatureUnderMouse(hitAt(event))
    }

    function handleMouseLeave() {
      model.setFeatureUnderMouse(undefined)
    }

    function handleClick() {
      const hit = model.featureUnderMouse
      if (hit) {
        model.selectFeature(hit)
      }
    }

    function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
      const hit = hitAt(event)
      if (hit) {
        event.preventDefault()
        // clear the hover tooltip so it doesn't stay stuck behind the menu
        model.setFeatureUnderMouse(undefined)
        setContextMenu({ coord: [event.clientX, event.clientY], hit })
      }
    }

    return (
      <DisplayChrome
        model={model}
        factory={ManhattanRenderer}
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
  contextMenu?: { coord: [number, number]; hit: ManhattanHit }
  setContextMenu: (v?: { coord: [number, number]; hit: ManhattanHit }) => void
}) {
  const { ticks, featureUnderMouse, displayCrossHatches, colorBy } = model
  const scalebarLeft = model.scalebarOverlapLeft
  const ldMode = colorBy === 'ld' && model.canvasDrawn && model.showLdLegend

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
          pointDiameterPx={model.scatterPointSize}
        />
      ) : null}
      {ldMode ? (
        <LdColorLegend
          offsetTop={YSCALEBAR_LABEL_OFFSET}
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
      {contextMenu ? (
        <Menu
          open
          anchorReference="anchorPosition"
          anchorPosition={{
            top: contextMenu.coord[1],
            left: contextMenu.coord[0],
          }}
          onMenuItemClick={callback => {
            callback()
            setContextMenu(undefined)
          }}
          onClose={() => {
            setContextMenu(undefined)
          }}
          menuItems={model.contextMenuItems(contextMenu.hit)}
        />
      ) : null}
    </>
  )
})

export default LinearManhattanDisplayComponent
