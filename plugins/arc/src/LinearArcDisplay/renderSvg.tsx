import { renderArcSvg as renderShared } from '../shared/renderArcSvg.tsx'
import Arcs from './components/Arcs.tsx'

import type { LinearArcDisplayModel } from './model.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

export async function renderArcSvg(
  model: LinearArcDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderShared(model, Arcs, opts)
}
