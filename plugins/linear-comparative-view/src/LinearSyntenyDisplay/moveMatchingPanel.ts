import { assembleLocStringRaw, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getCanonicalRefNameFn } from '@jbrowse/synteny-core'

import type {
  ResolvedSpan,
  SpanOfInterest,
} from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FeatPos, LinearSyntenyDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
 * Shared for the one-base clamp, which is silent when left out: a zero-width
 * span assembles into an inverted locstring.
 */
export async function navToResolvedSpan(
  view: LinearGenomeViewModel,
  span: ResolvedSpan,
) {
  const { refName } = span
  const start = span.start
  const end = Math.max(span.start + 1, span.end)
  try {
    view.navTo({ refName, start, end })
    return
  } catch {
    // the span is not inside this row's displayed regions
  }
  await view.navToLocString(assembleLocStringRaw({ refName, start, end }))
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
 */
export async function moveMatchingPanel({
  model,
  feat,
  window,
  movingView,
  toMate,
}: {
  model: LinearSyntenyDisplayModel
  feat: FeatPos
  // the staying panel's visible span on this alignment's axis
  window: SpanOfInterest
  movingView: LinearGenomeViewModel
  toMate: boolean
}) {
  const span = await resolveMatchingSpan({
    model,
    feat,
    window,
    toMate,
  })
  if (!span) {
    getSession(model).notify(
      'This alignment carries no CIGAR, so there is no matching region to resolve',
      'info',
    )
    return
  }
  await navToResolvedSpan(movingView, span)
}
