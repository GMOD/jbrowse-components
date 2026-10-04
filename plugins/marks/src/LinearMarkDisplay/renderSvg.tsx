/* eslint-disable react-refresh/only-export-components */
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { GroupLabelBoxes } from '@jbrowse/display-kit/GroupLabelBox'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgHaloText, axisPlotBox } from '@jbrowse/display-ui'
import { SvgTreeSidebar } from '@jbrowse/tree-sidebar'
import { ScorePlotSvgFrame } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'

import { TEXT_HALO_PX, TEXT_MARK_FONT_PX, placeTextMarks } from './textMarks.ts'

import type { MarkDisplayModel } from './components/markDisplayTypes.ts'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type React from 'react'

type RenderSvgModel = MarkDisplayModel & LgvSvgExportable

// The text marks' labels as `<text>`, at the placements the screen draws,
// measured in the export's font and inheriting it. Not an observer, since a
// figure is frozen; it reads the model once.
function MarkTextSvg({
  model,
  blocks,
  canvasWidth,
  plotHeight,
  fontFamily,
}: {
  model: RenderSvgModel
  blocks: RenderBlock[]
  canvasWidth: number
  plotHeight: number
  fontFamily: string | undefined
}) {
  const palette = usePalette()
  const font = { size: TEXT_MARK_FONT_PX, family: fontFamily }
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
  const { model, canvasWidth, height, overlays, opts, renderBlocks } = props
  const plotGeometry = axisPlotBox(height)
  const { yTop, plotHeight } = plotGeometry
  const { sections, rows } = model.facetLayout
  const rowHeight = model.effectiveRowHeight
  return (
    <ScorePlotSvgFrame
      {...props}
      plotGeometry={plotGeometry}
      marks={model.markList}
      regions={model.rpcDataMap}
      renderState={model.renderState}
    >
      {overlays ? (
        <g transform={`translate(0,${yTop})`}>
          {model.markTypes.includes('text') ? (
            <MarkTextSvg
              model={model}
              blocks={renderBlocks}
              canvasWidth={canvasWidth}
              plotHeight={plotHeight}
              fontFamily={opts?.fontFamily || undefined}
            />
          ) : null}
          {!rows && sections.length > 0 ? (
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
            />
          ) : null}
          {model.svgSidebar ? (
            <SvgTreeSidebar
              sidebar={model.svgSidebar}
              text={opts}
              scrollTop={model.scrollTop}
              availableHeight={plotHeight}
            />
          ) : null}
        </g>
      ) : null}
    </ScorePlotSvgFrame>
  )
}
