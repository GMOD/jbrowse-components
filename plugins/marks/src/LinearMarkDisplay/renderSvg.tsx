/* eslint-disable react-refresh/only-export-components */
import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { GroupLabelBoxes } from '@jbrowse/display-kit/GroupLabelBox'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgHaloText, axisPlotBox } from '@jbrowse/display-ui'
import {
  SvgRowLabels,
  SvgTreeSidebar,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { rowLabelOffset } from '@jbrowse/wiggle-core'
import { ScorePlotSvgFrame } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'

import { markRowHeightPx } from './markList.ts'
import { TEXT_HALO_PX, TEXT_MARK_FONT_PX, placeTextMarks } from './textMarks.ts'

import type { MarkDisplayModel } from './components/markDisplayTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { ScorePlotSvgModel } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'
import type React from 'react'

type RenderSvgModel = MarkDisplayModel & ScorePlotSvgModel

// The text marks' labels as `<text>`, at the placements the screen draws. Not
// an observer, since a figure is frozen; it reads the model once.
function MarkTextSvg({
  model,
  blocks,
  canvasWidth,
  plotHeight,
}: {
  model: RenderSvgModel
  blocks: RenderBlock[]
  canvasWidth: number
  plotHeight: number
}) {
  const { palette, typography } = useStyleTheme()
  const font = { size: TEXT_MARK_FONT_PX, family: typography.fontFamily }
  const labels = placeTextMarks(
    model.textMarkEntries,
    model.rpcDataMap,
    blocks,
    { ...model.renderState, canvasWidth, canvasHeight: plotHeight },
    font,
    palette.text.primary,
  )
  return labels.map(label => (
    <SvgHaloText
      key={`${label.regionIndex}-${label.markIndex}-${label.instance}`}
      x={label.x}
      y={label.baseline}
      fontSize={font.size}
      fontFamily={font.family}
      anchor="middle"
      fill={label.color}
      halo={palette.background.paper}
      haloWidth={TEXT_HALO_PX * 2}
    >
      {label.text}
    </SvgHaloText>
  ))
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, MarkSvgBody)
}

function MarkSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model, view, canvasWidth, height, overlays, opts, renderBlocks } =
    props
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
      {model.markTypes.includes('text') ? (
        <g transform={`translate(0,${yTop})`}>
          <MarkTextSvg
            model={model}
            blocks={renderBlocks}
            canvasWidth={canvasWidth}
            plotHeight={plotHeight}
          />
        </g>
      ) : null}
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
          />
        </g>
      ) : null}
    </ScorePlotSvgFrame>
  )
}
