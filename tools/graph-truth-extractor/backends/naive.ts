import fs from 'fs'

import { parseGfa } from '../parseGfa.ts'

import type { GfaEdge, GfaPath, GfaSegment, ParsedGfa } from '../parseGfa.ts'
import type { ExtractRequest, ExtractResult } from './types.ts'

function buildAdj(parsed: ParsedGfa): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  for (const s of parsed.segments) {
    adj.set(s.id, new Set())
  }
  for (const e of parsed.edges) {
    if (adj.has(e.fromId)) {
      adj.get(e.fromId)!.add(e.toId)
    }
    if (adj.has(e.toId)) {
      adj.get(e.toId)!.add(e.fromId)
    }
  }
  return adj
}

// Walk the named path, accumulating cumulative coordinates so we can find
// the segments overlapping [start,end). Returns the seed segment IDs.
function findSeedSegments(
  parsed: ParsedGfa,
  pathName: string,
  start: number,
  end: number,
  segLenById: Map<string, number>,
): string[] {
  // Match by exact name, then by W-line stem (`name:offset`) — both
  // sequencetubemap-tabix's pgtabix.py and our parseGfa append `:offset`
  // when a W-line is encountered.
  let path = parsed.paths.find(p => p.name === pathName)
  if (!path) {
    path = parsed.paths.find(p => p.name.startsWith(pathName + ':'))
  }
  if (!path) {
    throw new Error(
      `Path not found in GFA: ${pathName}. Available: ${parsed.paths
        .slice(0, 5)
        .map(p => p.name)
        .join(', ')}${parsed.paths.length > 5 ? ', ...' : ''}`,
    )
  }
  const seeds: string[] = []
  let pos = 0
  for (const step of path.steps) {
    const len = segLenById.get(step.id) ?? 0
    const segEnd = pos + len
    if (segEnd > start && pos < end) {
      seeds.push(step.id)
    }
    pos = segEnd
  }
  return seeds
}

function bfsExpand(
  seeds: string[],
  adj: Map<string, Set<string>>,
  context: number,
): Set<string> {
  const visited = new Set<string>(seeds)
  let frontier = new Set<string>(seeds)
  for (let step = 0; step < context; step++) {
    const next = new Set<string>()
    for (const id of frontier) {
      const neighbors = adj.get(id)
      if (!neighbors) {
        continue
      }
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n)
          next.add(n)
        }
      }
    }
    if (next.size === 0) {
      break
    }
    frontier = next
  }
  return visited
}

function emitSubgraph(
  segments: GfaSegment[],
  edges: GfaEdge[],
  paths: GfaPath[],
  keep: Set<string>,
): string {
  const lines: string[] = ['H\tVN:Z:1.1']
  for (const s of segments) {
    if (!keep.has(s.id)) {
      continue
    }
    if (s.seq && s.seq !== '*') {
      lines.push(`S\t${s.id}\t${s.seq}`)
    } else {
      lines.push(`S\t${s.id}\t*\tLN:i:${s.length}`)
    }
  }
  for (const e of edges) {
    if (keep.has(e.fromId) && keep.has(e.toId)) {
      lines.push(
        `L\t${e.fromId}\t${e.fromOrient}\t${e.toId}\t${e.toOrient}\t${e.overlap}`,
      )
    }
  }
  for (const p of paths) {
    const sub: { id: string; orient: '+' | '-' }[] = []
    for (const step of p.steps) {
      if (keep.has(step.id)) {
        sub.push(step)
      } else if (sub.length > 0) {
        const walk = sub.map(s => `${s.id}${s.orient}`).join(',')
        lines.push(`P\t${p.name}\t${walk}\t*`)
        sub.length = 0
      }
    }
    if (sub.length > 0) {
      const walk = sub.map(s => `${s.id}${s.orient}`).join(',')
      lines.push(`P\t${p.name}\t${walk}\t*`)
    }
  }
  return lines.join('\n') + '\n'
}

export async function naiveBackend(
  req: ExtractRequest,
): Promise<ExtractResult> {
  const t0 = Date.now()
  const text = fs.readFileSync(req.gfaPath, 'utf8')
  const parsed = parseGfa(text)
  const segLen = new Map<string, number>()
  for (const s of parsed.segments) {
    segLen.set(s.id, s.length)
  }
  const ctx = req.context === 'snarl' ? 1 : req.context
  const seeds = findSeedSegments(
    parsed,
    req.pathName,
    req.start,
    req.end,
    segLen,
  )
  const adj = buildAdj(parsed)
  const keep = bfsExpand(seeds, adj, ctx)
  const gfa = emitSubgraph(parsed.segments, parsed.edges, parsed.paths, keep)
  const elapsedMs = Date.now() - t0

  let segCount = 0
  let edgeCount = 0
  let pathCount = 0
  for (const line of gfa.split('\n')) {
    if (line.startsWith('S\t')) {
      segCount++
    } else if (line.startsWith('L\t')) {
      edgeCount++
    } else if (line.startsWith('P\t') || line.startsWith('W\t')) {
      pathCount++
    }
  }

  return {
    gfa,
    segmentCount: segCount,
    edgeCount: edgeCount,
    pathCount: pathCount,
    elapsedMs,
    backendVersion: 'naive/v1',
    notes: `naive BFS context=${ctx}, ${seeds.length} seeds, ${keep.size} kept`,
  }
}
