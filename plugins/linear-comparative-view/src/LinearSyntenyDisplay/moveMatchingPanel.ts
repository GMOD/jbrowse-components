import { assembleLocStringRaw, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { FeatPos, LinearSyntenyDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
 * Send one panel of a synteny view to the region the clicked band matches,
 * leaving its neighbour where it is.
 *
 * THE WINDOW, NOT THE FEATURE'S MIDPOINT, which is the whole difference from
 * "Center on feature": a published liftOver-style chain is one feature tens of
 * Mb long, so its midpoint is nowhere near what either panel is showing. And a
 * span rather than a point, so the moved panel matches the staying panel's
 * SCALE too and the band between them comes back near-vertical.
 *
 * THE WALK HAPPENS IN THE WORKER. The main thread holds no CIGARs for a band
 * -- the bulk path is typed arrays, deliberately, because a whole-genome PAF is
 * millions of blocks and a chromosome-scale CIGAR runs to tens of megabytes --
 * so this asks the worker to resolve the one clicked alignment and hands back
 * three numbers. `undefined` means the block carried no CIGAR after all, which
 * the menu already gates against; navigating on an interpolated guess is what
 * this deliberately does not do.
 */
export async function moveMatchingPanel({
  model,
  feat,
  stayingView,
  movingView,
  toMate,
}: {
  model: LinearSyntenyDisplayModel
  feat: FeatPos
  stayingView: LinearGenomeViewModel
  movingView: LinearGenomeViewModel
  toMate: boolean
}) {
  const session = getSession(model)
  // not named `window`: this runs on the main thread, where that shadows the
  // global and reads as a mistake even where it is not one
  const stayingWindow = visibleSpanOnRefName(
    stayingView,
    toMate ? feat.refName : feat.mate.refName,
  )
  if (!stayingWindow) {
    return
  }
  const span = await session.rpcManager.call(
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
      window: stayingWindow,
      toMate,
      // the resolved tier, matching the fetch that produced this feature id:
      // ids are not comparable across a tiered PIF's two tiers
      lodMode: model.lodTier,
    },
  )
  if (!span) {
    return
  }
  await movingView.navToLocString(
    assembleLocStringRaw({
      refName: span.refName,
      start: span.start,
      // at least one base, since a zero-width span assembles into an inverted
      // locstring
      end: Math.max(span.start + 1, span.end),
    }),
  )
}
