import { makeAbortError } from '@jbrowse/core/util/aborting'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { CachedFilehandle } from '@jbrowse/core/util/io'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './VcfTabixAdapter.ts'
import configSchema from './configSchema.ts'

test('adapter can fetch variants from volvox.vcf.gz', async () => {
  const adapter = new Adapter(
    configSchema.create({
      vcfGzLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        indexType: 'TBI',
        location: {
          localPath: require.resolve('./test_data/volvox.filtered.vcf.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )

  const csiAdapter = new Adapter(
    configSchema.create({
      vcfGzLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        indexType: 'CSI',
        location: {
          localPath: require.resolve('./test_data/volvox.filtered.vcf.gz.csi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )

  const csiFeatures = csiAdapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const names = await adapter.getRefNames()
  const csiNames = await csiAdapter.getRefNames()
  expect(names).toEqual(csiNames)
  expect(names).toMatchSnapshot()

  const feat = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featArray = await firstValueFrom(feat.pipe(toArray()))
  const csiFeaturesArray = await firstValueFrom(csiFeatures.pipe(toArray()))
  expect(featArray.slice(0, 5)).toMatchSnapshot()
  expect(JSON.stringify(csiFeaturesArray.slice(0, 5))).toEqual(
    JSON.stringify(featArray.slice(0, 5)),
  )

  const featNonExist = adapter.getFeatures({
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featArrayNonExist = await firstValueFrom(featNonExist.pipe(toArray()))
  expect(featArrayNonExist).toEqual([])
})

function hangReadsOf(suffix: string) {
  const signals: (AbortSignal | undefined)[] = []
  const { readFile } = CachedFilehandle.prototype
  jest
    .spyOn(CachedFilehandle.prototype, 'readFile')
    .mockImplementation(function (this: CachedFilehandle, opts) {
      if (!this.source?.endsWith(suffix)) {
        return readFile.call(this, opts)
      }
      const signal = typeof opts === 'object' ? opts.signal : undefined
      signals.push(signal)
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(makeAbortError())
        })
      })
    })
  return signals
}

async function until(done: () => boolean) {
  for (let i = 0; i < 100 && !done(); i++) {
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

describe('an abandoned setup', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('aborts its index read', async () => {
    const reads = hangReadsOf('.tbi')
    const adapter = new Adapter(
      configSchema.create({
        vcfGzLocation: {
          localPath: require.resolve('./test_data/volvox.filtered.vcf.gz'),
          locationType: 'LocalPathLocation',
        },
        index: {
          location: {
            localPath:
              require.resolve('./test_data/volvox.filtered.vcf.gz.tbi'),
            locationType: 'LocalPathLocation',
          },
        },
      }),
    )
    const caller = new AbortController()
    const pending = adapter.getHeader({ signal: caller.signal })
    await until(() => reads.length > 0)
    caller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await until(() => reads.every(signal => signal?.aborted))
    expect(reads).not.toHaveLength(0)
    expect(reads.every(signal => signal?.aborted)).toBe(true)
  })
})

// @gmod/tabix reads a record's span as htslib does, so the lines it returns
// cover the span `getEnd` gives the feature
describe('a symbolic record with no usable END', () => {
  const vcfGz = require.resolve('./test_data/sv_svlen.vcf.gz')
  const names = async (start: number, end: number) => {
    const adapter = new Adapter(
      configSchema.create({
        vcfGzLocation: { localPath: vcfGz, locationType: 'LocalPathLocation' },
        index: {
          indexType: 'TBI',
          location: {
            localPath: `${vcfGz}.tbi`,
            locationType: 'LocalPathLocation',
          },
        },
      }),
    )
    const features = await firstValueFrom(
      adapter.getFeatures({ refName: 'chr1', start, end }).pipe(toArray()),
    )
    return features.map(f => f.get('name'))
  }

  test('a <DEL> with SVLEN alone is fetched from inside its span', async () => {
    expect(await names(3000, 4000)).toEqual(['delsvlen'])
  })

  test('an END before POS does not hide the record at its POS', async () => {
    expect(await names(1199, 1200)).toEqual(['delsvlen', 'insbadend'])
  })
})

// dataAdapterCache calls this when the last session lets go of the adapter. A
// chunk cache nobody clears stays alive on its idle sweep for three minutes.
test('an evicted adapter hands its chunks back to the shared budget', async () => {
  const adapter = new Adapter(
    configSchema.create({
      vcfGzLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        indexType: 'TBI',
        location: {
          localPath: require.resolve('./test_data/volvox.filtered.vcf.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
  // freeing an adapter that never opened its file is not an error
  adapter.freeResources()

  const before = decompressedBytesBudget.total
  await firstValueFrom(
    adapter
      .getFeatures({ refName: 'ctgA', start: 0, end: 20000 })
      .pipe(toArray()),
  )
  expect(decompressedBytesBudget.total).toBeGreaterThan(before)

  adapter.freeResources()
  expect(decompressedBytesBudget.total).toBe(before)
})
