import { renderArcSvg as renderSharedArcSvg } from '../shared/renderArcSvg.tsx'
import Arcs from './components/Arcs.tsx'

import type { LinearArcDisplayModel } from './model.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

export function renderArcSvg(
  model: LinearArcDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderSharedArcSvg(model, Arcs, opts)
}
