import { useRef } from 'react'

import { Menu, useMouseTracking } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import {
  DisplayChrome,
  FloatingSvgOverlay,
} from '@jbrowse/plugin-linear-genome-view'
import {
  DisplayCrosshairs,
  RowLabelsOverlay,
  TreeSidebar,
  treeSidebarRightEdge,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { MultiRowRendererFactory } from '../rendering/MultiRowRendererFactory.ts'
import MultiRowColorLegend from './MultiRowColorLegend.tsx'
import MultiRowHoverHighlight from './MultiRowHoverHighlight.tsx'
import MultiRowIndelGlyphOverlay from './MultiRowIndelGlyphOverlay.tsx'
import MultiRowTooltip from './MultiRowTooltip.tsx'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

const MultiRowCanvas = observer(function MultiRowCanvas({
  model,
  canvasRef,
}: {
  model: LinearMultiRowFeatureDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const {
    height,
    sources,
    effectiveRowHeight,
    sidebarOffset,
    showLegend,
    colorLegend,
    hiddenCategorySet,
  } = model
  return (
    <>
      <canvas
        data-testid="multirow_canvas"
        ref={canvasRef}
        style={{
          width: view.trackWidthPx,
          height,
          position: 'absolute',
          left: 0,
          // pinned rather than left to the static flow: the pointer handlers
          // measure the chrome container, so the canvas has to share its origin
          top: 0,
        }}
      />
      <MultiRowIndelGlyphOverlay model={model} />
      <MultiRowHoverHighlight model={model} />
      {/* Also the display's doneness signal for capture gates: `sources` is
          derived from fetched features (the partition values), so this subtree
          cannot exist before data has loaded and been binned into rows --
          unlike `canvasDrawn`/`-done`, which flips on an empty first paint. The
          color legend serves this role for categorical paintings but renders
          nothing when the palette is continuous (MAX_LEGEND_ENTRIES), so the row
          labels are the signal that holds in both modes. See
          agent-docs/guides/SCREENSHOT_CAPTURE_RACE.md. */}
      <RowLabelsOverlay
        testId="multirow-row-labels"
        sources={sources}
        rowHeight={effectiveRowHeight}
        labelOffset={sidebarOffset}
        width={view.trackWidthPx}
        height={height}
      />
      {/* portaled above the inter-region masks (see FloatingSvgOverlay) so the
          legend isn't buried at multi-region scale */}
      {showLegend && colorLegend.length ? (
        <FloatingSvgOverlay width={view.trackWidthPx} height={height}>
          <MultiRowColorLegend
            entries={colorLegend}
            canvasWidth={view.trackWidthPx}
            maxHeight={height}
            hiddenLabels={hiddenCategorySet}
            onDismiss={() => {
              model.setShowLegend(false)
            }}
          />
        </FloatingSvgOverlay>
      ) : null}
      <TreeSidebar model={model} />
      {model.contextMenuInfo ? (
        <Menu
          open
          onMenuItemClick={callback => {
            callback()
          }}
          onClose={() => {
            model.closeContextMenu()
          }}
          anchorReference="anchorPosition"
          anchorPosition={{
            top: model.contextMenuInfo.clientY,
            left: model.contextMenuInfo.clientX,
          }}
          menuItems={model.contextMenuItems()}
        />
      ) : null}
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
    const ref = useRef<HTMLDivElement>(null)
    // One pointer source for the whole display: the hit-test, the tooltip, and
    // the guides all come off this measurement, in one frame.
    const { mouseState, handleMouseMove, handleMouseLeave } = useMouseTracking(
      ref,
      state => {
        model.setHoveredFeature(
          state ? model.featureAt(state.x, state.y) : undefined,
        )
      },
    )
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
        ref={ref}
        // its content is all absolutely positioned, so without a height the
        // container collapses and receives no pointer events at all
        style={{ height: model.height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={e => {
          onClick(e)
        }}
        onContextMenu={e => {
          onContextMenu(e)
        }}
      >
        {({ canvasRef }) => (
          <>
            <MultiRowCanvas model={model} canvasRef={canvasRef} />
            {mouseState ? (
              <>
                <DisplayCrosshairs
                  model={model}
                  mouseX={mouseState.x}
                  mouseY={mouseState.y}
                />
                <MultiRowTooltip model={model} mouseState={mouseState} />
              </>
            ) : null}
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default LinearMultiRowFeatureDisplayComponent
