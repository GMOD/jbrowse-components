import { useId, useState } from 'react'

import { ScrollChrome } from '@jbrowse/core/ui'
import { useRowVirtualScroll } from '@jbrowse/core/util/useRowVirtualScroll'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { RowLabelsOverlay } from './RowLabelsOverlay.tsx'
import TreeSidebar from './TreeSidebar.tsx'
import { treeSidebarOffset } from './treeSidebarGeometry.ts'

import type { RowBand } from './arrangeRows.ts'
import type { RowLabelSource, TreeSidebarModel } from './types.ts'
import type { ReactNode } from 'react'

type RowResizeTarget = Parameters<typeof useRowVirtualScroll>[1]

export interface RowsPanelModel extends TreeSidebarModel, RowResizeTarget {
  scrollTop: number
  sources: RowLabelSource[]
  rowBands: readonly RowBand[]
  showRowLabels: boolean
  canvasWidthPx: number
}

/**
 * A row display's scrolled rows viewport, from `rowsTopOffset` down
 * `scrollViewportHeight`: the panel the wheel binds to, holding whatever the
 * display draws over its rows (`children`) and the sidebar's inline half, so a
 * wheel over the dendrogram or an overlay scrolls the rows it sits on. Beside
 * it, the portaled row labels and the scrollbar, which `aria-controls` the
 * panel.
 */
export const RowsPanel = observer(function RowsPanel({
  model,
  testIdPrefix,
  labelOffset = treeSidebarOffset(model),
  cursor,
  children,
}: {
  model: RowsPanelModel
  // names the panel `<prefix>-rows` and the labels `<prefix>-row-labels`
  testIdPrefix: string
  labelOffset?: number
  cursor?: string
  children?: ReactNode
}) {
  const id = useId()
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  useRowVirtualScroll(panel, model, containingLgv(model).scrollZoom)
  const {
    rowsTopOffset: top,
    scrollViewportHeight: height,
    canvasWidthPx: width,
  } = model
  return (
    <>
      <div
        ref={setPanel}
        id={id}
        data-testid={`${testIdPrefix}-rows`}
        style={{ position: 'absolute', top, left: 0, width, height, cursor }}
      >
        {children}
        <TreeSidebar model={model} top={top} />
      </div>
      <RowLabelsOverlay
        testId={`${testIdPrefix}-row-labels`}
        sources={model.sources}
        rowHeight={model.effectiveRowHeight}
        labelOffset={labelOffset}
        width={width}
        height={height}
        top={top}
        scrollTop={model.scrollTop}
        showLabels={model.showRowLabels}
        bands={model.rowBands}
      />
      <ScrollChrome model={model} controlsId={id} top={top} />
    </>
  )
})
