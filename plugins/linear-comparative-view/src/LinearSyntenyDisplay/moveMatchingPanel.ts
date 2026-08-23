import { assembleLocStringRaw, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { getCanonicalRefNameFn } from '@jbrowse/synteny-core'
import { runInAction } from 'mobx'

import {
  captureStackViewports,
  takeFollowAnchor,
} from '../LinearSyntenyViewHelper/offscreenMateNav.ts'

import type {
  ResolvedSpan,
  SpanOfInterest,
} from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowAnchorTake } from '../LinearSyntenyViewHelper/offscreenMateNav.ts'
import type { FeatPos, LinearSyntenyDisplayModel } from './model.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * How a `navToResolvedSpan` ended. The callers have to tell the three apart:
 * only `replaced` discarded a region list, which is the one thing here worth an
 * Undo, and only `unmoved` means a follow anchor taken for this navigation was
 * never earned.
 */
export type SpanNavOutcome = 'inPlace' | 'replaced' | 'unmoved'

/**
 * A span with the one-base clamp applied, which is silent when left out: a
 * zero-width span assembles into an inverted locstring.
 *
 * Shared so a navigation and the snackbar reporting it cannot name two
 * different places.
 */
function clampedSpan(span: ResolvedSpan) {
  return {
    refName: span.refName,
    start: span.start,
    end: Math.max(span.start + 1, span.end),
  }
}

/**
 * Send `view` to a resolved span, the way every one-shot path does.
 *
 * A navigation rather than a pan: this changes what the row displays if the
 * span is on another contig, which the per-frame pass must not do — it uses
 * `positionViewOnSpan` instead.
 *
 * `navTo` FIRST, and `navToLocString` only as the fallback. Both send the row
 * to the right place; only `navTo` leaves it able to be sent anywhere else.
 * `navToLocString` resolving to a single location replaces `displayedRegions`
 * with the one contig it landed on, and the synteny fetch keeps a block only
 * when both ends are in view — so a whole-genome row is narrowed to one contig
 * by its own first successful move, and is never again offered an alignment
 * pointing off it. Under the follow that is permanent and self-inflicted: pan
 * the anchor to a locus matching another contig and every row holds while the
 * header reports "nothing aligns here", which is true only of the region set
 * the follow itself threw away.
 *
 * Falling back rather than pre-checking: "is this span inside the displayed
 * regions" is `navTo`'s own containment rule, and restating it here is how the
 * two come to disagree. It resolves both endpoints before it moves anything, so
 * a throw leaves the view untouched. A row genuinely not displaying the contig
 * — one the user navigated to a single region — still gets the replacement,
 * which is the only way to reach the span at all.
 *
 * Shared for the one-base clamp `clampedSpan` applies.
 *
 * IT REPORTS WHICH BRANCH IT TOOK, because they are not equally free. The
 * fallback discards a region list the reader may have built over several
 * navigations, so a caller that offers an Undo has to know it happened. And
 * `navToLocString` resolves WITHOUT navigating when the contig is not a refName
 * here and the text search raises a picker over the hits instead — ordinary for
 * a PAF naming contigs `1`,`2` against an assembly spelling them `chr1`,`chr2`.
 * Reported as a move, that left a follow anchor taken for a navigation that
 * never happened, which pulls every other row to a correspondence nothing
 * established.
 */
export async function navToResolvedSpan(
  view: LinearGenomeViewModel,
  span: ResolvedSpan,
): Promise<SpanNavOutcome> {
  const clamped = clampedSpan(span)
  try {
    view.navTo(clamped)
    return 'inPlace'
  } catch {
    // the span is not inside this row's displayed regions
  }
  const landed = await view.navToLocString(assembleLocStringRaw(clamped))
  return landed ? 'replaced' : 'unmoved'
}

/**
 * Move every panel in `panels` to `span`, and SETTLE UP for the anchor that was
 * taken to do it.
 *
 * Three things the two move items each got wrong on their own, which is why
 * this is one function rather than two spellings.
 *
 * NOTHING MOVED, NOTHING KEPT. The anchor is taken before the navigation,
 * because the follow propagates away from the anchor and a panel moved while
 * some other one holds it is a panel the next pass pulls straight back. That
 * makes the take a state change the navigation has not earned yet: a contig the
 * moving panel's assembly does not have — ordinary, since mate names come out
 * of the alignment file — fails both branches, and without the release the item
 * reported an error and re-pointed the follow at a different panel anyway.
 *
 * `allSettled`, so one panel's failure does not decide for the other. A
 * self-alignment moves BOTH neighbours, and the anchor is earned if either of
 * them landed.
 *
 * AN UNDO ONLY WHEN THERE IS SOMETHING TO PUT BACK, which is what keeps this
 * from being a snackbar on every move. `navToResolvedSpan` stays inside a
 * panel's own regions wherever it can, and that leaves nothing discarded — but
 * its fallback replaces `displayedRegions` with the one contig it landed on,
 * which is the permanent self-inflicted narrowing the navTo-first order exists
 * to avoid and cannot always avoid. A taken anchor counts too: the follow
 * re-places every other panel, so the click moved rows it never named.
 */
