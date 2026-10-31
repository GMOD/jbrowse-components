import { makeAbortError } from '@jbrowse/core/util/aborting'
import { CachedFilehandle } from '@jbrowse/core/util/io'
import { of } from 'rxjs'

import BgzipMafAdapter from '../BgzipMafAdapter/BgzipMafAdapter.ts'
import bgzipMafConfigSchema from '../BgzipMafAdapter/configSchema.ts'
import BgzipTaffyAdapter from '../BgzipTaffyAdapter/BgzipTaffyAdapter.ts'
import bgzipTaffyConfigSchema from '../BgzipTaffyAdapter/configSchema.ts'
import BigMafAdapter from '../BigMafAdapter/BigMafAdapter.ts'
import bigMafConfigSchema from '../BigMafAdapter/configSchema.ts'
import { loadMafSamplesAdapter } from './loadMafSamplesAdapter.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

const mockGetAdapter = jest.fn()
jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: (...args: unknown[]) => mockGetAdapter(...args) as unknown,
}))

const taf = {
  localPath: require.resolve('../../test_data/celegans/chrI.taf.gz'),
  locationType: 'LocalPathLocation',
}
const tai = {
  localPath: require.resolve('../../test_data/celegans/chrI.taf.gz.tai'),
  locationType: 'LocalPathLocation',
}
const nhLocation = {
  localPath: require.resolve('../../test_data/celegans/ce10.7way.nh'),
  locationType: 'LocalPathLocation',
}

function makeTaffy() {
  return new BgzipTaffyAdapter(
    bgzipTaffyConfigSchema.create({
      tafGzLocation: taf,
      taiLocation: tai,
      nhLocation,
    }),
  )
}

function makeMaf() {
  return new BgzipMafAdapter(
    bgzipMafConfigSchema.create({
      mafGzLocation: taf,
      taiLocation: tai,
      nhLocation,
    }),
  )
}

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

  it.each([
    [
      'BgzipTaffyAdapter',
      '.tai',
      (signal: AbortSignal) => makeTaffy().getRefNames({ signal }),
    ],
    [
      'BgzipMafAdapter',
      '.tai',
      (signal: AbortSignal) => makeMaf().getRefNames({ signal }),
    ],
    [
      'the samples of a MAF adapter',
      '.nh',
      (signal: AbortSignal) => makeMaf().getSamples({ signal }),
    ],
  ])('aborts the read under %s', async (_name, suffix, start) => {
    const reads = hangReadsOf(suffix)
    const caller = new AbortController()
    const pending = start(caller.signal)
    await until(() => reads.length > 0)
    caller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await until(() => reads.every(signal => signal?.aborted))
    expect(reads).not.toHaveLength(0)
    expect(reads.every(signal => signal?.aborted)).toBe(true)
  })
})

describe('a shared setup a caller awaits', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('loadMafSamplesAdapter aborts the samples read with its caller', async () => {
    mockGetAdapter.mockResolvedValue({ dataAdapter: makeMaf() })
    const reads = hangReadsOf('.nh')
    const caller = new AbortController()
    const pending = loadMafSamplesAdapter(
      {} as PluginManager,
      'session',
      {},
      { signal: caller.signal },
    )
    await until(() => reads.length > 0)
    caller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await until(() => reads.every(signal => signal?.aborted))
    expect(reads).not.toHaveLength(0)
    expect(reads.every(signal => signal?.aborted)).toBe(true)
  })

  test.each(['getRefNames', 'getHeader'] as const)(
    '%s hands the sub-adapter its signal',
    async method => {
      const seen: unknown[] = []
      const record = async (opts?: BaseOptions) => {
        seen.push(opts?.signal)
        return []
      }
      const subAdapter: getSubAdapterType = async () => ({
        dataAdapter: {
          getFeatures: () => of(),
          getRefNames: record,
          getHeader: record,
        } as unknown as Awaited<ReturnType<getSubAdapterType>>['dataAdapter'],
        sessionIds: new Set<string>(),
      })
      const adapter = new BigMafAdapter(
        bigMafConfigSchema.create({}),
        subAdapter,
      )
      const { signal } = new AbortController()
      await adapter[method]({ signal })
      expect(seen).toEqual([signal])
    },
  )
})
