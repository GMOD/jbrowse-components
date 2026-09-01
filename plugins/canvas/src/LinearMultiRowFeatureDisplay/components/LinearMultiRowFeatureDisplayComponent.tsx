import { eventPoint } from '@jbrowse/core/util/eventPoint'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { openContextMenuFromEvent } from '@jbrowse/display-kit/DisplayContextMenu'
import { FloatingSvgOverlay, PointerLayer } from '@jbrowse/display-ui'
import {
  DisplayContextMenu,
  DisplayCrosshairs,
  RowLabelsOverlay,
  RowSeparatorLines,
  TreeSidebar,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { MultiRowRendererFactory } from '../rendering/MultiRowRendererFactory.ts'
import { SEPARATOR_OPACITY } from '../rendering/rowBand.ts'
import MultiRowColorLegend from './MultiRowColorLegend.tsx'
import MultiRowHoverHighlight from './MultiRowHoverHighlight.tsx'
import MultiRowIndelGlyphOverlay from './MultiRowIndelGlyphOverlay.tsx'
import MultiRowTooltip from './MultiRowTooltip.tsx'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'
import type React from 'react'

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
    labelSources,
    effectiveRowHeight,
    sidebarOffset,
    showLegend,
    hasLegendEntries,
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
          />
        </svg>
      ) : null}
      <MultiRowHoverHighlight model={model} />
      {/* Also the display's doneness signal for capture gates: `sources` is
          derived from fetched features (the partition values), so this subtree
          cannot exist before data has loaded and been binned into rows --
          unlike `canvasDrawn`, which flips on an empty first paint. The
          color legend serves this role for categorical paintings but renders
          nothing when the palette is continuous (MAX_LEGEND_ENTRIES), so the row
          labels are the signal that holds in both modes. See
          agent-docs/reference/FIGURE_CAPTURE.md. */}
      <RowLabelsOverlay
        testId="multirow-row-labels"
        sources={labelSources}
        rowHeight={effectiveRowHeight}
        labelOffset={sidebarOffset}
        width={canvasWidthPx}
        height={height}
        showLabels={showRowLabels}
      />
      {/* portaled above the inter-region masks (see FloatingSvgOverlay) so the
          legend isn't buried at multi-region scale */}
      {showLegend && hasLegendEntries ? (
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
      // the inter-region gutter and the tree sidebar that overlays this
      // container resolve to nothing; what counts as either is
      // `contextTargetAt`'s to say
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
