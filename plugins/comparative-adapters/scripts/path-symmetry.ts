#!/usr/bin/env node
// Single-process path-symmetry runner. Replaces the per-path Node spawns
// that `tools/graph-truth-extractor/test-path-symmetry.sh` drove
// (equivalent-ranges + dump-subgraph + fingerprint, one process each):
// opens the binary indexes once, iterates equivalent ranges in-process,
// asserts all structural fingerprints match.
//
// Per agent-docs/GRAPH_PLAN.md "Plausible follow-up cleanups → Consolidate
// audit subprocess chain". Order-of-magnitude speedup at HPRC scale where
// each spawn re-loads tens of MB of index data.
//
// Usage:
//   node --experimental-strip-types \
//     plugins/comparative-adapters/scripts/path-symmetry.ts \
//     <prefix> <refPath> <start> <end> [--context K]

import {
  dumpSubgraphFromShard,
  getEquivalentRangesFromShard,
  openAuditShard,
} from './lib/auditShard.ts'
import { structuralFingerprint } from '../../../tools/graph-truth-extractor/canonicalize.ts'


function out(s: string) {
  process.stdout.write(`${s}\n`)
}

async function main() {
  const argv = process.argv.slice(2)
  let context = 1
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--context') {
      context = Number(argv[++i] ?? '1')
    } else {
      positional.push(a)
    }
  }
  if (positional.length < 4) {
    console.error(
      'Usage: node --experimental-strip-types plugins/comparative-adapters/scripts/path-symmetry.ts <prefix> <refPath> <start> <end> [--context K]',
    )
    process.exit(2)
  }
  const [prefix, refPath, startStr, endStr] = positional
  const start = Number(startStr!)
  const end = Number(endStr!)

  const shard = await openAuditShard(prefix!)
  const ranges = await getEquivalentRangesFromShard(
    shard,
    refPath!,
    start,
    end,
  )
  if (ranges.length === 0) {
    console.error('No equivalent ranges found — region empty?')
    process.exit(1)
  }

  out(`Path-symmetry: ${prefix} ${refPath}:${start}-${end}`)
  out(`Equivalent ranges: ${ranges.length}`)

  const fps: { name: string; fp: string }[] = []
  for (const r of ranges) {
    const gfa = await dumpSubgraphFromShard(shard, r.name, r.start, r.end, {
      context,
    })
    const fp = structuralFingerprint(gfa, { useSequence: true }).combined
    fps.push({ name: r.name, fp })
    out(`${r.name.padEnd(40)} ${r.name}:${r.start}-${r.end}  fp=${fp}`)
  }

  out('')
  out('=== Result ===')
  const first = fps[0]!.fp
  let allMatch = true
  for (const e of fps) {
    if (e.fp !== first) {
      allMatch = false
      out(`MISMATCH: ${e.name} fingerprint differs`)
    }
  }
  if (allMatch) {
    out(
      `ISOMORPHIC: all ${fps.length} paths produce the same structural fingerprint`,
    )
    process.exit(0)
  }
  out('DIVERGENT: path-symmetry violated')
  process.exit(1)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
