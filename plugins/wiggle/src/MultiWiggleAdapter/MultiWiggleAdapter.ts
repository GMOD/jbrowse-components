import { declaredSnapshot } from '@jbrowse/core/configuration'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, createStatusFanOut } from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { getSamplesTsvSources } from '@jbrowse/core/util/samplesTsv'
import { firstValueFrom, merge } from 'rxjs'
import { map, toArray } from 'rxjs/operators'

import { fetchRegionRaws, servesArrays } from '../fetchRegionRaws.ts'
import { mapWithConcurrency } from './mapWithConcurrency.ts'
import {
  getFilenameFromAdapterConfig,
  getPrimaryLocationPath,
} from './memberLocation.ts'
import { multiWiggleFeatureTable } from './multiWiggleFeatureTable.ts'

import type { MultiSourceFetchOpts as WiggleOptions } from '../multiSourceAdapter.ts'
import type { RawFeatureArrays } from '../util.ts'
import type { MemberConfig } from './memberLocation.ts'
import type {
  BaseOptions,
  ZoomRange,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type {
  RowSourceLister,
  RowSourceListing,
} from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

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

interface AdapterConfig extends MemberConfig {
  source?: string
  name?: string
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
function disambiguateSources<T extends LabelledMember>(entries: T[]): T[] {
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
      parentDirLabel(entry.source, getPrimaryLocationPath(entry)) ??
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

interface LabelledMember extends MemberConfig {
  source: string
}

interface BuiltMember {
  dataAdapter: BaseFeatureDataAdapter
  stamped: boolean
}

interface AdapterEntry extends LabelledMember, BuiltMember {}

function restamp(feature: Feature, source: string) {
  return new SimpleFeature({
    ...feature.toJSON(),
    uniqueId: `${source}-${feature.id()}`,
    source,
  })
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

export default class MultiWiggleAdapter
  extends BaseFeatureDataAdapter
  implements RowSourceLister
{
  public static capabilities = ['hasResolution']

  getAdapters = cachedSetup({ setup: () => this.getAdaptersImpl() })

  private memberConfs(): AdapterConfig[] {
    const subConfs = this.getConf('subadapters') as AdapterConfig[] | undefined
    if (subConfs?.length) {
      return subConfs
    }
    const baseUri = this.getConf('baseUri') || undefined
    return (this.getConf('bigWigs') as string[]).map(uri => ({
      type: 'BigWigAdapter',
      bigWigLocation: { uri, baseUri },
    }))
  }

  // `stamped` when the config handed over carries the member's `source`, so
  // the subadapter names its own features; a schema with no `source` slot
  // drops it, and only BigWig's has one.
  private async buildMember(conf: AdapterConfig): Promise<BuiltMember> {
    const getSubAdapter = this.getSubAdapter
    if (!getSubAdapter) {
      throw new Error('no getSubAdapter available')
    }
    const schema = conf.type
      ? this.pluginManager?.getAdapterType(conf.type).configSchema
      : undefined
    const subConf = schema ? declaredSnapshot(schema, conf) : conf
    const { dataAdapter } = await getSubAdapter(subConf)
    return {
      dataAdapter: dataAdapter as BaseFeatureDataAdapter,
      stamped: !!conf.source && subConf.source === conf.source,
    }
  }

  // Each member is built with its final, disambiguated name, except one with
  // no name and no path: its adapter's id names it, so it is built first,
  // unstamped.
  private async getAdaptersImpl(): Promise<AdapterEntry[]> {
    const labelled = await Promise.all(
      this.memberConfs().map(async conf => {
        const label =
          conf.source || conf.name || getFilenameFromAdapterConfig(conf)
        if (label) {
          return { ...conf, source: label, built: undefined }
        }
        const built = await this.buildMember(conf)
        return { ...conf, source: built.dataAdapter.id, built }
      }),
    )
    return Promise.all(
      disambiguateSources(labelled).map(async ({ built, ...member }) => ({
        ...member,
        ...(built ?? (await this.buildMember(member))),
      })),
    )
  }

  // note: can't really have dis-agreeing refNames
  public async getRefNames(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    // Unbounded, unlike the data reads: a header is a few KB, and every one
    // read here is one the first fetch finds cached instead of queueing for
    // inside SUBTRACK_FETCH_CONCURRENCY.
    const allNames = await Promise.all(
      adapters.map(a =>
        namingSource(a.source, a.dataAdapter.getRefNames(opts)),
      ),
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

  // Concurrently but bounded (SUBTRACK_FETCH_CONCURRENCY), each subtrack with
  // its own createStatusFanOut slot, taken when it starts: the subtracks all
  // report the same phase, so on one shared callback the first to finish would
  // blank the label while the rest still read, where N slots aggregate into one
  // bar.
  private eachSource<T>(
    adapters: AdapterEntry[],
    opts: WiggleOptions,
    work: (entry: AdapterEntry, opts: WiggleOptions) => Promise<T>,
  ) {
    const slot = createStatusFanOut(opts.statusCallback)
    return mapWithConcurrency(adapters, SUBTRACK_FETCH_CONCURRENCY, entry =>
      namingSource(
        entry.source,
        work(entry, { ...opts, statusCallback: slot() }),
      ),
    )
  }

  // Bounded like the fetch it runs beside: a BigWig's first range under its
  // first zoom level reads a raw-section sample, several range reads a file
  public async getZoomRange(
    opts: WiggleOptions = {},
  ): Promise<ZoomRange | undefined> {
    const ranges = await this.eachSource(
      await this.getFilteredAdapters(opts.sources),
      opts,
      (adp, o) => adp.dataAdapter.getZoomRange(o),
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

  public async getRegionByteSize(regions: Region[], opts: WiggleOptions = {}) {
    const sizes = await this.eachSource(
      await this.getFilteredAdapters(opts.sources),
      opts,
      (adp, o) => adp.dataAdapter.getRegionByteSize(regions, o),
    )
    const known = sizes.filter(size => size !== undefined)
    return known.length ? known.reduce((a, b) => a + b, 0) : undefined
  }

  private sourceFeatures(
    { source, dataAdapter, stamped }: AdapterEntry,
    region: Region,
    opts: WiggleOptions,
  ) {
    const features = dataAdapter.getFeatures(region, opts)
    return stamped ? features : features.pipe(map(f => restamp(f, source)))
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
    const perSource = await this.eachSource(
      await this.getFilteredAdapters(opts.sources),
      opts,
      (adp, o) =>
        firstValueFrom(this.sourceFeatures(adp, region, o).pipe(toArray())),
    )
    return perSource.flat()
  }

  // Every visible region in one call per subtrack: each subadapter is its own
  // file, so handing it all the regions lets it coalesce reads across them
  // (BigWig does — see fetchRegionRaws). `raws` is aligned to `regions`.
  public async getMultiSourceFeatureArraysMulti(
    regions: Region[],
    opts: WiggleOptions = {},
  ): Promise<{ source: string; raws: RawFeatureArrays[] }[]> {
    return this.sourceArrays(
      await this.getFilteredAdapters(opts.sources),
      regions,
      opts,
    )
  }

  private sourceArrays(
    adapters: AdapterEntry[],
    regions: Region[],
    opts: WiggleOptions,
  ) {
    return this.eachSource(
      adapters,
      opts,
      async ({ source, dataAdapter }, o) => ({
        source,
        raws: await fetchRegionRaws(
          dataAdapter,
          regions,
          o,
          this.pluginManager?.jexl,
        ),
      }),
    )
  }

  // Typed only where every subtrack serves arrays: a feature subadapter's
  // arrays keep just its score, and `y` may name any of its fields.
  override async getFeatureTable(region: Region, opts: WiggleOptions = {}) {
    const adapters = await this.getFilteredAdapters(opts.sources)
    if (!adapters.every(adp => servesArrays(adp.dataAdapter))) {
      return super.getFeatureTable(region, opts)
    }
    const perSource = await this.sourceArrays(adapters, [region], opts)
    return multiWiggleFeatureTable(
      perSource.map(({ source, raws }) => ({ source, raw: raws[0]! })),
      region.refName,
    )
  }

  // A row's attributes are the keys its subadapter config carries beyond the
  // adapter's own slots, which would otherwise list a file location as a column.
  private withoutAdapterSlots(
    type: string | undefined,
    conf: Record<string, unknown>,
  ) {
    const schema = type
      ? this.pluginManager?.getAdapterType(type).configSchema
      : undefined
    const slots = schema
      ? new Set(Object.keys(declaredSnapshot(schema, conf)))
      : undefined
    return slots
      ? Object.fromEntries(
          Object.entries(conf).filter(([key]) => !slots.has(key)),
        )
      : conf
  }

  getSourcesAndWarnings = cachedSetup({
    setup: async opts => {
      const sources = (await this.getAdapters()).map(
        ({
          type,
          bigWigLocation: _bw,
          dataAdapter: _da,
          stamped: _st,
          source,
          ...rest
        }) => ({
          ...this.withoutAdapterSlots(type, rest),
          source,
          name: source,
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

  async listRowSources(opts?: BaseOptions): Promise<RowSourceListing> {
    const sources: { name: string; [key: string]: unknown }[] =
      await this.getSources([], opts)
    return {
      field: 'source',
      sources: sources.map(({ name, label, color }) => ({
        name,
        ...(isText(label) ? { label } : {}),
        ...(isText(color) ? { color } : {}),
      })),
    }
  }
}
