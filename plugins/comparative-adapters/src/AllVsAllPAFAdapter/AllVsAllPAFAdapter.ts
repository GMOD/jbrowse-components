import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { ComparativeAdapterBase } from '../ComparativeAdapterBase.ts'
import {
  loadPafRecords,
  makeSyntenyFeature,
  orientPafRecord,
  parsePafBuffer,
} from '../PAFAdapter/util.ts'
import { panSNContig, panSNPrefixes } from '../pansn.ts'
import {
  assemblyByPanSNPrefix,
  assemblyForPanSNName,
  getOrCreate,
  isSelfDiagonal,
  markReciprocalDuplicates,
  noSuchPairError,
  panSNInventory,
  resolveAllVsAllQuery,
  resolvePanSNPrefix,
  sideDraws,
} from '../util.ts'

import type { AlignedSide } from '../util.ts'
import type { AllVsAllPAFAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

/**
 * One side of one PAF record, resolved to the locus it draws at and kept that
 * way. A region query reads these fields directly rather than re-running
 * {@link orientPafRecord} on every candidate it walks.
 */
interface IndexedSide extends AlignedSide {
  // position of the record in the parsed array, for the tags/strand the feature
  // carries — the bulk of a record (its CIGAR) is not copied in here
  record: number
  // mirrors PAFAdapter: true = the PAF query/qname side is the feature. Decides
  // how the CIGAR is oriented at emit time.
  flip: boolean
  // stable across this file, and what the feature's id is derived from
  syntenyId: number
}

export default class AllVsAllPAFAdapter extends ComparativeAdapterBase<AllVsAllPAFAdapterConfig> {
  setup = cachedSetup({ setup: (opts: BaseOptions) => this.setupPre(opts) })

  /**
   * Everything that does not depend on the query, done once per file load and
   * memoized by {@link cachedSetup}: the oriented sides, the reciprocal-pair
   * decision, and the per-(prefix, contig) index a region query walks.
   *
   * All three used to be per-query work. The index was keyed on the bare contig,
   * so a query for `chr1` in a 100-genome pangenome walked every sample's `chr1`
   * and threw 99% of it away in `sideDraws`; and the dedupe re-derived — per
   * region, per band, per pan/zoom — an answer that is a property of the file.
   * What is left at query time is a bounded walk of one bucket.
   */
  async setupPre(opts?: BaseOptions) {
    const records = await loadPafRecords({
      file: openLocation(this.getConf('pafLocation'), this.pluginManager),
      parse: parsePafBuffer,
      opts,
    })
    opts?.statusCallback?.('Indexing alignments by contig')

    // Both sides of every record, oriented. Self-diagonals (minimap2 without
    // `-X` emits one per sequence) drop out here rather than at read time: the
    // test is on coordinates alone, so no query can change the answer.
    const sides: IndexedSide[] = []
    // collected on the same pass, so a query whose assembly matches no sample in
    // the file can say what the file does hold — see noPanSNMatchError
    const seqNames = new Set<string>()
    for (const [record, r] of records.entries()) {
      for (const flip of [true, false]) {
        seqNames.add(flip ? r.qname : r.tname)
        const side = orientPafRecord(r, flip)
        if (!isSelfDiagonal(side)) {
          sides.push({
            ...side,
            record,
            flip,
            syntenyId: record * 2 + (flip ? 0 : 1),
          })
        }
      }
    }

    const duplicate = markReciprocalDuplicates(sides)
    const kept = sides.filter((_, i) => !duplicate[i])

    // prefix -> contig -> positions in `kept`. Filed under every prefix a side's
    // PanSN name is addressable by (`grape` and `grape#1`), so a sample-level
    // assembly and a haplotype-resolved one — each haplotype loaded as its own
    // assembly via assemblyNameToPanSN — both resolve without the lookup knowing
    // which depth the config named. Keyed on the anchor's own name, since that is
    // what a query's (assembly, refName) resolves to.
    const index = new Map<string, Map<string, number[]>>()
    // Which anchor prefixes the file states an alignment TO, at every depth
    // either side is addressable by. A synteny band asks exactly this question
    // and the answer is a property of the file, so it is answered here rather
    // than by discovering at draw time that a band came back empty.
    const matesByPrefix = new Map<string, Set<string>>()
    for (const [i, side] of kept.entries()) {
      const contig = panSNContig(side.refName)
      const matePrefixes = panSNPrefixes(side.mateRefName)
      for (const prefix of panSNPrefixes(side.refName)) {
        const byContig = getOrCreate(index, prefix, () => new Map())
        getOrCreate(byContig, contig, () => []).push(i)
        const mates = getOrCreate(matesByPrefix, prefix, () => new Set())
        for (const matePrefix of matePrefixes) {
          mates.add(matePrefix)
        }
      }
    }

    return {
      records,
      sides: kept,
      index,
      matesByPrefix,
      panSN: panSNInventory(seqNames),
    }
  }

  // Exactly the contigs `getFeatures` can emit for: the same `sideDraws` gate
  // over the same index, so a contig is reported iff some side filed under it
  // draws. Answering it from the index rather than a fresh scan also lets each
  // contig stop at its first drawing side.
  async getRefNames(opts: BaseOptions = {}) {
    const { sides, index } = await this.setup(opts)
    const anchorPrefix = resolvePanSNPrefix(this, opts.assemblyName)
    const targetPrefix = resolvePanSNPrefix(this, opts.targetAssemblyName)
    const byContig =
      anchorPrefix === undefined ? undefined : index.get(anchorPrefix)
    return [...(byContig ?? [])]
      .filter(([, bucket]) =>
        bucket.some(i => sideDraws(sides[i]!, anchorPrefix, targetPrefix)),
      )
      .map(([contig]) => contig)
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { records, sides, index, matesByPrefix, panSN } =
        await this.setup(opts)
      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      const { targetAssemblyName } = opts
      const asmByPrefix = assemblyByPanSNPrefix(this)

      // Tested against the inventory rather than the index, because a prefix
      // whose every alignment was a self-diagonal IS in the file and legitimately
      // draws nothing.
      const { anchorPrefix, targetPrefix } = await resolveAllVsAllQuery({
        adapter: this,
        assemblyName,
        targetAssemblyName,
        has: prefix => panSN.prefixes.has(prefix),
        inventory: () => panSN,
      })
      // Both ends are in the file but nothing aligns them: an incomplete
      // all-vs-all rather than a misconfigured track, so it names its own remedy.
      // Answered off the whole file, not this window — a window with no
      // alignments is ordinary and must stay silent.
      if (
        targetAssemblyName !== undefined &&
        targetPrefix !== undefined &&
        !matesByPrefix.get(anchorPrefix)?.has(targetPrefix)
      ) {
        throw noSuchPairError({ assemblyName, targetAssemblyName })
      }

      // Only the anchor's own sides on the queried contig can satisfy the query,
      // so the rest of the file is never touched. A cross-sample record has
      // exactly one anchor side, so it emits once. A same-sample (paralogy)
      // record — e.g. a segmental duplication — has BOTH sides on the anchor, so
      // it draws at each of its two loci with a distinct id.
      for (const i of index.get(anchorPrefix)?.get(qref) ?? []) {
        const side = sides[i]!
        const { start, end, mateRefName, mateStart, mateEnd } = side

        if (
          sideDraws(side, anchorPrefix, targetPrefix) &&
          doesIntersect2(qstart, qend, start, end)
        ) {
          const { extra, strand } = records[side.record]!
          observer.next(
            makeSyntenyFeature({
              syntenyId: side.syntenyId,
              assemblyName,
              refName: qref,
              start,
              end,
              strand,
              extra,
              flip: side.flip,
              mate: {
                start: mateStart,
                end: mateEnd,
                refName: panSNContig(mateRefName),
                assemblyName: assemblyForPanSNName(asmByPrefix, mateRefName),
              },
            }),
          )
        }
      }

      observer.complete()
    })
  }
}
