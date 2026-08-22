import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { getInstancePosition } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { findContactAt } from '../LinearHicDisplay/contactLookup.ts'
import { executeRenderHicData } from './executeRenderHicData.ts'
import { toContacts } from './testContacts.ts'

import type { TestContact } from './testContacts.ts'
import type { HicDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

/**
 * The payload carries no per-contact bin columns: `contactLookup` recovers each
 * bin from the packed position, against the region's own `combinedOffset` and
 * orientation. That is only sound because `combinedOffset ≈ -start/res` cancels
 * the chromosome-absolute part BEFORE the float32 cast, so what the buffer
 * stores is a small on-screen coordinate rather than a ~10^6 bin index — the
 * reasoning the old `contactBin1`/`contactBin2` columns were justified by, which
 * was about storing the bin itself.
 *
 * "Sound" is a claim about float32, so this drives the real worker across the
 * range that is actually reachable and checks the whole round trip: bins in,
 * hover the drawn cell, same bins out. The cases below are chosen for what
 * strains the cast — a large absolute bin index, a binsize so fine the cells go
 * sub-pixel, a wide viewport, and a mirrored region (whose stored value is a
 * reflection, so its recovery also has to unfold the one-cell-width shift).
 */
interface Case {
  name: string
  res: number
  bpPerPx: number
  /** genomic start of the single displayed region */
  start: number
  /** displayed width in px */
  widthPx: number
  reversed: boolean
}

const CASES: Case[] = [
  {
    name: 'auto binsize near the start of a chromosome',
    res: 100_000,
    bpPerPx: 50_000,
    start: 0,
    widthPx: 1500,
    reversed: false,
  },
  {
    name: '5 kb at 200 Mb (bin index ~4e4)',
    res: 5_000,
    bpPerPx: 2_500,
    start: 200_000_000,
    widthPx: 1500,
    reversed: false,
  },
  {
    name: '250 bp at 248 Mb (bin index ~1e6)',
    res: 250,
    bpPerPx: 125,
    start: 248_000_000,
    widthPx: 1500,
    reversed: false,
  },
  {
    // two resolutionBias steps finer: cells are ~0.09 px, the finest the UI can
    // reach, so the stored coordinate is the largest multiple of binWidth
    name: 'sub-pixel bins at 248 Mb',
    res: 250,
    bpPerPx: 2_000,
    start: 248_000_000,
    widthPx: 4000,
    reversed: false,
  },
  {
    name: 'a reversed region at 248 Mb',
    res: 1_000,
    bpPerPx: 500,
    start: 248_000_000,
    widthPx: 1500,
    reversed: true,
  },
]

async function run(c: Case, records: TestContact[]) {
  const region: Region = {
    refName: 'chr1',
    start: c.start,
    end: c.start + c.widthPx * c.bpPerPx,
    assemblyName: 'a',
    reversed: c.reversed,
  }
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getMultiRegionContactRecords: () =>
        Promise.resolve(toContacts(records, c.res)),
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const res = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions: [region],
      axisBlocks: [{ refName: 'chr1', offsetBp: 0 }],
      originBp: region.start,
      resolution: c.res,
      normalization: 'KR',
    },
  })
  return (res as unknown as { value: HicDataResult }).value
}

describe('bins survive the float32 round trip through the packed positions', () => {
  test.each(CASES.map(c => [c.name, c] as const))('%s', async (_name, c) => {
    const firstBin = Math.floor(c.start / c.res)
    const nBins = Math.floor((c.widthPx * c.bpPerPx) / c.res)
    // sample across the region rather than every bin — nBins reaches 32000 in
    // the sub-pixel case and the interesting axis is magnitude, not count
    const step = Math.max(1, Math.floor(nBins / 200))

    const contacts: TestContact[] = []
    for (let k = 0; firstBin + k * step + 3 < firstBin + nBins; k++) {
      const b = firstBin + k * step
      contacts.push({
        bin1: b,
        bin2: b,
        counts: contacts.length + 1,
        region1Idx: 0,
        region2Idx: 0,
      })
      // an off-diagonal neighbour too, so the two axes can't agree by symmetry
      contacts.push({
        bin1: b,
        bin2: b + 3,
        counts: contacts.length + 1,
        region1Idx: 0,
        region2Idx: 0,
      })
    }
    expect(contacts.length).toBeGreaterThan(100)

    const data = await run(c, contacts)
    expect(data.numContacts).toBe(contacts.length)

    // Hover the center of each drawn cell. This exercises both halves of the
    // recovery: the table build recovers every contact's bins to key them, and
    // the probe confirms the candidate against its own packed cell.
    for (let i = 0; i < data.numContacts; i++) {
      const hit = findContactAt(
        data,
        getInstancePosition(data.instances, i, 0) + data.binWidth / 2,
        getInstancePosition(data.instances, i, 1) + data.binWidth / 2,
      )
      const { bin1, bin2, counts } = contacts[i]!
      // Bins come back as they went in even in the reversed case. Mirroring
      // swaps which endpoint the worker put on the x axis, but `findContactAt`
      // re-canonicalizes a same-region pair to (min, max) before keying — so the
      // orientation shows up in where the cell is drawn, never in the locus the
      // tooltip prints.
      expect(hit).toEqual({
        bin1,
        bin2,
        region1Idx: 0,
        region2Idx: 0,
        counts,
      })
    }
  })
})
