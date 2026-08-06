import { readConfObject } from '@jbrowse/core/configuration'
import {
  BedTabixAdapter,
  bedTabixConfigSchema as BedTabixConfigSchema,
} from '@jbrowse/plugin-bed'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import TaffyConfigSchema from '../BgzipTaffyAdapter/configSchema.ts'
import BigMafConfigSchema from '../BigMafAdapter/configSchema.ts'
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

  // The mirror mistake to the one MafTabixAdapter.test.ts covers: the alignment
  // BED put into `summaryAdapter` instead of into `bedGzLocation`. It is
  // headerless, so its columns are `field*` and there is no `src` — and `src` is
  // the whole mapping from a summary row to a display row, so every bar dropped
  // silently through `rowIndexBySrc`. (The summary RPC now also discovers its
  // row set from `src`, which would have produced a row named `undefined`.)
  it('says what is wrong when the summary file has no src column', async () => {
    const adapter = new MafTabixAdapter(
      MafTabixConfigSchema.create({
        bedGzLocation: {
          localPath: require.resolve('./test_data/volvox.maf.summary.bed.gz'),
          locationType: 'LocalPathLocation',
        },
        summaryAdapter: { type: 'BedTabixAdapter' },
      }),
      () =>
        Promise.resolve({
          dataAdapter: new BedTabixAdapter(
            BedTabixConfigSchema.create({
              bedGzLocation: {
                localPath:
                  require.resolve('../../../../test_data/volvox/volvox.maf.bed.gz'),
                locationType: 'LocalPathLocation',
              },
              index: {
                location: {
                  localPath:
                    require.resolve('../../../../test_data/volvox/volvox.maf.bed.gz.tbi'),
                  locationType: 'LocalPathLocation',
                },
              },
            }),
          ) as BaseFeatureDataAdapter,
          sessionIds: new Set<string>(),
        }),
    )
    await expect(records(adapter)).rejects.toThrow(/no `src` column/)
  })
})

// `showSummary` is `!!readConfObject(self.adapterConfig, 'summaryAdapter') &&
// aboveForceLoadFloor`. A schema with no such slot reads `undefined` there — no
// error, no warning, just a track that never summarizes.
//
// That is not hypothetical: `LinearMafDisplay/testEnv.ts` registers its own stub
// `MafTabixAdapter` schema which declares the slot, so every display-level
// summary test passed while the shipped schema had none and the real product
// path was dead. These assert the schemas the plugin actually registers, using
// the same read the display makes, so the stub cannot drift away from them
// again.
describe('the summaryAdapter slot exists where the display expects it', () => {
  it('MafTabixAdapter round-trips a summary sub-adapter', () => {
    const conf = MafTabixConfigSchema.create({
      bedGzLocation: { uri: 'x.bed.gz', locationType: 'UriLocation' },
      summaryAdapter: { type: 'BedTabixAdapter' },
    })
    expect(readConfObject(conf, 'summaryAdapter')).toEqual({
      type: 'BedTabixAdapter',
    })
  })

  it('BigMafAdapter round-trips one too', () => {
    const conf = BigMafConfigSchema.create({
      bigBedLocation: { uri: 'x.bb', locationType: 'UriLocation' },
      summaryAdapter: { type: 'BigBedAdapter' },
    })
    expect(readConfObject(conf, 'summaryAdapter')).toEqual({
      type: 'BigBedAdapter',
    })
  })

  it('reads as unset — not as an error — when nothing is configured', () => {
    const conf = MafTabixConfigSchema.create({
      bedGzLocation: { uri: 'x.bed.gz', locationType: 'UriLocation' },
    })
    expect(readConfObject(conf, 'summaryAdapter')).toBeNull()
  })

  // Deliberately absent: TAF's `.tai` seeks within an alignment, so a read
  // already costs what is on screen rather than what the blocks span, and the
  // zoom-out problem the tier solves does not arise the same way. Pinned so the
  // omission reads as a decision rather than an oversight.
  it('BgzipTaffyAdapter has no summary slot, by decision', () => {
    const conf = TaffyConfigSchema.create({
      tafGzLocation: { uri: 'x.taf.gz', locationType: 'UriLocation' },
    })
    expect(Object.keys(conf)).not.toContain('summaryAdapter')
  })
})
