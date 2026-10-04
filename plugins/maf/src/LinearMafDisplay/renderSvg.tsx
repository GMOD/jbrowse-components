/* eslint-disable react-refresh/only-export-components */
import React from 'react'

import { paintInsertionLabels } from '@jbrowse/alignments-core'
import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { colorLongreadInv } from '@jbrowse/core/ui/palette'
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { mafCoverageBandColors } from '../LinearMafRenderer/coverageBandColors.ts'
import {
  MAF_CONSERVATION_MARK,
  MAF_COVERAGE_MARKS,
  MAF_ROWS_MARKS,
  mafInsertionParams,
} from '../LinearMafRenderer/mafMarks.ts'
import { drawMafAnnotations } from '../LinearMafRenderer/rendering/annotations.ts'
import { drawMafCodons } from '../LinearMafRenderer/rendering/codons.ts'
import { drawMafDeletionLabels } from '../LinearMafRenderer/rendering/deletions.ts'
import { drawMafEmptyLines } from '../LinearMafRenderer/rendering/emptyLines.ts'
import { drawInversions } from '../LinearMafRenderer/rendering/inversions.ts'
import { drawMafLabels } from '../LinearMafRenderer/rendering/labels.ts'
import {
  getContrastBaseMap,
  getFrameColors,
  getMafColorPalette,
} from '../LinearMafRenderer/util.ts'
import { SvgMafBandLabels } from './components/MafBandLabels.tsx'
import { visibleRowRange } from './components/visibleRegionGeometry.ts'
import { cullMafRows, encodeMafRows } from './encodeMafRows.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

export async function renderSvg(
  model: LinearMafDisplayModel,
  opts: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, MafSvgBody)
}

function MafSvgBody({
  model,
  canvasWidth: width,
  renderBlocks,
  overlays,
  opts,
}: LgvSvgBodyProps<LinearMafDisplayModel>) {
  const palette = usePalette()
  const {
    effectiveRowHeight,
    rowsHeight,
    topBands,
    rowsTopOffset,
    coverageBandActive,
    conservationBandActive,
    conservationDisplayHeight,
    scrollTop,
  } = model
  const colorPalette = getMafColorPalette(palette)
  // Each band paints into its own layer translated to that band's origin, so
  // the rows painter sees its band at offset 0, not the display's stack.
  const svgState = {
    ...model.renderState,
    rowsTop: 0,
    rowsHeight,
    palette: colorPalette,
  }
  const contrast = getContrastBaseMap(palette)
  const encodeProps = model.rowsEncodePropsIn(colorPalette)
  const shownRows = visibleRowRange(effectiveRowHeight, scrollTop, rowsHeight)
  const svgRows = new Map(
    [...model.rowsSources].map(([idx, source]) => [
      idx,
      cullMafRows(
        encodeMafRows(source, encodeProps),
        renderBlocks.filter(b => b.displayedRegionIndex === idx),
        width,
        shownRows,
      ),
    ]),
  )
  return (
    <>
      {coverageBandActive ? (
        <MarkSvgLayer
          marks={MAF_COVERAGE_MARKS}
          regions={model.rpcDataMap}
          blocks={renderBlocks}
          state={{
            ...svgState,
            coverage: {
              ...model.coverageBandState,
              height: topBands.reserved.coverage,
              colors: mafCoverageBandColors(palette),
            },
          }}
          width={width}
          height={topBands.reserved.coverage}
          opts={opts}
        />
      ) : null}
      {conservationBandActive ? (
        <g transform={`translate(0, ${topBands.top.conservation})`}>
          <MarkSvgLayer
            marks={[MAF_CONSERVATION_MARK]}
            regions={svgRows}
            blocks={renderBlocks}
            state={{
              ...svgState,
              conservation: { top: 0, height: conservationDisplayHeight },
            }}
            width={width}
            height={conservationDisplayHeight}
            opts={opts}
          />
        </g>
      ) : null}
      <g transform={`translate(0, ${rowsTopOffset})`}>
        {/* The row painters cull by row, not by pixel, so the partly scrolled
            top row starts above the box; on screen its canvas clips it, and a
            vector layer has no canvas edge to do that. */}
        <SvgClipRect
          id={`maf-rows-${svgNodeId(model)}`}
          width={width}
          height={rowsHeight}
        >
          <MarkSvgLayer
            marks={MAF_ROWS_MARKS}
            regions={svgRows}
            blocks={renderBlocks}
            state={svgState}
            width={width}
            height={rowsHeight}
            opts={opts}
            paint={(ctx, framed) => {
              // the overlay canvases the screen stacks over the rows canvas
              if (!overlays) {
                return
              }
              drawMafEmptyLines(ctx, model.visibleEmptyLines, colorPalette)
              drawMafAnnotations(
                ctx,
                model.visibleFrames,
                getFrameColors(palette),
              )
              paintInsertionLabels(
                ctx,
                renderBlocks,
                block => svgRows.get(block.displayedRegionIndex)?.insertions,
                framed,
                mafInsertionParams(framed),
              )
              drawMafDeletionLabels(ctx, model.visibleDeletions, colorPalette)
              drawMafLabels(
                ctx,
                model.visibleLabels,
                contrast,
                palette.text.primary,
              )
              drawMafCodons(ctx, model.visibleCodonGlyphs, palette.text.primary)
              drawInversions(ctx, model.visibleInversions, colorLongreadInv)
            }}
          />
        </SvgClipRect>
        {overlays ? (
          <SvgTreeSidebar
            sidebar={model.svgSidebar}
            text={opts}
            scrollTop={scrollTop}
            availableHeight={rowsHeight}
          />
        ) : null}
      </g>
      {/* The same titles the display shows on screen (`MafBandLabels`), and for
        the same reason: with both bands drawn they are told apart only by
        their Y-axis units, and an exported figure can't be hovered. */}
      {overlays ? <SvgMafBandLabels labels={model.bandLabels} /> : null}
    </>
  )
}
