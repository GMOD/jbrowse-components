import { getEdgesForOrdinals, orientChar } from './gfaBinaryIO.ts'
import { canonicalLinkKey, parsePanSn } from './gfaEmitHelpers.ts'

import type { EdgeRecord, IndexedBinaryShard } from './gfaBinaryIO.ts'

// Reference prototype for megabase-scale coarsening.
//
// **Status:** prototype — the production form of this algorithm lives (will
// live) in `tools/gfa-to-tabix` (Rust), emitting a static-file tile pyramid
// (`prefix.tiles.<stride>.bin` etc.) consumed by pure tabix lookups at
// runtime. Per the user's static-file steer in `agent-docs/GRAPH_PLAN.md`,
// the runtime should not be re-deriving topology on every query. This file
// is kept as (a) the reference algorithm the Rust port matches against,
// (b) a fallback for graphs that lack precomputed tile files, and (c)
// the unblock for the chr20 demo until the static path lands.
//
// Used by `getSubgraph` for regions where per-segment GFA emission collapses
// on its own weight (chr20 1 Mbp ≈ 219 K subwalks; 5 Mbp ≈ 434 K). Walks the
// reference path's segments along the queried region, collapses linear runs
// into super-segments, detects bubbles via edge fanout, and either drops alt
// segs (small bubbles) or preserves the alt-walk explicitly (large bubbles).
// The threshold scales with region size so the same builder serves 100 kb
// and 100 Mbp queries.
//
// Trade-offs (intentional at this scale):
//   - Sequences are placeholder (`*` + `LN:i:`); the renderer doesn't display
//     per-base detail at megabase zoom anyway.
//   - Only the reference path is emitted as a W-line. Other paths' walks
//     through the coarsened structure are out of scope for v1.
//   - The alt-walk explorer uses bounded BFS into alt branches; pathological
//     topologies (deep dead-ends, cycles) hit the cap and the bubble is
//     conservatively *collapsed* (no partial alt-walk emission) — keeping
//     the output graph fully connected.
//
// Out-of-scope (deferred to Rust port + Phase 4):
//   - Snarl-boundary expansion via `prefix.snarls.bed.gz` (Phase 4).
//   - Tile-pyramid level dispatch (`tiles.10k`/`tiles.100k`/`tiles.1m`).
//   - Per-haplotype thinning at low zoom.

interface SuperSegment {
  id: string
  totalLen: number
  segCount: number
  refSegs: number[]
}

interface PreservedBubble {
  // segOrds visited along alt branches.
  altSegs: Set<number>
  altSegLens: Map<number, number>
  // ref-allele segments between (refBefore, refAfter) on the ref path,
  // emitted as their own S-lines so the ref-path W-line can traverse them.
  refAllele: number[]
}

const MAX_BFS_DEPTH = 8
const MAX_BUBBLE_SEGS = 256

interface BfsResult {
  reconvergeIdx: number // -1 if not found
  maxAltLen: number
  altSegs: Set<number>
  altSegLens: Map<number, number>
  capHit: boolean
}

