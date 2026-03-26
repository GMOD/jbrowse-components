import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { LocalFile } from 'generic-filehandle2'

// Use the real RemoteFile (not the jest mock which only mocks LocalFile)
const { RemoteFile } = jest.requireActual(
  'generic-filehandle2',
) as typeof import('generic-filehandle2')
import { Observable } from 'rxjs'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './CramAdapter.ts'
import { FetchableSmallFasta, SequenceAdapter } from './CramTestAdapters.ts'
import configSchema from './configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

// A sequence adapter that returns undefined for all queries, simulating a
// missing or misconfigured genome (e.g. refName mismatch like chr1 vs 1)
class EmptySequenceAdapter extends BaseSequenceAdapter {
  constructor() {
    super(ConfigurationSchema('empty', {}).create())
  }

  getRefNames() {
    return Promise.resolve([])
  }

  getRegions() {
    return Promise.resolve([])
  }

  getFeatures(): Observable<SimpleFeature> {
    return new Observable(observer => {
      observer.complete()
    })
  }
}

const getEmptySequenceSubAdapter: getSubAdapterType = async () => {
  return {
    dataAdapter: new EmptySequenceAdapter(),
    sessionIds: new Set(),
  }
}

const pluginManager = new PluginManager()

const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => {
  return {
    dataAdapter: new SequenceAdapter(
      new LocalFile(require.resolve('../../test_data/volvox.fa')),
    ),
    sessionIds: new Set(),
  }
}

// Mock sequenceAdapter config - the actual config doesn't matter since
// getVolvoxSequenceSubAdapter ignores it and returns the test adapter
const sequenceAdapterConfig = { type: 'TestSequenceAdapter' }

function makeAdapter(arg: string) {
  return new Adapter(
    configSchema.create({
      cramLocation: {
        localPath: require.resolve(arg),
        locationType: 'LocalPathLocation',
      },
      craiLocation: {
        localPath: require.resolve(`${arg}.crai`),
        locationType: 'LocalPathLocation',
      },
    }),
    getVolvoxSequenceSubAdapter,
    pluginManager,
  )
}

test('adapter can fetch features from volvox-sorted.cram', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
  // Set sequenceAdapterConfig on adapter (normally done by CoreGetRefNames)
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  expect(featuresArray[0]!.get('refName')).toBe('ctgA')
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(3809)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(adapter.refIdToName(0)).toBe('ctgA')
  expect(adapter.refIdToName(1)).toBe(undefined)

  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
})

test('test usage of cramSlightlyLazyFeature toJSON (used in the widget)', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
  // Set sequenceAdapterConfig on adapter (normally done by CoreGetRefNames)
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  const f = featuresArray[0]!.toJSON()
  expect(f.refName).toBe('ctgA')
  expect(f.start).toBe(2)
  expect(f.end).toBe(102)
  // don't pass the mismatches to the frontend
  expect(f.mismatches).toEqual(undefined)
})

test('CRAM mismatch bases are valid ACGT when sequence adapter is configured', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))

  // Find all mismatch-type read features across all records
  const invalidBases: string[] = []
  for (const feature of featuresArray) {
    const mismatches = feature.get('mismatches') as
      | { type: string; base: string }[]
      | undefined
    if (!mismatches) {
      continue
    }
    for (const mm of mismatches) {
      if (mm.type === 'mismatch') {
        if (!mm.base || !/^[ACGTNacgtn]$/.test(mm.base)) {
          invalidBases.push(mm.base)
        }
      }
    }
  }
  expect(invalidBases).toEqual([])
})

test('CRAM SNPs work when originalRefName differs from FASTA refName (chr prefix mismatch)', async () => {
  // Scenario: assembly canonical name is 'chr_ctgA' but both the CRAM and
  // FASTA use 'ctgA'. The region arrives with refName='ctgA' (renamed to
  // match CRAM) and originalRefName='chr_ctgA' (the displayedRegion name).
  // Before the fix, seqFetch would use originalRefName ('chr_ctgA') to query
  // the FASTA, which doesn't have that name, so sequence fetch would fail
  // and SNPs would be missing/broken.
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    originalRefName: 'chr_ctgA',
    start: 0,
    end: 20000,
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))

  // Verify mismatch bases are valid ACGT (not empty/undefined)
  const invalidBases: string[] = []
  for (const feature of featuresArray) {
    const mismatches = feature.get('mismatches') as
      | { type: string; base: string }[]
      | undefined
    if (!mismatches) {
      continue
    }
    for (const mm of mismatches) {
      if (mm.type === 'mismatch') {
        if (!mm.base || !/^[ACGTNacgtn]$/.test(mm.base)) {
          invalidBases.push(mm.base)
        }
      }
    }
  }
  expect(invalidBases).toEqual([])
})

