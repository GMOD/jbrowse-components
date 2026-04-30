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
//     <prefix> <pathName> <start> <end> [--no-edges]
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
  mergeOrdinalRanges,
  parsePosLineOrdinals,
  getSegmentsForOrdinalsFromShard,
} from '../src/GfaTabixAdapter/gfaBinaryIO.ts'
import {
  buildGfaFromEdges,
  buildGfaFromPathInference,
} from '../src/GfaTabixAdapter/gfaSubgraphBuilders.ts'

import type { IndexedBinaryShard } from '../src/GfaTabixAdapter/gfaBinaryIO.ts'

interface Args {
  prefix: string
  pathName: string
  start: number
  end: number
  noEdges: boolean
}

function parseArgs(argv: string[]): Args {
  let prefix = ''
  let pathName = ''
  let start = 0
  let end = 0
  let noEdges = false
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--no-edges') {
      noEdges = true
    } else {
      positional.push(a)
    }
  }
  if (positional.length < 4) {
    console.error(
      'Usage: node --experimental-strip-types plugins/comparative-adapters/scripts/dump-subgraph.ts <prefix> <pathName> <start> <end> [--no-edges]',
    )
    process.exit(2)
  }
  prefix = positional[0]!
  pathName = positional[1]!
  start = Number(positional[2]!)
  end = Number(positional[3]!)
  return { prefix, pathName, start, end, noEdges }
}

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

  // Read header to discover the per-path index used by segments.bin records.
  const header = await posFile.getHeader()
  const sizesMatch = /sizes=([^\n]+)/.exec(header)
  const pathsMatch = /paths=([^\n]+)/.exec(header)
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

  let gfa: string
  if (edgeShard) {
    gfa = await buildGfaFromEdges(
      viewportRefOrds,
      segLens,
      edgeShard,
      ranges => getSegmentsForOrdinalsFromShard(segShard, ranges),
      pathNames,
      segments,
    )
  } else {
    gfa = buildGfaFromPathInference(
      segments,
      refPathIdx,
      viewportRefOrds,
      segLens,
      pathNames,
    )
  }
  process.stdout.write(gfa.endsWith('\n') ? gfa : gfa + '\n')
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
