import { Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import {
  DisplayChrome,
  FloatingSvgOverlay,
} from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { MultiRowRendererFactory } from '../rendering/MultiRowRendererFactory.ts'
import MultiRowColorLegend from './MultiRowColorLegend.tsx'
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
    hoveredFeature,
    height,
    sources,
    rowHeight,
    sidebarOffset,
    showLegend,
    colorLegend,
    hiddenCategorySet,
  } = model
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = model.featureAt(e.clientX - rect.left, e.clientY - rect.top)
    model.setHoveredFeature(
      hit ? { ...hit, clientX: e.clientX, clientY: e.clientY } : undefined,
    )
  }
  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = model.featureAt(e.clientX - rect.left, e.clientY - rect.top)
    if (hit) {
      model.selectFeatureById(hit.id, hit.regionIndex)
    }
  }
  function onContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const p = view.pxToBp(px)
    model.setHoveredFeature(undefined)
    if (!p.oob) {
      model.openContextMenu({
        clientX: e.clientX,
        clientY: e.clientY,
        refName: p.refName,
        pos: Math.floor(p.coord0),
        hit: model.featureAt(px, e.clientY - rect.top),
      })
    }
  }
  return (
    <>
      <canvas
        data-testid="multirow_canvas"
        ref={canvasRef}
        onMouseMove={e => {
          onMouseMove(e)
        }}
        onMouseLeave={() => {
          model.setHoveredFeature(undefined)
        }}
        onClick={e => {
          onClick(e)
        }}
        onContextMenu={e => {
          onContextMenu(e)
        }}
        style={{
          width: view.width,
          height,
          position: 'absolute',
          left: 0,
          cursor: hoveredFeature ? 'pointer' : 'default',
        }}
      />
      {sources.length ? (
        // The display's doneness signal for capture gates. `sources` is derived
        // from fetched features (the partition values), so this subtree cannot
        // exist before data has loaded and been binned into rows -- unlike
        // `canvasDrawn`/`-done`, which flips on an empty first paint, and unlike
        // the DisplayChrome wrapper, which collapses to height 0 and so never
        // passes a `visible: true` selector wait. The color legend serves this
        // role for categorical paintings but renders nothing when the palette is
        // continuous (MAX_LEGEND_ENTRIES), so the row labels are the signal that
        // holds in both modes. See agent-docs/guides/SCREENSHOT_CAPTURE_RACE.md.
        <svg
          data-testid="multirow-row-labels"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: view.width,
            height,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <SvgRowLabels
            sources={sources}
            rowHeight={rowHeight}
            labelOffset={sidebarOffset}
            availableHeight={height}
          />
        </svg>
      ) : null}
      {/* portaled above the inter-region masks (see FloatingSvgOverlay) so the
          legend isn't buried at multi-region scale */}
      {showLegend && colorLegend.length ? (
        <FloatingSvgOverlay width={view.width} height={height}>
          <MultiRowColorLegend
            entries={colorLegend}
            canvasWidth={view.width}
            maxHeight={height}
            hiddenLabels={hiddenCategorySet}
            onDismiss={() => {
              model.setShowLegend(false)
            }}
          />
        </FloatingSvgOverlay>
      ) : null}
      <TreeSidebar model={model} />
      <MultiRowTooltip model={model} />
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
    return (
      <DisplayChrome
        model={model}
        factory={MultiRowRendererFactory}
        testid="multirow-display"
      >
        {({ canvasRef }) => (
          <MultiRowCanvas model={model} canvasRef={canvasRef} />
        )}
      </DisplayChrome>
    )
  },
)

export default LinearMultiRowFeatureDisplayComponent
