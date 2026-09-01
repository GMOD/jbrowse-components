import {
  animationAllowed,
  assembleLocString,
  getSession,
} from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { OffscreenMateLocus } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { FollowHost } from '../SyntenyFollow/followHost.ts'
import type { AnimationMode, Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Padding around the mate locus, as a fraction of its own width per side, so
// the ribbons that gain both ends have something to be read against.
export const OFFSCREEN_MATE_NAV_GROW = 0.2

// The narrowest window a mark may navigate to: a small anchor framed exactly
// lands the row at sequence-level zoom with nothing around it.
export const OFFSCREEN_MATE_NAV_MIN_BP = 20_000

/**
 * The window a clicked mark frames on its row: the mate's own locus, padded,
 * widened to the floor if that is still narrower, and clamped to the contig.
 *
 * The floor is a WIDTH with the padding inside it, so the number here is the
 * number the row lands at. Interbase, and a span rather than a locstring. No
 * locus at all means the whole contig.
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
export interface FollowAnchorHost extends IStateTreeNode, FollowHost {
  // identity only, so `unknown` is all `release` needs from a row
  views: readonly unknown[]
  // runs a navigation as the follow's own rather than as a gesture: a gesture
  // on a followed row takes the anchor, and a move that anchored the row it
  // does NOT navigate must not have that undone by the row it does
  holdFollowAnchor: <T>(fn: () => T) => T
}

/**
 * A taken follow anchor and the undo for it. Named so that a caller with no
 * follow host at all — BreakpointSplitView is a panel stack with no such mode —
 * can stand in the inert take rather than branch around every use of one.
 */
export interface FollowAnchorTake {
  taken: boolean
  release: () => void
  hold: <T>(fn: () => T) => T
}

/**
 * The take for a stack that cannot follow: nothing was moved, so nothing is
 * given back.
 */
export function noFollowAnchor(): FollowAnchorTake {
  return {
    taken: false,
    release() {},
    hold: fn => fn(),
  }
}

/**
 * Point the follow at `row` for a navigation, and hand back the undo for it.
 *
 * TAKEN BEFORE the navigation, because the follow propagates AWAY from the
 * anchor: a row navigated while some other row holds it is a row the next
 * follow pass pulls straight back. That makes giving it back this module's
 * problem — every exit that does not land has to release, and so does the
 * snackbar's Undo.
 *
 * `release` is safe on any path and any number of times. It writes only while
 * the HOST is alive — the node it writes, so a row that died mid-flight still
 * gives the anchor back — and only while the anchor is still the one this take
 * set, since snackbars stack. With the follow off nothing is taken and
 * `release` writes nothing at all.
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
    hold: fn => host.holdFollowAnchor(fn),
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
 * than jump to it: the reader's own answer (`animationAllowed`), and then the
 * one arrangement where the arc is wrong. `linkViews` holds the rows together
 * in PIXELS and `installLinkedViewSync` replays a row's `zoomTo` onto the
 * others but not its scroll, so a flight there pulls every row back to the
 * apex and drops them in again while one of them travels.
 */
export function mateFlightAllowed(
  host: { linkViews: boolean },
  mode: AnimationMode,
) {
  return animationAllowed(mode) && !host.linkViews
}

/**
 * What a row was showing before a mark's click, as the function that puts it
 * back. A click can change `displayedRegions`, and the row it changed may be
 * one the reader built over several navigations — "show all regions" is a
 * different destination, not an undo.
 *
 * A bp WINDOW, not a pixel pair: a snackbar carrying an action never
 * auto-hides, so a capture and its Undo can be a window resize apart. Regions
 * first, since `setWindow` clamps against the region set.
 */
function captureRowViewport(view: LinearGenomeViewModel) {
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
 * Where a clicked mark sends its row, and the locstring naming it.
 *
 * `scroll` for a contig the row already displays: its regions are right and its
 * window is not. `add` for one it does not, which the row gains rather than
 * swaps its list for. `none` when neither resolves, carrying what to tell the
 * reader.
 */
export type MateNavDestination =
  | { kind: 'scroll'; loc: string; refName: string; coord0: number }
  | {
      kind: 'add'
      loc: string
      regions: Region[]
      location: { refName: string; start: number; end: number }
    }
  | { kind: 'none'; reason: string }

/**
 * Resolve a mark's click against the row it names, without touching anything —
 * a viewport capture and the follow anchor are both taken after this answers.
 *
 * THE DRAWN SPAN DECIDES THE CLASS, and where the ribbons are is not where the
 * block is: `mateCumBp` is the facing row's own cumBp, read back through
 * `pxToBp` so a reversed region comes back right. A span landing off the layout
 * (`oob`) or on another contig is stale geometry, and the row holds — `locus` is
 * the coordinate this class exists to stop using, so there is nothing to fall
 * back to. Those two tests are the whole of what staleness can be caught by, and
 * a rearrangement WITHIN the named contig passes both; the message says what was
 * established rather than naming a cause.
 *
 * THE ADD BRANCH CANNOT LEAVE THE WINDOW OUTSIDE THE REGIONS, which is what
 * `showRegions` throws on. The row keeps its own region for the contig only when
 * that region REACHES the framed window; otherwise the whole contig replaces it.
 * The reachability test compares raw and the drop filter canonicalizes, which
 * are two different questions —
 * `agent-docs/ideas/offscreen-synteny-mates.md` §"Where the click sends the row".
 */
export function mateNavDestination({
  node,
  view,
  refName,
  mate,
}: {
  node: IStateTreeNode
  view: LinearGenomeViewModel
  refName: string
  mate?: { locus: OffscreenMateLocus; mateCumBp?: OffscreenMateLocus }
}): MateNavDestination {
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName
    ? getSession(node).assemblyManager.get(assemblyName)
    : undefined
  // `getCanonicalRefName2` rather than the strict one: mate names come out of
  // an alignment file, and the strict one THROWS before the aliases load
  const canonical = (name: string) =>
    assembly?.getCanonicalRefName2(name) ?? name
  const drawn = mate?.mateCumBp
  if (drawn && view.displayedRegions.length > 0) {
    const centerCumBp = (drawn.start + drawn.end) / 2
    const at = view.pxToBp(centerCumBp / view.bpPerPx - view.offsetPx)
    return at.oob || canonical(at.refName) !== canonical(refName)
      ? {
          kind: 'none',
          reason: `Could not show ${refName}: that mark's drawn position no longer lands on it`,
        }
      : {
          kind: 'scroll',
          refName: at.refName,
          coord0: at.coord0,
          loc: assembleLocString({
            refName: at.refName,
            start: at.coord0,
            end: at.coord0 + 1,
          }),
        }
  }
  const region = assembly?.getRegionForRefName(canonical(refName))
  if (!region) {
    return {
      kind: 'none',
      reason: `Could not find ${refName} in ${assemblyName}`,
    }
  }
  const { start, end } = navSpan(region, mate?.locus)
  const reaches = view.displayedRegions.some(
    r => r.refName === region.refName && start >= r.start && end <= r.end,
  )
  return {
    kind: 'add',
    regions: reaches
      ? [...view.displayedRegions]
      : [
          ...view.displayedRegions.filter(
            r => canonical(r.refName) !== region.refName,
          ),
          region,
        ],
    location: { refName: region.refName, start, end },
    loc: assembleLocString({ refName: region.refName, start, end }),
  }
}
