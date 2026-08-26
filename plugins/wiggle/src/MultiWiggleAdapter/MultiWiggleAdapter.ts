import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { SimpleFeature, createStatusFanOut } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { merge } from 'rxjs'
import { map } from 'rxjs/operators'

import { fetchRegionRaws } from '../fetchRegionRaws.ts'
import { getFilename } from '../util.ts'
import { mapWithConcurrency } from './mapWithConcurrency.ts'

import type { RawFeatureArrays } from '../util.ts'
import type { WiggleAdapterOptions } from '../wiggleAdapterOptions.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type {
  FileLocation,
  AugmentedRegion as Region,
} from '@jbrowse/core/util/types'

interface WiggleOptions extends WiggleAdapterOptions {
  sources?: { name: string }[]
}

// How many subtracks fetch at once. A multiwiggle carries as many subtracks as
// someone points at it — hundreds is ordinary, a thousand happens — and the
// fan-out used to be a bare Promise.all over every one of them.
//
// The bound is about bytes in flight, not sockets. The browser already caps
// connections per origin, so the requests queue either way; what does not queue
// is what each in-flight fetch holds while it runs — the block group it
// downloaded, the wasm decompression output, and the parsed typed arrays. All
// of those live at once, per subtrack, and none of it is released until that
// subtrack's fetch resolves. Unbounded, peak worker memory scales with the
// subtrack count rather than with anything the machine has, which is a tab that
// dies rather than a view that is slow.
//
// Ten because wall-clock is set by the server and the connection cap well below
// this, so a higher number buys throughput no one can use and costs memory
// linearly. Deliberately a constant and not a config slot: nobody has a reason
// to tune it yet, and a slot is a support surface forever.
const SUBTRACK_FETCH_CONCURRENCY = 10

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
      subConfs = entries.map(entry => ({
        type: 'BigWigAdapter',
        source: getFilename(entry),
        bigWigLocation: {
          uri: entry,
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
    if (!sources?.length) {
      return adapters
    }
    const sourceNames = new Set(sources.map(s => s.name))
    return adapters.filter(adp => sourceNames.has(adp.source))
  }

  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const adapters = await this.getFilteredAdapters(opts.sources)

      merge(
        ...adapters.map(adp => {
          const { source, dataAdapter } = adp
          return dataAdapter.getFeatures(region, opts).pipe(
            map(f => {
              // Compared, not just tested for presence: disambiguateSources
              // renames a colliding entry AFTER its subadapter was built from
              // the original config, so a BigWigAdapter keeps stamping the
              // pre-disambiguation `source` slot. Two files sharing a basename
              // would then emit every feature under one name — which is what
              // the score-matrix clustering groups on, leaving both rows empty.
              // BigWigAdapter normally matches on the first compare, so this
              // still skips the wrapping in the common case.
              if (f.get('source') === source) {
                return f
              }
              // Fallback for adapters that don't set source, and rename path
              const data = f.toJSON()
              data.uniqueId = `${source}-${f.id()}`
              data.source = source
              return new SimpleFeature(data)
            }),
          )
        }),
      ).subscribe(observer)
    }, opts.stopToken)
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
        raws: await fetchRegionRaws(dataAdapter, regions, {
          ...opts,
          statusCallback: slot(),
        }),
      }),
    )
  }

  // UNUSED in-tree, same as BigWigAdapter's pair: autoscale is computed
  // client-side from the rendered arrays now (WiggleCommonMixin), so these only
  // fan out to subadapters for external callers.
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

  async getMultiRegionQuantitativeStats(
    regions: Region[] = [],
    opts: WiggleOptions = {},
  ) {
    if (!regions.length) {
      return blankStats()
    }

    const adapters = await this.getAdapters()

    const allStats = await Promise.all(
      adapters.map(adp =>
        adp.dataAdapter.getMultiRegionQuantitativeStats(regions, opts),
      ),
    )

    return aggregateQuantitativeStats(allStats)
  }

  // in another adapter type, this could be dynamic depending on region or
  // something, but it is static for this particular multi-wiggle adapter type
  async getSources(_regions: Region[]) {
    const adapters = await this.getAdapters()
    return adapters.map(
      ({ type: _t, bigWigLocation: _bw, dataAdapter: _da, ...rest }) => ({
        ...rest,
        name: rest.source,
      }),
    )
  }
}
