import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import { when } from 'mobx'

import {
  DEFAULT_SYNTENY_COLORS,
  LABEL_WIDTH,
} from './components/multiSyntenyBackendTypes.ts'
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
    height,
    rowHeight,
    rowSpacing,
    showSnps,
  } = model
  const { width, offsetPx } = view
  const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0

  if (genomeRows.size === 0) {
    return null
  }

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
    height,
    rowHeight,
    rowSpacing,
    bpToPx,
    colorBy,
    labelW,
    showSnps,
    colors: DEFAULT_SYNTENY_COLORS,
  })

  return <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
}
