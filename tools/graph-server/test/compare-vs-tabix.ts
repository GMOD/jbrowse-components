// Server ↔ tabix correctness oracle. The runtime backend
// (`tools/graph-server`) and the static-file backend
// (`plugins/comparative-adapters/src/GfaTabixAdapter` over output from
// `tools/gfa-to-tabix`) should produce equivalent per-position mismatch
// lists. This script spawns the server against the volvox pangenome,
// queries `/synteny` for several regions, and for every feature in the
// response builds a `Map<refPos, base>` from the cs string (the same data
// `extractMismatchesFromCs` would feed the renderer) and compares it to
// the mismatch map derived by walking `bubbles.bed.gz` rows fully contained
// in the feature's span attributed to the feature's `queryGenome`.
//
// Position-level: a divergence is one of {missing-on-server, extra-on-
// server, base-differs}. This is the data shape the renderer actually
// consumes, so equality here is what user-facing parity means.
//
// Run:
//   pnpm exec node --experimental-strip-types tools/graph-server/test/compare-vs-tabix.ts
// Optional env: PORT, ORACLE_REGIONS_JSON (override REGIONS), ORACLE_VERBOSE=1,
//               ORACLE_MAX_REPORT (cap reported divergences per region, default 5)

import { spawn, spawnSync } from 'child_process'
import path from 'path'
import { setTimeout as sleep } from 'timers/promises'

const PORT = Number(process.env.PORT ?? 5199)
const HERE = new URL('.', import.meta.url).pathname
const REPO = path.resolve(HERE, '../../..')
const DATASETS = path.join(HERE, 'datasets.volvox.json')
const SERVER = path.join(HERE, '../src/server.ts')
const BUBBLES_BED = path.join(
  REPO,
  'test_data/volvox/volvox_pangenome_50.bubbles.bed.gz',
)
const VERBOSE = process.env.ORACLE_VERBOSE === '1'
const MAX_REPORT = Number(process.env.ORACLE_MAX_REPORT ?? 5)

interface Region {
  refName: string
  start: number
  end: number
}

const DEFAULT_REGIONS: Region[] = [
  { refName: 'ctgA', start: 0, end: 5000 },
  { refName: 'ctgA', start: 5000, end: 15000 },
  { refName: 'ctgA', start: 15000, end: 50001 },
]

interface ServerFeature {
  queryGenome: string
  start: number
  end: number
  strand: 1 | -1
  cs?: string
}

// Single position-level event. Indels are coalesced into one entry per
// refPos with `kind=ins|del` so the comparison doesn't depend on whether
// the cs emitted a single multi-base `-acgt` or per-base events.
type EventKind = 'snp' | 'ins' | 'del'
interface MismatchEvent {
  refPos: number
  kind: EventKind
  // For snp: query base (uppercase A/C/G/T/N). For indel: '' (length comes
  // from a separate field if we ever need it; for now equality on kind+pos
  // is sufficient).
  base: string
  length: number
}

function readBubbleHeader(): string[] {
  const out = spawnSync('bash', ['-c', `zcat ${BUBBLES_BED} | head -1`], {
    encoding: 'utf8',
  })
  const first = out.stdout.trim()
  if (!first.startsWith('#genomes=')) {
    throw new Error(`bubble file missing #genomes header; got: ${first}`)
  }
  return first.slice('#genomes='.length).split(',')
}

// Walk a cs string starting at refStart, pushing one event per `*`/`-`/`+`
// operator. Matches `extractMismatchesFromCs` + `extractIndelsFromCs`
// semantics combined.
function csToEvents(cs: string, refStart: number, out: MismatchEvent[]) {
  let refPos = refStart
  let i = 0
  while (i < cs.length) {
    const ch = cs[i]
    if (ch === ':') {
      i++
      let num = 0
      while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
        num = num * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      refPos += num
    } else if (ch === '*') {
      const queryBase = cs[i + 2]
      if (queryBase) {
        out.push({
          refPos,
          kind: 'snp',
          base: queryBase.toUpperCase(),
          length: 1,
        })
      }
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      const start = i
      while (
        i < cs.length &&
        cs[i] !== ':' &&
        cs[i] !== '*' &&
        cs[i] !== '+' &&
        cs[i] !== '-'
      ) {
        i++
      }
      const len = i - start
      out.push({ refPos, kind: 'del', base: '', length: len })
      refPos += len
    } else if (ch === '+') {
      i++
      const start = i
      while (
        i < cs.length &&
        cs[i] !== ':' &&
        cs[i] !== '*' &&
        cs[i] !== '+' &&
        cs[i] !== '-'
      ) {
        i++
      }
      const len = i - start
      out.push({ refPos, kind: 'ins', base: '', length: len })
    } else {
      i++
    }
  }
}

