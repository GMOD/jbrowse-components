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

import {
  getEquivalentRangesFromShard,
  openAuditShard,
} from './lib/auditShard.ts'

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 4) {
    console.error(
      'Usage: node --experimental-strip-types plugins/comparative-adapters/scripts/equivalent-ranges.ts <prefix> <refPath> <start> <end>',
    )
    process.exit(2)
  }
  const [prefix, refPath, startStr, endStr] = argv
  const shard = await openAuditShard(prefix!, { noEdges: true })
  const ranges = await getEquivalentRangesFromShard(
    shard,
    refPath!,
    Number(startStr!),
    Number(endStr!),
  )
  for (const r of ranges) {
    process.stdout.write(`${r.name}\t${r.start}\t${r.end}\n`)
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