// BFS forward through alt edges starting from each first-hop alt segment.
// Returns:
//   reconvergeIdx — the largest viewportRefOrd index any alt branch reaches,
//     or -1 if none reach a future ref segment.
//   maxAltLen     — sum of segment lengths along the longest alt path observed
//     (used by the threshold decision).
//   altSegs       — every non-ref segment ord visited.
//   capHit        — true if the depth or segment cap fired before exhausting
//     the frontier; signals "topology too complex to represent" at this zoom.
async function exploreBubble(
  cur: number,
  refOrdToIdx: Map<number, number>,
  curRefIdx: number,
  edgeShard: IndexedBinaryShard,
  refEdges: Map<number, EdgeRecord[]>,
): Promise<BfsResult> {
  const altSegs = new Set<number>()
  const altSegLens = new Map<number, number>()
  const visited = new Set<number>([cur])
  let reconvergeIdx = -1
  let maxAltLen = 0
  let capHit = false

  // Seed the frontier from cur's alt-edges. Edges to cur (self-loops) and
  // edges to the immediate next ref are not bubble entries.
  const next = curRefIdx + 1
  const nextOrd = next < refOrdToIdx.size ? findOrdAtIdx(refOrdToIdx, next) : -1
  let frontier: { ord: number; accLen: number }[] = []
  for (const e of refEdges.get(cur) ?? []) {
    if (e.targetOrd === cur || e.targetOrd === nextOrd) {
      continue
    }
    if (refOrdToIdx.has(e.targetOrd)) {
      const idx = refOrdToIdx.get(e.targetOrd)!
      if (idx > curRefIdx && idx > reconvergeIdx) {
        reconvergeIdx = idx
      }
      continue
    }
    if (visited.has(e.targetOrd)) {
      continue
    }
    visited.add(e.targetOrd)
    altSegs.add(e.targetOrd)
    altSegLens.set(e.targetOrd, e.tgtLen)
    if (e.tgtLen > maxAltLen) {
      maxAltLen = e.tgtLen
    }
    frontier.push({ ord: e.targetOrd, accLen: e.tgtLen })
  }

  for (
    let depth = 0;
    depth < MAX_BFS_DEPTH && frontier.length > 0;
    depth++
  ) {
    if (altSegs.size >= MAX_BUBBLE_SEGS) {
      capHit = true
      break
    }
    const ords = frontier.map(f => f.ord)
    const fetched = await getEdgesForOrdinals(edgeShard, ords)
    const nextFrontier: { ord: number; accLen: number }[] = []
    for (const f of frontier) {
      for (const e of fetched.get(f.ord) ?? []) {
        if (visited.has(e.targetOrd)) {
          continue
        }
        visited.add(e.targetOrd)
        if (refOrdToIdx.has(e.targetOrd)) {
          const idx = refOrdToIdx.get(e.targetOrd)!
          if (idx > curRefIdx && idx > reconvergeIdx) {
            reconvergeIdx = idx
          }
          const accLen = f.accLen
          if (accLen > maxAltLen) {
            maxAltLen = accLen
          }
          continue
        }
        if (altSegs.size >= MAX_BUBBLE_SEGS) {
          capHit = true
          continue
        }
        altSegs.add(e.targetOrd)
        altSegLens.set(e.targetOrd, e.tgtLen)
        const newAccLen = f.accLen + e.tgtLen
        if (newAccLen > maxAltLen) {
          maxAltLen = newAccLen
        }
        nextFrontier.push({ ord: e.targetOrd, accLen: newAccLen })
      }
    }
    if (depth + 1 === MAX_BFS_DEPTH && nextFrontier.length > 0) {
      capHit = true
    }
    frontier = nextFrontier
  }

  return { reconvergeIdx, maxAltLen, altSegs, altSegLens, capHit }
}

// Reverse-lookup helper since refOrdToIdx is keyed by ord. Only called once
// per bubble entry, so a linear scan is fine relative to the BFS cost.
function findOrdAtIdx(refOrdToIdx: Map<number, number>, idx: number) {
  for (const [ord, i] of refOrdToIdx) {
    if (i === idx) {
      return ord
    }
  }
  return -1
}

function finishRun(
  run: { totalLen: number; refSegs: number[] },
  superSegs: SuperSegment[],
) {
  if (run.refSegs.length === 0) {
    return
  }
  superSegs.push({
    id: `super_${superSegs.length}`,
    totalLen: run.totalLen,
    segCount: run.refSegs.length,
    refSegs: [...run.refSegs],
  })
}

