import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { MultiPairFeature } from '../PairwiseIndexedPAFAdapter/PairwiseIndexedPAFAdapter.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation, Region } from '@jbrowse/core/util/types'

interface SegRecord {
  segOrd: number
  pathName: string
  offset: number
  segLen: number
  orient: string
  segId: string
}

function parseGfaPathName(path: string) {
  const parts = path.split('#')
  if (parts.length >= 3) {
    return {
      genome: parts.slice(0, -1).join('#'),
      refName: parts[parts.length - 1]!,
    }
  }
  return { genome: parts[0]!, refName: parts[1] ?? parts[0]! }
}

interface ParsedHeader {
  genomes: string[]
  chromSizes: Map<string, { refName: string; length: number }[]>
}

export default class GfaTabixAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  private posFile: TabixIndexedFile
  private segsFile: TabixIndexedFile
  private headerPromise?: Promise<ParsedHeader>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pm = this.pluginManager

    const posLoc = this.getConf('posLocation') as FileLocation
    const posIdxLoc = this.getConf(['posIndex', 'location']) as FileLocation

    this.posFile = new TabixIndexedFile({
      filehandle: openLocation(posLoc, pm),
      tbiFilehandle: openLocation(posIdxLoc, pm),
      chunkCacheSize: 50 * 2 ** 20,
    })

    const segsLoc = this.getConf('segsLocation') as FileLocation
    const segsIdxLoc = this.getConf(['segsIndex', 'location']) as FileLocation

    this.segsFile = new TabixIndexedFile({
      filehandle: openLocation(segsLoc, pm),
      tbiFilehandle: openLocation(segsIdxLoc, pm),
      chunkCacheSize: 50 * 2 ** 20,
    })
  }

  private async getParsedHeader() {
    if (!this.headerPromise) {
      this.headerPromise = this.posFile.getHeader().then(header => {
        const genomesMatch = /genomes=([^\n]+)/.exec(header)
        const genomes = genomesMatch ? genomesMatch[1]!.split(',') : []

        const chromSizes = new Map<
          string,
          { refName: string; length: number }[]
        >()
        const sizesMatch = /sizes=([^\n]+)/.exec(header)
        if (sizesMatch) {
          for (const entry of sizesMatch[1]!.split(',')) {
            const colonIdx = entry.lastIndexOf(':')
            if (colonIdx < 0) {
              continue
            }
            const { genome, refName } = parseGfaPathName(
              entry.slice(0, colonIdx),
            )
            const length = +entry.slice(colonIdx + 1)
            if (!chromSizes.has(genome)) {
              chromSizes.set(genome, [])
            }
            chromSizes.get(genome)!.push({ refName, length })
          }
        }
        return { genomes, chromSizes }
      })
    }
    return this.headerPromise
  }

  getAssemblyNames() {
    return this.getConf('assemblyNames') as string[]
  }

  async getChromSizes() {
    return (await this.getParsedHeader()).chromSizes
  }

  public async hasDataForRefName() {
    return true
  }

  async getRefNames() {
    return []
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const result = await this.getMultiPairFeatures(query, opts)
      const { assemblyName } = query

      for (const [queryGenome, features] of result.genomeRows) {
        for (const feat of features) {
          observer.next(
            new SyntenyFeature({
              uniqueId: `${feat.featureId}-${assemblyName}`,
              assemblyName,
              start: feat.start,
              end: feat.end,
              type: 'match',
              refName: query.refName,
              strand: feat.strand,
              syntenyId: +feat.featureId,
              identity: feat.identity,
              numMatches: 0,
              blockLen: 0,
              mate: {
                start: feat.mateStart,
                end: feat.mateEnd,
                refName: feat.mateRefName,
                assemblyName: queryGenome,
              },
            }),
          )
        }
      }
      observer.complete()
    })
  }

  async getMultiPairFeatures(
    query: Region,
    _opts: { bpPerPx?: number; stopToken?: BaseOptions['stopToken'] } = {},
  ) {
    const genomeRows = new Map<string, MultiPairFeature[]>()
    const { refName, start, end, assemblyName } = query

    // Step 1: Query pos.bed.gz for ref region → segment ordinal range
    let minSegOrd = Infinity
    let maxSegOrd = -Infinity
    let refPathName = ''

    for (const candidate of [`${assemblyName}#${refName}`, refName]) {
      try {
        await this.posFile.getLines(candidate, start, end, {
          lineCallback: line => {
            refPathName = candidate
            const cols = line.split('\t')
            minSegOrd = Math.min(minSegOrd, +cols[3]!)
            maxSegOrd = Math.max(maxSegOrd, +cols[4]!)
          },
        })
      } catch {
        // path name format didn't match, try next
      }
      if (refPathName) {
        break
      }
    }

    if (!refPathName || minSegOrd > maxSegOrd) {
      return { genomeNames: [] as string[], genomeRows }
    }

    // Step 2: Query segs.bed.gz for segment range → all genome positions
    const refSegments: SegRecord[] = []
    const otherSegments = new Map<string, SegRecord[]>()

    await this.segsFile.getLines('S', minSegOrd, maxSegOrd + 1, {
      lineCallback: line => {
        const cols = line.split('\t')
        const rec: SegRecord = {
          segOrd: +cols[1]!,
          pathName: cols[3]!,
          offset: +cols[4]!,
          segLen: +cols[5]!,
          orient: cols[6]!,
          segId: cols[7]!,
        }

        if (rec.pathName === refPathName) {
          refSegments.push(rec)
        } else {
          if (!otherSegments.has(rec.pathName)) {
            otherSegments.set(rec.pathName, [])
          }
          otherSegments.get(rec.pathName)!.push(rec)
        }
      },
    })

    const refSegOrdSet = new Set(refSegments.map(s => s.segOrd))
    const refByOrd = new Map(refSegments.map(s => [s.segOrd, s]))

    // Step 3: For each other genome, find shared segments, merge, build features
    for (const [otherPath, segments] of otherSegments) {
      const { genome: genomeName, refName: mateRefName } =
        parseGfaPathName(otherPath)

      if (!genomeRows.has(genomeName)) {
        genomeRows.set(genomeName, [])
      }
      const features = genomeRows.get(genomeName)!

      // Build paired records (ref + query) sorted by ref offset
      const paired: { ref: SegRecord; query: SegRecord; strand: number }[] = []
      for (const seg of segments) {
        const refSeg = refSegOrdSet.has(seg.segOrd)
          ? refByOrd.get(seg.segOrd)
          : undefined
        if (refSeg) {
          paired.push({
            ref: refSeg,
            query: seg,
            strand: seg.orient === refSeg.orient ? 1 : -1,
          })
        }
      }
      if (paired.length === 0) {
        continue
      }
      paired.sort((a, b) => a.ref.offset - b.ref.offset)

      // Merge adjacent contiguous segments with same strand
      let ms = -1
      let me = -1
      let mms = -1
      let mme = -1
      let mStrand = 0
      let mOrd = -1
      let mSegId = ''

      const emit = () => {
        if (ms >= 0) {
          features.push({
            queryGenome: genomeName,
            start: ms,
            end: me,
            mateStart: mms,
            mateEnd: mme,
            mateRefName,
            strand: mStrand,
            syriType: undefined,
            identity: 1,
            featureId: `gfa-${mOrd}-${otherPath}`,
            segmentId: mSegId,
          })
        }
      }

      for (let i = 0; i < paired.length; i++) {
        const p = paired[i]!
        const rs = p.ref.offset
        const re = p.ref.offset + p.ref.segLen
        const qs = p.query.offset
        const qe = p.query.offset + p.query.segLen

        if (
          ms >= 0 &&
          p.strand === mStrand &&
          rs === me &&
          ((mStrand === 1 && qs === mme) || (mStrand === -1 && qe === mms))
        ) {
          me = re
          if (mStrand === 1) {
            mme = qe
          } else {
            mms = qs
          }
        } else {
          emit()
          ms = rs
          me = re
          mms = qs
          mme = qe
          mStrand = p.strand
          mOrd = p.ref.segOrd
          mSegId = p.ref.segId
        }
      }
      emit()
    }

    return { genomeNames: [...genomeRows.keys()], genomeRows }
  }
}
