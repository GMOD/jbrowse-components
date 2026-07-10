import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { panSNContig, panSNSample } from '../pansn.ts'
import {
  assemblyByPanSNPrefix,
  makeIndexedSyntenyFeature,
  parsePifLine,
  resolveCoarseTier,
  resolvePanSNPrefix,
} from '../util.ts'

import type { AllVsAllIndexedPAFAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation, Region } from '@jbrowse/core/util/types'

export default class AllVsAllIndexedPAFAdapter extends BaseFeatureDataAdapter<AllVsAllIndexedPAFAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected pif: TabixIndexedFile
  private refSeqNamesP?: Promise<string[]>

  public constructor(
    config: AllVsAllIndexedPAFAdapterConfig,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pifGzLoc = this.getConf('pifGzLocation') as FileLocation
    const type = this.getConf(['index', 'indexType'])
    const loc = this.getConf(['index', 'location'])
    const pm = this.pluginManager

    this.pif = new TabixIndexedFile({
      filehandle: openLocation(pifGzLoc, pm),
      ...openTabixIndexFilehandle(loc, type, pm),
      chunkCacheSize: 50 * 2 ** 20,
    })
  }

  public async hasDataForRefName() {
    return true
  }

  // The tabix contig list, read once. Every seqid is a PanSN name prefixed with
  // its tier letter (fine t/q, coarse T/Q); both the stripped-and-deduped seqid
  // set and the coarse-tier probe derive from this one fetch.
  private async refSeqNames(opts?: BaseOptions) {
    this.refSeqNamesP ??= this.pif
      .getReferenceSequenceNames(opts)
      .catch((e: unknown) => {
        this.refSeqNamesP = undefined
        throw e
      })
    return this.refSeqNamesP
  }

  // The distinct PanSN seqids, tier letter (t/q/T/Q) stripped and deduped across
  // tiers.
  private async pansnSeqNames(opts?: BaseOptions) {
    return [...new Set((await this.refSeqNames(opts)).map(n => n.slice(1)))]
  }

  private async hasCoarseTier(opts?: BaseOptions) {
    return (await this.refSeqNames(opts)).some(
      n => n.startsWith('T') || n.startsWith('Q'),
    )
  }

  async getRefNames(opts: BaseOptions = {}) {
    const { assemblyName } = opts
    // Report every anchor-side contig present in the file. Unlike the in-memory
    // adapter this does not pre-cull contigs whose only mate is the same sample
    // (that needs a range scan); hasDataForRefName stays true and getFeatures
    // filters, so over-reporting a ref is harmless.
    if (assemblyName === undefined) {
      return []
    }
    const anchorPrefix = resolvePanSNPrefix(this, assemblyName)
    const set = new Set<string>()
    for (const seq of await this.pansnSeqNames(opts)) {
      if (panSNSample(seq) === anchorPrefix) {
        set.add(panSNContig(seq))
      }
    }
    return [...set]
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    const { statusCallback = () => {} } = opts
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName: qref, assemblyName } = query
      const { targetAssemblyName } = opts
      const asmByPrefix = assemblyByPanSNPrefix(this)
      const anchorPrefix = resolvePanSNPrefix(this, assemblyName)
      const targetPrefix = resolvePanSNPrefix(this, targetAssemblyName)

      const coarse = resolveCoarseTier({
        bpPerPx: opts.bpPerPx,
        threshold: this.getConf('coarseBpPerPxThreshold'),
        hasCoarseTier: await this.hasCoarseTier(opts),
        lodMode: opts.lodMode,
      })
      // The anchor is the PAF query side of some records and the target side of
      // others, so both perspectives (letters) of the chosen tier must be
      // queried and unioned.
      const letters = coarse ? ['Q', 'T'] : ['q', 't']

      // Resolve the anchor (assembly, refName) to its PanSN seqid(s); one contig
      // can map to several when the sample is multi-haplotype.
      const seqs = (await this.pansnSeqNames(opts)).filter(
        seq => panSNSample(seq) === anchorPrefix && panSNContig(seq) === qref,
      )

      const label = 'Downloading features'
      await updateStatus(label, statusCallback, () =>
        Promise.all(
          seqs.flatMap(seq =>
            letters.map(letter =>
              this.pif.getLines(letter + seq, start, end, {
                lineCallback: (line, fileOffset) => {
                  // The mate (columns 6/8/9) is a full PanSN name, no tier
                  // letter; split it into sample + contig.
                  const parsed = parsePifLine(line)
                  const matePrefix = panSNSample(parsed.mateName)
                  const mateRefName = panSNContig(parsed.mateName)

                  // One-vs-all draws every mate, including same-sample paralogy:
                  // make-pif's double-emit already keys each locus on its own
                  // contig, so viewing chr1 returns the chr1-anchored row and
                  // viewing chr2 the chr2-anchored row (distinct fileOffsets =
                  // distinct ids). A synteny band narrows to its pair via
                  // targetAssemblyName, which also drops paralogy. A degenerate
                  // self-diagonal (the SAME sample's locus aligned to itself) is
                  // skipped — the sample check matters: two different samples
                  // sharing a contig name (both `chr1`) can align at identical
                  // coords in a conserved region, which is a real cross-sample
                  // block, not a self-diagonal. Mirrors AllVsAllPAFAdapter.
                  const drawsHere =
                    (targetPrefix === undefined ||
                      matePrefix === targetPrefix) &&
                    !(
                      matePrefix === anchorPrefix &&
                      mateRefName === qref &&
                      parsed.mateStart === parsed.indexedStart &&
                      parsed.mateEnd === parsed.indexedEnd
                    )

                  if (drawsHere) {
                    observer.next(
                      makeIndexedSyntenyFeature({
                        line: parsed,
                        fileOffset,
                        assemblyName,
                        refName: qref,
                        mate: {
                          start: parsed.mateStart,
                          end: parsed.mateEnd,
                          refName: mateRefName,
                          assemblyName: asmByPrefix[matePrefix] ?? matePrefix,
                        },
                      }),
                    )
                  }
                },
              }),
            ),
          ),
        ),
      )

      observer.complete()
    })
  }
}
