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
import { panSNContig } from '../pansn.ts'
import {
  assemblyByPanSNPrefix,
  createReciprocalDedupe,
  assemblyForPanSNName,
  noPanSNMatchError,
  panSNInventory,
  resolvePanSNPrefix,
  sideDraws,
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
    // collected on the same pass, so a query whose assembly matches no sample in
    // the file can say what the file does hold — see noPanSNMatchError
    const seqNames = new Set<string>()
    for (const [index, r] of records.entries()) {
      for (const flip of [true, false]) {
        const name = flip ? r.qname : r.tname
        seqNames.add(name)
        const contig = panSNContig(name)
        const sides = sidesByContig.get(contig)
        if (sides) {
          sides.push({ index, flip })
        } else {
          sidesByContig.set(contig, [{ index, flip }])
        }
      }
    }
    return { records, sidesByContig, panSN: panSNInventory(seqNames) }
  }

  // Exactly the contigs `getFeatures` can emit for: the same `sideDraws` gate
  // over the same per-contig index, so a contig is reported iff some side filed
  // under it draws. Answering it from the index rather than a fresh scan also
  // lets each contig stop at its first drawing side.
  async getRefNames(opts: BaseOptions = {}) {
    const { records, sidesByContig } = await this.setup(opts)
    const anchorPrefix = resolvePanSNPrefix(this, opts.assemblyName)
    const targetPrefix = resolvePanSNPrefix(this, opts.targetAssemblyName)
    return [...sidesByContig]
      .filter(([, sides]) =>
        sides.some(({ index, flip }) =>
          sideDraws(
            orientPafRecord(records[index]!, flip),
            anchorPrefix,
            targetPrefix,
          ),
        ),
      )
      .map(([contig]) => contig)
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { records, sidesByContig, panSN } = await this.setup(opts)
      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      const { targetAssemblyName } = opts
      const asmByPrefix = assemblyByPanSNPrefix(this)
      const anchorPrefix = resolvePanSNPrefix(this, assemblyName)
      const targetPrefix = resolvePanSNPrefix(this, targetAssemblyName)

      // An assembly the file has never heard of is a misconfigured track that
      // would otherwise draw nothing and say nothing; see noPanSNMatchError.
      if (!panSN.prefixes.has(anchorPrefix)) {
        throw noPanSNMatchError({
          assemblyName,
          prefix: anchorPrefix,
          inventory: panSN,
        })
      }

      // Only the sides filed under the queried contig can satisfy the
      // `refName === qref` test, so the rest of the file is skipped outright.
      // A cross-sample record has exactly one anchor side, so it emits once. A
      // same-sample (paralogy) record — e.g. a segmental duplication — has BOTH
      // sides on the anchor, so it draws at each of its two loci with a distinct
      // id (index*2 + side).
      // Records are walked in file order, so which of a reciprocal pair is kept
      // is a property of the file rather than of when a read landed.
      const isDuplicate = createReciprocalDedupe()
      for (const { index, flip } of sidesByContig.get(qref) ?? []) {
        const r = records[index]!
        const side = orientPafRecord(r, flip)
        const { start, end, mateRefName, mateStart, mateEnd } = side

        if (
          sideDraws(side, anchorPrefix, targetPrefix) &&
          doesIntersect2(qstart, qend, start, end) &&
          !isDuplicate(side)
        ) {
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
