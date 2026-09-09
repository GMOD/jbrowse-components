import { eventPoint } from '@jbrowse/core/util/eventPoint'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { openContextMenuFromEvent } from '@jbrowse/display-kit/DisplayContextMenu'
import { PointerLayer } from '@jbrowse/display-ui'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import {
  DisplayContextMenu,
  DisplayCrosshairs,
  RowLabelsOverlay,
  RowSeparatorLines,
  TreeSidebar,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import DensityBandOverlay from '../../shared/DensityBandOverlay.tsx'
import { MULTI_ROW_MARKS } from '../rendering/multiRowMarks.ts'
import { SEPARATOR_OPACITY } from '../rendering/rowBand.ts'
import MultiRowHoverHighlight from './MultiRowHoverHighlight.tsx'
import MultiRowIndelGlyphOverlay from './MultiRowIndelGlyphOverlay.tsx'
import MultiRowTooltip from './MultiRowTooltip.tsx'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'
import type React from 'react'

function createMultiRowBackend(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, MULTI_ROW_MARKS)
}

const MultiRowCanvas = observer(function MultiRowCanvas({
  model,
  canvasRef,
}: {
  model: LinearMultiRowFeatureDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  // `canvasWidthPx` is the width `renderState` carries, so every overlay below
  // sits in the box the painting was actually mapped into.
  const {
    canvasWidthPx,
    height,
    sources,
    labelSources,
    effectiveRowHeight,
    sidebarOffset,
    showRowSeparators,
    showRowLabels,
  } = model
  return (
    <>
      <canvas
        data-testid="multirow_canvas"
        ref={canvasRef}
        style={{
          width: canvasWidthPx,
          height,
          position: 'absolute',
          left: 0,
          // the pointer handlers measure the chrome container, so the canvas
          // has to share its origin
          top: 0,
        }}
      />
      <DensityBandOverlay model={model} />
      <MultiRowIndelGlyphOverlay model={model} />
      {/* inline rather than portaled: the tree sidebar is a later sibling with
          an opaque panel, so the lines stop at the dendrogram */}
      {showRowSeparators ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: canvasWidthPx,
            height,
            pointerEvents: 'none',
          }}
        >
          <RowSeparatorLines
            numRows={sources.length}
            rowHeight={effectiveRowHeight}
            width={canvasWidthPx}
            opacity={SEPARATOR_OPACITY}
          />
        </svg>
      ) : null}
      <MultiRowHoverHighlight model={model} />
      {/* Capture gates read this subtree as the doneness signal: `sources`
          derives from fetched features, so it cannot exist before the data has
          loaded and been binned into rows. */}
      <RowLabelsOverlay
        testId="multirow-row-labels"
        sources={labelSources}
        rowHeight={effectiveRowHeight}
        labelOffset={sidebarOffset}
        width={canvasWidthPx}
        height={height}
        showLabels={showRowLabels}
      />
      <TreeSidebar model={model} />
      <DisplayContextMenu model={model} />
    </>
  )
})

const LinearMultiRowFeatureDisplayComponent = observer(
  function LinearMultiRowFeatureDisplayComponent({
    model,
  }: {
    model: LinearMultiRowFeatureDisplayModel
  }) {
    function onClick(e: React.MouseEvent<HTMLDivElement>) {
      const { x, y } = eventPoint(e)
      const hit = model.featureAt(x, y)
      if (hit) {
        model.selectFeatureById(hit.id, hit.regionIndex)
      }
    }
    function onContextMenu(e: React.MouseEvent<HTMLDivElement>) {
      const { x, y } = eventPoint(e)
      const target = model.contextTargetAt(x, y)
      openContextMenuFromEvent(
        model,
        e,
        target
          ? { clientX: e.clientX, clientY: e.clientY, ...target }
          : undefined,
      )
    }
    return (
      <DisplayChrome
        model={model}
        factory={createMultiRowBackend}
        testid="multirow-display"
        // its content is all absolutely positioned, so without a height the
        // container collapses and receives no pointer events at all
        style={{ height: model.height }}
        onPointerPosition={state => {
          model.setHoveredFeature(
            state ? model.featureAt(state.x, state.y) : undefined,
          )
          model.setDensityHoverPx(state ? state.x : undefined)
        }}
        onClick={e => {
          onClick(e)
        }}
        onContextMenu={e => {
          onContextMenu(e)
        }}
      >
        {({ canvasRef, mouseTracker }) => (
          <>
            <MultiRowCanvas model={model} canvasRef={canvasRef} />
            <PointerLayer mouseTracker={mouseTracker}>
              {mouseState =>
                mouseState ? (
                  <>
                    <DisplayCrosshairs
                      model={model}
                      mouseX={mouseState.x}
                      mouseY={mouseState.y}
                    />
                    <MultiRowTooltip model={model} mouseState={mouseState} />
                  </>
                ) : null
              }
            </PointerLayer>
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default LinearMultiRowFeatureDisplayComponent
