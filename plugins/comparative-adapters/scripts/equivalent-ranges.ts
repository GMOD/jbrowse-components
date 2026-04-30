#!/usr/bin/env node
// Prints per-path coordinate ranges that overlap the same physical segments
// as a given (refPath, refStart, refEnd) viewport. Used by the C3
// path-symmetry harness to query "the same locus" from N reference paths.
//
// Output: one TSV row per equivalent path, including the ref path itself,
// with columns `pathName<TAB>start<TAB>end`. Names are file-side PanSN
// (e.g. `GRCh38#0#chrM`), not JBrowse-mapped assembly names.
//
// Usage:
//   node --experimental-strip-types \
//     plugins/comparative-adapters/scripts/equivalent-ranges.ts \
//     <prefix> <refPath> <start> <end>

import fs from 'fs'

import { TabixIndexedFile } from '@gmod/tabix'
import { LocalFile } from 'generic-filehandle2'

import {
  mergeOrdinalRanges,
  parsePosLineOrdinals,
  getSegmentsForOrdinalsFromShard,
} from '../src/GfaTabixAdapter/gfaBinaryIO.ts'

import type { IndexedBinaryShard } from '../src/GfaTabixAdapter/gfaBinaryIO.ts'

interface Args {
  prefix: string
  refPath: string
  start: number
  end: number
}

function parseArgs(argv: string[]): Args {
  if (argv.length < 4) {
    console.error(
      'Usage: node --experimental-strip-types plugins/comparative-adapters/scripts/equivalent-ranges.ts <prefix> <refPath> <start> <end>',
    )
    process.exit(2)
  }
  return {
    prefix: argv[0]!,
    refPath: argv[1]!,
    start: Number(argv[2]!),
    end: Number(argv[3]!),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const posPath = `${args.prefix}.pos.bed.gz`
  const tbiPath = `${args.prefix}.pos.bed.gz.tbi`
  const segPath = `${args.prefix}.segments.bin`
  const segIdxPath = `${args.prefix}.segments.idx`

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

  const header = await posFile.getHeader()
  const pathsMatch = /paths=([^\n]+)/.exec(header)
  const sizesMatch = /sizes=([^\n]+)/.exec(header)
  const pathNames = pathsMatch
    ? pathsMatch[1]!.split(',')
    : sizesMatch
      ? sizesMatch[1]!.split(',').map(entry => {
          const colonIdx = entry.lastIndexOf(':')
          return colonIdx !== -1 ? entry.slice(0, colonIdx) : entry
        })
      : []
  const refPathIdx = pathNames.indexOf(args.refPath)
  if (refPathIdx === -1) {
    throw new Error(`path ${args.refPath} not found in header`)
  }

  const rawRanges: [number, number][] = []
  await posFile.getLines(args.refPath, args.start, args.end, {
    lineCallback: line => {
      parsePosLineOrdinals(line, rawRanges)
    },
  })
  if (rawRanges.length === 0) {
    return
  }
  const ordinalRanges = mergeOrdinalRanges(rawRanges)
  const segments = await getSegmentsForOrdinalsFromShard(segShard, ordinalRanges)

  const refOrds = new Set<number>()
  for (const rec of segments) {
    if (
      rec.pathNameIdx === refPathIdx &&
      rec.offset + rec.segLen > args.start &&
      rec.offset < args.end
    ) {
      refOrds.add(rec.segOrd)
    }
  }
  if (refOrds.size === 0) {
    return
  }

  // Extend with the ref path's own range as the first emitted row so the
  // caller can fingerprint the ref viewport too.
  const ranges = new Map<string, { start: number; end: number }>()
  ranges.set(args.refPath, { start: args.start, end: args.end })
  for (const rec of segments) {
    if (rec.pathNameIdx === refPathIdx) {
      continue
    }
    if (!refOrds.has(rec.segOrd)) {
      continue
    }
    const name = pathNames[rec.pathNameIdx]
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

  for (const [name, { start, end }] of ranges) {
    process.stdout.write(`${name}\t${start}\t${end}\n`)
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
