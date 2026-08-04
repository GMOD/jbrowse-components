import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { SimpleFeature } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { merge } from 'rxjs'
import { map } from 'rxjs/operators'

import { fetchRegionRaws } from '../fetchRegionRaws.ts'
import { getFilename } from '../util.ts'

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

interface AdapterConfig {
  type?: string
  source?: string
  name?: string
  bigWigLocation?: FileLocation
  [key: string]: unknown
}

function getFilenameFromAdapterConfig(config: AdapterConfig) {
  if (config.type === 'BigWigAdapter' && config.bigWigLocation) {
    const location = config.bigWigLocation
    if ('uri' in location && location.uri) {
      return getFilename(location.uri)
    }
    if ('localPath' in location && location.localPath) {
      return getFilename(location.localPath)
    }
    if ('blob' in location && location.blob) {
      const blob = location.blob as File
      return blob.name ? getFilename(blob.name) : undefined
    }
  }
  return undefined
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
  const used = new Set<string>()
  return entries.map(entry => {
    const collides = (counts.get(entry.source) ?? 0) > 1
    const preferred = collides
      ? (parentDirLabel(entry.source, getLocationPath(entry.bigWigLocation)) ??
        entry.source)
      : entry.source
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

  private adaptersP?: Promise<AdapterEntry[]>

  public async getAdapters(): Promise<AdapterEntry[]> {
    this.adaptersP ??= this.getAdaptersImpl()
    return this.adaptersP
  }

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
  public async getMultiSourceFeatureArraysMulti(
    regions: Region[],
    opts: WiggleOptions = {},
  ): Promise<{ source: string; raws: RawFeatureArrays[] }[]> {
    const adapters = await this.getFilteredAdapters(opts.sources)
    return Promise.all(
      adapters.map(async ({ source, dataAdapter }) => ({
        source,
        raws: await fetchRegionRaws(dataAdapter, regions, opts),
      })),
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
