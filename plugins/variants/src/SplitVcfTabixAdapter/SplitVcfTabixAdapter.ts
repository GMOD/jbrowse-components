import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import { indexSuffix, isCsiLocation } from '@jbrowse/core/configuration'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import {
  appendVcfLines,
  streamVcfFeatures,
  vcfSourcesAndWarnings,
} from '../shared/vcfAdapterUtils.ts'

import type { SplitVcfTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { FileLocation, NoAssemblyRegion } from '@jbrowse/core/util/types'

interface ContigFile {
  vcf: TabixIndexedFile
  parser: VcfParser
  header: string
}

function namedIndexType(location: FileLocation, fallback: 'TBI' | 'CSI') {
  const name =
    'uri' in location
      ? location.uri
      : 'localPath' in location
        ? location.localPath
        : ''
  return isCsiLocation(location)
    ? 'CSI'
    : /\.tbi$/i.test(name.split(/[?#]/)[0]!)
      ? 'TBI'
      : fallback
}

export default class SplitVcfTabixAdapter extends BaseFeatureDataAdapter<SplitVcfTabixAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames', 'exportData']

  private setups = new Map<
    string,
    (opts?: BaseOptions) => Promise<ContigFile>
  >()

  // every contig's file opened so far, for dataAdapterCache's eviction to clear
  private files: TabixIndexedFile[] = []

  freeResources() {
    for (const file of this.files) {
      file.clearChunkCache()
    }
  }

  // `vcfGzLocationMap` is a frozen slot, so nothing validates its keys at load
  private locationMap(): Record<string, FileLocation | undefined> {
    return this.getConf('vcfGzLocationMap')
  }

  private openContig(refName: string, vcfGzLocation: FileLocation) {
    const indexType = this.getConf('indexType')
    const named: FileLocation | undefined =
      this.getConf('indexLocationMap')[refName]
    const derived =
      'uri' in vcfGzLocation
        ? {
            locationType: 'UriLocation' as const,
            uri: `${vcfGzLocation.uri}${indexSuffix(indexType)}`,
            baseUri: vcfGzLocation.baseUri,
          }
        : undefined
    const indexLocation = named ?? derived
    if (!indexLocation) {
      throw new Error(
        `SplitVcfTabixAdapter needs an indexLocationMap entry for "${refName}": its vcfGzLocationMap entry is not a uri, so the index location cannot be derived from it`,
      )
    }
    const file = new TabixIndexedFile({
      filehandle: openLocation(vcfGzLocation, this.pluginManager),
      ...openTabixIndexFilehandle(
        indexLocation,
        named ? namedIndexType(named, indexType) : indexType,
        this.pluginManager,
      ),
      chunkCacheBudget: decompressedBytesBudget,
      bgzfWorkerPool: sharedBgzfWorkerPool(),
    })
    this.files.push(file)
    return file
  }

  /** The contig's file, or undefined for a contig the map has no file for. */
  async configure(refName: string, opts?: BaseOptions) {
    const vcfGzLocation = this.locationMap()[refName]
    if (!vcfGzLocation) {
      return undefined
    }
    let setup = this.setups.get(refName)
    if (!setup) {
      setup = cachedSetup({
        label: 'Downloading index',
        setup: async ({ signal }) => {
          const vcf = this.openContig(refName, vcfGzLocation)
          const header = await vcf.getHeader({ signal })
          return { vcf, parser: new VcfParser({ header }), header }
        },
      })
      this.setups.set(refName, setup)
    }
    return setup(opts)
  }

  private emptyMapError() {
    return new Error('SplitVcfTabixAdapter has an empty vcfGzLocationMap')
  }

  // the files share their metadata lines, so any of them answers for the
  // header's text, an open one first; their sample columns can differ, which
  // is what allContigs is for
  private async anyContig(opts?: BaseOptions) {
    const [refName] = [
      ...this.setups.keys(),
      ...Object.keys(this.locationMap()),
    ]
    const contig =
      refName === undefined ? undefined : await this.configure(refName, opts)
    if (!contig) {
      throw this.emptyMapError()
    }
    return contig
  }

  // every file in the map, in map order, which opens each one's header
  private async allContigs(opts?: BaseOptions) {
    const contigs = await Promise.all(
      Object.keys(this.locationMap()).map(refName =>
        this.configure(refName, opts),
      ),
    )
    const opened = contigs.filter(contig => contig !== undefined)
    if (opened.length === 0) {
      throw this.emptyMapError()
    }
    return opened
  }

  public async getRefNames() {
    return Object.keys(this.locationMap())
  }

  async getHeader(opts?: BaseOptions) {
    return (await this.anyContig(opts)).header
  }

  async getMetadata(opts?: BaseOptions) {
    return (await this.anyContig(opts)).parser.getMetadata()
  }

  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    let total = 0
    for (const [refName, refRegions] of Map.groupBy(regions, r => r.refName)) {
      const contig = await this.configure(refName, opts)
      if (contig) {
        total += await contig.vcf.bytesForRegions(refRegions, opts)
      }
    }
    return total
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const contig = await this.configure(query.refName, opts)
      if (contig) {
        await streamVcfFeatures(
          { ...contig, idPrefix: `${this.id}-${query.refName}` },
          query,
          opts,
          observer,
        )
      } else {
        observer.complete()
      }
    }, opts.signal)
  }

  public async getExportData(
    regions: NoAssemblyRegion[],
    formatType: string,
    opts?: BaseOptions,
  ): Promise<string | undefined> {
    if (formatType !== 'vcf') {
      return undefined
    }
    const { header } = await this.anyContig(opts)
    const exportLines = header.split('\n').filter(Boolean)
    for (const [refName, refRegions] of Map.groupBy(regions, r => r.refName)) {
      const contig = await this.configure(refName, opts)
      if (contig) {
        await appendVcfLines(
          exportLines,
          contig.vcf,
          contig.parser,
          refRegions,
          opts,
        )
      }
    }
    return exportLines.join('\n')
  }

  // See VcfTabixAdapter: `getSources` is the base-class contract, this is the
  // one that keeps the samples-metadata warnings.
  async getSourcesAndWarnings(opts?: BaseOptions) {
    const parsers = (await this.allContigs(opts)).map(c => c.parser)
    return vcfSourcesAndWarnings({
      parsers,
      samplesTsvLocation: this.getConf('samplesTsvLocation'),
      pluginManager: this.pluginManager,
      opts,
    })
  }

  async getSources(_regions: Region[], opts?: BaseOptions) {
    return (await this.getSourcesAndWarnings(opts)).sources
  }
}
