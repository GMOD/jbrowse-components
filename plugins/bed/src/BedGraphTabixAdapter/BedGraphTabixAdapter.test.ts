import { makeAbortError } from '@jbrowse/core/util/aborting'
import { CachedFilehandle } from '@jbrowse/core/util/io'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BedGraphTabixAdapter from './BedGraphTabixAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter() {
  return new BedGraphTabixAdapter(
    configSchema.create({
      bedGraphGzLocation: {
        localPath: require.resolve('./test_data/test.bg.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('./test_data/test.bg.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
}
test('basic', async () => {
  const adapter = makeAdapter()

  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chr1',
        start: 0,
        end: 10000,
      })
      .pipe(toArray()),
  )

  expect(features).toMatchSnapshot()
})

// A bedGraph whose header is a plain row skipped with `tabix -S 1` rather than
// a `#` comment. tabix's getHeader() returns nothing for those, so the value
// columns used to come back unnamed with no error anywhere — the track drew,
// the names were just gone.
test('names value columns from a skip-line header', async () => {
  const adapter = new BedGraphTabixAdapter(
    configSchema.create({
      bedGraphGzLocation: {
        localPath: require.resolve('./test_data/skipline.bg.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('./test_data/skipline.bg.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
  expect(await adapter.getNames()).toEqual([
    'chrom',
    'start',
    'end',
    'gain',
    'loss',
  ])
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
    const adapter = makeAdapter()
    const caller = new AbortController()
    const pending = adapter.getRefNames({ signal: caller.signal })
    await until(() => reads.length > 0)
    caller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await until(() => reads.every(signal => signal?.aborted))
    expect(reads).not.toHaveLength(0)
    expect(reads.every(signal => signal?.aborted)).toBe(true)
  })
})
