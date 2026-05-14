// Debug probe for Phase 1 of GRAPH_SERVER_PLAN.md: verify what the worker
// sees when fed server features for ctgA:1-50001.
//
// Boots the server, fetches /synteny, then re-runs the worker-side pipeline
// (extractMismatchesFromCs → computeCoverage → computeSNPCoverage) locally
// and prints snpCount/maxDepth/color distribution. Inlines the relevant
// functions to avoid pulling tsx-bearing packages into the strip-types loader.

/* eslint-disable no-console */

import { spawn } from 'child_process'
import path from 'path'
import { setTimeout as sleep } from 'timers/promises'

interface ServerFeature {
  queryGenome: string
  origRefName: string
  start: number
  end: number
  mateStart: number
  mateEnd: number
  mateRefName: string
  strand: 1 | -1
  identity: number
  featureId: string
  cs?: string
}

interface Mismatch {
  position: number
  base: number
  strand: number
}

const PORT = Number(process.env.PORT ?? 5097)
const HERE = new URL('.', import.meta.url).pathname
const REPO = path.resolve(HERE, '../../..')
const DATASETS = path.join(HERE, 'datasets.volvox.json')
const SERVER = path.join(HERE, '../src/server.ts')

const REGION_START = 1
const REGION_END = 50001
const REF_NAME = 'ctgA'
const GENOME = 'ref#0'

const BASE_CODES: Record<number, string> = {
  65: 'A',
  67: 'C',
  71: 'G',
  84: 'T',
}

function isDigit(ch: string) {
  return ch >= '0' && ch <= '9'
}

function isCsOpChar(ch: string | undefined) {
  return ch === ':' || ch === '*' || ch === '+' || ch === '-'
}

function parseCsSeqLen(cs: string, start: number) {
  let i = start
  while (i < cs.length && !isCsOpChar(cs[i])) {
    i++
  }
  return i - start
}

function extractMismatchesFromCs(
  cs: string,
  featureStart: number,
  mismatches: Mismatch[],
) {
  let refPos = 0
  let i = 0
  while (i < cs.length) {
    const ch = cs[i]!
    if (ch === ':') {
      i++
      let num = 0
      while (i < cs.length && isDigit(cs[i]!)) {
        num = num * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      refPos += num
    } else if (ch === '*') {
      const queryBase = cs[i + 2]
      if (queryBase) {
        mismatches.push({
          position: featureStart + refPos,
          base: queryBase.toUpperCase().charCodeAt(0),
          strand: 0,
        })
      }
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
      refPos += len
    } else if (ch === '+') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
    } else {
      i++
    }
  }
}

function computeCoverage(
  features: { start: number; end: number }[],
  regionStart: number,
  regionEnd: number,
) {
  if (features.length === 0) {
    return {
      depths: new Float32Array(0),
      maxDepth: 0,
      startPos: 0,
    }
  }
  let actualStart = regionStart
  let actualEnd = regionEnd
  const maxExtension = regionEnd - regionStart
  for (const f of features) {
    if (f.start < actualStart && f.start >= regionStart - maxExtension) {
      actualStart = f.start
    }
    if (f.end > actualEnd && f.end <= regionEnd + maxExtension) {
      actualEnd = f.end
    }
  }
  actualStart = Math.max(actualStart, regionStart)
  const numBins = actualEnd - actualStart
  const events: { pos: number; delta: number }[] = []
  for (const f of features) {
    events.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
  }
  events.sort((a, b) => a.pos - b.pos)
  const depths = new Float32Array(numBins)
  let depth = 0
  let eventIdx = 0
  for (let binIdx = 0; binIdx < numBins; binIdx++) {
    const binEnd = actualStart + binIdx + 1
    while (eventIdx < events.length && events[eventIdx]!.pos < binEnd) {
      depth += events[eventIdx]!.delta
      eventIdx++
    }
    depths[binIdx] = Math.max(0, depth)
  }
  let maxDepth = 0
  for (let i = 0; i < numBins; i++) {
    if (depths[i]! > maxDepth) {
      maxDepth = depths[i]!
    }
  }
  return { depths, maxDepth: maxDepth || 1, startPos: actualStart }
}

