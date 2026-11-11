import { junctionEnds } from '@jbrowse/sv-core'

import { findFeatureViewLevel, isLevelPairMinimized } from '../util.ts'

import type { OverlayContext } from './overlayUtils.tsx'
import type { Feature } from '@jbrowse/core/util'
import type { JunctionEnd } from '@jbrowse/sv-core'

// A record whose own glyph reaches its mate end, a symbolic DEL, DUP or INV,
// already draws the junction in its row.
function spansMate(feature: Feature, mate: JunctionEnd) {
  return (
    feature.get('refName') === mate.refName &&
    feature.get('start') <= mate.pos &&
    mate.pos <= feature.get('end')
  )
}

// The junctions of a variant track that get a connector: both ends land in a
// row, the record's glyph does not already span them, and neither row has the
// track minimized.
export function connectedVariantJunctions({
  match,
  views,
  tracks,
  assemblies,
}: Pick<OverlayContext, 'match' | 'views' | 'tracks' | 'assemblies'>) {
  return match.kind === 'variant'
    ? match.layoutMatches.flatMap(([near, far]) => {
        const ends = near && junctionEnds(near.feature)
        // the far record's own end where the fetch returned it, so the
        // position and the kept side are both in the spelling that record's
        // row resolves
        const mateEnd =
          ends && ((far && junctionEnds(far.feature)?.own) ?? ends.mate)
        const farLevel =
          mateEnd &&
          (far?.level ??
            findFeatureViewLevel(
              views,
              assemblies,
              mateEnd.refName,
              mateEnd.pos,
            ))
        return near &&
          ends &&
          mateEnd &&
          farLevel !== undefined &&
          !(farLevel === near.level && spansMate(near.feature, mateEnd)) &&
          !isLevelPairMinimized(tracks, near.level, farLevel)
          ? [{ near, far, ends, mateEnd, farLevel }]
          : []
      })
    : []
}
