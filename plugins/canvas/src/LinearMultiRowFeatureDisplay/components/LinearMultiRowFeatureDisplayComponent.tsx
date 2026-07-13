import type React from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import MultiRowColorLegend from './MultiRowColorLegend.tsx'
import MultiRowTooltip from './MultiRowTooltip.tsx'
import { MultiRowRendererFactory } from '../rendering/MultiRowRendererFactory.ts'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
        <svg
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
      {showLegend && colorLegend.length ? (
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: view.width,
            height,
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          <MultiRowColorLegend entries={colorLegend} canvasWidth={view.width} />
        </svg>
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
