import { useState } from 'react'

import { ErrorOverlay, Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { useRenderingBackend } from '@jbrowse/core/util/useRenderingBackend'
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
import LdColorLegend from './LdColorLegend.tsx'
import LdIndexWarning from './LdIndexWarning.tsx'
import TooltipComponent from './TooltipComponent.tsx'

import type { ManhattanHit } from '../findManhattanHit.ts'
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
    const { canvasRef, error, retry } = useRenderingBackend(
      ManhattanRenderer,
      model,
    )
    const view = getContainingView(model) as LGV
    const [clientMouseCoord, setClientMouseCoord] = useState(COORD0)
    const [contextMenu, setContextMenu] = useState<{
      coord: [number, number]
      hit: ManhattanHit
    }>()

    function hitAt(event: React.MouseEvent<HTMLDivElement>) {
      const state = model.renderState
      if (state) {
        const rect = event.currentTarget.getBoundingClientRect()
        return findManhattanHit(
          event.clientX - rect.left,
          event.clientY - rect.top - YSCALEBAR_LABEL_OFFSET,
          model.renderBlocks,
          model.rpcDataMap,
          model.flatbushes,
          state,
          model.regionRefNames,
        )
      }
      return undefined
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
        setContextMenu({ coord: [event.clientX, event.clientY], hit })
      }
    }

    const width = view.trackWidthPx
    const height = model.height
    const { ticks, featureUnderMouse, displayCrossHatches, colorBy } = model
    const scalebarLeft = model.scalebarOverlapLeft
    const ldMode = colorBy === 'ld' && model.canvasDrawn

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
        onContextMenu={event => {
          handleContextMenu(event)
        }}
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
        {ldMode ? <LdColorLegend offsetTop={YSCALEBAR_LABEL_OFFSET} /> : null}
        {model.indexSnpMissing ? (
          <LdIndexWarning offsetTop={YSCALEBAR_LABEL_OFFSET} />
        ) : null}
        <TooltipComponent model={model} clientMouseCoord={clientMouseCoord} />
        <DisplayErrorBar model={model} />
        <DisplayLoadingOverlay model={model} />
        {contextMenu ? (
          <Menu
            open
            anchorReference="anchorPosition"
            anchorPosition={{
              top: contextMenu.coord[1],
              left: contextMenu.coord[0],
            }}
            onMenuItemClick={(_event, callback) => {
              callback()
              setContextMenu(undefined)
            }}
            onClose={() => {
              setContextMenu(undefined)
            }}
            menuItems={[
              {
                label: `Color by LD to ${contextMenu.hit.refName}:${
                  contextMenu.hit.start + 1
                }`,
                onClick: () => {
                  model.colorByLdToHit(contextMenu.hit)
                },
              },
            ]}
          />
        ) : null}
      </div>
    )
  },
)

export default LinearManhattanDisplayComponent
