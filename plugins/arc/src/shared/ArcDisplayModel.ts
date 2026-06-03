import type { LinearArcDisplayModel } from '../LinearArcDisplay/model.ts'
import type { LinearPairedArcDisplayModel } from '../LinearPairedArcDisplay/model.ts'

// Shared chrome (loading bar, error display, container) is identical for both
// arc displays; this union is the prop type those components accept.
export type ArcDisplayModel =
  | LinearArcDisplayModel
  | LinearPairedArcDisplayModel
