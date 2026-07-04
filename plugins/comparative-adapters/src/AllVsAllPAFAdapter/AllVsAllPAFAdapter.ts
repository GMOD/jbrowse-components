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

  // sample prefix (in the PAF) -> JBrowse assembly name, for this track's pair
  private prefixToAssembly() {
    const map = this.getConf('assemblyNameToPanSN') as Record<string, string>
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
    const assemblyName = opts.assemblyName
    const feats = await this.setup(opts)
    const prefixToAsm = this.prefixToAssembly()
    const set = new Set<string>()
    // only contigs that actually participate in this track's pair (both sides
    // resolve to the two assemblies), mirroring the getFeatures filter so
    // getRefNames doesn't over-report refs that have no drawable features here
    for (const feat of feats) {
      const qAsm = prefixToAsm[panSNSample(feat.qname)]
      const tAsm = prefixToAsm[panSNSample(feat.tname)]
      if (qAsm && tAsm && qAsm !== tAsm) {
        if (qAsm === assemblyName) {
          set.add(panSNContig(feat.qname))
        }
        if (tAsm === assemblyName) {
          set.add(panSNContig(feat.tname))
        }
      }
    }
    return [...set]
  }

  getFeatures(query: Region, opts: PAFOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const pafRecords = await this.setup(opts)
      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      const prefixToAsm = this.prefixToAssembly()

      for (let i = 0; i < pafRecords.length; i++) {
        const r = pafRecords[i]!
        const qAsm = prefixToAsm[panSNSample(r.qname)]
        const tAsm = prefixToAsm[panSNSample(r.tname)]

        // keep only records whose two sides are exactly this track's pair (both
        // resolved, and different from each other) — this is what filters an
        // all-vs-all file down to the A-vs-B band
        if (qAsm && tAsm && qAsm !== tAsm) {
          // orient so the side on the queried assembly is the feature, the
          // other is the mate; flip mirrors PAFAdapter (query side is qname)
          const flip = qAsm === assemblyName
          const start = flip ? r.qstart : r.tstart
          const end = flip ? r.qend : r.tend
          const refName = panSNContig(flip ? r.qname : r.tname)
          const mateName = panSNContig(flip ? r.tname : r.qname)
          const mateStart = flip ? r.tstart : r.qstart
          const mateEnd = flip ? r.tend : r.qend
          const mateAsm = flip ? tAsm : qAsm
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
                  start: mateStart,
                  end: mateEnd,
                  refName: mateName,
                  assemblyName: mateAsm,
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
