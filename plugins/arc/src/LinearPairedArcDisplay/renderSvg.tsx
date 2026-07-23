import { renderArcSvg as renderShared } from '../shared/renderArcSvg.tsx'
import Arcs from './components/Arcs.tsx'

import type { LinearPairedArcDisplayModel } from './model.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

export async function renderArcSvg(
  model: LinearPairedArcDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderShared(model, Arcs, opts)
}
