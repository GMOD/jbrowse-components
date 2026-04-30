#!/usr/bin/env node
// Dumps the GfaTabixAdapter `getSubgraph` output for a region as raw GFA.
// Used as the "ours" side of the Phase 0 audit harness — the truth side comes
// from `tools/graph-truth-extractor/cli.ts` (vg/odgi/chunkix/naive).
//
// Lives inside plugins/comparative-adapters/ so it naturally resolves
// @gmod/tabix and generic-filehandle2 from this package's deps.
//
// Usage:
//   node --experimental-strip-types \
//     plugins/comparative-adapters/scripts/dump-subgraph.ts \
//     <prefix> <pathName> <start> <end> [--no-edges] [--max-paths N] [--context K]
//
// where <prefix> is e.g. test_data/volvox/volvox_pangenome_50 (the path
// without the .pos.bed.gz suffix) and <pathName> is the PanSN-formatted path
// e.g. ref#0#ctgA. Output is GFA on stdout.
//
// We bypass the BaseGfaTabixAdapter MST/configuration layer and invoke the
// shared helpers in src/GfaTabixAdapter/ directly. This keeps the CLI free of
// MobX/Plugin dependencies.

import fs from 'fs'

import { TabixIndexedFile } from '@gmod/tabix'
import { LocalFile } from 'generic-filehandle2'

import {
  getSegmentsForOrdinalsFromShard,
  mergeOrdinalRanges,
  parsePosLineOrdinals,
} from '../src/GfaTabixAdapter/gfaBinaryIO.ts'
import { buildGfaCoarsened } from '../src/GfaTabixAdapter/gfaCoarsener.ts'
import { getSequencesForOrdinals } from '../src/GfaTabixAdapter/gfaSeqIO.ts'
import {
  buildGfaFromEdges,
  buildGfaFromPathInference,
} from '../src/GfaTabixAdapter/gfaSubgraphBuilders.ts'

import type { IndexedBinaryShard } from '../src/GfaTabixAdapter/gfaBinaryIO.ts'
import type { SeqShard } from '../src/GfaTabixAdapter/gfaSeqIO.ts'

interface Args {
  prefix: string
  pathName: string
  start: number
  end: number
  noEdges: boolean
  maxPathsEmitted?: number
  context?: number
  coarsen?: 'auto' | 'on' | 'off'
  bubbleThreshold?: number
}

function parseArgs(argv: string[]): Args {
  let noEdges = false
  let maxPathsEmitted: number | undefined
  let context: number | undefined
  let coarsen: 'auto' | 'on' | 'off' = 'auto'
  let bubbleThreshold: number | undefined
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--no-edges') {
      noEdges = true
    } else if (a === '--max-paths') {
      const next = argv[++i]
      if (!next) {
        console.error('--max-paths requires a numeric argument')
        process.exit(2)
      }
      maxPathsEmitted = Number(next)
    } else if (a === '--context') {
      const next = argv[++i]
      if (!next) {
        console.error('--context requires a numeric argument')
        process.exit(2)
      }
      context = Number(next)
    } else if (a === '--coarsen') {
      const next = argv[++i]
      if (!next || (next !== 'auto' && next !== 'on' && next !== 'off')) {
        console.error('--coarsen requires auto|on|off')
        process.exit(2)
      }
      coarsen = next
    } else if (a === '--bubble-threshold') {
      const next = argv[++i]
      if (!next) {
        console.error('--bubble-threshold requires a numeric argument')
        process.exit(2)
      }
      bubbleThreshold = Number(next)
    } else {
      positional.push(a)
    }
  }
  if (positional.length < 4) {
    console.error(
      'Usage: node --experimental-strip-types plugins/comparative-adapters/scripts/dump-subgraph.ts <prefix> <pathName> <start> <end> [--no-edges] [--max-paths N] [--context K] [--coarsen auto|on|off] [--bubble-threshold BP]',
    )
    process.exit(2)
  }
  return {
    prefix: positional[0]!,
    pathName: positional[1]!,
    start: Number(positional[2]!),
    end: Number(positional[3]!),
    noEdges,
    maxPathsEmitted,
    context,
    coarsen,
    bubbleThreshold,
  }
}

