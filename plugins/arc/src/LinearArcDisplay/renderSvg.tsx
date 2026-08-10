import { renderArcSvg as renderShared } from '../shared/renderArcSvg.tsx'
import Arcs from './components/Arcs.tsx'

import type { LinearArcDisplayModel } from './model.ts'

// **This module is the lazy boundary for the export path, not a shim.** The
// model's `renderSvg` action reaches the export code through exactly one
// `import()`, and everything the export needs — the shared body and this
// display's glyph — is a plain static import here, behind it.
//
// It reads like an indirection worth deleting, and it was deleted once: the two
// imports moved into the model as a `Promise.all` of two `import()`s. That works
// and it is worse. One edge module means one dynamic import, one chunk, and one
// place that knows which `<Arcs>` pairs with the shared body; inlining it puts a
// second dynamic import in the hot path of every arc display and spreads the
// pairing across both models.
export async function renderArcSvg(model: LinearArcDisplayModel) {
  return renderShared(model, Arcs)
}
