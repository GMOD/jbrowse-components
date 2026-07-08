import { TabixIndexedFile } from '@gmod/tabix'
import { csToCigar } from '@jbrowse/cigar-utils'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import SyntenyFeature from '../SyntenyFeature/index.ts'
import { panSNContig, panSNSample } from '../pansn.ts'
import {
  assemblyByPanSNPrefix,
  pafIdentity,
  parsePAFLine,
  resolvePanSNPrefix,
} from '../util.ts'

import type { AllVsAllIndexedPAFAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation, Region } from '@jbrowse/core/util/types'

// The coarse (uppercase T/Q) tier is a no-CIGAR summary used when zoomed out; the
// fine (lowercase t/q) tier carries per-row CIGARs. A file only has the coarse
// tier if make-pif emitted it. A manual 'coarse' override still falls back to
// fine when the tier is absent — the alternative would be returning no data.
function resolveCoarseTier({
  bpPerPx,
  threshold,
  hasCoarseTier,
  lodMode = 'auto',
}: {
  bpPerPx: number | undefined
  threshold: number
  hasCoarseTier: boolean
  lodMode?: BaseOptions['lodMode']
}) {
  const zoomedOut = bpPerPx !== undefined && bpPerPx >= threshold
  return (
    hasCoarseTier && (lodMode === 'coarse' || (lodMode === 'auto' && zoomedOut))
  )
}

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

      const label = `Downloading ${coarse ? 'coarse' : 'fine'} features`
      await updateStatus(label, statusCallback, () =>
        Promise.all(
          seqs.flatMap(seq =>
            letters.map(letter =>
              this.pif.getLines(letter + seq, start, end, {
                lineCallback: (line, fileOffset) => {
                  // PIF pre-orients each row: columns 1-4 (qname/qstart/qend) are
                  // the anchor (col 1 carries the tier letter + PanSN name),
                  // columns 6/8/9 (tname/tstart/tend) are the mate (full PanSN,
                  // no letter). CIGARs are pre-swapped per perspective.
                  const r = parsePAFLine(line)
                  const matePrefix = panSNSample(r.tname)
                  const mateRefName = panSNContig(r.tname)

                  // One-vs-all draws every mate, including same-sample paralogy:
                  // make-pif's double-emit already keys each locus on its own
                  // contig, so viewing chr1 returns the chr1-anchored row and
                  // viewing chr2 the chr2-anchored row (distinct fileOffsets =
                  // distinct ids). A synteny band narrows to its pair via
                  // targetAssemblyName, which also drops paralogy. A degenerate
                  // self-diagonal (identical locus on both sides) is skipped.
                  const drawsHere =
                    (targetPrefix === undefined ||
                      matePrefix === targetPrefix) &&
                    !(
                      mateRefName === qref &&
                      r.tstart === r.qstart &&
                      r.tend === r.qend
                    )

                  if (drawsHere) {
                    const { extra, strand } = r
                    const {
                      numMatches = 0,
                      blockLen = 1,
                      cg,
                      cs,
                      ...rest
                    } = extra
                    const CIGAR =
                      cg ?? (typeof cs === 'string' ? csToCigar(cs) : undefined)
                    observer.next(
                      new SyntenyFeature({
                        uniqueId: fileOffset + assemblyName,
                        assemblyName,
                        start: r.qstart,
                        end: r.qend,
                        type: 'match',
                        refName: qref,
                        strand,
                        ...rest,
                        CIGAR,
                        cs: typeof cs === 'string' ? cs : undefined,
                        syntenyId: fileOffset,
                        identity: pafIdentity(extra),
                        numMatches,
                        blockLen,
                        mate: {
                          start: r.tstart,
                          end: r.tend,
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
