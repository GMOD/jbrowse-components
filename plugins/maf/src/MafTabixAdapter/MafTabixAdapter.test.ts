import {
  BedTabixAdapter,
  bedTabixConfigSchema as BedTabixConfigSchema,
} from '@jbrowse/plugin-bed'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import MafTabixAdapter from './MafTabixAdapter.ts'
import MafTabixConfigSchema from './configSchema.ts'

import type { AlignmentRecord, Sample } from '../types.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

// The real `maf_to_bed.py` output shipped as a fixture: one line per alignment
// block, ten species packed into the last column as
// `sample.chr:start:size:strand:srcSize:seq`.
function adapter(conf: Record<string, unknown> = {}) {
  return new MafTabixAdapter(
    MafTabixConfigSchema.create({
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
      nhLocation: {
        localPath:
          require.resolve('../../../../test_data/volvox/volvox.maf.nh'),
        locationType: 'LocalPathLocation',
      },
      ...conf,
    }),
    subConf =>
      Promise.resolve({
        dataAdapter: new BedTabixAdapter(
          BedTabixConfigSchema.create(subConf),
        ) as BaseFeatureDataAdapter,
        sessionIds: new Set<string>(),
      }),
  )
}

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 400,
  assemblyName: 'volvox',
}

function features(a: MafTabixAdapter, samples?: Sample[]) {
  return firstValueFrom(
    a.getFeatures(REGION, samples ? { samples } : undefined).pipe(toArray()),
  )
}

function alignmentsOf(f: Feature) {
  return f.get('alignments') as Record<string, AlignmentRecord>
}

describe('MafTabixAdapter reads a maf_to_bed BED', () => {
  // The alignment column is read as `field5` — @gmod/bed's name for the 6th
  // column of a headerless BED. Nothing else pins that name, and the cast is
  // unguarded, so a file whose columns are named some other way (a `#` header
  // line, an `autoSql` config) reaches `.split` on undefined.
  it('decodes every species packed into the alignment column', async () => {
    const out = await features(adapter())
    expect(out.length).toBeGreaterThan(0)

    const first = out[0]!
    expect(first.get('refName')).toBe('ctgA')
    expect(first.get('start')).toBe(0)
    expect(first.get('end')).toBe(100)

    const alignments = alignmentsOf(first)
    expect(Object.keys(alignments).sort()).toEqual([
      'hypervolvox',
      'megavolvox',
      'metavolvox',
      'microvolvox',
      'minivolvox',
      'nanovolvox',
      'picovolvox',
      'simvolvox',
      'ultravolvox',
      'volvox',
    ])
    // the source chromosome, not the whole `sample.chr` token — this is what
    // color-by-source-chromosome and the inversion consensus key on
    expect(alignments.simvolvox).toEqual({
      chr: 'chrA',
      start: 4700,
      strand: 1,
      srcSize: 47000,
      seq: expect.stringContaining('cATtgTaGCGGAGTTgaaCAaCGG'),
    })
    // every row is gapped to the same column count as the reference
    const refLen = (first.get('seq') as string).length
    for (const rec of Object.values(alignments)) {
      expect(rec.seq).toHaveLength(refLen)
    }
  })

  // MAF puts the reference first in every stanza, and the block's genomic
  // extent is derived from it downstream — a block that resolves no reference
  // sequence has no extent and vanishes from the rows and from coverage.
  it('takes the reference sequence from the queried assembly', async () => {
    const out = await features(adapter())
    for (const f of out) {
      expect(f.get('seq')).toBe(alignmentsOf(f).volvox!.seq)
    }
  })

  // `refAssemblyName` exists for the case where the MAF names its reference
  // differently from the JBrowse assembly, so it must win over `query.assemblyName`.
  it('honors refAssemblyName over the queried assembly name', async () => {
    const out = await features(adapter({ refAssemblyName: 'simvolvox' }))
    expect(out[0]!.get('seq')).toBe(alignmentsOf(out[0]!).simvolvox!.seq)
  })

  // With a sample set the tokens resolve exactly (`matchSampleId`) instead of
  // heuristically, and species outside it are dropped rather than given a row.
  it('narrows to the passed sample set', async () => {
    const out = await features(adapter(), [
      { id: 'volvox', label: 'volvox' },
      { id: 'simvolvox', label: 'simvolvox' },
    ])
    expect(Object.keys(alignmentsOf(out[0]!)).sort()).toEqual([
      'simvolvox',
      'volvox',
    ])
  })

  it('resolves its sample set and guide tree from the .nh', async () => {
    const { samples, treeNewick } = await adapter().getSamples()
    expect(treeNewick).toContain('volvox')
    // leaf order drives row order
    expect(samples.map(s => s.id)).toContain('simvolvox')
  })

  // The byte gate reads this; it comes from the tabix index alone, no download.
  it('reports an index-only byte estimate', async () => {
    const bytes = await adapter().getRegionByteSize([REGION])
    expect(bytes).toBeGreaterThan(0)
  })

  // A BED with a `#` header takes its column names from it, so there is no
  // `field5` — and the summary BED `maf2bed --summary` writes as a sibling of
  // the alignment BED has exactly such a header. Pointing `bedGzLocation` at it
  // is a one-character mistake that used to surface as `Cannot read properties
  // of undefined (reading 'split')`.
  it('says what is wrong when the alignment column is missing', async () => {
    const headered = adapter({
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
    })
    await expect(features(headered)).rejects.toThrow(/no alignment column/)
  })
})
