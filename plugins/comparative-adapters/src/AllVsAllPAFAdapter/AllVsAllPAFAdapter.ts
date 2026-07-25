import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { createSharedSetup } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { parsePafBuffer } from '../PAFAdapter/PAFAdapter.ts'
import {
  loadPafRecords,
  makeSyntenyFeature,
  orientPafRecord,
} from '../PAFAdapter/util.ts'
import { panSNContig, panSNMatchesPrefix } from '../pansn.ts'
import {
  assemblyByPanSNPrefix,
  assemblyForPanSNName,
  resolvePanSNPrefix,
} from '../util.ts'

import type { AllVsAllPAFAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// One side of one PAF record: the locus it draws at. `flip` mirrors PAFAdapter
// (true = the PAF query/qname side is the feature), and `index` is the record's
// position in the parsed array, which the feature id is derived from.
interface RecordSide {
  index: number
  flip: boolean
}

export default class AllVsAllPAFAdapter extends BaseFeatureDataAdapter<AllVsAllPAFAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames']

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures so is not
    // really that important, and has to be true or else getFeatures is never
    // called (BaseAdapter filters it out)
    return true
  }

  setup = createSharedSetup((opts: BaseOptions) => this.setupPre(opts))

  async setupPre(opts?: BaseOptions) {
    const records = await loadPafRecords({
      file: openLocation(this.getConf('pafLocation'), this.pluginManager),
      parse: parsePafBuffer,
      opts,
    })
    opts?.statusCallback?.('Indexing alignments by contig')

    // Each record is filed under the stripped contig of both of its sides, so a
    // region query walks only the records touching that contig instead of the
    // whole file. Keyed on the contig rather than sample+contig because the
    // anchor prefix is a per-query input (and may name a sample or a single
    // haplotype), while the contig is what the query's refName is matched
    // against either way. Built once: N bands x every pan/zoom otherwise rescans
    // every record in the file.
    const sidesByContig = new Map<string, RecordSide[]>()
    for (const [index, r] of records.entries()) {
      for (const flip of [true, false]) {
        const contig = panSNContig(flip ? r.qname : r.tname)
        const sides = sidesByContig.get(contig)
        if (sides) {
          sides.push({ index, flip })
        } else {
          sidesByContig.set(contig, [{ index, flip }])
        }
      }
    }
    return { records, sidesByContig }
  }

  async getRefNames(opts: BaseOptions = {}) {
    const { assemblyName, targetAssemblyName } = opts
    const { records } = await this.setup(opts)
    const anchorPrefix = resolvePanSNPrefix(this, assemblyName)
    const targetPrefix = resolvePanSNPrefix(this, targetAssemblyName)
    const set = new Set<string>()
    // Mirror the getFeatures gate: report the anchor-side contig of every side
    // that draws. One-vs-all (no target) reports every anchor contig, including
    // those whose only mate is the same sample (paralogy). A supplied
    // targetAssemblyName (two-row synteny band) narrows to that single pair,
    // which also drops paralogy contigs (mate = same sample, not the target).
    for (const r of records) {
      for (const flip of [true, false]) {
        const sideName = flip ? r.qname : r.tname
        const mateName = flip ? r.tname : r.qname
        if (
          panSNMatchesPrefix(sideName, anchorPrefix) &&
          (targetPrefix === undefined ||
            panSNMatchesPrefix(mateName, targetPrefix))
        ) {
          set.add(panSNContig(sideName))
        }
      }
    }
    return [...set]
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { records, sidesByContig } = await this.setup(opts)
      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      const { targetAssemblyName } = opts
      const asmByPrefix = assemblyByPanSNPrefix(this)
      const anchorPrefix = resolvePanSNPrefix(this, assemblyName)
      const targetPrefix = resolvePanSNPrefix(this, targetAssemblyName)

      // Only the sides filed under the queried contig can satisfy the
      // `refName === qref` test, so the rest of the file is skipped outright.
      // A cross-sample record has exactly one anchor side, so it emits once. A
      // same-sample (paralogy) record — e.g. a segmental duplication — has BOTH
      // sides on the anchor, so it draws at each of its two loci with a distinct
      // id (index*2 + side). One-vs-all (no targetAssemblyName) draws every
      // mate, listed or not (labelled by assembly if listed, else its bare PanSN
      // prefix); a two-row synteny band narrows to its pair, which also excludes
      // paralogy since the mate is the same sample, not the other band.
      for (const { index, flip } of sidesByContig.get(qref) ?? []) {
        const r = records[index]!
        const {
          refName: sideName,
          start,
          end,
          mateRefName: mateName,
          mateStart,
          mateEnd,
        } = orientPafRecord(r, flip)

        // A degenerate self-diagonal is the SAME sequence aligned to itself at
        // the same coords (minimap2 without -X emits one per sequence); drop it
        // from both sides. The test is on the full PanSN names, not
        // sample+stripped-contig: `grape#1#chr1` vs `grape#2#chr1` shares both
        // of those yet is a real hap1-vs-hap2 alignment, and two samples that
        // share a contig name (both `chr1`) can align at identical coords in a
        // conserved region.
        const selfDiagonal =
          r.qname === r.tname && r.qstart === r.tstart && r.qend === r.tend

        const drawsHere =
          !selfDiagonal &&
          panSNMatchesPrefix(sideName, anchorPrefix) &&
          (targetPrefix === undefined ||
            panSNMatchesPrefix(mateName, targetPrefix))

        if (drawsHere && doesIntersect2(qstart, qend, start, end)) {
          const { extra, strand } = r
          observer.next(
            makeSyntenyFeature({
              syntenyId: index * 2 + (flip ? 0 : 1),
              assemblyName,
              refName: qref,
              start,
              end,
              strand,
              extra,
              flip,
              mate: {
                start: mateStart,
                end: mateEnd,
                refName: panSNContig(mateName),
                assemblyName: assemblyForPanSNName(asmByPrefix, mateName),
              },
            }),
          )
        }
      }

      observer.complete()
    })
  }
}
