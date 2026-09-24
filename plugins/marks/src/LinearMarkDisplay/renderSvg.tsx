/* eslint-disable react-refresh/only-export-components */
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { GroupLabelBoxes } from '@jbrowse/display-kit/GroupLabelBox'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { axisPlotBox } from '@jbrowse/display-ui'
import {
  SvgRowLabels,
  SvgTreeSidebar,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { rowLabelOffset } from '@jbrowse/wiggle-core'
import { ScorePlotSvgFrame } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'

import { markRowHeightPx } from './markList.ts'

import type { MarkDisplayModel } from './components/markDisplayTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { ScorePlotSvgModel } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'
import type React from 'react'

type RenderSvgModel = MarkDisplayModel & ScorePlotSvgModel

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, MarkSvgBody)
}

function MarkSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model, view, canvasWidth, height, overlays, opts } = props
  const { yTop, plotHeight } = axisPlotBox(height)
  const { sections, rowCount, rows } = model.facetLayout
  const rowHeight = markRowHeightPx(plotHeight, rowCount)
  return (
    <ScorePlotSvgFrame
      {...props}
      marks={model.markList}
      regions={model.rpcDataMap}
      renderState={model.renderState}
    >
      {overlays && !rows && sections.length > 0 ? (
        <g transform={`translate(0,${yTop})`}>
          <GroupLabelBoxes
            sections={sections.map(section => ({
              key: section.key,
              label: section.label,
              top: section.firstRow * rowHeight,
              height: section.rowCount * rowHeight,
            }))}
            left={0}
            width={canvasWidth}
            canvasHeight={plotHeight}
            theme={{ palette: resolvePalette({ configTheme: opts?.theme }) }}
          />
        </g>
      ) : null}
      {overlays && model.drawsRows ? (
        <g transform={`translate(0,${yTop})`}>
          {model.showRowLabels ? (
            <SvgRowLabels
              sources={model.sources}
              rowHeight={model.effectiveRowHeight}
              labelOffset={rowLabelOffset(
                model.axes,
                treeSidebarOffset(model),
                Math.max(-view.offsetPx, 0),
              )}
              availableHeight={plotHeight}
            />
          ) : null}
          <SvgTreeSidebar
            showTree={model.showTree}
            showLabels={false}
            hierarchy={model.hierarchy}
            sources={[]}
            rowHeight={model.effectiveRowHeight}
            treeAreaWidth={model.treeAreaWidth}
            clusterProvenance={model.rowTreeProvenance}
            contentBlocks={view.dynamicBlocks.contentBlocks}
          />
        </g>
      ) : null}
    </ScorePlotSvgFrame>
  )
}
