import { renderArcSvg as renderShared } from '../shared/renderArcSvg.tsx'
import Arcs from './components/Arcs.tsx'

import type { LinearPairedArcDisplayModel } from './model.ts'

// The lazy boundary for this display's export path — see the twin in
// LinearArcDisplay/renderSvg.tsx for why it is a module rather than two
// `import()`s inlined into the model.
export async function renderArcSvg(model: LinearPairedArcDisplayModel) {
  return renderShared(model, Arcs)
}
