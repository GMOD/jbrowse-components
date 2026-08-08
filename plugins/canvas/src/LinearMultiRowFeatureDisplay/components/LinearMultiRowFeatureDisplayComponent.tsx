import { ContextMenu, useMouseState } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import {
  DisplayChrome,
  FloatingSvgOverlay,
} from '@jbrowse/plugin-linear-genome-view'
import {
  DisplayCrosshairs,
  RowLabelsOverlay,
  RowSeparatorLines,
  TreeSidebar,
  treeSidebarRightEdge,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { MultiRowRendererFactory } from '../rendering/MultiRowRendererFactory.ts'
import {
  MIN_SEPARATOR_ROW_PX,
  SEPARATOR_OPACITY,
} from '../rendering/rowBand.ts'
import MultiRowColorLegend from './MultiRowColorLegend.tsx'
import MultiRowHoverHighlight from './MultiRowHoverHighlight.tsx'
import MultiRowIndelGlyphOverlay from './MultiRowIndelGlyphOverlay.tsx'
import MultiRowTooltip from './MultiRowTooltip.tsx'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

// The guides and the tooltip, in their own component so that following the
// pointer re-renders these two and nothing else. Read in the component that
// binds the handlers instead, this would re-render `DisplayChrome`, its status
// container and all three overlays on every mousemove — see `useMouseTracking`.
function PointerLayer({
  model,
  mouseTracker,
}: {
  model: LinearMultiRowFeatureDisplayModel
  mouseTracker: MouseTracker
}) {
  const mouseState = useMouseState(mouseTracker)
  return mouseState ? (
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

const MultiRowCanvas = observer(function MultiRowCanvas({
  model,
  canvasRef,
}: {
  model: LinearMultiRowFeatureDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  // `canvasWidthPx`, not `view.width` or a second `trackWidthPx` read: it is the
  // width `renderState` carries, so every overlay below is positioned in the box
  // the painting was actually mapped into. The getter exists to be the one
  // answer — reading the view directly is how MAF drifted onto `view.width`.
  const {
    canvasWidthPx,
    height,
    sources,
    effectiveRowHeight,
    sidebarOffset,
    showLegend,
    showRowSeparators,
    showRowLabels,
    colorLegend,
    rowGroupLegend,
    hiddenCategorySet,
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
          // pinned rather than left to the static flow: the pointer handlers
          // measure the chrome container, so the canvas has to share its origin
          top: 0,
        }}
      />
      <MultiRowIndelGlyphOverlay model={model} />
      {/* inline rather than portaled through FloatingSvgOverlay: the tree
          sidebar is a later sibling and its panel is opaque, so drawing the
          lines here is what stops them from running across the dendrogram */}
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
            minRowPx={MIN_SEPARATOR_ROW_PX}
          />
        </svg>
      ) : null}
      <MultiRowHoverHighlight model={model} />
      {/* Also the display's doneness signal for capture gates: `sources` is
          derived from fetched features (the partition values), so this subtree
          cannot exist before data has loaded and been binned into rows --
          unlike `canvasDrawn`/`-done`, which flips on an empty first paint. The
          color legend serves this role for categorical paintings but renders
          nothing when the palette is continuous (MAX_LEGEND_ENTRIES), so the row
          labels are the signal that holds in both modes. See
          agent-docs/reference/SCREENSHOT_CAPTURE_RACE.md. */}
      <RowLabelsOverlay
        testId="multirow-row-labels"
        sources={sources}
        rowHeight={effectiveRowHeight}
        labelOffset={sidebarOffset}
        width={canvasWidthPx}
        height={height}
        showLabels={showRowLabels}
      />
      {/* portaled above the inter-region masks (see FloatingSvgOverlay) so the
          legend isn't buried at multi-region scale */}
      {showLegend && (colorLegend.length || rowGroupLegend.length) ? (
        <FloatingSvgOverlay width={canvasWidthPx} height={height}>
          <MultiRowColorLegend
            entries={colorLegend}
            rowGroupItems={rowGroupLegend}
            canvasWidth={canvasWidthPx}
            maxHeight={height}
            hiddenLabels={hiddenCategorySet}
            onDismiss={() => {
              model.setShowLegend(false)
            }}
          />
        </FloatingSvgOverlay>
      ) : null}
      <TreeSidebar model={model} />
      <ContextMenu
        anchor={model.contextMenuInfo}
        menuItems={() => model.contextMenuItems()}
        onClose={() => {
          model.closeContextMenu()
        }}
      />
    </>
  )
})

const LinearMultiRowFeatureDisplayComponent = observer(
  function LinearMultiRowFeatureDisplayComponent({
    model,
  }: {
    model: LinearMultiRowFeatureDisplayModel
  }) {
    const view = getContainingView(model) as LinearGenomeViewModel
    function onClick(e: React.MouseEvent<HTMLDivElement>) {
      const rect = e.currentTarget.getBoundingClientRect()
      const hit = model.featureAt(e.clientX - rect.left, e.clientY - rect.top)
      if (hit) {
        model.selectFeatureById(hit.id, hit.regionIndex)
      }
    }
    function onContextMenu(e: React.MouseEvent<HTMLDivElement>) {
      const rect = e.currentTarget.getBoundingClientRect()
      const px = e.clientX - rect.left
      const p = view.pxToBp(px)
      // preventDefault only when a menu actually opens, so a right-click in the
      // inter-region gutter, or on the tree sidebar that overlays this container
      // and owns its own menu, falls through instead of being a dead zone
      if (!p.oob && px >= treeSidebarRightEdge(model)) {
        e.preventDefault()
        model.setHoveredFeature(undefined)
        model.openContextMenu({
          clientX: e.clientX,
          clientY: e.clientY,
          refName: p.refName,
          // anchors "sort rows by color here" on the clicked column, so it
          // must be the base drawn there (coord0 is off by one when reversed)
          pos: basePaintedAt(p, p.offset),
          hit: model.featureAt(px, e.clientY - rect.top),
        })
      }
    }
    return (
      <DisplayChrome
        model={model}
        factory={MultiRowRendererFactory}
        testid="multirow-display"
        // its content is all absolutely positioned, so without a height the
        // container collapses and receives no pointer events at all
        style={{ height: model.height }}
        // One pointer source for the whole display: the hit-test, the tooltip
        // and the guides all come off the chrome's single measurement, in one
        // frame.
        onPointerPosition={state => {
          model.setHoveredFeature(
            state ? model.featureAt(state.x, state.y) : undefined,
          )
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
            <PointerLayer model={model} mouseTracker={mouseTracker} />
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default LinearMultiRowFeatureDisplayComponent
