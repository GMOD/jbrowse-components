import { MISMATCH_COLOR } from '@jbrowse/alignments-core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import { CoverageYScaleBar } from '@jbrowse/plugin-alignments'
import { when } from 'mobx'

import { LABEL_WIDTH } from './components/multiSyntenyBackendTypes.ts'
import { renderMultiSyntenyToCtx } from './components/Canvas2DMultiSyntenyRenderer.ts'

import type { MultiLGVSyntenyDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(model: MultiLGVSyntenyDisplayModel) {
  const view = getContainingView(model) as LGV
  await when(() => model.genomeRows.size > 0 || !!model.error)

  const {
    genomeRows,
    displayedGenomes,
    colorBy,
    syntenyAreaHeight,
    syntenyCoverageHeight,
    showCoverage,
    rowHeight,
    rowSpacing,
    showSnps,
    rpcDataMap,
  } = model
  const { width, offsetPx } = view
  const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0

  if (genomeRows.size === 0) {
    return null
  }

  const { palette } = createJBrowseTheme()
  const ctx = new SvgCanvas()
  const bpToPx = (refName: string, coord: number) => {
    const result = view.bpToPx({ refName, coord })
    if (result === undefined) {
      return undefined
    }
    return result.offsetPx - offsetPx
  }

  renderMultiSyntenyToCtx(ctx, genomeRows, displayedGenomes, {
    width,
    height: syntenyAreaHeight,
    rowHeight,
    rowSpacing,
    bpToPx,
    colorBy,
    labelW,
    showSnps,
    coverageHeight: syntenyCoverageHeight,
    coverageRegions: showCoverage
      ? [...rpcDataMap.values()]
      : [],
    colors: {
      mismatch: MISMATCH_COLOR,
      deletion: palette.deletion,
      insertion: palette.insertion,
      baseA: palette.bases.A.main,
      baseC: palette.bases.C.main,
      baseG: palette.bases.G.main,
      baseT: palette.bases.T.main,
    },
    coverageColor: palette.coverage,
  })

  const { coverageTicks } = model

  return (
    <g>
      <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
      {showCoverage && coverageTicks ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <CoverageYScaleBar model={{ coverageTicks }} />
        </g>
      ) : null}
    </g>
  )
}
