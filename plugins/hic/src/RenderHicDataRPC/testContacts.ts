import type {
  MultiRegionContacts,
  RegionPairRun,
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
 * Build the adapter's struct-of-arrays result from a per-contact fixture.
 *
 * Region membership becomes contiguous runs, cut wherever the pair changes —
 * so a fixture listed in the adapter's own `(i, j)` nested-loop order produces
 * exactly the run table the adapter would, and every contact keeps the index
 * the test refers to it by.
 */
export function toContacts(
  contacts: TestContact[],
  resolution: number,
  appliedNormalization = 'KR',
): MultiRegionContacts {
  const numContacts = contacts.length
  const bin1 = new Uint32Array(numContacts)
  const bin2 = new Uint32Array(numContacts)
  const counts = new Float32Array(numContacts)
  const pairs: RegionPairRun[] = []

  for (const [i, c] of contacts.entries()) {
    bin1[i] = c.bin1
    bin2[i] = c.bin2
    counts[i] = c.counts
    const open = pairs.at(-1)
    if (
      open &&
      open.region1Idx === c.region1Idx &&
      open.region2Idx === c.region2Idx
    ) {
      open.end = i + 1
    } else {
      pairs.push({
        region1Idx: c.region1Idx,
        region2Idx: c.region2Idx,
        start: i,
        end: i + 1,
      })
    }
  }

  return {
    bin1,
    bin2,
    counts,
    pairs,
    numContacts,
    resolution,
    appliedNormalization,
  }
}
