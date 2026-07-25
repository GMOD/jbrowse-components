import { renderArcSvg as renderShared } from '../shared/renderArcSvg.tsx'
import Arcs from './components/Arcs.tsx'

import type { LinearArcDisplayModel } from './model.ts'

export async function renderArcSvg(model: LinearArcDisplayModel) {
  return renderShared(model, Arcs)
}
