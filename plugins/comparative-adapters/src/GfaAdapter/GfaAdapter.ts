import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { MultiPairFeature } from '../MultiPairFeature.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation, Region } from '@jbrowse/core/util/types'

interface GfaSegment {
  id: string
  length: number
  sequence: string
}

interface GfaLink {
  source: string
  strand1: string
  target: string
  strand2: string
}

interface GfaPathEntry {
  name: string
  genome: string
  refName: string
  segments: { segId: string; orient: string }[]
}

interface ParsedGfa {
  segments: Map<string, GfaSegment>
  links: GfaLink[]
  paths: GfaPathEntry[]
  genomes: string[]
  chromSizes: Map<string, { refName: string; length: number }[]>
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

function parseGfa(text: string) {
  const segments = new Map<string, GfaSegment>()
  const links: GfaLink[] = []
  const paths: GfaPathEntry[] = []
  const genomeSet = new Set<string>()

  for (const line of text.split('\n')) {
    if (line.startsWith('S\t')) {
      const cols = line.split('\t')
      const id = cols[1]!
      const seq = cols[2]!
      let length = seq === '*' ? 0 : seq.length
      for (let i = 3; i < cols.length; i++) {
        if (cols[i]!.startsWith('LN:i:')) {
          length = +cols[i]!.slice(5)
        }
      }
      segments.set(id, { id, length, sequence: seq })
    } else if (line.startsWith('L\t')) {
      const cols = line.split('\t')
      links.push({
        source: cols[1]!,
        strand1: cols[2]!,
        target: cols[3]!,
        strand2: cols[4]!,
      })
    } else if (line.startsWith('P\t') || line.startsWith('W\t')) {
      if (line.startsWith('P\t')) {
        const cols = line.split('\t')
        const pathName = cols[1]!
        const segStr = cols[2]!
        const { genome, refName } = parseGfaPathName(pathName)
        genomeSet.add(genome)

        const segs = segStr.split(',').map(s => ({
          segId: s.slice(0, -1),
          orient: s.slice(-1),
        }))
        paths.push({ name: pathName, genome, refName, segments: segs })
      } else {
        const cols = line.split('\t')
        const genome = cols[1]!
        const haplotype = cols[2]!
        const refName = cols[3]!
        const walkStr = cols[6]!
        genomeSet.add(genome + (haplotype !== '*' ? `#${haplotype}` : ''))

        const segs: { segId: string; orient: string }[] = []
        let pos = 0
        while (pos < walkStr.length) {
          const orient = walkStr[pos]!
          pos++
          let end = pos
          while (
            end < walkStr.length &&
            walkStr[end] !== '>' &&
            walkStr[end] !== '<'
          ) {
            end++
          }
          segs.push({
            segId: walkStr.slice(pos, end),
            orient: orient === '>' ? '+' : '-',
          })
          pos = end
        }

        paths.push({
          name: `${genome}#${haplotype}#${refName}`,
          genome: genome + (haplotype !== '*' ? `#${haplotype}` : ''),
          refName,
          segments: segs,
        })
      }
    }
  }

  const chromSizes = new Map<string, { refName: string; length: number }[]>()
  for (const path of paths) {
    let totalLen = 0
    for (const seg of path.segments) {
      totalLen += segments.get(seg.segId)?.length ?? 0
    }
    if (!chromSizes.has(path.genome)) {
      chromSizes.set(path.genome, [])
    }
    chromSizes
      .get(path.genome)!
      .push({ refName: path.refName, length: totalLen })
  }

  return {
    segments,
    links,
    paths,
    genomes: [...genomeSet],
    chromSizes,
  } satisfies ParsedGfa
}

function findRefPath(
  paths: GfaPathEntry[],
  assemblyName: string,
  refName: string,
) {
  return paths.find(
    p =>
      (p.genome === assemblyName && p.refName === refName) ||
      p.name === `${assemblyName}#${refName}`,
  )
}

export default class GfaAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  private gfaPromise?: Promise<ParsedGfa>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
  }

  private async getGfa() {
    if (!this.gfaPromise) {
      this.gfaPromise = (async () => {
        const loc = this.getConf('gfaLocation') as FileLocation
        const handle = openLocation(loc, this.pluginManager)
        const text = await handle.readFile('utf8')
        return parseGfa(text)
      })()
    }
    return this.gfaPromise
  }

  getAssemblyNames() {
    return this.getConf('assemblyNames') as string[]
  }

  async getSources() {
    const gfa = await this.getGfa()
    return gfa.genomes.map(g => ({ name: g }))
  }

  async getChromSizes() {
    return (await this.getGfa()).chromSizes
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
              syntenyId: +feat.featureId.replace(/\D/g, '') || 0,
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

  async getSubgraph(region: Region) {
    const gfa = await this.getGfa()
    const { refName, start, end, assemblyName } = region

    const refPath = findRefPath(gfa.paths, assemblyName, refName)
    if (!refPath) {
      console.warn(
        '[GfaAdapter.getSubgraph] No ref path found for',
        assemblyName,
        refName,
      )
      return ''
    }

    const refSegsInRange = new Set<string>()
    let offset = 0
    for (const seg of refPath.segments) {
      const segLen = gfa.segments.get(seg.segId)?.length ?? 0
      if (offset + segLen > start && offset < end) {
        refSegsInRange.add(seg.segId)
      }
      offset += segLen
    }
    if (refSegsInRange.size === 0) {
      console.warn(
        '[GfaAdapter.getSubgraph] No ref segments overlap query range',
      )
      return ''
    }

    const allSegIds = new Set<string>()
    const pathSpans = new Map<string, { segId: string; orient: string }[]>()

    for (const path of gfa.paths) {
      let firstShared = -1
      let lastShared = -1
      for (let i = 0; i < path.segments.length; i++) {
        if (refSegsInRange.has(path.segments[i]!.segId)) {
          if (firstShared === -1) {
            firstShared = i
          }
          lastShared = i
        }
      }
      if (firstShared >= 0) {
        const span: { segId: string; orient: string }[] = []
        for (let i = firstShared; i <= lastShared; i++) {
          const seg = path.segments[i]!
          allSegIds.add(seg.segId)
          span.push(seg)
        }
        pathSpans.set(path.name, span)
      }
    }

    const lines: string[] = ['H\tVN:Z:1.1']
    for (const segId of allSegIds) {
      const seg = gfa.segments.get(segId)
      if (seg) {
        lines.push(`S\t${segId}\t${seg.sequence}\tLN:i:${seg.length}`)
      }
    }
    // Emit explicit links from source GFA
    const emittedLinks = new Set<string>()
    for (const link of gfa.links) {
      if (allSegIds.has(link.source) && allSegIds.has(link.target)) {
        const key = `${link.source}\t${link.strand1}\t${link.target}\t${link.strand2}`
        if (!emittedLinks.has(key)) {
          emittedLinks.add(key)
          lines.push(`L\t${key}\t*`)
        }
      }
    }

    // Infer links from path adjacency when no explicit links exist
    if (gfa.links.length === 0) {
      for (const span of pathSpans.values()) {
        for (let i = 0; i < span.length - 1; i++) {
          const a = span[i]!
          const b = span[i + 1]!
          const key = `${a.segId}\t${a.orient}\t${b.segId}\t${b.orient}`
          if (!emittedLinks.has(key)) {
            emittedLinks.add(key)
            lines.push(`L\t${key}\t*`)
          }
        }
      }
    }

    for (const [pathName, span] of pathSpans) {
      const walk = span.map(s => `${s.segId}${s.orient}`).join(',')
      lines.push(`P\t${pathName}\t${walk}\t*`)
    }

    return lines.join('\n')
  }

  async getMultiPairFeatures(query: Region, _opts: BaseOptions = {}) {
    const gfa = await this.getGfa()
    const genomeRows = new Map<string, MultiPairFeature[]>()
    const { refName, start, end, assemblyName } = query

    // Build segment ordinal positions for all paths
    const pathPositions = new Map<
      string,
      { segId: string; orient: string; offset: number; length: number }[]
    >()
    for (const path of gfa.paths) {
      const positions: {
        segId: string
        orient: string
        offset: number
        length: number
      }[] = []
      let offset = 0
      for (const seg of path.segments) {
        const segLen = gfa.segments.get(seg.segId)?.length ?? 0
        positions.push({
          segId: seg.segId,
          orient: seg.orient,
          offset,
          length: segLen,
        })
        offset += segLen
      }
      pathPositions.set(path.name, positions)
    }

    const refPath = findRefPath(gfa.paths, assemblyName, refName)
    if (!refPath) {
      return { genomeRows }
    }

    const refPositions = pathPositions.get(refPath.name)!

    // Find segments in the query range
    const refSegSet = new Set<string>()
    const refSegBySegId = new Map<
      string,
      { offset: number; length: number; orient: string }
    >()
    for (const pos of refPositions) {
      if (pos.offset + pos.length > start && pos.offset < end) {
        refSegSet.add(pos.segId)
        refSegBySegId.set(pos.segId, pos)
      }
    }

    // For each other path, find shared segments and build features
    for (const otherPath of gfa.paths) {
      if (otherPath.name === refPath.name) {
        continue
      }

      const otherPositions = pathPositions.get(otherPath.name)!
      const features: MultiPairFeature[] = []

      for (const pos of otherPositions) {
        const refSeg = refSegBySegId.get(pos.segId)
        if (refSeg) {
          const strand = pos.orient === refSeg.orient ? 1 : -1
          features.push({
            queryGenome: otherPath.genome,
            origRefName: refName,
            start: refSeg.offset,
            end: refSeg.offset + refSeg.length,
            mateStart: pos.offset,
            mateEnd: pos.offset + pos.length,
            mateRefName: otherPath.refName,
            strand,
            syriType: undefined,
            identity: 1,
            featureId: `gfa-${pos.segId}-${otherPath.name}`,
            segmentId: pos.segId,
            cigar: undefined,
            cs: undefined,
          })
        }
      }

      if (features.length > 0) {
        if (!genomeRows.has(otherPath.genome)) {
          genomeRows.set(otherPath.genome, [])
        }
        const existing = genomeRows.get(otherPath.genome)!
        for (const f of features) {
          existing.push(f)
        }
      }
    }

    return { genomeRows }
  }
}
