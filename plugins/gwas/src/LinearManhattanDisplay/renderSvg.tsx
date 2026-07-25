import { renderWiggleFamilySvg } from '@jbrowse/plugin-wiggle'
import { YSCALEBAR_LABEL_OFFSET, YScaleBar } from '@jbrowse/wiggle-core'

import { drawManhattanBlocks } from './Canvas2DManhattanRenderer.ts'
import SvgLdLegend from './components/SvgLdLegend.tsx'

import type { ManhattanDisplayModel } from './components/manhattanDisplayTypes.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
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
  return renderWiggleFamilySvg({
    model,
    opts,
    clipIdPrefix: 'manhattan',
    paint: (ctx, { canvasWidth, drawHeight, renderBlocks }) => {
      const state = {
        ...model.renderState,
        canvasWidth,
        canvasHeight: drawHeight,
      }
      drawManhattanBlocks(ctx, model.rpcDataMap, renderBlocks, state)
    },
    // left y-axis (Manhattan is always linear, never density) plus the r² key
    // when LD coloring is active
    legend: ({ scalebarLeft, legendRight, ticks }) => (
      <>
        {ticks ? (
          <g transform={`translate(${scalebarLeft})`}>
            <YScaleBar ticks={ticks} orientation="left" />
          </g>
        ) : null}
        {model.ldColoringActive && model.showLdLegend ? (
          <g transform={`translate(0,${YSCALEBAR_LABEL_OFFSET})`}>
            <SvgLdLegend
              canvasWidth={legendRight}
              maxHeight={model.height - YSCALEBAR_LABEL_OFFSET}
              indexSnpMissing={model.indexSnpMissing}
              indexSnpOffscreen={model.indexSnpOffscreen}
            />
          </g>
        ) : null}
      </>
    ),
  })
}
