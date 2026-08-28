import { animationAllowed, getSession } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { OffscreenMateLocus } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { AnimationMode, Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Padding around the mate locus, as a fraction of its own width per side. The
// span is where the hidden alignments land and nothing more, so shown exactly
// it puts their ribbons hard against both edges of the row with nothing around
// them to read against. Applied HERE rather than handed to `navToLocString`, so
// the floor below is the width the row actually lands at.
export const OFFSCREEN_MATE_NAV_GROW = 0.2

// The narrowest window a mark may navigate to. A single small anchor is a
// perfectly ordinary thing to click, and its own span can be a few hundred bp —
// framed exactly, the row lands at sequence-level zoom showing that one
// alignment and nothing to place it against, which is the opposite failure from
// the whole-chromosome one this fixes.
export const OFFSCREEN_MATE_NAV_MIN_BP = 20_000

/**
 * The window a clicked mark frames on its row: the mate's own locus, padded,
 * and widened to the floor if that is still narrower. Clamped to the contig,
 * since the caller has the region and a window off its end frames blank.
 *
 * The floor is a WIDTH, and the padding is inside it, so the number here is the
 * number the row lands at. Padding afterwards instead made a documented 20kb
 * minimum a 28kb one — and 24kb at the origin, where only the left side clips,
 * which is the asymmetry deriving `start` from the span already removed once.
 *
 * INTERBASE, and a span rather than a locstring: the click used to hand
 * `navToLocString` a string for it to parse back into these two numbers, which
 * only made sense while the destination was also a REGION REPLACEMENT. The row
 * now keeps its regions and frames a window in them, so the numbers travel as
 * numbers. No locus at all means the whole contig — the answer a click gave
 * before there were coordinates.
 */
export function navSpan(
  region: { start: number; end: number },
  locus?: OffscreenMateLocus,
) {
  if (!locus) {
    return { start: region.start, end: region.end }
  }
  const padded = Math.round(
    (locus.end - locus.start) * (1 + 2 * OFFSCREEN_MATE_NAV_GROW),
  )
  const span = Math.max(OFFSCREEN_MATE_NAV_MIN_BP, padded)
  const start = Math.max(
    region.start,
    Math.min(
      region.end - span,
      Math.round((locus.start + locus.end - span) / 2),
    ),
  )
  return { start, end: Math.min(region.end, start + span) }
}

// The view-wide follow state a mark's navigation borrows. A state tree node
// because `release` has to know THIS is still alive — it is what gets written.
export interface FollowAnchorHost extends IStateTreeNode {
  followSynteny: boolean
  followAnchorIndex: number
  // identity only, so `unknown` is all `release` needs from a row
  views: readonly unknown[]
  setFollowAnchorIndex: (idx: number) => void
}

/**
 * A taken follow anchor and the undo for it. Named so that a caller with no
 * follow host at all — BreakpointSplitView is a panel stack with no such mode —
 * can stand in the inert take rather than branch around every use of one.
 */
export interface FollowAnchorTake {
  taken: boolean
  release: () => void
}

/**
 * The take for a stack that cannot follow: nothing was moved, so nothing is
 * given back.
 */
export function noFollowAnchor(): FollowAnchorTake {
  return {
    taken: false,
    release() {},
  }
}

/**
 * Point the follow at `row` for a navigation, and hand back the undo for it.
 *
 * TAKEN BEFORE the navigation, because the follow propagates AWAY from the
 * anchor: a row navigated while some other row holds it is a row the next
 * follow pass pulls straight back, so the click would post its snackbar and
 * change nothing. Which is what makes giving it back this module's problem —
 * the take is a state change the navigation has not earned yet, and only a
 * LANDED navigation raises the snackbar that can undo it. Every other exit has
 * to release, and so does that snackbar's Undo.
 *
 * `release` is safe to call on any path and any number of times. It writes only
 * while the HOST is alive — the node it writes, which is why it is not a
 * liveness test a caller supplies: handed the navigated row's instead, the one
 * exit that most needs releasing (the row died mid-flight) is the one where the
 * test reads false and the anchor is kept. And only while the anchor is still
 * the one this take set: snackbars stack, and an older one's cleanup must not
 * drag the anchor off a row a later click moved it to.
 *
 * With the follow off nothing is taken and `release` writes nothing at all —
 * the anchor is a persisted setting this click never touched, and putting a
 * value back that was never moved silently re-points it at whichever row a mark
 * was last clicked on.
 */
export function takeFollowAnchor(
  host: FollowAnchorHost,
  row: number,
): FollowAnchorTake {
  const previous = host.followAnchorIndex
  const anchored = host.views[row]
  const taken = host.followSynteny && previous !== row
  if (taken) {
    host.setFollowAnchorIndex(row)
  }
  return {
    taken,
    release() {
      // By node, not by index: a removal renumbers the rows, and
      // `reconcileLevels` clamps the anchor, so the original `row` stops naming
      // the row this take pointed at. Liveness first — the read is what throws.
      if (taken && isAlive(host)) {
        const holder = host.views.indexOf(anchored)
        if (holder !== -1 && host.followAnchorIndex === holder) {
          host.setFollowAnchorIndex(previous)
        }
      }
    },
  }
}

/**
 * Whether a mark's click may FLY to a contig the row already displays rather
 * than jump to it.
 *
 * Only the scroll class can be flown at all — the other one replaces the row's
 * displayed regions, and there is no path through a coordinate space the
 * destination is not in. This is the second half: whether flying that path is
 * the right thing here.
 *
 * The reader's own answer first (`animationAllowed` — the session preference
 * and, under 'system', the OS reduced-motion setting), and then the one thing
 * about this stack that makes the arc wrong: `linkViews` holds the rows
 * together in PIXELS, and `installLinkedViewSync` replays a row's `zoomTo` onto
 * the others but not its scroll. So a flight there pulls every row back to the
 * arc's apex and drops them all in again while one of them travels — a picture
 * of the stack coming apart. The jump is what those rows keep.
 */
export function mateFlightAllowed(
  host: { linkViews: boolean },
  mode: AnimationMode,
) {
  return animationAllowed(mode) && !host.linkViews
}

/**
 * What a row was showing before a mark's click replaced it, as the function
 * that puts it back. `navToLocString` REPLACES `displayedRegions`, so what the
 * click discards may be a region list built over several navigations — "show
 * all regions" is a different destination, not an undo.
 *
 * `displayedRegions` is a frozen `Region[]`, so a copy of the array is the whole
 * of what has to be kept, and the captured objects are plain — nothing here
 * holds an MST node that could be destroyed under the snackbar.
 *
 * A bp WINDOW, not a pixel pair, for the reason `showRegionsWithUndo` states:
 * a snackbar carrying an action never auto-hides, so a capture and its Undo can
 * be a window resize apart, and pixels mean nothing without the width they were
 * measured at.
 *
 * Regions first: `setWindow` clamps against the region set, so restoring into
 * the wrong one lands somewhere else.
 */
export function captureRowViewport(view: LinearGenomeViewModel) {
  const regions: Region[] = [...view.displayedRegions]
  const { windowWidthBp, windowStartBp } = view
  return () => {
    if (isAlive(view)) {
      view.setDisplayedRegions(regions)
      view.setWindow(windowWidthBp, windowStartBp)
    }
  }
}

/**
 * Every row's viewport, as one function that puts them all back.
 *
 * The follow re-places every other row when this one takes the anchor, so the
 * click moves the whole stack and restoring one row leaves it mirrored: the
 * click's arrangement under the pre-click anchor.
 */
export function captureStackViewports(views: LinearGenomeViewModel[]) {
  const restores = views.map(view => captureRowViewport(view))
  return () => {
    for (const restore of restores) {
      restore()
    }
  }
}

/**
 * The facing row's own region for a contig a mark names, or undefined when that
 * assembly does not have it.
 *
 * WHOLE-CONTIG, because a region the row does not yet display has no other
 * natural extent — the window inside it is `navSpan`'s answer, and the two are
 * separate so panning off the mark's locus stays inside the region rather than
 * running out of it.
 *
 * `getCanonicalRefName2` rather than `getCanonicalRefName`: mate names come out
 * of an alignment file, the facing assembly may spell them differently, and the
 * strict one THROWS when the aliases have not loaded. The fallback there is the
 * name as given, which then simply fails to match below and reaches the caller
 * as "not found" — the same answer an absent contig gets.
 */
export function mateRegion(
  node: IStateTreeNode,
  view: LinearGenomeViewModel,
  refName: string,
) {
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName
    ? getSession(node).assemblyManager.get(assemblyName)
    : undefined
  const canonical = assembly?.getCanonicalRefName2(refName)
  return canonical
    ? assembly?.regions?.find(r => r.refName === canonical)
    : undefined
}
