import type {
  MultiRegionContacts,
  RegionPairContacts,
} from '../HicAdapter/HicAdapter.ts'

/** A contact written the readable way, for fixtures. */
export interface TestContact {
  bin1: number
  bin2: number
  counts: number
  region1Idx: number
  region2Idx: number
}

/**
 * The adapter's result from a per-contact fixture: consecutive contacts of one
 * region pair become that pair's arrays, so a fixture listed in the adapter's
 * `(i, j)` order keeps every contact at the index the test names it by.
 */
export function toContacts(
  contacts: TestContact[],
  resolution: number,
  appliedNormalization = 'KR',
): MultiRegionContacts {
  const groups: { region1Idx: number; region2Idx: number; c: TestContact[] }[] =
    []
  for (const c of contacts) {
    const open = groups.at(-1)
    if (
      open &&
      open.region1Idx === c.region1Idx &&
      open.region2Idx === c.region2Idx
    ) {
      open.c.push(c)
    } else {
      groups.push({
        region1Idx: c.region1Idx,
        region2Idx: c.region2Idx,
        c: [c],
      })
    }
  }
  const pairs: RegionPairContacts[] = groups.map(g => ({
    region1Idx: g.region1Idx,
    region2Idx: g.region2Idx,
    bin1: Int32Array.from(g.c, c => c.bin1),
    bin2: Int32Array.from(g.c, c => c.bin2),
    counts: Float32Array.from(g.c, c => c.counts),
  }))
  return {
    pairs,
    numContacts: contacts.length,
    resolution,
    appliedNormalization,
  }
}