export async function movePanelsToSpan({
  panels,
  span,
  anchor,
  restore,
  session,
  followNote,
}: {
  panels: LinearGenomeViewModel[]
  span: ResolvedSpan
  anchor: FollowAnchorTake
  // the whole stack's viewports as captured BEFORE the take, since the follow
  // re-places every panel and restoring only the moved one leaves the stack
  // mirrored: the click's arrangement under the pre-click anchor
  restore: () => void
  session: AbstractSessionModel
  // how the snackbar names the panel the anchor went to, which differs by item:
  // the clicked panel for the LGV display, the one that stayed for a band
  followNote: string
}) {
  const settled = await Promise.allSettled(
    panels.map(panel => navToResolvedSpan(panel, span)),
  )
  const outcomes: SpanNavOutcome[] = []
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      outcomes.push(result.value)
    } else {
      session.notifyError(`${result.reason}`, result.reason)
    }
  }
  if (outcomes.some(outcome => outcome !== 'unmoved')) {
    if (anchor.taken || outcomes.includes('replaced')) {
      const loc = assembleLocStringRaw(clampedSpan(span))
      session.notify(
        anchor.taken ? `Showing ${loc}, ${followNote}` : `Showing ${loc}`,
        'info',
        {
          name: 'Undo',
          onClick: () => {
            // one transaction, so the follow sees the settled pre-click state
            // rather than a half-restored one
            runInAction(() => {
              restore()
              anchor.release()
            })
          },
        },
      )
    }
  } else {
    anchor.release()
  }
}

/**
 * The part of `view`'s visible window that lies on `refName`, or undefined
 * when the panel is not showing that contig — the case where there is no
 * window on this alignment's axis to map across.
 *
 * `dynamicBlocks` rather than `coarseDynamicBlocks`: this is read at the
 * moment of the click, so the debounced copy would answer with wherever the
 * panel was up to a tick ago.
 */
export function visibleSpanOnRefName(
  view: LinearGenomeViewModel,
  refName: string,
) {
  const blocks = view.dynamicBlocks.contentBlocks.filter(
    b => b.refName === refName,
  )
  return blocks.length
    ? {
        start: Math.min(...blocks.map(b => b.start)),
        end: Math.max(...blocks.map(b => b.end)),
      }
    : undefined
}

/**
 * The slice of the other axis that one loaded alignment puts opposite `window`,
 * resolved in the worker.
 *
 * THE WALK HAPPENS IN THE WORKER. The main thread holds no CIGARs for a band --
 * the bulk path is typed arrays, deliberately, because a whole-genome PAF is
 * millions of blocks and a chromosome-scale CIGAR runs to tens of megabytes --
 * so this asks the worker to resolve the one alignment and hands back three
 * numbers. `undefined` means the block carried no CIGAR after all.
 *
 * Shared by the click-driven move below and by the synteny follow, which differ
 * in what they do with a `undefined`: the move has none of the answer and hides
 * its menu item, the follow falls back to interpolating across the block (see
 * interpolateFollowSpan for why the two answer that differently).
 */
export async function resolveMatchingSpan({
  model,
  feat,
  window,
  toMate,
}: {
  model: LinearSyntenyDisplayModel
  feat: FeatPos
  window: SpanOfInterest
  toMate: boolean
}) {
  const { assemblyManager, rpcManager } = getSession(model)
  const sessionId = getRpcSessionId(model)
  const { adapterConfig } = model
  // Read BEFORE the call, and as a string: the span comes back canonicalized
  // against whichever panel it landed on -- `toMate` moves the mate axis (v1),
  // otherwise the feature axis (v0) -- and by the time it does, that panel may
  // be gone, where touching its MST regions throws.
  //
  // The AXIS's assembly rather than the feature's, because the operand this has
  // to agree with is view state: `alreadyShowing` compares against where the
  // moving row is and `positionViewOnSpan` against its `displayedRegions`. An
  // all-vs-all file can name a mate assembly the session does not have at all,
  // and resolving in that one would be resolving in the wrong namespace even
  // where it succeeds.
  const axis = toMate ? model.connectedViews?.v1 : model.connectedViews?.v0
  const axisAssemblyName = axis?.assemblyNames[0]
  const span = await rpcManager.call(
    sessionId,
    'SyntenyResolveMatchingRegion',
    // The two callers want opposite things, so neither handle can be a constant
    // here. `SyntenyFollow` fires this every settle and its latest-wins is
    // `seq`, not a token — an answer it discards is one it deliberately let
    // finish, because the per-level promise is shared by key and three
    // re-entrant passes ride one call, which its integration suite asserts. The
    // click-driven move below would take both, and has nowhere to put either: no
    // lifecycle owns the click, so a token would never be stopped, and the
    // display's status field belongs to its fetch autorun, whose `fetching` flag
    // is what raises the chip. Both are answered by giving the click a surface
    // of its own, not by picking a default here.
    // eslint-disable-next-line no-restricted-syntax
    {
      adapterConfig,
      // the block's own extent on the QUERY axis, which is the axis the band's
      // fetch queries -- so the lookup finds the feature whichever panel is
      // being moved
      //
      // Canonical since the fetch canonicalizes `refNameDict`, and this is the
      // one refName on this path that goes back OUT: the method extends
      // `RpcMethodTypeWithRenameRegions`, so the outbound pass maps it into the
      // adapter's namespace again. Do not rename it here as well.
      regions: [
        {
          refName: feat.refName,
          start: feat.start,
          end: feat.end,
          assemblyName: feat.assemblyName,
        },
      ],
      featureId: feat.id,
      window,
      toMate,
      // the resolved tier, matching the fetch that produced this feature id:
      // ids are not comparable across a tiered PIF's two tiers
      lodMode: model.lodTier,
    },
  )
  if (!span) {
    return undefined
  }
  // The second of the two adapter->canonical channels, and the reason this one
  // is not optional: `alreadyShowing` compares this refName against where the
  // moving row actually is, which is canonical, so canonicalizing only the
  // fetch would leave it never matching and renavigating on every wake.
  const canonical = await getCanonicalRefNameFn({
    assemblyManager,
    assemblyName: axisAssemblyName,
  })
  return { ...span, refName: canonical(span.refName) }
}