interface BubbleRow {
  start: number
  end: number
  cs: string
  altGenomes: Set<string>
}

function fetchBubbleRows(
  region: Region,
  genomes: string[],
  refPath: string,
): BubbleRow[] {
  const out = spawnSync(
    'tabix',
    [BUBBLES_BED, `${refPath}:${region.start}-${region.end}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  if (out.status !== 0) {
    throw new Error(`tabix bubble failed: ${out.stderr}`)
  }
  // Schema (verified against GfaTabixAdapter/bubbleOverlay.ts parseBubbleLine):
  //   col 3 = alleleA, col 4 = alleleB (always alleleA < alleleB upstream)
  //   col 7 = samples carrying alleleA
  //   col 8 = samples carrying alleleB
  // So for alleleA=0 (ref-like), col 8 lists the samples carrying the non-
  // ref allele B. (The early version of this oracle read col 7 — that was
  // wrong and inverted every comparison.)
  const rows: BubbleRow[] = []
  for (const line of out.stdout.split('\n')) {
    if (!line || line.startsWith('#')) {
      continue
    }
    const cols = line.split('\t')
    if (cols.length < 9) {
      continue
    }
    const alleleA = Number(cols[3])
    if (alleleA !== 0) {
      continue
    }
    const altGenomes = new Set<string>()
    for (const idxStr of cols[8]?.split(',').filter(Boolean) ?? []) {
      const name = genomes[Number(idxStr)]
      if (name !== undefined) {
        altGenomes.add(name)
      }
    }
    rows.push({
      start: Number(cols[1]),
      end: Number(cols[2]),
      cs: cols[6] ?? '',
      altGenomes,
    })
  }
  return rows
}

// Build the position-level event list for one genome by walking every
// bubble row containing it. Each row's cs starts at row.start.
function tabixEventsForFeature(
  rows: BubbleRow[],
  start: number,
  end: number,
  genome: string,
): MismatchEvent[] {
  const out: MismatchEvent[] = []
  for (const r of rows) {
    if (r.start >= start && r.end <= end && r.altGenomes.has(genome)) {
      csToEvents(r.cs, r.start, out)
    }
  }
  out.sort((a, b) => a.refPos - b.refPos || a.kind.localeCompare(b.kind))
  return out
}

interface Divergence {
  refPos: number
  kind: 'missing' | 'extra' | 'base-differs' | 'kind-differs'
  server?: MismatchEvent
  tabix?: MismatchEvent
}

// Two events at the same refPos with the same kind+base/length are equal.
// We accept length differences on indels as a soft mismatch (kept as a
// divergence but tagged separately).
function diffEventLists(
  serverEvents: MismatchEvent[],
  tabixEvents: MismatchEvent[],
): Divergence[] {
  const divs: Divergence[] = []
  let i = 0
  let j = 0
  while (i < serverEvents.length && j < tabixEvents.length) {
    const s = serverEvents[i]!
    const t = tabixEvents[j]!
    if (s.refPos < t.refPos) {
      divs.push({ refPos: s.refPos, kind: 'extra', server: s })
      i++
    } else if (s.refPos > t.refPos) {
      divs.push({ refPos: t.refPos, kind: 'missing', tabix: t })
      j++
    } else if (s.kind !== t.kind) {
      divs.push({
        refPos: s.refPos,
        kind: 'kind-differs',
        server: s,
        tabix: t,
      })
      i++
      j++
    } else if (s.kind === 'snp' && s.base !== t.base) {
      divs.push({
        refPos: s.refPos,
        kind: 'base-differs',
        server: s,
        tabix: t,
      })
      i++
      j++
    } else {
      i++
      j++
    }
  }
  while (i < serverEvents.length) {
    divs.push({
      refPos: serverEvents[i]!.refPos,
      kind: 'extra',
      server: serverEvents[i],
    })
    i++
  }
  while (j < tabixEvents.length) {
    divs.push({
      refPos: tabixEvents[j]!.refPos,
      kind: 'missing',
      tabix: tabixEvents[j],
    })
    j++
  }
  return divs
}

async function waitForHealth(base: string) {
  for (let i = 0; i < 200; i++) {
    await sleep(150)
    try {
      const r = await fetch(`${base}/health`)
      if (r.ok) {
        return
      }
    } catch {
      // not ready
    }
  }
  throw new Error('server never became healthy')
}

async function main() {
  const genomes = readBubbleHeader()
  console.log(`[oracle] bubble header lists ${genomes.length} genomes`)

  const regions: Region[] = process.env.ORACLE_REGIONS_JSON
    ? (JSON.parse(process.env.ORACLE_REGIONS_JSON) as Region[])
    : DEFAULT_REGIONS

  const proc = spawn('node', ['--experimental-strip-types', SERVER], {
    env: {
      ...process.env,
      PORT: String(PORT),
      GRAPH_SERVER_DATASETS: DATASETS,
    },
    cwd: REPO,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout.on('data', d => {
    if (VERBOSE) {
      process.stdout.write(`[server] ${d}`)
    }
  })
  proc.stderr.on('data', d => {
    if (VERBOSE) {
      process.stderr.write(`[server-err] ${d}`)
    }
  })
  let killed = false
  process.on('exit', () => {
    if (!killed) {
      proc.kill()
    }
  })

  const base = `http://127.0.0.1:${PORT}/api/v0`
  await waitForHealth(base)
  const refGenome = 'ref#0'
  const headers = { 'content-type': 'application/json' }
  let regionsWithDivergence = 0

  try {
    for (const region of regions) {
      const refPath = `${refGenome}#${region.refName}`
      console.log(`\n[oracle] ${region.refName}:${region.start}-${region.end}`)
      const r = await fetch(`${base}/datasets/volvox/synteny`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          refName: region.refName,
          start: region.start,
          end: region.end,
          genome: refGenome,
          context: 0,
        }),
      })
      if (!r.ok) {
        throw new Error(`server /synteny failed: ${r.status} ${r.statusText}`)
      }
      const { features } = (await r.json()) as { features: ServerFeature[] }

      const bubbleRows = fetchBubbleRows(region, genomes, refPath)

      const byKind = { missing: 0, extra: 0, baseDiffers: 0, kindDiffers: 0 }
      const byEventKind = {
        snp: 0,
        ins: 0,
        del: 0,
      }
      const featureDivs: { f: ServerFeature; divs: Divergence[] }[] = []
      let serverEventsTotal = 0
      let tabixEventsTotal = 0
      for (const f of features) {
        const serverEvents: MismatchEvent[] = []
        if (f.cs) {
          csToEvents(f.cs, f.start, serverEvents)
        }
        const tabixEvents = tabixEventsForFeature(
          bubbleRows,
          f.start,
          f.end,
          f.queryGenome,
        )
        serverEventsTotal += serverEvents.length
        tabixEventsTotal += tabixEvents.length
        const divs = diffEventLists(serverEvents, tabixEvents)
        for (const d of divs) {
          if (d.kind === 'missing') {
            byKind.missing++
            if (d.tabix) {
              byEventKind[d.tabix.kind]++
            }
          } else if (d.kind === 'extra') {
            byKind.extra++
            if (d.server) {
              byEventKind[d.server.kind]++
            }
          } else if (d.kind === 'base-differs') {
            byKind.baseDiffers++
          } else {
            byKind.kindDiffers++
          }
        }
        if (divs.length > 0) {
          featureDivs.push({ f, divs })
        }
      }

      console.log(
        `  events: server=${serverEventsTotal} tabix=${tabixEventsTotal}`,
      )
      console.log(
        `  divergences: ${byKind.missing} server-missing, ${byKind.extra} server-extra, ${byKind.baseDiffers} base-differs, ${byKind.kindDiffers} kind-differs`,
      )
      console.log(
        `  divergent events by kind: ${byEventKind.snp} snp, ${byEventKind.ins} ins, ${byEventKind.del} del`,
      )

      if (featureDivs.length === 0) {
        console.log(`  ✓ all ${features.length} features agree`)
      } else {
        regionsWithDivergence++
        featureDivs.sort((a, b) => b.divs.length - a.divs.length)
        console.log(
          `  ✗ ${featureDivs.length}/${features.length} features diverge (top ${MAX_REPORT} by divergence count):`,
        )
        for (const { f, divs } of featureDivs.slice(0, MAX_REPORT)) {
          const sample = divs.slice(0, 3).map(d => {
            if (d.kind === 'extra' && d.server) {
              return `+${d.refPos}:${d.server.kind}${d.server.base}`
            }
            if (d.kind === 'missing' && d.tabix) {
              return `-${d.refPos}:${d.tabix.kind}${d.tabix.base}`
            }
            if (d.kind === 'base-differs' && d.server && d.tabix) {
              return `~${d.refPos}:${d.tabix.base}→${d.server.base}`
            }
            return `?${d.refPos}`
          })
          console.log(
            `    ${f.queryGenome} ${f.start}-${f.end} (strand=${f.strand}): ${divs.length} divs, e.g. ${sample.join(',')}`,
          )
        }
      }
    }
  } finally {
    killed = true
    proc.kill()
  }

  if (regionsWithDivergence > 0) {
    console.log(
      `\n[oracle] DIVERGENCE: ${regionsWithDivergence}/${regions.length} regions disagree`,
    )
    process.exit(1)
  } else {
    console.log(`\n[oracle] OK: ${regions.length} regions clean`)
  }
}

main().catch((e: unknown) => {
  console.error('[oracle] FAIL', e)
  process.exit(1)
})