// Build the unified ord → output-ID remap and emit the full coarsened GFA
// (S/L/W lines). All edges that cross output-IDs become L-lines; intra-
// super-segment edges (the "collapsed" majority) are dropped.
function emitCoarsenedGfa(
  superSegs: SuperSegment[],
  bubbles: (PreservedBubble | undefined)[],
  segLens: Map<number, number>,
  refEdges: Map<number, EdgeRecord[]>,
  altEdges: Map<number, EdgeRecord[]>,
  refPathName: string,
) {
  const lines: string[] = ['H\tVN:Z:1.1']

  // ord → output-ID. Ref ordinals collapsed inside a super-segment map to
  // that super-segment's ID; alt-segs and ref-allele segs map to `s<ord>`.
  const ordToOutput = new Map<number, string>()
  for (const ss of superSegs) {
    for (const ord of ss.refSegs) {
      ordToOutput.set(ord, ss.id)
    }
  }
  const altSegOrds = new Set<number>()
  for (const b of bubbles) {
    if (!b) {
      continue
    }
    for (const ord of b.altSegs) {
      ordToOutput.set(ord, `s${ord}`)
      altSegOrds.add(ord)
    }
    for (const ord of b.refAllele) {
      ordToOutput.set(ord, `s${ord}`)
      altSegOrds.add(ord)
    }
  }

  // S lines: super-segments first, then alt/ref-allele segs (deduped).
  for (const ss of superSegs) {
    lines.push(`S\t${ss.id}\t*\tLN:i:${ss.totalLen}\tSC:i:${ss.segCount}`)
  }
  const emittedAlt = new Set<number>()
  for (const b of bubbles) {
    if (!b) {
      continue
    }
    for (const ord of b.altSegs) {
      if (emittedAlt.has(ord)) {
        continue
      }
      emittedAlt.add(ord)
      const len = b.altSegLens.get(ord) ?? segLens.get(ord) ?? 0
      lines.push(`S\ts${ord}\t*\tLN:i:${len}`)
    }
    for (const ord of b.refAllele) {
      if (emittedAlt.has(ord)) {
        continue
      }
      emittedAlt.add(ord)
      const len = segLens.get(ord) ?? 0
      lines.push(`S\ts${ord}\t*\tLN:i:${len}`)
    }
  }

  // L lines: walk every available edge (refEdges from the ref-path scan +
  // altEdges discovered during bubble BFS). Skip intra-super edges. Canonical
  // form deduplicates bidirected partners.
  const linkSet = new Set<string>()
  const addEdge = (src: number, e: EdgeRecord) => {
    const srcId = ordToOutput.get(src)
    const tgtId = ordToOutput.get(e.targetOrd)
    if (!srcId || !tgtId || srcId === tgtId) {
      return
    }
    linkSet.add(
      canonicalLinkKey(srcId, orientChar(e.srcOrient), tgtId, orientChar(e.tgtOrient)),
    )
  }
  for (const [src, edges] of refEdges) {
    for (const e of edges) {
      addEdge(src, e)
    }
  }
  for (const [src, edges] of altEdges) {
    for (const e of edges) {
      addEdge(src, e)
    }
  }
  // Adjacent-super-segment fallback links: if two super-segments are
  // consecutive without a bubble between them and no edge in refEdges
  // crosses (rare but possible if the boundary segment's edges weren't
  // fetched), synthesize a forward link so the graph stays connected.
  for (let i = 0; i + 1 < superSegs.length; i++) {
    if (bubbles[i]) {
      continue
    }
    const a = superSegs[i]!
    const b = superSegs[i + 1]!
    linkSet.add(canonicalLinkKey(a.id, '+', b.id, '+'))
  }
  for (const k of linkSet) {
    lines.push(`L\t${k}\t*`)
  }

  // W line for the reference path. Walks super_0 → bubble_0 ref-allele →
  // super_1 → bubble_1 ref-allele → ... → super_N. Trailing bubbles (no
  // super-segment after) emit their refAllele if any; otherwise nothing.
  const walkParts: string[] = []
  let totalWalkLen = 0
  for (let i = 0; i < superSegs.length; i++) {
    const ss = superSegs[i]!
    walkParts.push(`>${ss.id}`)
    totalWalkLen += ss.totalLen
    const b = bubbles[i]
    if (b) {
      for (const ord of b.refAllele) {
        walkParts.push(`>s${ord}`)
        totalWalkLen += segLens.get(ord) ?? 0
      }
    }
  }
  const trailing = bubbles[superSegs.length]
  if (trailing) {
    for (const ord of trailing.refAllele) {
      walkParts.push(`>s${ord}`)
      totalWalkLen += segLens.get(ord) ?? 0
    }
  }
  if (walkParts.length > 0) {
    const { sample, hap, contig } = parsePanSn(refPathName)
    lines.push(
      `W\t${sample}\t${hap}\t${contig}\t0\t${totalWalkLen}\t${walkParts.join('')}`,
    )
  }

  return lines.join('\n')
}

