import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { createStatusFanOut } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { panSNContig, panSNMatchesPrefix, panSNPrefixes } from '../pansn.ts'
import {
  assemblyByPanSNPrefix,
  assemblyForPanSNName,
  hasCoarseTierPrefix,
  makeIndexedSyntenyFeature,
  readPifLines,
  resolveCoarseTier,
  resolvePanSNPrefix,
} from '../util.ts'

import type { PifLine } from '../util.ts'

import type { AllVsAllIndexedPAFAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// One-vs-all draws every mate, including same-sample paralogy: make-pif's
// double-emit already keys each locus on its own contig, so viewing chr1
// returns the chr1-anchored row and viewing chr2 the chr2-anchored row
// (distinct fileOffsets = distinct ids). A synteny band narrows to its pair via
// targetAssemblyName, which also drops paralogy. A degenerate self-diagonal
// (the SAME sequence aligned to itself at the same coords) is skipped — tested
// on the full PanSN names, since `grape#1#chr1` vs `grape#2#chr1` shares sample
// and stripped contig yet is a real hap1-vs-hap2 alignment, and two samples
// sharing a contig name (both `chr1`) can align at identical coords in a
// conserved region. Mirrors AllVsAllPAFAdapter.
function drawsHere(line: PifLine, targetPrefix: string | undefined) {
  const selfDiagonal =
    line.indexedName.slice(1) === line.mateName &&
    line.mateStart === line.indexedStart &&
    line.mateEnd === line.indexedEnd
  return (
    !selfDiagonal &&
    (targetPrefix === undefined ||
      panSNMatchesPrefix(line.mateName, targetPrefix))
  )
}

export default class AllVsAllIndexedPAFAdapter extends BaseFeatureDataAdapter<AllVsAllIndexedPAFAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected pif: TabixIndexedFile
  private refSeqNamesP?: Promise<string[]>
  private seqIndexP?: Promise<Map<string, Map<string, string[]>>>

  public constructor(
    config: AllVsAllIndexedPAFAdapterConfig,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pifGzLoc = this.getConf('pifGzLocation')
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

  // The distinct PanSN seqids (tier letter t/q/T/Q stripped, deduped across
  // tiers) grouped prefix -> contig -> seqids. Every seqid is filed under each
  // prefix it is addressable by (`grape` and `grape#1`), so a sample-level
  // assembly resolves to both haplotypes' seqids while a haplotype-resolved
  // pangenome — each haplotype loaded as its own assembly via
  // assemblyNameToPanSN — resolves to just its own. One contig therefore maps to
  // several seqids under a sample prefix and one under a haplotype prefix. Built
  // once rather than per query: a whole-genome pangenome has tens of thousands
  // of seqids, and getRefNames and every getFeatures call — one per band, per
  // region, per pan/zoom — would otherwise re-split and re-scan the entire
  // contig list.
  private async seqIndex(opts?: BaseOptions) {
    this.seqIndexP ??= this.refSeqNames(opts)
      .then(names => {
        const index = new Map<string, Map<string, string[]>>()
        for (const seq of new Set(names.map(n => n.slice(1)))) {
          const contig = panSNContig(seq)
          for (const prefix of panSNPrefixes(seq)) {
            let byContig = index.get(prefix)
            if (!byContig) {
              byContig = new Map()
              index.set(prefix, byContig)
            }
            const seqs = byContig.get(contig)
            if (seqs) {
              seqs.push(seq)
            } else {
              byContig.set(contig, [seq])
            }
          }
        }
        return index
      })
      .catch((e: unknown) => {
        this.seqIndexP = undefined
        throw e
      })
    return this.seqIndexP
  }

  private async hasCoarseTier(opts?: BaseOptions) {
    return hasCoarseTierPrefix(await this.refSeqNames(opts))
  }

  async getRefNames(opts: BaseOptions = {}) {
    // Report every anchor-side contig present in the file. Unlike the in-memory
    // adapter this does not pre-cull contigs whose only mate is the same sample
    // (that needs a range scan); hasDataForRefName stays true and getFeatures
    // filters, so over-reporting a ref is harmless.
    const anchorPrefix = resolvePanSNPrefix(this, opts.assemblyName)
    const byContig =
      anchorPrefix === undefined
        ? undefined
        : (await this.seqIndex(opts)).get(anchorPrefix)
    return byContig === undefined ? [] : [...byContig.keys()]
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    const { statusCallback = () => {}, stopToken } = opts
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
      const seqs =
        (await this.seqIndex(opts)).get(anchorPrefix)?.get(qref) ?? []

      // One slot per concurrent getLines: they run under one Promise.all and
      // would otherwise take turns overwriting the single status field, so the
      // bar would jump between seqids and blank as soon as the first finished.
      // Aggregated, a multi-haplotype anchor reads as one Σbytes bar.
      const slot = createStatusFanOut(statusCallback)
      const stopTokenCheck = createStopTokenChecker(stopToken)
      await Promise.all(
        seqs.flatMap(seq =>
          letters.map(letter =>
            readPifLines({
              pif: this.pif,
              seqid: letter + seq,
              start,
              end,
              statusCallback: slot(),
              stopTokenCheck,
              lineCallback: (parsed, fileOffset) => {
                if (drawsHere(parsed, targetPrefix)) {
                  observer.next(
                    makeIndexedSyntenyFeature({
                      line: parsed,
                      fileOffset,
                      assemblyName,
                      refName: qref,
                      mate: {
                        // The mate (columns 6/8/9) is a full PanSN name, no
                        // tier letter; split it into sample + contig.
                        start: parsed.mateStart,
                        end: parsed.mateEnd,
                        refName: panSNContig(parsed.mateName),
                        assemblyName: assemblyForPanSNName(
                          asmByPrefix,
                          parsed.mateName,
                        ),
                      },
                    }),
                  )
                }
              },
            }),
          ),
        ),
      )

      observer.complete()
    })
  }
}
