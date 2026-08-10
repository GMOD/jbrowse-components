import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { createStatusFanOut } from '@jbrowse/core/util'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { panSNContig, panSNPrefixes } from '../pansn.ts'
import {
  assemblyByPanSNPrefix,
  assemblyForPanSNName,
  hasCoarseTierPrefix,
  makeIndexedSyntenyFeature,
  markReciprocalDuplicates,
  noPanSNMatchError,
  panSNInventory,
  readPifLines,
  resolveCoarseTier,
  resolvePanSNPrefix,
  sideDraws,
} from '../util.ts'

import type { AlignedSide, PifLine } from '../util.ts'
import type { AllVsAllIndexedPAFAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// A PIF row read as one all-vs-all side. make-pif already oriented the row to
// the perspective it is indexed under, so this is a rename rather than a
// reorientation — but it is what lets the shared `sideDraws` /
// `markReciprocalDuplicates` predicates see the same shape the in-memory adapter
// builds with orientPafRecord.
function pifSide(line: PifLine): AlignedSide {
  return {
    refName: line.indexedRefName,
    start: line.indexedStart,
    end: line.indexedEnd,
    mateRefName: line.mateName,
    mateStart: line.mateStart,
    mateEnd: line.mateEnd,
    strand: line.strand,
  }
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
      chunkCacheBudget: decompressedBytesBudget,
    })
  }

  public async hasDataForRefName() {
    return true
  }

  // Config-derived and therefore fixed for this adapter: an edit produces a new
  // snapshot, hence a new cache key and a new adapter (see dataAdapterCache).
  // Read once instead of per getFeatures — that is per band, per region, per
  // pan/zoom, and assemblyByPanSNPrefix builds a fresh map each time.
  private asmByPrefixCache?: Record<string, string>

  private asmByPrefix() {
    this.asmByPrefixCache ??= assemblyByPanSNPrefix(this)
    return this.asmByPrefixCache
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
      const asmByPrefix = this.asmByPrefix()
      const anchorPrefix = resolvePanSNPrefix(this, assemblyName)
      const targetPrefix = resolvePanSNPrefix(this, opts.targetAssemblyName)

      const coarse = resolveCoarseTier({
        hasCoarseTier: await this.hasCoarseTier(opts),
        lodMode: opts.lodMode,
      })
      // The anchor is the PAF query side of some records and the target side of
      // others, so both perspectives (letters) of the chosen tier must be
      // queried and unioned.
      const letters = coarse ? ['Q', 'T'] : ['q', 't']

      // Resolve the anchor (assembly, refName) to its PanSN seqid(s); one contig
      // can map to several when the sample is multi-haplotype.
      const seqIndex = await this.seqIndex(opts)
      const byContig = seqIndex.get(anchorPrefix)
      // A prefix present but holding no such contig is ordinary — a contig with
      // no alignments. A prefix the file has never heard of is a misconfigured
      // track that would otherwise draw nothing and say nothing; see
      // noPanSNMatchError. The target is checked too, so a band naming a
      // mistyped assembly says which end is wrong instead of drawing empty.
      //
      // Unlike the in-memory adapter this cannot go on to say "both ends are
      // present but nothing aligns them" (see noSuchPairError): that is a fact
      // about the rows, and the seqid list is all this has without a scan. The
      // make-pif warning covers the same ground at build time.
      for (const [name, prefix] of [
        [assemblyName, anchorPrefix],
        [opts.targetAssemblyName, targetPrefix],
      ] as const) {
        if (
          name !== undefined &&
          prefix !== undefined &&
          !seqIndex.has(prefix)
        ) {
          throw noPanSNMatchError({
            assemblyName: name,
            prefix,
            inventory: panSNInventory(
              // the tier letter (t/q/T/Q) is not part of the name
              (await this.refSeqNames(opts)).map(n => n.slice(1)),
            ),
          })
        }
      }
      if (byContig === undefined) {
        throw noPanSNMatchError({
          assemblyName,
          prefix: anchorPrefix,
          inventory: panSNInventory(
            (await this.refSeqNames(opts)).map(name => name.slice(1)),
          ),
        })
      }
      const seqs = byContig.get(qref) ?? []

      // One slot per concurrent getLines: they run under one Promise.all and
      // would otherwise take turns overwriting the single status field, so the
      // bar would jump between seqids and blank as soon as the first finished.
      // Aggregated, a multi-haplotype anchor reads as one Σbytes bar.
      const slot = createStatusFanOut(statusCallback)
      const stopTokenCheck = createStopTokenChecker(stopToken)
      // Collected rather than emitted from the read callbacks so the whole
      // result can be deduped in one pass, and so emission order is the file's
      // rather than the network's: the reads are a Promise.all over every
      // (seqid, letter) and which lands first varies run to run. fileOffset is a
      // virtual offset into the one file, so it totally orders the rows on its
      // own — the perspective letter is not part of the sort.
      const rows: { fileOffset: number; line: PifLine; side: AlignedSide }[] =
        []
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
                // One-vs-all draws every mate, including same-sample paralogy:
                // make-pif's double-emit already keys each locus on its own
                // contig, so viewing chr1 returns the chr1-anchored row and
                // viewing chr2 the chr2-anchored row (distinct fileOffsets =
                // distinct ids).
                const side = pifSide(parsed)
                if (sideDraws(side, anchorPrefix, targetPrefix)) {
                  rows.push({ fileOffset, line: parsed, side })
                }
              },
            }),
          ),
        ),
      )
      rows.sort((a, b) => a.fileOffset - b.fileOffset)

      const duplicate = markReciprocalDuplicates(rows.map(r => r.side))
      for (const [i, { fileOffset, line }] of rows.entries()) {
        if (!duplicate[i]) {
          observer.next(
            makeIndexedSyntenyFeature({
              line,
              fileOffset,
              assemblyName,
              refName: qref,
              mate: {
                // The mate (columns 6/8/9) is a full PanSN name, no tier
                // letter; split it into sample + contig.
                start: line.mateStart,
                end: line.mateEnd,
                refName: panSNContig(line.mateName),
                assemblyName: assemblyForPanSNName(asmByPrefix, line.mateName),
              },
            }),
          )
        }
      }

      observer.complete()
    })
  }
}