export async function buildGfaCoarsened(
  viewportRefOrds: number[],
  segLens: Map<number, number>,
  edgeShard: IndexedBinaryShard,
  pathNames: string[],
  refPathIdx: number,
  bubbleThresholdBp: number,
) {
  if (viewportRefOrds.length === 0) {
    return ''
  }

  const refOrdToIdx = new Map<number, number>()
  for (let i = 0; i < viewportRefOrds.length; i++) {
    refOrdToIdx.set(viewportRefOrds[i]!, i)
  }

  // Pre-fetch all ref-segment edges in one batch — we'll need every one for
  // both the bubble walk (immediate alt-edges) and the unified L-line emit.
  const refEdges = await getEdgesForOrdinals(edgeShard, viewportRefOrds)

  const superSegs: SuperSegment[] = []
  // bubbles[i] sits between superSegs[i] and superSegs[i+1] (i.e., after
  // super_i and before super_{i+1}). bubbles[superSegs.length] is the
  // trailing-bubble slot.
  const bubbles: (PreservedBubble | undefined)[] = []
  // Edges discovered during bubble BFS that aren't already in refEdges. The
  // emit step unions these for L-line emission.
  const altEdgesAccum = new Map<number, EdgeRecord[]>()

  let currentRun: { totalLen: number; refSegs: number[] } = {
    totalLen: 0,
    refSegs: [],
  }
  let i = 0

  while (i < viewportRefOrds.length) {
    const cur = viewportRefOrds[i]!
    const curLen = segLens.get(cur) ?? 0
    const next = i + 1 < viewportRefOrds.length ? viewportRefOrds[i + 1]! : -1
    const edges = refEdges.get(cur) ?? []
    const altEdges = edges.filter(
      e => e.targetOrd !== next && e.targetOrd !== cur,
    )
    const hasAltBranch = altEdges.some(e => !refOrdToIdx.has(e.targetOrd))

    if (!hasAltBranch) {
      // Linear ref step (or only ref→ref skip-edges, which don't form a
      // multi-allelic bubble at this level of detail).
      currentRun.refSegs.push(cur)
      currentRun.totalLen += curLen
      i++
      continue
    }

    const bubble = await exploreBubble(
      cur,
      refOrdToIdx,
      i,
      edgeShard,
      refEdges,
    )

    // cur is the last ref before the bubble. Always lives in the preceding
    // super-run (boundary node, ref-path traverses it).
    currentRun.refSegs.push(cur)
    currentRun.totalLen += curLen

    // Decision: collapse vs preserve.
    //   collapse — drop all alt segs from the output, fold ref-allele
    //              segs into the running super-run.
    //   preserve — emit alt segs and ref-allele segs as separate S-lines,
    //              terminate the super-run, register the bubble.
    // BFS cap-hit topologies always collapse (we don't have enough info to
    // emit a connected partial alt-walk).
    const alt = bubble.altSegs.size > 0
    const reconverged = bubble.reconvergeIdx >= 0
    const altLargeEnough = bubble.maxAltLen >= bubbleThresholdBp
    const shouldPreserve =
      alt && reconverged && altLargeEnough && !bubble.capHit

    if (!shouldPreserve) {
      // Collapse: fold ref-allele segs into the current super-run, advance
      // past the bubble.
      const endRefIdx = reconverged ? bubble.reconvergeIdx : i + 1
      for (let j = i + 1; j < endRefIdx && j < viewportRefOrds.length; j++) {
        const ord = viewportRefOrds[j]!
        currentRun.refSegs.push(ord)
        currentRun.totalLen += segLens.get(ord) ?? 0
      }
      i = endRefIdx
      continue
    }

    // Preserve: terminate the super-run, register a bubble, jump to
    // reconvergence.
    finishRun(currentRun, superSegs)
    const refAlleleEnd = Math.min(bubble.reconvergeIdx, viewportRefOrds.length)
    const refAllele: number[] = []
    for (let j = i + 1; j < refAlleleEnd; j++) {
      refAllele.push(viewportRefOrds[j]!)
    }
    bubbles[superSegs.length - 1] = {
      altSegs: bubble.altSegs,
      altSegLens: bubble.altSegLens,
      refAllele,
    }
    // Fetch alt-segment outgoing edges so the emit pass has the full edge set
    // for the bubble interior. Done lazily here per-bubble rather than in
    // exploreBubble so the BFS stays focused on topology discovery.
    if (bubble.altSegs.size > 0) {
      const altOrds = [...bubble.altSegs]
      const altEdgeMap = await getEdgesForOrdinals(edgeShard, altOrds)
      for (const [src, edges] of altEdgeMap) {
        altEdgesAccum.set(src, edges)
      }
    }
    currentRun = { totalLen: 0, refSegs: [] }
    i = bubble.reconvergeIdx
  }

  finishRun(currentRun, superSegs)

  const refPathName = pathNames[refPathIdx] ?? 'reference'
  return emitCoarsenedGfa(
    superSegs,
    bubbles,
    segLens,
    refEdges,
    altEdgesAccum,
    refPathName,
  )
}
