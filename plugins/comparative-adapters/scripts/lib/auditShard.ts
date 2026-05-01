// Shared library for the audit harness CLI scripts. Opens a tabix index
// prefix once, exposes in-process `dumpSubgraph` / `getEquivalentRanges`
// equivalents so multi-query runners (e.g. path-symmetry) avoid spawning
// one Node process per call. Per agent-docs/GRAPH_PLAN.md "Plausible
// follow-up cleanups → Consolidate audit subprocess chain".

import fs from 'fs'

import { TabixIndexedFile } from '@gmod/tabix'
import { LocalFile } from 'generic-filehandle2'

import {
  getSegmentsForOrdinalsFromShard,
  mergeOrdinalRanges,
  parsePosLineOrdinals,
} from '../../src/GfaTabixAdapter/gfaBinaryIO.ts'
import { buildGfaCoarsened } from '../../src/GfaTabixAdapter/gfaCoarsener.ts'
import { getSequencesForOrdinals } from '../../src/GfaTabixAdapter/gfaSeqIO.ts'
import {
  buildGfaFromEdges,
  buildGfaFromPathInference,
} from '../../src/GfaTabixAdapter/gfaSubgraphBuilders.ts'

import type { IndexedBinaryShard } from '../../src/GfaTabixAdapter/gfaBinaryIO.ts'
import type { SeqShard } from '../../src/GfaTabixAdapter/gfaSeqIO.ts'

export interface AuditShard {
  posFile: TabixIndexedFile
  segShard: IndexedBinaryShard
  edgeShard?: IndexedBinaryShard
  seqShard?: SeqShard
  pathNames: string[]
  inputFormat: 'walks' | 'paths'
}

export interface OpenAuditShardOpts {
  noEdges?: boolean
}

// Mirror gfaTabixUtils.ts; CLI dispatch must agree with adapter dispatch.
const COARSEN_THRESHOLD_BP = 1_000_000
const MIN_BUBBLE_THRESHOLD_BP = 20
const BUBBLE_THRESHOLD_DIVISOR = 50_000

export async function openAuditShard(
  prefix: string,
  opts: OpenAuditShardOpts = {},
): Promise<AuditShard> {
  const posPath = `${prefix}.pos.bed.gz`
  const tbiPath = `${prefix}.pos.bed.gz.tbi`
  const segPath = `${prefix}.segments.bin`
  const segIdxPath = `${prefix}.segments.idx`
  const edgesPath = `${prefix}.edges.bin`
  const edgesIdxPath = `${prefix}.edges.idx`
  const seqFaPath = `${prefix}.segments.seq.fa`
  const seqIdxPath = `${prefix}.segments.seq.idx`

  for (const p of [posPath, tbiPath, segPath, segIdxPath]) {
    if (!fs.existsSync(p)) {
      throw new Error(`Required file not found: ${p}`)
    }
  }

  const posFile = new TabixIndexedFile({
    filehandle: new LocalFile(posPath),
    tbiFilehandle: new LocalFile(tbiPath),
  })
  const segShard: IndexedBinaryShard = {
    filehandle: new LocalFile(segPath),
    idxFile: new LocalFile(segIdxPath),
  }
  const hasEdges =
    !opts.noEdges && fs.existsSync(edgesPath) && fs.existsSync(edgesIdxPath)
  const edgeShard: IndexedBinaryShard | undefined = hasEdges
    ? {
        filehandle: new LocalFile(edgesPath),
        idxFile: new LocalFile(edgesIdxPath),
      }
    : undefined
  const seqShard: SeqShard | undefined =
    fs.existsSync(seqFaPath) && fs.existsSync(seqIdxPath)
      ? {
          fastaFile: new LocalFile(seqFaPath),
          idxFile: new LocalFile(seqIdxPath),
        }
      : undefined

  const header = await posFile.getHeader()
  const sizesMatch = /sizes=([^\n]+)/.exec(header)
  const pathsMatch = /paths=([^\n]+)/.exec(header)
  const formatMatch = /input-format=([^\n\s]+)/.exec(header)
  const inputFormat: 'walks' | 'paths' =
    formatMatch?.[1] === 'walks' ? 'walks' : 'paths'
  const pathNames = pathsMatch
    ? pathsMatch[1]!.split(',')
    : sizesMatch
      ? sizesMatch[1]!.split(',').map(entry => {
          const colonIdx = entry.lastIndexOf(':')
          return colonIdx !== -1 ? entry.slice(0, colonIdx) : entry
        })
      : []

  return { posFile, segShard, edgeShard, seqShard, pathNames, inputFormat }
}

