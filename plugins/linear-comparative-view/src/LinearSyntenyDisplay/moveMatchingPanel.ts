import { assembleLocStringRaw, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type {
  ResolvedSpan,
  SpanOfInterest,
} from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FeatPos, LinearSyntenyDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Send `view` to a resolved span, the way every one-shot path does.
 *
 * A NAVIGATION rather than a pan: `navToLocString` will change what the row
 * displays if the span is on a contig it is not currently showing, which is the
 * whole point when a follow crosses onto another chromosome. The per-frame
 * pass wants the opposite and uses `positionViewOnSpan` instead.
 *
 * Shared because the one-base clamp below is easy to leave out and silent when
 * it is: a zero-width span assembles into an INVERTED locstring, which the
 * parser then reads as a region running backwards.
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
  return getSession(model).rpcManager.call(
    getRpcSessionId(model),
    'SyntenyResolveMatchingRegion',
    {
      adapterConfig: model.adapterConfig,
      // the block's own extent on the QUERY axis, which is the axis the band's
      // fetch queries -- so the lookup finds the feature whichever panel is
      // being moved
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
