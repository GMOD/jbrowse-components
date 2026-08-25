import { orientAlignment } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { getCigar, getMate } from '../syntenyMate.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * The same alignment seen from its other end.
 *
 * WHY THE WORKER HAS TO DO THIS. An adapter orients a row to whichever axis was
 * asked about — `PairwiseAdapterBase.facingSides` picks the side off the queried
 * region's own assembly — so the second, target-axis fetch returns rows anchored
 * on the target row. Everything downstream of here assumes the opposite:
 * `refName`/`start`/`end` on the query axis and `mate` on the target's. One of
 * the two fetches therefore has to be turned round, and it is this one.
 *
 * THE CIGAR IS NOT JUST CARRIED OVER. Insertions in one perspective are
 * deletions in the other, and on the reverse strand the ops run the other way
 * too — `orientAlignment` is the same transform the adapters apply when they
 * orient a file row, and both halves of it (`swapIndelCigar`, `flipCigar`) are
 * their own inverse, so it converts in either direction. Carrying the string
 * unchanged would paint every indel wedge on the wrong side of its block, which
 * is a picture that looks entirely plausible.
 *
 * The id is kept. A file's two perspectives of one alignment have distinct ids
 * by construction (PIF stores them as separate rows, all-vs-all numbers them
 * apart on purpose, and the pairwise adapters put the perspective in the id so
 * a self-alignment's two ends do not share one), so this cannot collide with
 * the query fetch's own — which is also why nothing here has to join the two
 * fetches on a shared key.
 */
export function flipSyntenyFeature(f: Feature): Feature | undefined {
  const mate = getMate(f)
  if (!mate) {
    return undefined
  }
  const strand = f.get('strand') ?? 1
  const { CIGAR, cs } = orientAlignment({
    cg: getCigar(f),
    cs: f.get('cs') as string | undefined,
    flip: true,
    strand,
  })
  return new SimpleFeature({
    ...f.toJSON(),
    refName: mate.refName,
    start: mate.start,
    end: mate.end,
    assemblyName: mate.assemblyName,
    // written even when undefined, so a row that had a CIGAR before the flip
    // cannot keep the un-flipped one through the spread above
    CIGAR,
    cs,
    // the four fields a mate is: `name`/`id` are optional and no adapter sets
    // them (see SyntenyFeatureData), so there is nothing to carry across
    mate: {
      refName: f.get('refName'),
      start: f.get('start'),
      end: f.get('end'),
      assemblyName: f.get('assemblyName') as string,
    },
  })
}