test('CRAM mismatch bases are empty/undefined when sequence adapter returns no sequence (refName mismatch)', async () => {
  // This test simulates the production bug: the sequence adapter is configured
  // but getSequence returns undefined (e.g. due to a chr-prefix mismatch like
  // CRAM uses "ctgA" but the assembly FASTA only has "chr_ctgA"). When this
  // happens, @gmod/cram cannot call addReferenceSequence to decode rf.sub,
  // so all X-type read features have sub=undefined.
  const adapter = new Adapter(
    configSchema.create({
      cramLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.cram'),
        locationType: 'LocalPathLocation',
      },
      craiLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
        locationType: 'LocalPathLocation',
      },
    }),
    getEmptySequenceSubAdapter,
    pluginManager,
  )
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))

  // With no sequence, X-type read features will have sub=undefined, so
  // mm.base will be the fallback 'N' (after our fix in CramSlightlyLazyFeature)
  let mismatchCount = 0
  for (const feature of featuresArray) {
    const mismatches = feature.get('mismatches') as
      | { type: string; base: string }[]
      | undefined
    if (!mismatches) {
      continue
    }
    for (const mm of mismatches) {
      if (mm.type === 'mismatch') {
        mismatchCount++
        // base must not be empty - should be 'N' fallback, not ''
        expect(mm.base).toBeTruthy()
      }
    }
  }
  // There should be mismatch features - if none, the test is not exercising anything
  expect(mismatchCount).toBeGreaterThan(0)
})

test(
  'NA12878 exome CRAM mismatch bases should be valid ACGT',
  async () => {
    const { IndexedCramFile, CraiIndex } = await import('@gmod/cram')
    const { IndexedFasta } = await import('@gmod/indexedfasta')

    const cram = new IndexedCramFile({
      cramFilehandle: new RemoteFile(
        'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
      ),
      index: new CraiIndex({
        filehandle: new RemoteFile(
          'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram.crai',
        ),
      }),
      seqFetch: async (seqId: number, start: number, end: number) => {
        const fasta = new IndexedFasta({
          fasta: new RemoteFile(
            'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
          ),
          fai: new RemoteFile(
            'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
          ),
          gzi: new RemoteFile(
            'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
          ),
        })
        const seqNames = await fasta.getSequenceList()
        const refName = seqNames[seqId]
        if (!refName) {
          throw new Error(`no sequence for seqId ${seqId}`)
        }
        const seq = await fasta.getSequence(refName, start - 1, end)
        return seq ?? ''
      },
      checkSequenceMD5: false,
    })

    // Fetch reads from chr11 (seqId=2 in the FASTA) in a known exome region
    const header = await cram.cram.getSamHeader()
    // Find the seqId for chromosome 11
    const lines = header.filter(
      h => h.tag === 'SQ' && h.data.some(d => d.tag === 'SN' && d.value === '11'),
    )
    expect(lines.length).toBeGreaterThan(0)

    // Use the cram index to find reads on chr11
    // First find the refId for '11' in the cram header
    const sqLines = header.filter(h => h.tag === 'SQ')
    const chr11Idx = sqLines.findIndex(h =>
      h.data.some(d => d.tag === 'SN' && d.value === '11'),
    )
    expect(chr11Idx).toBeGreaterThanOrEqual(0)

    // Fetch a small region that should have exome coverage
    const records = await cram.getRecordsForRange(chr11Idx, 5225464, 5225700)
    expect(records.length).toBeGreaterThan(0)

    // Check that X-type read features have sub populated
    let totalX = 0
    let missingSubCount = 0
    for (const record of records) {
      if (!record.readFeatures) {
        continue
      }
      for (const rf of record.readFeatures) {
        if (rf.code === 'X') {
          totalX++
          const xrf = rf as { sub?: string; ref?: string; data: number }
          if (!xrf.sub) {
            missingSubCount++
            console.log(
              `[NA12878 test] X feature missing sub: data=${xrf.data} ref=${xrf.ref} refPos=${rf.refPos}`,
            )
          }
        }
      }
    }
    console.log(
      `NA12878 test: ${records.length} records, ${totalX} X features, ${missingSubCount} missing sub`,
    )
    expect(missingSubCount).toBe(0)
  },
  60000,
)
