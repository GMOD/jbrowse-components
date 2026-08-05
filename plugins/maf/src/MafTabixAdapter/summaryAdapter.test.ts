import {
  BedTabixAdapter,
  bedTabixConfigSchema as BedTabixConfigSchema,
} from '@jbrowse/plugin-bed'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { mafSummaryFeatures } from '../util/loadMafSummaryAdapter.ts'
import MafTabixAdapter from './MafTabixAdapter.ts'
import MafTabixConfigSchema from './configSchema.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

// The fixture is real `maf2bed --summary` output, sorted, bgzipped and tabixed
// exactly as its README tells the user to. That is the point of testing through
// the real BedTabixAdapter rather than a stub: the two repos agree on a file
// format by nothing but this contract, and the failure mode when they don't is
// silent — an unmatched `src` drops its bars via `rowIndexBySrc` and the track
// renders as empty rather than as an error.
function summaryAdapter() {
  return new BedTabixAdapter(
    BedTabixConfigSchema.create({
      bedGzLocation: {
        localPath: require.resolve('./test_data/volvox.maf.summary.bed.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath:
            require.resolve('./test_data/volvox.maf.summary.bed.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
}

// A MafTabixAdapter whose `summaryAdapter` slot resolves to the fixture above.
// `getSubAdapter` is what the plugin manager normally supplies.
function mafAdapter(summaryAdapterConf: unknown) {
  const adapter = new MafTabixAdapter(
    MafTabixConfigSchema.create({
      bedGzLocation: {
        localPath: require.resolve('./test_data/volvox.maf.summary.bed.gz'),
        locationType: 'LocalPathLocation',
      },
      summaryAdapter: summaryAdapterConf,
    }),
    () =>
      Promise.resolve({
        dataAdapter: summaryAdapter() as BaseFeatureDataAdapter,
        // the plugin manager's cache bookkeeping; nothing here reads it
        sessionIds: new Set<string>(),
      }),
  )
  return adapter
}

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 100_000,
  assemblyName: 'volvox',
}

async function records(adapter: MafTabixAdapter) {
  return firstValueFrom(mafSummaryFeatures(adapter, REGION).pipe(toArray()))
}

describe('a maf2bed --summary BED round-trips into summary records', () => {
  it('reads the columns its header names', async () => {
    const out = await records(mafAdapter({ type: 'BedTabixAdapter' }))
    // three species x the runs the merge left, over the whole contig
    expect(out.length).toBeGreaterThan(0)
    for (const r of out) {
      expect(r.refName).toBe('ctgA')
      expect(typeof r.src).toBe('string')
      expect(Number.isFinite(r.score)).toBe(true)
    }
  })

  it('keys records by sample id, which is what the row lookup matches', async () => {
    const out = await records(mafAdapter({ type: 'BedTabixAdapter' }))
    // `volvox`, not `volvox.ctgA` — the display looks these up in
    // `rowIndexBySrc`, whose keys are the track's sample ids, and drops what it
    // cannot find without saying so
    expect(new Set(out.map(r => r.src))).toEqual(
      new Set(['volvox', 'simvolvox', 'microvolvox']),
    )
  })

  it('carries the identity score through as a 0..1 number', async () => {
    const out = await records(mafAdapter({ type: 'BedTabixAdapter' }))
    // simvolvox merged two blocks: 9/9 classifiable in the first (one gap
    // column), 4/8 in the second, length-weighted to 13/17
    const sim = out.find(r => r.src === 'simvolvox')!
    expect(sim.score).toBeCloseTo(0.765, 3)
    expect(sim.start).toBe(100)
    expect(sim.end).toBe(208)
    // the reference row is present and reads fully conserved against itself
    expect(out.filter(r => r.src === 'volvox').every(r => r.score === 1)).toBe(
      true,
    )
    for (const r of out) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(1)
    }
  })

  // The status columns are optional — bigMafSummary supplies them, the maf2bed
  // BED does not, and nothing renders them today. Absent must read as absent
  // rather than as a parsed-garbage MafStatus.
  it('leaves the optional status columns undefined when the file omits them', async () => {
    const out = await records(mafAdapter({ type: 'BedTabixAdapter' }))
    expect(out.every(r => r.leftStatus === undefined)).toBe(true)
    expect(out.every(r => r.rightStatus === undefined)).toBe(true)
  })

  it('emits nothing when the slot is unset, so callers fall back to the gate', async () => {
    const out = await records(mafAdapter(null))
    expect(out).toEqual([])
  })
})