/**
 * Send one panel of a synteny view to the region the clicked band matches,
 * leaving its neighbour where it is.
 *
 * THE WINDOW, NOT THE FEATURE'S MIDPOINT, which is the whole difference from
 * "Center on feature": a published liftOver-style chain is one feature tens of
 * Mb long, so its midpoint is nowhere near what either panel is showing. And a
 * span rather than a point, so the moved panel matches the staying panel's
 * SCALE too and the band between them comes back near-vertical.
 *
 * The staying panel's window is passed IN, read once by `bandMoveTargets` when
 * the menu was built — the same reading that decided the item was offerable at
 * all, so the item and the action cannot disagree about whether there is a
 * window here.
 *
 * NO CIGAR, NO MOVE, and it SAYS SO. The menu gates on `hasCigar`, but that
 * flag is per-FETCH — true when any block in the response carried one — so a
 * file that mixes them (a chain set with a few CIGAR-less rows, a PAF
 * concatenated from two runs) puts the item on a block that has none and the
 * walk comes back empty. Navigating on an interpolated guess is what this
 * deliberately does not do; going quiet is not the alternative, since a menu
 * item that does nothing reads as a broken one.
 *
 * The message can name the CIGAR because that is the only way the resolve
 * answers `undefined` from a menu this session opened: the other way is an id
 * the worker cannot find, and `setRpcData` closes the menu on every refetch
 * precisely so a click cannot outlive the fetch its feature came from.
 *
 * IT TAKES THE FOLLOW ANCHOR, onto the panel that STAYS. A panel the follow
 * moves is re-asserted onto the anchor's mapping the moment it settles, and this
 * navigation is what wakes that pass — so with the follow on, "move the top
 * panel" ran and the follow put it back, while "move the bottom panel" moved the
 * anchor and dragged the top one along with it. Either way the item did
 * something other than what it says. Anchoring the staying panel is what the
 * item MEANS, and it makes the follow keep the correspondence the move just
 * established rather than overwrite it. `takeFollowAnchor` is the same take
 * `showOffscreenMateContig` makes; `movePanelsToSpan` gives it back when the
 * navigation does not land, and offers the Undo when it lands by replacing the
 * panel's regions.
 *
 * NOTHING IS TOUCHED ACROSS THE RESOLVE WITHOUT ASKING FIRST. The menu closes
 * on a refetch, not on the view being closed under it, so the stack and the
 * moved panel can both be gone by the time an RPC answers. The two reads that
 * WALK the tree are hoisted above the await for the reason `resolveMatchingSpan`
 * hoists its assembly name — `getContainingView` and `getSession` throw on a
 * node that has left it — and the writes below are gated on liveness, since the
 * viewport capture reads MST regions off every panel in the stack.
 */
export async function moveMatchingPanel({
  model,
  feat,
  window,
  movingView,
  stayingIndex,
  toMate,
}: {
  model: LinearSyntenyDisplayModel
  feat: FeatPos
  // the staying panel's visible span on this alignment's axis
  window: SpanOfInterest
  movingView: LinearGenomeViewModel
  // where the staying panel sits in the stack, which is where the follow's
  // anchor goes
  stayingIndex: number
  toMate: boolean
}) {
  const stack = model.view
  const session = getSession(model)
  const span = await resolveMatchingSpan({
    model,
    feat,
    window,
    toMate,
  })
  if (isAlive(stack) && isAlive(movingView)) {
    if (span) {
      // Captured before the take, which already re-places the other panels.
      // After the resolve too, so an alignment that turns out to have no answer
      // leaves the anchor where the user had it.
      const restore = captureStackViewports([...stack.views])
      const anchor = takeFollowAnchor(stack, stayingIndex)
      await movePanelsToSpan({
        panels: [movingView],
        span,
        anchor,
        restore,
        session,
        followNote: 'and following the panel that stayed',
      })
    } else {
      session.notify(
        'This alignment carries no CIGAR, so there is no matching region to resolve',
        'info',
      )
    }
  }
}
