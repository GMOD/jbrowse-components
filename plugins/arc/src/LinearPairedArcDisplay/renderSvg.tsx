import { renderArcSvg as renderSharedArcSvg } from '../shared/renderArcSvg.tsx'
import Arcs from './components/Arcs.tsx'

import type { LinearPairedArcDisplayModel } from './model.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

export function renderArcSvg(
  model: LinearPairedArcDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderSharedArcSvg(model, Arcs, opts)
}
