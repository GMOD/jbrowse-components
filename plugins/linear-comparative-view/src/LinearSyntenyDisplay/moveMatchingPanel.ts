import { assembleLocStringRaw, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getAdapterToCanonicalRefNameMap } from '@jbrowse/synteny-core'

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
 * Shared for the one-base clamp, which is silent when left out: a zero-width
 * span assembles into an inverted locstring.
 */
export async function navToResolvedSpan(
  view: LinearGenomeViewModel,
  span: ResolvedSpan,
) {
  await view.navToLocString(
    assembleLocStringRaw({
      refName: span.refName,
      start: span.start,
      end: Math.max(span.start + 1, span.end),
    }),
  )
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
  const span = await rpcManager.call(
    sessionId,
    'SyntenyResolveMatchingRegion',
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
  // fetch would leave it never matching and renavigating on every wake. The
  // axis is whichever one the span landed on -- `toMate` moves the mate axis
  // (v1), otherwise the feature axis (v0).
  const axis = toMate ? model.connectedViews?.v1 : model.connectedViews?.v0
  if (!axis) {
    return span
  }
  const map = await getAdapterToCanonicalRefNameMap({
    assemblyManager,
    sessionId,
    adapterConfig,
    regions: axis.displayedRegions,
  })
  return { ...span, refName: map[span.refName] ?? span.refName }
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
