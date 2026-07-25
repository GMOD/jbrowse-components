import { renderArcSvg as renderShared } from '../shared/renderArcSvg.tsx'
import Arcs from './components/Arcs.tsx'

import type { LinearPairedArcDisplayModel } from './model.ts'

export async function renderArcSvg(model: LinearPairedArcDisplayModel) {
  return renderShared(model, Arcs)
}
