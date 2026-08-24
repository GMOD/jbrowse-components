/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import {
  WiggleFamilySvgFrame,
  svgLegendRightPx,
  svgScalebarLeftPx,
} from '@jbrowse/plugin-wiggle'
import {
  ScoreRuleLines,
  YSCALEBAR_LABEL_OFFSET,
  YScaleBar,
} from '@jbrowse/wiggle-core'

import { drawManhattanBlocks } from './Canvas2DManhattanRenderer.ts'
import SvgLdLegend from './components/SvgLdLegend.tsx'

import type { ManhattanDisplayModel } from './components/manhattanDisplayTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { WiggleFamilySvgModel } from '@jbrowse/plugin-wiggle'
import type React from 'react'

// Importing the full LinearManhattanDisplayModel here would close a type cycle
// (factory return type → renderSvg action → model instance → factory return
// type), so this reuses the component's hand-rolled slice of the same model —
// which already covers every paint/legend input — plus the shared
// SvgChrome/axis/cross-hatch fields. Reusing it rather than re-declaring the
// fields keeps the export under the `_ModelSatisfiesComponentContract` guard in
// stateModelFactory.ts instead of adding a second slice that drifts on its own.
type RenderSvgModel = ManhattanDisplayModel & WiggleFamilySvgModel

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, ManhattanSvgBody)
}

function ManhattanSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model, view, height, canvasWidth } = props
  const legendRight = svgLegendRightPx(view, canvasWidth)
  return (
    <WiggleFamilySvgFrame
      {...props}
      clipIdPrefix="manhattan"
      paint={(ctx, { canvasWidth: w, drawHeight, renderBlocks }) => {
        drawManhattanBlocks(ctx, model.rpcDataMap, renderBlocks, {
          ...model.renderState,
          canvasWidth: w,
          canvasHeight: drawHeight,
        })
      }}
      // Over the plot rather than inside `paint`: the threshold is an
      // annotation on the axis, so it comes off the model's own
      // scoreRuleMarks, the same marks the screen overlay draws.
      overlay={
        model.scoreRuleMarks.length > 0 ? (
          <ScoreRuleLines marks={model.scoreRuleMarks} width={canvasWidth} />
        ) : null
      }
      // left y-axis (Manhattan is always linear, never density) plus the r² key
      // when LD coloring is active
      legend={
        <>
          {model.ticks ? (
            <g transform={`translate(${svgScalebarLeftPx(view)})`}>
              <YScaleBar ticks={model.ticks} orientation="left" />
            </g>
          ) : null}
          {model.ldColoringActive && model.showLdLegend ? (
            <g transform={`translate(0,${YSCALEBAR_LABEL_OFFSET})`}>
              <SvgLdLegend
                canvasWidth={legendRight}
                maxHeight={height - YSCALEBAR_LABEL_OFFSET}
                indexSnpMissing={model.indexSnpMissing}
                indexSnpOffscreen={model.indexSnpOffscreen}
              />
            </g>
          ) : null}
        </>
      }
    />
  )
}