function computeSNPCoverage(
  mismatches: Mismatch[],
  regionStart: number,
  coverage: { depths: Float32Array; maxDepth: number; startPos: number },
) {
  const { depths, maxDepth, startPos } = coverage
  if (mismatches.length === 0 || maxDepth === 0) {
    return {
      count: 0,
      colorHist: new Map<number, number>(),
      droppedDueToZeroDepth: 0,
      droppedDueToOutsideRegion: 0,
      sampleSegments: [] as Record<string, number>[],
    }
  }
  const snpByPos = new Map<
    number,
    { position: number; a: number; c: number; g: number; t: number }
  >()
  for (const mm of mismatches) {
    let e = snpByPos.get(mm.position)
    if (!e) {
      e = { position: mm.position, a: 0, c: 0, g: 0, t: 0 }
      snpByPos.set(mm.position, e)
    }
    if (mm.base === 65) {
      e.a++
    } else if (mm.base === 67) {
      e.c++
    } else if (mm.base === 71) {
      e.g++
    } else if (mm.base === 84) {
      e.t++
    }
  }
  const segments: { position: number; colorType: number; height: number }[] = []
  let droppedDueToZeroDepth = 0
  for (const entry of snpByPos.values()) {
    const total = entry.a + entry.c + entry.g + entry.t
    if (total === 0) {
      continue
    }
    const idx = entry.position - startPos
    const totalDepth = idx >= 0 && idx < depths.length ? (depths[idx] ?? 0) : 0
    if (totalDepth === 0) {
      droppedDueToZeroDepth++
      continue
    }
    if (entry.a > 0) {
      segments.push({
        position: entry.position,
        colorType: 1,
        height: entry.a / totalDepth,
      })
    }
    if (entry.c > 0) {
      segments.push({
        position: entry.position,
        colorType: 2,
        height: entry.c / totalDepth,
      })
    }
    if (entry.g > 0) {
      segments.push({
        position: entry.position,
        colorType: 3,
        height: entry.g / totalDepth,
      })
    }
    if (entry.t > 0) {
      segments.push({
        position: entry.position,
        colorType: 4,
        height: entry.t / totalDepth,
      })
    }
  }
  const filtered = segments.filter(s => s.position >= regionStart)
  const droppedDueToOutsideRegion = segments.length - filtered.length
  const colorHist = new Map<number, number>()
  for (const s of filtered) {
    colorHist.set(s.colorType, (colorHist.get(s.colorType) ?? 0) + 1)
  }
  const sample = filtered.slice(0, 5).map(s => ({
    position: s.position,
    colorType: s.colorType,
    height: Number(s.height.toFixed(3)),
  }))
  return {
    count: filtered.length,
    colorHist,
    droppedDueToZeroDepth,
    droppedDueToOutsideRegion,
    sampleSegments: sample,
  }
}

function summarize(features: ServerFeature[]) {
  const csCount = features.filter(f => f.cs).length
  const subCount = features.reduce(
    (n, f) => n + (f.cs?.match(/\*/g)?.length ?? 0),
    0,
  )
  return {
    features: features.length,
    withCs: csCount,
    subOps: subCount,
    firstFew: features.slice(0, 3).map(f => ({
      genome: f.queryGenome,
      start: f.start,
      end: f.end,
      strand: f.strand,
      identity: Number(f.identity.toFixed(4)),
      featureId: f.featureId,
      csLen: f.cs?.length ?? 0,
      csHead: f.cs?.slice(0, 80),
    })),
  }
}

