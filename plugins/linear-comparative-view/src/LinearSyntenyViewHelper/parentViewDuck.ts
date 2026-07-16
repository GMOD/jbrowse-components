import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The containing LinearSyntenyView, as seen from a level (its model, its
// canvas, and the canvas's wheel handler). Duck-typed rather than imported:
// the view model composes the level's own state model, so a real import would
// be circular. One declaration for all three readers, so the next field lands
// in one place instead of drifting across three partial copies.
export interface ParentViewDuck {
  width: number
  views: LinearGenomeViewModel[]
  scrollZoom: boolean
  overdrawPx: number
  autoDiagonalizeRequested: boolean
  autoDiagonalizeComplete: boolean
}
