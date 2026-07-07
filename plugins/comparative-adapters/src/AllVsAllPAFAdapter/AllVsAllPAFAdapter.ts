import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { getWeightedMeans, makeSyntenyFeature } from '../PAFAdapter/util.ts'
import { panSNContig, panSNSample } from '../pansn.ts'
import { parsePAFLine } from '../util.ts'

import type { AllVsAllPAFAdapterConfig } from './configSchema.ts'
import type { PAFRecord } from '../PAFAdapter/util.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

export default class AllVsAllPAFAdapter extends BaseFeatureDataAdapter<AllVsAllPAFAdapterConfig> {
  private setupP?: Promise<PAFRecord[]>

  public static capabilities = ['getFeatures', 'getRefNames']

  async setup(opts?: BaseOptions) {
    this.setupP ??= this.setupPre(opts).catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  async setupPre(opts?: BaseOptions) {
    const lines: PAFRecord[] = []
    parseLineByLine(
      await fetchAndMaybeUnzip(
        openLocation(this.getConf('pafLocation'), this.pluginManager),
        opts,
      ),
      line => {
        lines.push(parsePAFLine(line))
        return true
      },
      opts?.statusCallback,
    )
    return getWeightedMeans(lines)
  }

  getAssemblyNames() {
    return this.getConf('assemblyNames') as string[]
  }

  // JBrowse assembly name -> its PanSN sample prefix in the PAF (identity when
  // unmapped). Also drives the anchor/target prefix lookups below.
  private assemblyToPrefix() {
    return this.getConf('assemblyNameToPanSN') as Record<string, string>
  }

  // PanSN sample prefix (in the PAF) -> JBrowse assembly name, for the listed
  // assemblies. Used to give a mate a friendly assembly label; a mate whose
  // sample is not a listed assembly falls back to the bare prefix (one-vs-all
  // draws against every sample in the file, listed or not).
  private assemblyByPrefix() {
    const map = this.assemblyToPrefix()
    const out: Record<string, string> = {}
    for (const asm of this.getAssemblyNames()) {
      out[map[asm] ?? asm] = asm
    }
    return out
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures so is not
    // really that important, and has to be true or else getFeatures is never
    // called (BaseAdapter filters it out)
    return true
  }

  async getRefNames(opts: BaseOptions = {}) {
    const { assemblyName, targetAssemblyName } = opts
    const feats = await this.setup(opts)
    const map = this.assemblyToPrefix()
    const anchorPrefix =
      assemblyName === undefined
        ? undefined
        : (map[assemblyName] ?? assemblyName)
    const targetPrefix =
      targetAssemblyName === undefined
        ? undefined
        : (map[targetAssemblyName] ?? targetAssemblyName)
    const set = new Set<string>()
    // Mirror the getFeatures gate: report the anchor-side contig of every side
    // that draws. One-vs-all (no target) reports every anchor contig, including
    // those whose only mate is the same sample (paralogy). A supplied
    // targetAssemblyName (two-row synteny band) narrows to that single pair,
    // which also drops paralogy contigs (mate = same sample, not the target).
    for (const feat of feats) {
      const qPrefix = panSNSample(feat.qname)
      const tPrefix = panSNSample(feat.tname)
      for (const flip of [true, false]) {
        const sidePrefix = flip ? qPrefix : tPrefix
        const matePrefix = flip ? tPrefix : qPrefix
        if (
          sidePrefix === anchorPrefix &&
          (targetPrefix === undefined || matePrefix === targetPrefix)
        ) {
          set.add(panSNContig(flip ? feat.qname : feat.tname))
        }
      }
    }
    return [...set]
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const pafRecords = await this.setup(opts)
      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      const { targetAssemblyName } = opts
      const map = this.assemblyToPrefix()
      const asmByPrefix = this.assemblyByPrefix()
      const anchorPrefix = map[assemblyName] ?? assemblyName
      const targetPrefix =
        targetAssemblyName === undefined
          ? undefined
          : (map[targetAssemblyName] ?? targetAssemblyName)

      for (let i = 0; i < pafRecords.length; i++) {
        const r = pafRecords[i]!
        const qPrefix = panSNSample(r.qname)
        const tPrefix = panSNSample(r.tname)

        // Each side of the record where the queried assembly sits is a locus the
        // record can draw at; the other side is the mate (flip mirrors
        // PAFAdapter: true = the PAF query/qname side is the feature). A
        // cross-sample record has exactly one anchor side, so it emits once. A
        // same-sample (paralogy) record — e.g. a segmental duplication — has
        // BOTH sides on the anchor, so it draws at each of its two loci with a
        // distinct id (i*2 + side). One-vs-all (no targetAssemblyName) draws
        // every mate, listed or not (labelled by assembly if listed, else its
        // bare PanSN prefix); a two-row synteny band narrows to its pair, which
        // also excludes paralogy since the mate is the same sample, not the
        // other band.
        for (const flip of [true, false]) {
          const sidePrefix = flip ? qPrefix : tPrefix
          const matePrefix = flip ? tPrefix : qPrefix
          const start = flip ? r.qstart : r.tstart
          const end = flip ? r.qend : r.tend
          const refName = panSNContig(flip ? r.qname : r.tname)
          const mateStart = flip ? r.tstart : r.qstart
          const mateEnd = flip ? r.tend : r.qend
          const mateRefName = panSNContig(flip ? r.tname : r.qname)

          const drawsHere =
            sidePrefix === anchorPrefix &&
            (targetPrefix === undefined || matePrefix === targetPrefix) &&
            // skip a degenerate self-diagonal (identical locus on both sides);
            // real paralogy has distinct coords/contig
            !(
              mateRefName === refName &&
              mateStart === start &&
              mateEnd === end
            )

          if (
            drawsHere &&
            refName === qref &&
            doesIntersect2(qstart, qend, start, end)
          ) {
            const { extra, strand } = r
            observer.next(
              makeSyntenyFeature({
                syntenyId: i * 2 + (flip ? 0 : 1),
                assemblyName,
                refName,
                start,
                end,
                strand,
                extra,
                flip,
                mate: {
                  start: mateStart,
                  end: mateEnd,
                  refName: mateRefName,
                  assemblyName: asmByPrefix[matePrefix] ?? matePrefix,
                },
              }),
            )
          }
        }
      }

      observer.complete()
    })
  }
}