// Mirrors gfaTabixUtils.ts; CLI must use the same defaults so the adapter
// dispatch path and the bash-harness path agree on which builder runs.
const COARSEN_THRESHOLD_BP = 1_000_000
const MIN_BUBBLE_THRESHOLD_BP = 20
const BUBBLE_THRESHOLD_DIVISOR = 50_000

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const posPath = `${args.prefix}.pos.bed.gz`
  const tbiPath = `${args.prefix}.pos.bed.gz.tbi`
  const segPath = `${args.prefix}.segments.bin`
  const segIdxPath = `${args.prefix}.segments.idx`
  const edgesPath = `${args.prefix}.edges.bin`
  const edgesIdxPath = `${args.prefix}.edges.idx`

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
    !args.noEdges && fs.existsSync(edgesPath) && fs.existsSync(edgesIdxPath)
  const edgeShard: IndexedBinaryShard | undefined = hasEdges
    ? { filehandle: new LocalFile(edgesPath), idxFile: new LocalFile(edgesIdxPath) }
    : undefined

  const seqFaPath = `${args.prefix}.segments.seq.fa`
  const seqIdxPath = `${args.prefix}.segments.seq.idx`
  const seqShard: SeqShard | undefined =
    fs.existsSync(seqFaPath) && fs.existsSync(seqIdxPath)
      ? {
          fastaFile: new LocalFile(seqFaPath),
          idxFile: new LocalFile(seqIdxPath),
        }
      : undefined
  const fetchSeqs = seqShard
    ? (ords: number[]) => getSequencesForOrdinals(seqShard, ords)
    : undefined

  // Read header to discover the per-path index used by segments.bin records.
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
  const refPathIdx = pathNames.indexOf(args.pathName)
  if (refPathIdx === -1) {
    throw new Error(
      `path ${args.pathName} not found in header (paths=${pathNames.slice(0, 5).join(',')}${pathNames.length > 5 ? ',...' : ''})`,
    )
  }

  const rawRanges: [number, number][] = []
  await posFile.getLines(args.pathName, args.start, args.end, {
    lineCallback: (line: string) => {
      parsePosLineOrdinals(line, rawRanges)
    },
  })
  if (rawRanges.length === 0) {
    process.stdout.write('')
    return
  }
  const ordinalRanges = mergeOrdinalRanges(rawRanges)
  const segments = await getSegmentsForOrdinalsFromShard(segShard, ordinalRanges)

  const viewportRefOrds: number[] = []
  const segLens = new Map<number, number>()
  for (const rec of segments) {
    if (
      rec.pathNameIdx === refPathIdx &&
      rec.offset + rec.segLen > args.start &&
      rec.offset < args.end
    ) {
      viewportRefOrds.push(rec.segOrd)
      segLens.set(rec.segOrd, rec.segLen)
    }
  }
  if (viewportRefOrds.length === 0) {
    process.stdout.write('')
    return
  }

  const regionBp = args.end - args.start
  const useCoarsen =
    args.coarsen === 'on' ||
    (args.coarsen === 'auto' &&
      regionBp >= COARSEN_THRESHOLD_BP &&
      edgeShard !== undefined)

  let gfa: string
  if (useCoarsen) {
    if (!edgeShard) {
      throw new Error('--coarsen on requires edges.bin (run without --no-edges)')
    }
    const bubbleThresholdBp =
      args.bubbleThreshold ??
      Math.max(
        MIN_BUBBLE_THRESHOLD_BP,
        Math.floor(regionBp / BUBBLE_THRESHOLD_DIVISOR),
      )
    gfa = await buildGfaCoarsened(
      viewportRefOrds,
      segLens,
      edgeShard,
      pathNames,
      refPathIdx,
      bubbleThresholdBp,
    )
  } else {
    const buildOpts = {
      maxPathsEmitted: args.maxPathsEmitted,
      context: args.context,
      emitFormat: inputFormat,
    }
    gfa = await (edgeShard ? buildGfaFromEdges(
        viewportRefOrds,
        segLens,
        edgeShard,
        ranges => getSegmentsForOrdinalsFromShard(segShard, ranges),
        pathNames,
        segments,
        fetchSeqs,
        buildOpts,
      ) : buildGfaFromPathInference(
        segments,
        refPathIdx,
        viewportRefOrds,
        segLens,
        pathNames,
        fetchSeqs,
        buildOpts,
      ))
  }
  process.stdout.write(gfa.endsWith('\n') ? gfa : `${gfa  }\n`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
