import { IndexedCramFile } from '@gmod/cram'
import { getClip } from '@jbrowse/cigar-utils'
import PluginManager from '@jbrowse/core/PluginManager'
import { statusMessageText } from '@jbrowse/core/util'
import { makeAbortError } from '@jbrowse/core/util/aborting'
import { CachedFilehandle } from '@jbrowse/core/util/io'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './CramAdapter.ts'
import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from './CramTestAdapters.fixture.ts'
import configSchema from './configSchema.ts'

const pluginManager = new PluginManager()

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
    volvoxReference,
  )
}

test('adapter can fetch features from volvox-sorted.cram', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')

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

// Regression: the .crai index downloads once (in setup, during the first
// fetch). A second fetch after a small pan/zoom reuses it and must not re-flash
// "Downloading index" — it only downloads alignments.
test('emits "Downloading index" on first fetch only, not once cached', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
  const query = {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  }
  const collect = async () => {
    const seen: string[] = []
    await firstValueFrom(
      adapter
        .getFeatures(query, {
          statusCallback: s => {
            seen.push(statusMessageText(s) ?? '')
          },
        })
        .pipe(toArray()),
    )
    return seen
  }

  const first = await collect()
  const second = await collect()

  expect(first).toContain('Downloading index')
  expect(second).not.toContain('Downloading index')
  expect(second).toContain('Downloading alignments')
})

test('test usage of cramSlightlyLazyFeature toJSON (used in the widget)', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')

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

test('clipLengthAtStartOfRead matches getClip(CIGAR) for every record', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  expect(featuresArray.length).toBeGreaterThan(0)
  for (const feature of featuresArray) {
    const cigar = feature.get('CIGAR') as string
    const strand = feature.get('strand')!
    expect(feature.get('clipLengthAtStartOfRead')).toBe(getClip(cigar, strand))
  }
})

// The signal is what makes a cancelled navigation reach the socket. Without it
// a superseded fetch stops *processing* records but downloads the whole range
// first, which on a 2000x pileup is the entire cost of the navigation it was
// meant to abandon. BamAdapter has done this since the signal reached the reader;
// CramAdapter had the signal in hand and passed no signal.
//
// jest cannot cover what the signal does to a socket — see the comment at the
// top of products/jbrowse-web/browser-tests/suites/fetch-cancellation.ts, which
// covers that end for BAM. What it can pin is that a signal is threaded at all,
// and that it is wired to this call's signal, which is the part that was
// missing and the part a refactor would silently drop again.
test('getFeatures threads its signal into the cram read as a signal', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')

  // The read is held open so the signal can be stopped while it is genuinely in
  // flight. That is the only window in which the signal is live: the signal
  // disposes its listener as soon as the call it wraps resolves, so a signal
  // stopped afterwards correctly aborts nothing.
  const seen: (AbortSignal | undefined)[] = []
  let releaseRead = () => {}
  const readReached = new Promise<void>(resolveReached => {
    const spy = jest
      .spyOn(IndexedCramFile.prototype, 'getRecordsForRange')
      .mockImplementation(async (_seq, _start, _end, opts) => {
        seen.push(opts?.signal)
        resolveReached()
        await new Promise<void>(r => {
          releaseRead = () => {
            spy.mockRestore()
            r()
          }
        })
        return []
      })
  })

  const signalController = new AbortController()
  const signal = signalController.signal
  const done = firstValueFrom(
    adapter
      .getFeatures(
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 20000 },
        { signal },
      )
      .pipe(toArray()),
  )

  await readReached
  expect(seen).toHaveLength(1)
  const readSignal = seen[0]
  expect(readSignal).toBeInstanceOf(AbortSignal)
  expect(readSignal!.aborted).toBe(false)

  // and it is this call's signal driving it, not some unrelated one
  const aborted = new Promise<void>(resolve => {
    readSignal!.addEventListener('abort', () => {
      resolve()
    })
  })
  signalController.abort()
  await aborted
  expect(readSignal!.aborted).toBe(true)

  // and the observable unwinds rather than delivering features from a read the
  // caller has already abandoned
  releaseRead()
  await expect(done).rejects.toMatchObject({ name: 'AbortError' })
})

// CRAM keeps RG in its own data series, resolved through the header, so the
// tag filter has to read it the way the details panel does
test('a read-group tag filter keeps only that group', async () => {
  const adapter = makeAdapter('../../../../test_data/volvox/volvox-rg.cram')
  const reads = (tagFilters?: { tag: string; value: string }[]) =>
    firstValueFrom(
      adapter
        .getFeatures(
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
          { filterBy: { flagInclude: 0, flagExclude: 0, tagFilters } },
        )
        .pipe(toArray()),
    )

  const all = await reads()
  const group4 = await reads([{ tag: 'RG', value: '4' }])
  expect(group4.length).toBeGreaterThan(0)
  expect(group4.length).toBeLessThan(all.length)
  expect(
    group4.every(f => (f.get('tags') as Record<string, unknown>).RG === '4'),
  ).toBe(true)
})

// volvox-sorted.cram has no @RG header lines, so every read's group lookup
// falls through to the tag block, where it found the same override again
test('an RG tag filter on a CRAM with no read groups keeps no read', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
  const reads = await firstValueFrom(
    adapter
      .getFeatures(
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 20000 },
        {
          filterBy: {
            flagInclude: 0,
            flagExclude: 0,
            tagFilters: [{ tag: 'RG', value: '4' }],
          },
        },
      )
      .pipe(toArray()),
  )
  expect(reads).toEqual([])
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
    const reads = hangReadsOf('.crai')
    const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
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
