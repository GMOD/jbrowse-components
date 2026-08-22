import { TabixIndexedFile } from '@gmod/tabix'
import VcfParser from '@gmod/vcf'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { getVcfSources, streamVcfFeatures } from '../shared/vcfAdapterUtils.ts'

import type { SplitVcfTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { FileLocation, NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class SplitVcfTabixAdapter extends BaseFeatureDataAdapter<SplitVcfTabixAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames', 'exportData']

  private configuredByRef = new Map<
    string,
    Promise<{ vcf: TabixIndexedFile; parser: VcfParser }>
  >()

  // refNames whose per-contig index has finished downloading; gates the status
  // label so pan/zoom re-entry into configure() doesn't re-flash "Downloading
  // index" for a contig already loaded
  private readyRefs = new Set<string>()

  // Which contigs this adapter has a file for. `vcfGzLocationMap` is a frozen
  // slot, so nothing validates its shape at load (the keys are whatever the
  // config author typed) and every read has to treat a miss as a real outcome —
  // hence the `| undefined` the frozen slot's own `any` would otherwise hide.
  private locationMap(): Record<string, FileLocation | undefined> {
    return this.getConf('vcfGzLocationMap')
  }

  private configureOnce(refName: string) {
    if (!this.configuredByRef.has(refName)) {
      const indexType = this.getConf('indexType')
      const locationMap = this.locationMap()
      const vcfGzLocation = locationMap[refName]
      // Named, rather than left to fail as `undefined.uri` two lines down. The
      // usual cause is a map keyed in the other refName convention from the
      // assembly ('1' against a 'chr'-prefixed one, or the reverse), which
      // aliasing resolves everywhere else — so the bare TypeError named neither
      // the contig, the adapter, nor the slot to go fix.
      if (!vcfGzLocation) {
        throw new Error(
          `SplitVcfTabixAdapter has no vcfGzLocationMap entry for "${refName}". Available: ${
            Object.keys(locationMap).join(', ') || '(none)'
          }`,
        )
      }
      // The `.tbi`/`.csi` sibling can only be derived for a uri location: a
      // localPath or blob has no name to append to, and the old fallback built
      // the literal string "undefined.tbi" out of one and failed much later,
      // inside tabix, as a fetch error naming a path nobody wrote.
      const indexLocation: FileLocation | undefined =
        this.getConf('indexLocationMap')[refName] ??
        ('uri' in vcfGzLocation
          ? { uri: `${vcfGzLocation.uri}.${indexType.toLowerCase()}` }
          : undefined)
      if (!indexLocation) {
        throw new Error(
          `SplitVcfTabixAdapter needs an indexLocationMap entry for "${refName}": its vcfGzLocationMap entry is not a uri, so the index location cannot be derived from it`,
        )
      }
      const vcf = new TabixIndexedFile({
        filehandle: openLocation(vcfGzLocation, this.pluginManager),
        ...openTabixIndexFilehandle(
          indexLocation,
          indexType,
          this.pluginManager,
        ),
        chunkCacheBudget: decompressedBytesBudget,
        bgzfWorkerPool: sharedBgzfWorkerPool(),
      })
      this.configuredByRef.set(
        refName,
        vcf
          .getHeader()
          .then(header => {
            this.readyRefs.add(refName)
            return {
              vcf,
              parser: new VcfParser({ header }),
            }
          })
          .catch((e: unknown) => {
            this.configuredByRef.delete(refName)
            throw e
          }),
      )
    }
    return this.configuredByRef.get(refName)!
  }

  // Show "Downloading index" only while a contig's index is genuinely
  // downloading. Once loaded, callers await the cached promise silently rather
  // than re-flashing the label on pan/zoom.
  async configure(refName: string, opts?: BaseOptions) {
    return this.readyRefs.has(refName)
      ? this.configureOnce(refName)
      : updateStatus('Downloading index', opts?.statusCallback, () =>
          this.configureOnce(refName),
        )
  }

  public async getRefNames() {
    return Object.keys(this.locationMap())
  }

  // Index-only compressed-byte estimate (no feature download). Each refName is
  // a separate file, so regions are grouped by refName and estimated against
  // their own index — used to short-circuit an over-budget region before
  // pulling every line (see executeRenderFeatureData).
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    const byRef = new Map<string, Region[]>()
    for (const region of regions) {
      const list = byRef.get(region.refName)
      if (list) {
        list.push(region)
      } else {
        byRef.set(region.refName, [region])
      }
    }
    let total = 0
    for (const [refName, refRegions] of byRef) {
      const { vcf } = await this.configure(refName, opts)
      total += await vcf.bytesForRegions(refRegions, opts)
    }
    return total
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { vcf, parser } = await this.configure(query.refName, opts)
      await streamVcfFeatures(
        { vcf, parser, idPrefix: this.id },
        query,
        opts,
        observer,
      )
    }, opts.stopToken)
  }

  public async getExportData(
    regions: NoAssemblyRegion[],
    formatType: string,
    opts?: BaseOptions,
  ): Promise<string | undefined> {
    if (formatType !== 'vcf') {
      return undefined
    }

    const exportLines: string[] = []
    let headerWritten = false
    for (const region of regions) {
      const { vcf } = await this.configure(region.refName, opts)
      if (!headerWritten) {
        exportLines.push(...(await vcf.getHeader()).split('\n').filter(Boolean))
        headerWritten = true
      }
      await updateStatus('Exporting variants', opts?.statusCallback, () =>
        vcf.getLines(region.refName, region.start, region.end, {
          lineCallback: (line: string) => {
            exportLines.push(line)
          },
          ...opts,
        }),
      )
    }

    return exportLines.join('\n')
  }

  // The sample list is the VCF header's, and every file in the map shares it, so
  // any one of them answers. Unlike getFeatures this is not reached through
  // getRefNames — the multi-sample displays call it once per adapter — so an
  // empty map arrives here first, and `configure(undefined!)` turned that into
  // the same anonymous `undefined.uri` TypeError.
  //
  // See VcfTabixAdapter: `getSources` is the base-class contract, this is the
  // one that keeps the samples-metadata warnings.
  async getSourcesAndWarnings() {
    const [refName] = Object.keys(this.locationMap())
    if (refName === undefined) {
      throw new Error('SplitVcfTabixAdapter has an empty vcfGzLocationMap')
    }
    const { parser } = await this.configure(refName)
    return getVcfSources(
      this.getConf('samplesTsvLocation'),
      parser,
      this.pluginManager,
    )
  }

  async getSources() {
    return (await this.getSourcesAndWarnings()).sources
  }
}
