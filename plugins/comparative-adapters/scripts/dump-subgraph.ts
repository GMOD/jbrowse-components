#!/usr/bin/env node
// Dumps the GfaTabixAdapter `getSubgraph` output for a region as raw GFA.
// Used as the "ours" side of the Phase 0 audit harness — the truth side comes
// from `tools/graph-truth-extractor/cli.ts` (vg/odgi/chunkix/naive).
//
// Lives inside plugins/comparative-adapters/ so it naturally resolves
// @gmod/tabix and generic-filehandle2 from this package's deps. Shared
// loading + dispatch logic lives in `lib/auditShard.ts` so single-process
// multi-query runners (path-symmetry) can skip the per-call Node spawn.
//
// Usage:
//   node --experimental-strip-types \
//     plugins/comparative-adapters/scripts/dump-subgraph.ts \
//     <prefix> <pathName> <start> <end> [--no-edges] [--max-paths N] [--context K] [--coarsen auto|on|off] [--bubble-threshold BP]

import { dumpSubgraphFromShard, openAuditShard } from './lib/auditShard.ts'

interface Args {
  prefix: string
  pathName: string
  start: number
  end: number
  noEdges: boolean
  maxPathsEmitted?: number
  context?: number
  coarsen: 'auto' | 'on' | 'off'
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const shard = await openAuditShard(args.prefix, { noEdges: args.noEdges })
  const gfa = await dumpSubgraphFromShard(
    shard,
    args.pathName,
    args.start,
    args.end,
    {
      noEdges: args.noEdges,
      maxPathsEmitted: args.maxPathsEmitted,
      context: args.context,
      coarsen: args.coarsen,
      bubbleThreshold: args.bubbleThreshold,
    },
  )
  if (gfa.length === 0) {
    process.stdout.write('')
    return
  }
  process.stdout.write(gfa.endsWith('\n') ? gfa : `${gfa}\n`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
