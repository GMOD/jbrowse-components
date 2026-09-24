import { breakendLocKey, junctionEnds } from '@jbrowse/sv-core'

import type { Feature } from '@jbrowse/core/util'
import type { JunctionEnd } from '@jbrowse/sv-core'

function endKey(end: JunctionEnd) {
  return breakendLocKey(`${end.refName}:${end.pos}`)
}

/**
 * Variant records, one junction per chunk: a record, then the record at its
 * mate end when the fetch holds one — the other half of a reciprocal BND pair,
 * or of a row a paired adapter (BEDPE, STAR-Fusion) files under both contigs.
 * A record written once, or whose mate record fell to a filter, is a chunk of
 * one, and the overlay draws it to its mate position all the same. Records
 * naming no other end are dropped.
 */
export function getVariantJunctions(feats: Map<string, Feature>) {
  const byJunction = new Map<
    string,
    { feature: Feature; ends: NonNullable<ReturnType<typeof junctionEnds>> }[]
  >()
  for (const feature of feats.values()) {
    const ends = junctionEnds(feature)
    if (ends) {
      const key = [endKey(ends.own), endKey(ends.mate)].sort().join('\t')
      const bucket = byJunction.get(key)
      if (bucket) {
        bucket.push({ feature, ends })
      } else {
        byJunction.set(key, [{ feature, ends }])
      }
    }
  }
  return [...byJunction.values()].map(([first, ...rest]) => {
    const mateKey = endKey(first!.ends.mate)
    const atMate = rest.find(r => endKey(r.ends.own) === mateKey)
    return atMate ? [first!.feature, atMate.feature] : [first!.feature]
  })
}
