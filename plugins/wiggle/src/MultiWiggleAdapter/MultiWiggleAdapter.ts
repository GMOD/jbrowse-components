import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { aggregateQuantitativeStats } from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { SimpleFeature, createStatusFanOut } from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { getSamplesTsvSources } from '@jbrowse/core/util/samplesTsv'
import { firstValueFrom, merge } from 'rxjs'
import { map, toArray } from 'rxjs/operators'

import { fetchRegionRaws } from '../fetchRegionRaws.ts'
import { getFilename } from '../util.ts'
import { mapWithConcurrency } from './mapWithConcurrency.ts'

import type { MultiSourceFetchOpts as WiggleOptions } from '../multiSourceAdapter.ts'
import type { RawFeatureArrays } from '../util.ts'
import type {
  BaseOptions,
  ZoomRange,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type {
  FileLocation,
  AugmentedRegion as Region,
} from '@jbrowse/core/util/types'

// Bounds bytes in flight rather than sockets: each running subtrack fetch holds
// its downloaded blocks, decompression output and parsed arrays until it
// resolves, so unbounded peak worker memory grows with the subtrack count.
const SUBTRACK_FETCH_CONCURRENCY = 10

async function namingSource<T>(source: string, work: Promise<T>) {
  try {
    return await work
  } catch (e) {
    if (isAbortException(e)) {
      throw e
    }
    throw new Error(`Subtrack "${source}": ${e}`, { cause: e })
  }
}

interface AdapterConfig {
  type?: string
  source?: string
  name?: string
  bigWigLocation?: FileLocation
  [key: string]: unknown
}

function getLocationPath(location?: FileLocation) {
  return location === undefined
    ? undefined
    : 'uri' in location && location.uri
      ? location.uri
      : 'localPath' in location && location.localPath
        ? location.localPath
        : 'blob' in location && location.blob instanceof File
          ? location.blob.name || undefined
          : undefined
}

// The basename a BigWig subadapter falls back to when its config names no
// `source`/`name` — the same path `disambiguateSources` reads below, so the
// derived label and the label that gets qualified on a collision are one walk
// over the location rather than two that can disagree about which forms count.
function getFilenameFromAdapterConfig(config: AdapterConfig) {
  if (config.type !== 'BigWigAdapter') {
    return undefined
  }
  const path = getLocationPath(config.bigWigLocation)
  return path ? getFilename(path) : undefined
}

// Grow a colliding label leftward to include its parent directory, e.g. the
// `sample` shared by `cond1/sample.bw` and `cond2/sample.bw` becomes
// `cond1/sample` vs `cond2/sample`.
function parentDirLabel(label: string, path?: string) {
  const trimmed = path?.replace(/\/+$/, '') ?? ''
  const dirSlash = trimmed.lastIndexOf('/')
  const dir = dirSlash === -1 ? '' : trimmed.slice(0, dirSlash)
  const parent = dir.slice(dir.lastIndexOf('/') + 1)
  return parent ? `${parent}/${label}` : undefined
}

// Two files sharing a basename (e.g. in different directories) derive the same
// `source`, which is the per-subtrack identity key — colliding sources collapse
// the subtracks into one duplicated-looking track (#5598). Qualify colliding
// labels with their parent directory, falling back to a numeric suffix so the
// result is always unique.
function disambiguateSources(entries: AdapterEntry[]): AdapterEntry[] {
  const counts = new Map<string, number>()
  for (const { source } of entries) {
    counts.set(source, (counts.get(source) ?? 0) + 1)
  }
  // Every already-unique name is reserved up front, not just the ones handed
  // out so far: a duplicate resolving to `sample (2)` must not take that name
  // from an entry genuinely called `sample (2)`, which would then be pushed out
  // to `sample (2) (2)` — renaming the subtrack that was never ambiguous. Those
  // entries return untouched below, so reserving them can't rename them either.
  const used = new Set(
    entries.map(e => e.source).filter(s => counts.get(s) === 1),
  )
  return entries.map(entry => {
    if (counts.get(entry.source) === 1) {
      return entry
    }
    const preferred =
      parentDirLabel(entry.source, getLocationPath(entry.bigWigLocation)) ??
      entry.source
    let source = preferred
    let n = 2
    while (used.has(source)) {
      source = `${preferred} (${n++})`
    }
    used.add(source)
    return source === entry.source ? entry : { ...entry, source }
  })
}

interface AdapterEntry {
  dataAdapter: BaseFeatureDataAdapter
  source: string
  bigWigLocation?: FileLocation
  [key: string]: unknown
}

export default class MultiWiggleAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['hasResolution']

  getAdapters = cachedSetup({ setup: () => this.getAdaptersImpl() })

  private async getAdaptersImpl(): Promise<AdapterEntry[]> {
    const getSubAdapter = this.getSubAdapter
    if (!getSubAdapter) {
      throw new Error('no getSubAdapter available')
    }
    let subConfs = this.getConf('subadapters')
    if (!subConfs?.length) {
      const entries = this.getConf('bigWigs') as string[]
      const baseUri = this.getConf('baseUri') || undefined
      subConfs = entries.map(entry => ({
        type: 'BigWigAdapter',
        source: getFilename(entry),
        bigWigLocation: {
          uri: entry,
          baseUri,
        },
      }))
    }

    const entries = await Promise.all(
      subConfs.map(async (conf: AdapterConfig) => {
        const dataAdapter = (await getSubAdapter(conf))
          .dataAdapter as BaseFeatureDataAdapter
        const source =
          conf.source ||
          conf.name ||
          getFilenameFromAdapterConfig(conf) ||
          dataAdapter.id
        return {
          ...conf,
          dataAdapter,
          source,
        }
      }),
    )
    return disambiguateSources(entries)
  }

  // note: can't really have dis-agreeing refNames
  public async getRefNames(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    const allNames = await Promise.all(
      adapters.map(a => a.dataAdapter.getRefNames(opts)),
    )
    return [...new Set(allNames.flat())]
  }

  private async getFilteredAdapters(sources?: { name: string }[]) {
    const adapters = await this.getAdapters()
    const wanted = sources?.length
      ? sources
      : (await this.getSourcesAndWarnings()).sources
    const sourceNames = new Set(wanted.map(s => s.name))
    return adapters.filter(adp => sourceNames.has(adp.source))
  }

  // Bounded like the fetch it runs beside: a BigWig's first range under its
  // first zoom level reads a raw-section sample, several range reads a file
  public async getZoomRange(
    opts: WiggleOptions = {},
  ): Promise<ZoomRange | undefined> {
    const adapters = await this.getFilteredAdapters(opts.sources)
    const ranges = await mapWithConcurrency(
      adapters,
      SUBTRACK_FETCH_CONCURRENCY,
      adp => namingSource(adp.source, adp.dataAdapter.getZoomRange(opts)),
    )
    let range: ZoomRange | undefined
    for (const r of ranges) {
      if (r) {
        range = range
          ? {
              minBpPerPx: Math.max(range.minBpPerPx, r.minBpPerPx),
              maxBpPerPx: Math.min(range.maxBpPerPx, r.maxBpPerPx),
            }
          : r
      }
    }
    return range
  }

  private sourceFeatures(
    { source, dataAdapter }: AdapterEntry,
    region: Region,
    opts: WiggleOptions,
  ) {
    return dataAdapter.getFeatures(region, opts).pipe(
      map(f => {
        // Compared, not tested for presence: disambiguateSources renames a
        // colliding entry after its subadapter was built, so a BigWigAdapter
        // stamps the old name, and two files sharing a basename would emit
        // every feature under one source.
        if (f.get('source') === source) {
          return f
        }
        const data = f.toJSON()
        data.uniqueId = `${source}-${f.id()}`
        data.source = source
        return new SimpleFeature(data)
      }),
    )
  }

  // Streams each subtrack's features as they arrive, so two calls may
  // interleave them differently; `getFeaturesArray` is the ordered list.
  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const adapters = await this.getFilteredAdapters(opts.sources)
      const slot = createStatusFanOut(opts.statusCallback)
      merge(
        ...adapters.map(adp =>
          this.sourceFeatures(adp, region, {
            ...opts,
            statusCallback: slot(),
          }),
        ),
        SUBTRACK_FETCH_CONCURRENCY,
      ).subscribe(observer)
    }, opts.signal)
  }

  // The subtracks in declared order, whichever file answers first: a click
  // re-runs this and indexes the list by the position the first call gave
  // the instance, so arrival order would open another file's feature.
  public async getFeaturesArray(region: Region, opts: WiggleOptions = {}) {
    const adapters = await this.getFilteredAdapters(opts.sources)
    const slot = createStatusFanOut(opts.statusCallback)
    const perSource = await mapWithConcurrency(
      adapters,
      SUBTRACK_FETCH_CONCURRENCY,
      adp =>
        namingSource(
          adp.source,
          firstValueFrom(
            this.sourceFeatures(adp, region, {
              ...opts,
              statusCallback: slot(),
            }).pipe(toArray()),
          ),
        ),
    )
    return perSource.flat()
  }

  // Every visible region in one call per subtrack: each subadapter is its own
  // file, so handing it all the regions lets it coalesce reads across them
  // (BigWig does — see fetchRegionRaws). `raws` is aligned to `regions`.
  //
  // The subtracks download concurrently and all report the same phase
  // ("Downloading wiggle data"), so each gets its own createStatusFanOut slot
  // rather than the caller's raw statusCallback — otherwise the last writer wins
  // and the first file to finish blanks the label while the other 39 are still
  // going. Aggregated, N subtracks read as one Σbytes bar. Same idiom as
  // BaseFeatureDataAdapter.getFeaturesInMultipleRegions.
  //
  // Concurrently, but not all at once — see SUBTRACK_FETCH_CONCURRENCY. A slot
  // is taken when a subtrack actually starts rather than up front, so the bar
  // aggregates the ones in flight instead of showing hundreds of silent slots.
  public async getMultiSourceFeatureArraysMulti(
    regions: Region[],
    opts: WiggleOptions = {},
  ): Promise<{ source: string; raws: RawFeatureArrays[] }[]> {
    const adapters = await this.getFilteredAdapters(opts.sources)
    const slot = createStatusFanOut(opts.statusCallback)
    return mapWithConcurrency(
      adapters,
      SUBTRACK_FETCH_CONCURRENCY,
      async ({ source, dataAdapter }) => ({
        source,
        raws: await namingSource(
          source,
          fetchRegionRaws(dataAdapter, regions, {
            ...opts,
            statusCallback: slot(),
          }),
        ),
      }),
    )
  }

  public async getRegionQuantitativeStats(
    region: Region,
    opts?: WiggleOptions,
  ) {
    const adapters = await this.getAdapters()
    const allStats = await Promise.all(
      adapters.map(adp =>
        adp.dataAdapter.getRegionQuantitativeStats(region, opts),
      ),
    )
    return aggregateQuantitativeStats(allStats)
  }

  getSourcesAndWarnings = cachedSetup({
    setup: async opts => {
      const sources = (await this.getAdapters()).map(
        ({ type: _t, bigWigLocation: _bw, dataAdapter: _da, ...rest }) => ({
          ...rest,
          name: rest.source,
        }),
      )
      const { sources: rows, warnings } = await getSamplesTsvSources({
        location: this.getConf('samplesTsvLocation'),
        names: sources.map(s => s.name),
        namesLabel: 'the subtrack list',
        pluginManager: this.pluginManager,
        opts,
      })
      const byName = new Map(sources.map(s => [s.name, s]))
      return {
        sources: rows.map(row => ({ ...byName.get(row.name)!, ...row })),
        warnings,
      }
    },
  })

  async getSources(_regions: Region[], opts?: BaseOptions) {
    return (await this.getSourcesAndWarnings(opts)).sources
  }
}