function runPipeline(features: ServerFeature[]) {
  const coverageFeatures = features.map(f => ({ start: f.start, end: f.end }))
  const mismatches: Mismatch[] = []
  for (const f of features) {
    if (f.cs) {
      extractMismatchesFromCs(f.cs, f.start, mismatches)
    }
  }
  const coverage = computeCoverage(coverageFeatures, REGION_START, REGION_END)
  const snp = computeSNPCoverage(mismatches, REGION_START, coverage)

  const baseHist = new Map<string, number>()
  for (const mm of mismatches) {
    const b = BASE_CODES[mm.base] ?? `0x${mm.base.toString(16)}`
    baseHist.set(b, (baseHist.get(b) ?? 0) + 1)
  }
  const minPos = mismatches.length
    ? Math.min(...mismatches.map(m => m.position))
    : NaN
  const maxPos = mismatches.length
    ? Math.max(...mismatches.map(m => m.position))
    : NaN
  const oobLow = mismatches.filter(m => m.position < REGION_START).length
  const oobHigh = mismatches.filter(m => m.position >= REGION_END).length

  return {
    mismatchCount: mismatches.length,
    mismatchBaseHist: Object.fromEntries(baseHist),
    mismatchPosRange: [minPos, maxPos],
    mismatchOOB: { low: oobLow, high: oobHigh },
    coverage: {
      depthsLen: coverage.depths.length,
      maxDepth: coverage.maxDepth,
      startPos: coverage.startPos,
      avgDepth:
        coverage.depths.length > 0
          ? Number(
              (
                coverage.depths.reduce((a, b) => a + b, 0) /
                coverage.depths.length
              ).toFixed(2),
            )
          : 0,
    },
    snp: {
      count: snp.count,
      colorHist: Object.fromEntries(snp.colorHist),
      droppedDueToZeroDepth: snp.droppedDueToZeroDepth,
      droppedDueToOutsideRegion: snp.droppedDueToOutsideRegion,
      sample: snp.sampleSegments,
    },
  }
}

async function main() {
  const proc = spawn('node', ['--experimental-strip-types', SERVER], {
    env: {
      ...process.env,
      PORT: String(PORT),
      GRAPH_SERVER_DATASETS: DATASETS,
    },
    cwd: REPO,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout.on('data', d => process.stdout.write(`[server] ${d}`))
  proc.stderr.on('data', d => process.stderr.write(`[server-err] ${d}`))
  let killed = false
  process.on('exit', () => {
    if (!killed) {
      proc.kill()
    }
  })

  const base = `http://127.0.0.1:${PORT}/api/v0`
  for (let i = 0; i < 60; i++) {
    await sleep(100)
    try {
      const r = await fetch(`${base}/health`)
      if (r.ok) {
        break
      }
    } catch {
      // still booting
    }
  }

  try {
    const synR = await fetch(`${base}/datasets/volvox/synteny`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refName: REF_NAME,
        start: REGION_START,
        end: REGION_END,
        genome: GENOME,
      }),
    })
    const synJson = (await synR.json()) as { features: ServerFeature[] }
    const features = synJson.features
    console.log('\n=== ON-WIRE FEATURES ===')
    console.log(JSON.stringify(summarize(features), null, 2))

    console.log('\n=== PIPELINE RESULT ===')
    console.log(JSON.stringify(runPipeline(features), null, 2))

    // Per-genome breakdown: how many features per query genome and what their
    // combined ref span is. Helps catch missing-region bugs where some samples
    // emit features only for a sub-range of ctgA:1-50001.
    const perGenome = new Map<
      string,
      { count: number; minStart: number; maxEnd: number; withCs: number }
    >()
    for (const f of features) {
      let e = perGenome.get(f.queryGenome)
      if (!e) {
        e = { count: 0, minStart: Infinity, maxEnd: -Infinity, withCs: 0 }
        perGenome.set(f.queryGenome, e)
      }
      e.count++
      e.minStart = Math.min(e.minStart, f.start)
      e.maxEnd = Math.max(e.maxEnd, f.end)
      if (f.cs) {
        e.withCs++
      }
    }
    console.log('\n=== PER-GENOME COVERAGE ===')
    const rows: [string, number, number, number, number][] = []
    for (const [g, e] of perGenome) {
      rows.push([g, e.count, e.minStart, e.maxEnd, e.withCs])
    }
    rows.sort((a, b) => a[0].localeCompare(b[0]))
    console.log(
      'genome'.padEnd(14) +
        'count'.padStart(6) +
        'minStart'.padStart(10) +
        'maxEnd'.padStart(10) +
        'withCs'.padStart(8),
    )
    for (const [g, c, s, e, cs] of rows) {
      console.log(
        g.padEnd(14) +
          String(c).padStart(6) +
          String(s).padStart(10) +
          String(e).padStart(10) +
          String(cs).padStart(8),
      )
    }
  } finally {
    killed = true
    proc.kill()
  }
}

main().catch(e => {
  console.error('FAIL', e)
  process.exit(1)
})
