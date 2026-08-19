import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { ComparativeSurface } from '@jbrowse/synteny-core'

// The containing LinearSyntenyView, as seen from a level (its model, its
// canvas, and the canvas's wheel handler). Duck-typed rather than imported:
// the view model composes the level's own state model, so a real import would
// be circular. One declaration for all three readers, so the next field lands
// in one place instead of drifting across three partial copies.
export interface ParentViewDuck {
  width: number
  // measured + every row initialized; the level's `canRender` precondition,
  // because reading `width` before first layout throws
  initialized: boolean
  views: LinearGenomeViewModel[]
  scrollZoom: boolean
  overdrawPx: number
  initPending: boolean
  pendingAutoDiagonalize: boolean
  // paint the stubs for alignments whose mate is on a contig the facing row is
  // not displaying — a repaint, never a refetch
  showOffscreenMates: boolean
  // the same floor the ribbons are culled by, applied to the stubs so filtering
  // a hairball down does not leave a fringe of marks for what it hid
  minAlignmentLength: number
}

// One level of the stack, as seen from a synteny display nested inside it. Same
// circular-import reason as ParentViewDuck.
export interface LevelDuck {
  height: number
  level: number
  // the shared band, joined for the display: paint from the level, the two
  // not-the-answer-yet flags from the view above it
  surfaceReadiness: ComparativeSurface
}

// Identify a level while walking up from a display, so the display finds it by
// what it is rather than by counting hops (it sat 4 deep:
// display -> displays[] -> track -> tracks[] -> level). A hop count silently
// returns the wrong node if anything is ever inserted between the two, and the
// symptom is an undefined `height`/`level` projecting as NaN somewhere far away;
// findParentThatIs throws instead. Matched on the `type` literal, which is also
// what saved sessions persist — hence the stale 'ViewHelper' name for something
// that is not, and no longer pretends to be, a view.
export function isSyntenyLevel(thing: unknown): thing is LevelDuck {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'type' in thing &&
    thing.type === 'LinearSyntenyViewHelper'
  )
}
