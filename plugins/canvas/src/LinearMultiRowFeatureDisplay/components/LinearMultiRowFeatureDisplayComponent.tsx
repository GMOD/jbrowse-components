import type React from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

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
  const { height, sources, rowHeight, sidebarOffset } = model
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = model.featureAt(e.clientX - rect.left, e.clientY - rect.top)
    model.setHoveredFeature(
      hit ? { ...hit, clientX: e.clientX, clientY: e.clientY } : undefined,
    )
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
        onContextMenu={() => {
          model.setHoveredFeature(undefined)
        }}
        style={{ width: view.width, height, position: 'absolute', left: 0 }}
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
      <TreeSidebar model={model} />
      <MultiRowTooltip model={model} />
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
        {({ canvasRef }) => <MultiRowCanvas model={model} canvasRef={canvasRef} />}
      </DisplayChrome>
    )
  },
)

export default LinearMultiRowFeatureDisplayComponent