async function fetchViewportSegments(
  shard: AuditShard,
  pathName: string,
  start: number,
  end: number,
) {
  const refPathIdx = shard.pathNames.indexOf(pathName)
  if (refPathIdx === -1) {
    throw new Error(
      `path ${pathName} not found in header (paths=${shard.pathNames
        .slice(0, 5)
        .join(',')}${shard.pathNames.length > 5 ? ',...' : ''})`,
    )
  }
  const rawRanges: [number, number][] = []
  await shard.posFile.getLines(pathName, start, end, {
    lineCallback: (line: string) => {
      parsePosLineOrdinals(line, rawRanges)
    },
  })
  if (rawRanges.length === 0) {
    return { refPathIdx, segments: [], ordinalRanges: [] as [number, number][] }
  }
  const ordinalRanges = mergeOrdinalRanges(rawRanges)
  const segments = await getSegmentsForOrdinalsFromShard(
    shard.segShard,
    ordinalRanges,
  )
  return { refPathIdx, segments, ordinalRanges }
}

export interface EquivalentRange {
  name: string
  start: number
  end: number
}

export async function getEquivalentRangesFromShard(
  shard: AuditShard,
  refPath: string,
  start: number,
  end: number,
): Promise<EquivalentRange[]> {
  const { refPathIdx, segments } = await fetchViewportSegments(
    shard,
    refPath,
    start,
    end,
  )
  if (segments.length === 0) {
    return []
  }
  const refOrds = new Set<number>()
  for (const rec of segments) {
    if (
      rec.pathNameIdx === refPathIdx &&
      rec.offset + rec.segLen > start &&
      rec.offset < end
    ) {
      refOrds.add(rec.segOrd)
    }
  }
  if (refOrds.size === 0) {
    return []
  }
  const ranges = new Map<string, { start: number; end: number }>([[refPath, { start, end }]])
  for (const rec of segments) {
    if (rec.pathNameIdx === refPathIdx) {
      continue
    }
    if (!refOrds.has(rec.segOrd)) {
      continue
    }
    const name = shard.pathNames[rec.pathNameIdx]
    if (!name) {
      continue
    }
    const recEnd = rec.offset + rec.segLen
    const existing = ranges.get(name)
    if (!existing) {
      ranges.set(name, { start: rec.offset, end: recEnd })
    } else {
      if (rec.offset < existing.start) {
        existing.start = rec.offset
      }
      if (recEnd > existing.end) {
        existing.end = recEnd
      }
    }
  }
  const out: EquivalentRange[] = []
  for (const [name, r] of ranges) {
    out.push({ name, start: r.start, end: r.end })
  }
  return out
}

export interface DumpSubgraphOpts {
  noEdges?: boolean
  maxPathsEmitted?: number
  context?: number
  coarsen?: 'auto' | 'on' | 'off'
  bubbleThreshold?: number
}

export async function dumpSubgraphFromShard(
  shard: AuditShard,
  pathName: string,
  start: number,
  end: number,
  opts: DumpSubgraphOpts = {},
): Promise<string> {
  const coarsen = opts.coarsen ?? 'auto'
  const { refPathIdx, segments } = await fetchViewportSegments(
    shard,
    pathName,
    start,
    end,
  )
  if (segments.length === 0) {
    return ''
  }
  const viewportRefOrds: number[] = []
  const segLens = new Map<number, number>()
  for (const rec of segments) {
    if (
      rec.pathNameIdx === refPathIdx &&
      rec.offset + rec.segLen > start &&
      rec.offset < end
    ) {
      viewportRefOrds.push(rec.segOrd)
      segLens.set(rec.segOrd, rec.segLen)
    }
  }
  if (viewportRefOrds.length === 0) {
    return ''
  }

  const edgeShard = opts.noEdges ? undefined : shard.edgeShard
  const fetchSeqs = shard.seqShard
    ? (ords: number[]) => getSequencesForOrdinals(shard.seqShard!, ords)
    : undefined

  const regionBp = end - start
  const useCoarsen =
    coarsen === 'on' ||
    (coarsen === 'auto' && regionBp >= COARSEN_THRESHOLD_BP && !!edgeShard)

  if (useCoarsen) {
    if (!edgeShard) {
      throw new Error(
        'coarsen=on requires edges.bin (open the shard with noEdges=false)',
      )
    }
    const bubbleThresholdBp =
      opts.bubbleThreshold ??
      Math.max(
        MIN_BUBBLE_THRESHOLD_BP,
        Math.floor(regionBp / BUBBLE_THRESHOLD_DIVISOR),
      )
    return buildGfaCoarsened(
      viewportRefOrds,
      segLens,
      edgeShard,
      shard.pathNames,
      refPathIdx,
      bubbleThresholdBp,
    )
  }
  const buildOpts = {
    maxPathsEmitted: opts.maxPathsEmitted,
    context: opts.context,
    emitFormat: shard.inputFormat,
  }
  if (edgeShard) {
    return buildGfaFromEdges(
      viewportRefOrds,
      segLens,
      edgeShard,
      ranges => getSegmentsForOrdinalsFromShard(shard.segShard, ranges),
      shard.pathNames,
      segments,
      fetchSeqs,
      buildOpts,
    )
  }
  return buildGfaFromPathInference(
    segments,
    refPathIdx,
    viewportRefOrds,
    segLens,
    shard.pathNames,
    fetchSeqs,
    buildOpts,
  )
}
