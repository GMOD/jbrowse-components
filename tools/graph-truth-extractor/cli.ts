import fs from 'fs'

import {
  canonicalize,
  structuralFingerprint,
  summarizeDiff,
} from './canonicalize.ts'
import { extractTruthSubgraph } from './index.ts'

import type { ExtractRequest, TruthBackend } from './backends/types.ts'

interface Args {
  backend?: string
  gfa?: string
  path?: string
  start?: string
  end?: string
  context?: string
  emit?: string
  allBackends?: boolean
  useSequence?: boolean
  indexPrefix?: string
  cacheDir?: string
  out?: string
  help?: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--backend') {
      out.backend = argv[++i]
    } else if (a === '--gfa') {
      out.gfa = argv[++i]
    } else if (a === '--path') {
      out.path = argv[++i]
    } else if (a === '--start') {
      out.start = argv[++i]
    } else if (a === '--end') {
      out.end = argv[++i]
    } else if (a === '--context') {
      out.context = argv[++i]
    } else if (a === '--emit') {
      out.emit = argv[++i]
    } else if (a === '--all-backends') {
      out.allBackends = true
    } else if (a === '--use-sequence') {
      out.useSequence = true
    } else if (a === '--index-prefix') {
      out.indexPrefix = argv[++i]
    } else if (a === '--cache-dir') {
      out.cacheDir = argv[++i]
    } else if (a === '--out') {
      out.out = argv[++i]
    } else if (a === '-h' || a === '--help') {
      out.help = true
    }
  }
  return out
}

function help() {
  console.error(String.raw`graph-truth-extractor CLI

Usage:
  node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
    --backend vg|odgi|chunkix|naive \
    --gfa <path> --path <name> --start <n> --end <n> [--context <k|snarl>] \
    [--emit raw|canonical|json] [--use-sequence] [--out <path>] \
    [--all-backends] [--index-prefix <prefix>] [--cache-dir <dir>]
`)
}

function buildRequest(args: Args, backend: TruthBackend): ExtractRequest {
  const ctxRaw = args.context ?? '1'
  const context = ctxRaw === 'snarl' ? 'snarl' : Number(ctxRaw)
  return {
    backend,
    gfaPath: args.gfa!,
    pathName: args.path!,
    start: Number(args.start ?? 0),
    end: Number(args.end ?? 0),
    context,
    indexPrefix: args.indexPrefix,
    cacheDir: args.cacheDir,
  }
}

async function runOne(args: Args) {
  const backend = (args.backend ?? 'vg') as TruthBackend
  const result = await extractTruthSubgraph(buildRequest(args, backend))
  const emit = args.emit ?? 'canonical'
  let out: string
  if (emit === 'raw') {
    out = result.gfa
  } else if (emit === 'canonical') {
    out = canonicalize(result.gfa, { useSequence: !!args.useSequence })
  } else if (emit === 'json') {
    const canonical = canonicalize(result.gfa, {
      useSequence: !!args.useSequence,
    })
    out = JSON.stringify(
      {
        backend,
        backendVersion: result.backendVersion,
        elapsedMs: result.elapsedMs,
        segmentCount: result.segmentCount,
        edgeCount: result.edgeCount,
        pathCount: result.pathCount,
        notes: result.notes,
        canonicalGfa: canonical,
      },
      null,
      2,
    )
  } else {
    throw new Error(`Unknown --emit: ${emit}`)
  }
  if (args.out) {
    fs.writeFileSync(args.out, out)
  } else {
    process.stdout.write(out)
  }
}

async function runAll(args: Args) {
  const backends: TruthBackend[] = ['vg', 'odgi', 'chunkix', 'naive']
  const useSequence = !!args.useSequence
  const results: {
    backend: TruthBackend
    ok: boolean
    elapsedMs?: number
    backendVersion?: string
    segs?: number
    edges?: number
    paths?: number
    fingerprint?: ReturnType<typeof structuralFingerprint>
    canonical?: string
    error?: string
  }[] = []
  for (const backend of backends) {
    try {
      const r = await extractTruthSubgraph(buildRequest(args, backend))
      results.push({
        backend,
        ok: true,
        elapsedMs: r.elapsedMs,
        backendVersion: r.backendVersion,
        segs: r.segmentCount,
        edges: r.edgeCount,
        paths: r.pathCount,
        fingerprint: structuralFingerprint(r.gfa, { useSequence }),
        canonical: canonicalize(r.gfa, { useSequence }),
      })
    } catch (e) {
      results.push({
        backend,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  console.error('backend\tok\telapsedMs\tsegs\tedges\tpaths\tversion')
  for (const r of results) {
    console.error(
      `${r.backend}\t${r.ok}\t${r.elapsedMs ?? ''}\t${r.segs ?? ''}\t${r.edges ?? ''}\t${r.paths ?? ''}\t${r.backendVersion ?? ''}`,
    )
  }

  // Pairwise comparison using structural fingerprints as the authoritative
  // equality test. Fingerprints are grounded in actual sequences and are
  // invariant to node-ID conventions and walk splitting between backends.
  // Canonical-form diff is shown as a diagnostic when fingerprints disagree,
  // but the exit code is driven by the fingerprint result.
  const ok = results.filter(r => r.ok)
  let allMatch = true
  for (let i = 1; i < ok.length; i++) {
    const a = ok[0]!
    const b = ok[i]!
    const fp = a.fingerprint!
    const fpb = b.fingerprint!
    const same = fp.combined === fpb.combined
    console.error(
      `# ${a.backend} vs ${b.backend}: ${same ? 'isomorphic' : 'DIVERGE'}`,
    )
    if (!same) {
      allMatch = false
      console.error(
        `#   seq  ${fp.seq === fpb.seq ? 'match' : 'DIFFER'}  link ${fp.link === fpb.link ? 'match' : 'DIFFER'}  path ${fp.path === fpb.path ? 'match' : 'DIFFER'}`,
      )
      if (a.canonical && b.canonical) {
        const summary = summarizeDiff(a.canonical, b.canonical)
        console.error(`#   segments: ${JSON.stringify(summary.segments)}`)
        console.error(`#   edges:    ${JSON.stringify(summary.edges)}`)
        console.error(`#   paths:    ${JSON.stringify(summary.paths)}`)
      }
    }
  }

  if (!allMatch) {
    process.exitCode = 1
  }
  for (const r of results) {
    if (!r.ok) {
      console.error(`# ${r.backend} failed: ${r.error}`)
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    help()
    return
  }
  if (
    !args.gfa ||
    !args.path ||
    args.start === undefined ||
    args.end === undefined
  ) {
    help()
    process.exitCode = 2
    return
  }
  await (args.allBackends ? runAll(args) : runOne(args))
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : String(err))
  process.exitCode = 1
})
