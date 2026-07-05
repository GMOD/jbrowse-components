import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { getWeightedMeans, makeSyntenyFeature } from '../PAFAdapter/util.ts'
import { parsePAFLine } from '../util.ts'

import type { AllVsAllPAFAdapterConfig } from './configSchema.ts'
import type { PAFRecord } from '../PAFAdapter/util.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

interface PAFOptions extends BaseOptions {
  config?: AnyConfigurationModel
}

const SEP = '#'

// The PanSN sample name is the token before the first separator, e.g.
// `grape#1#chr1` -> `grape`.
function panSNSample(refName: string) {
  return refName.split(SEP)[0]!
}

// Strip the PanSN prefix to recover the assembly's own refName: `sample#hap#chr1`
// -> `chr1`, `sample#chr1` -> `chr1`. A contig that itself contains the
// separator is assumed not to occur (PanSN uses `#` only as the delimiter).
function panSNContig(refName: string) {
  const parts = refName.split(SEP)
  return parts.length >= 3
    ? parts.slice(2).join(SEP)
    : parts.length === 2
      ? parts[1]!
      : refName
}

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
    // Mirror the getFeatures gate so getRefNames doesn't over-report refs with
    // no drawable features: report the anchor-side contig of every record whose
    // mate is a DIFFERENT sample (one-vs-all). A supplied targetAssemblyName
    // (two-row synteny band) narrows this to that single pair.
    for (const feat of feats) {
      const qPrefix = panSNSample(feat.qname)
      const tPrefix = panSNSample(feat.tname)
      if (
        qPrefix === anchorPrefix &&
        tPrefix !== anchorPrefix &&
        (targetPrefix === undefined || tPrefix === targetPrefix)
      ) {
        set.add(panSNContig(feat.qname))
      }
      if (
        tPrefix === anchorPrefix &&
        qPrefix !== anchorPrefix &&
        (targetPrefix === undefined || qPrefix === targetPrefix)
      ) {
        set.add(panSNContig(feat.tname))
      }
    }
    return [...set]
  }

  getFeatures(query: Region, opts: PAFOptions = {}) {
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

        // Anchor the queried assembly's side as the feature, the other as the
        // mate; flip mirrors PAFAdapter (the query/qname side is the anchor).
        const flip = qPrefix === anchorPrefix
        const matePrefix = flip ? tPrefix : qPrefix

        // One-vs-all: draw every record touching the queried assembly whose
        // mate is a DIFFERENT sample, whether or not that sample is a listed
        // assembly — the mate is labelled by its assembly if listed, else its
        // bare PanSN prefix. In the two-row synteny view targetAssemblyName
        // (the other band's assembly) narrows this to that single pair; a plain
        // LGV leaves it undefined, so the assembly draws against everything in
        // the file. Same-sample records (paralogy) are left out here.
        const drawsHere =
          (qPrefix === anchorPrefix || tPrefix === anchorPrefix) &&
          matePrefix !== anchorPrefix &&
          (targetPrefix === undefined || matePrefix === targetPrefix)

        if (drawsHere) {
          const start = flip ? r.qstart : r.tstart
          const end = flip ? r.qend : r.tend
          const refName = panSNContig(flip ? r.qname : r.tname)
          const { extra, strand } = r
          if (refName === qref && doesIntersect2(qstart, qend, start, end)) {
            observer.next(
              makeSyntenyFeature({
                syntenyId: i,
                assemblyName,
                refName,
                start,
                end,
                strand,
                extra,
                flip,
                mate: {
                  start: flip ? r.tstart : r.qstart,
                  end: flip ? r.tend : r.qend,
                  refName: panSNContig(flip ? r.tname : r.qname),
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
