import type { FollowHost } from '../SyntenyFollow/followHost.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type {
  AttributeRange,
  ComparativeSurface,
  LodMode,
  SyntenyColorBy,
} from '@jbrowse/synteny-core'

// The containing LinearSyntenyView, as seen from a level and from the synteny
// displays inside it. Duck-typed rather than imported: the view model composes
// the level's own state model, so a real import would be circular. One
// declaration for every reader, so the next field lands in one place instead of
// drifting across partial copies.
//
// THIS IS THE NON-INFERRED LINK THAT KEEPS `levels[i]` TYPED, and it is the one
// place the whole cycle is cut. The loop is view -> `levels` -> level ->
// `linearSyntenyDisplays` -> display -> `view`, and the display's `view` getter
// is the last edge. Naming `LinearSyntenyViewModel` there closes it, which is
// what forced `LinearComparativeView` to declare `levels` an `IAnyModelType` and
// made every read off a level `any` out to the SVG export and to embedding
// hosts. Erased here instead, the erasure costs only what a display reads off
// its view -- this list -- rather than everything reachable through a level.
//
// ADR-055's interface form does NOT substitute for it on this cycle, which is
// the one place that ADR is amended: see its "Duck-type the view on the display
// side" entry. Measured -- with all four instance types written as
// `interface X extends Instance<…> {}` and the display naming the view, the
// interfaces resolve to nothing rather than to `any`, and typecheck reports 28
// TS2339s for members that plainly exist (`display.featureData`,
// `view.views`, `level.renderParams`). Two mutually referring models terminate,
// which is the case the ADR verified on dotplot; a four-node loop with no
// non-inferred link does not.
//
// So a member belongs HERE rather than in an import.
export interface ParentViewDuck extends IStateTreeNode, FollowHost {
  width: number
  // measured + every row initialized; the level's `canRender` precondition,
  // because reading `width` before first layout throws
  initialized: boolean
  views: LinearGenomeViewModel[]
  scrollZoom: boolean
  overdrawPx: number
  initPending: boolean
  pendingAutoDiagonalize: boolean
  // whether the container mounted this view's body, counting any view this one
  // is nested inside; a view below the fold has no canvas, so it will never
  // paint (see ComparativeSurface.hostMounted)
  effectiveBodyMounted: boolean
  // paint the marks for alignments whose mate is on a contig the facing row is
  // not displaying — a repaint, never a refetch
  showOffscreenMates: boolean
  // whether the file was queried from the LOWER row as well, which is what says
  // the lower row's mark strip can be complete — see `laneData`
  bidirectionalFetch: boolean
  // the same floor the ribbons are culled by, applied to the marks so filtering
  // a hairball down does not leave a fringe of marks for what it hid
  minAlignmentLength: number
  // The view-wide ribbon settings a display renders and fetches by. View-wide
  // rather than per display on purpose: one opacity slider, one CIGAR mode and
  // one LOD tier govern every level, so a display reads them here rather than
  // carrying its own.
  alpha: number
  fadeThinAlignments: boolean
  opacityByIdentity: boolean
  drawCIGAR: boolean
  drawCIGARMatchesOnly: boolean
  lodMode: LodMode
  // The assembly the chromosome-painting modes key on, so a region keeps its
  // color as it is traced across levels. Undefined until a row knows its own.
  anchorAssemblyName: string | undefined
  // The view's accumulated domain per numeric attribute, which an
  // `attribute:<name>` ramp scales to — widened by every fetch that lands, so a
  // pan does not re-scale the colors under the reader.
  attributeRanges: Record<string, AttributeRange>
  observeAttributeRanges: (ranges: Record<string, AttributeRange>) => void
  // The per-track half of the color state: a track's own pinned mode and its
  // slot in the view's palette, both keyed by trackId.
  resolveColorBy: (trackId: string) => SyntenyColorBy
  trackColorFor: (trackId: string) => string
  // The follow state (`FollowHost`) is read by the off-screen mate click,
  // which navigates a row: a row the follow MOVES is re-asserted onto the
  // anchor's mapping the moment it settles, so a click on one of its marks
  // would post its snackbar and change nothing. `holdFollowAnchor` runs a
  // navigation as the follow's own rather than as a gesture that takes it.
  holdFollowAnchor: <T>(fn: () => T) => T
  //
  // Also read by that click, to decide whether it may FLY to the contig rather
  // than jump: with the rows locked in pixels, the flight's zoom-out arc is
  // replayed onto every row by `installLinkedViewSync` while its pan is not, so
  // the whole stack would pull back and only one row would travel.
  linkViews: boolean
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
