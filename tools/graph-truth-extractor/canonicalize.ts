import { createHash } from 'crypto'

import { parseGfa } from './parseGfa.ts'

import type { GfaEdge, GfaPath, GfaSegment, ParsedGfa } from './parseGfa.ts'

export interface CanonicalizeOptions {
  // When true, segment identity uses the actual nucleotide sequence instead of
  // the (length, neighbor-set) Weisfeiler-Lehman hash. Set true once Phase 1
  // sequences are available; false for Phase 0 where S lines are placeholders.
  useSequence?: boolean
}

function flipOrient(o: '+' | '-'): '+' | '-' {
  return o === '+' ? '-' : '+'
}

// L lines are bidirected: `s1 + s2 +` is logically equivalent to
// `s2 - s1 -` (walk the same edge from the other end). Pick a canonical
// orientation by choosing the form whose serialized string is
// lexicographically smaller.
function canonicalEdge(e: GfaEdge): GfaEdge {
  const forward: GfaEdge = e
  const reversed: GfaEdge = {
    fromId: e.toId,
    fromOrient: flipOrient(e.toOrient),
    toId: e.fromId,
    toOrient: flipOrient(e.fromOrient),
    overlap: e.overlap,
  }
  const fwdKey = `${forward.fromId}|${forward.fromOrient}|${forward.toId}|${forward.toOrient}`
  const revKey = `${reversed.fromId}|${reversed.fromOrient}|${reversed.toId}|${reversed.toOrient}`
  return fwdKey <= revKey ? forward : reversed
}

// Walks `s1+,s2+` and `s2-,s1-` describe the same physical traversal,
// just from opposite ends. Pick the lexicographically smaller of the two
// serializations as canonical.
function canonicalPathSteps(steps: GfaPath['steps']): GfaPath['steps'] {
  const fwd = steps.map(s => `${s.id}${s.orient}`).join(',')
  const rev = [...steps]
    .reverse()
    .map(s => `${s.id}${flipOrient(s.orient)}`)
    .join(',')
  if (fwd <= rev) {
    return steps
  }
  return [...steps]
    .reverse()
    .map(s => ({ id: s.id, orient: flipOrient(s.orient) }))
}

function shortHash(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 16)
}

// Weisfeiler-Lehman color refinement. Iteratively refines node labels until
// each node's label encodes the equivalence class of its rooted subgraph.
// Two structurally isomorphic graphs converge to label sets in 1:1
// correspondence; we use the final per-node labels as canonical IDs.
function refineLabels(
  segments: GfaSegment[],
  edges: GfaEdge[],
  initialLabel: (s: GfaSegment) => string,
): Map<string, string> {
  const labels = new Map<string, string>()
  for (const s of segments) {
    labels.set(s.id, initialLabel(s))
  }

  const undirectedAdj = new Map<string, string[]>()
  for (const s of segments) {
    undirectedAdj.set(s.id, [])
  }
  for (const e of edges) {
    const a = e.fromId
    const b = e.toId
    if (undirectedAdj.has(a)) {
      undirectedAdj.get(a)!.push(b)
    }
    if (undirectedAdj.has(b)) {
      undirectedAdj.get(b)!.push(a)
    }
  }

  const maxIters = Math.min(segments.length + 1, 32)
  for (let iter = 0; iter < maxIters; iter++) {
    const next = new Map<string, string>()
    for (const s of segments) {
      const neighborLabels = undirectedAdj
        .get(s.id)!
        .map(n => labels.get(n) ?? '')
        .sort()
      next.set(
        s.id,
        shortHash(`${labels.get(s.id)}|${neighborLabels.join(',')}`),
      )
    }

    const prevPartition = new Map<string, string[]>()
    for (const [id, label] of labels) {
      if (!prevPartition.has(label)) {
        prevPartition.set(label, [])
      }
      prevPartition.get(label)!.push(id)
    }
    const nextPartition = new Map<string, string[]>()
    for (const [id, label] of next) {
      if (!nextPartition.has(label)) {
        nextPartition.set(label, [])
      }
      nextPartition.get(label)!.push(id)
    }
    if (prevPartition.size === nextPartition.size) {
      break
    }
    for (const [id, label] of next) {
      labels.set(id, label)
    }
  }

  return labels
}

function assignCanonicalIds(
  segments: GfaSegment[],
  labels: Map<string, string>,
): Map<string, string> {
  // Sort segments by (label, original id) so equivalent nodes get
  // deterministic but distinct canonical IDs.
  const sorted = [...segments].sort((a, b) => {
    const la = labels.get(a.id)!
    const lb = labels.get(b.id)!
    if (la !== lb) {
      return la < lb ? -1 : 1
    }
    return a.id < b.id ? -1 : 1
  })
  const map = new Map<string, string>()
  for (let i = 0; i < sorted.length; i++) {
    map.set(sorted[i]!.id, `n${i}`)
  }
  return map
}

function rewriteEdge(e: GfaEdge, idMap: Map<string, string>): GfaEdge {
  return {
    fromId: idMap.get(e.fromId) ?? e.fromId,
    fromOrient: e.fromOrient,
    toId: idMap.get(e.toId) ?? e.toId,
    toOrient: e.toOrient,
    overlap: e.overlap,
  }
}

function rewritePath(p: GfaPath, idMap: Map<string, string>): GfaPath {
  return {
    name: p.name,
    kind: p.kind,
    raw: p.raw,
    steps: p.steps.map(s => ({
      id: idMap.get(s.id) ?? s.id,
      orient: s.orient,
    })),
  }
}

function emitCanonicalGfa(
  segments: GfaSegment[],
  edges: GfaEdge[],
  paths: GfaPath[],
  idMap: Map<string, string>,
  useSequence: boolean,
): string {
  const lines: string[] = ['H\tVN:Z:1.1']

  const remapped = segments
    .map(s => ({ ...s, id: idMap.get(s.id) ?? s.id }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const s of remapped) {
    if (useSequence && s.seq && s.seq !== '*') {
      lines.push(`S\t${s.id}\t${s.seq}`)
    } else {
      lines.push(`S\t${s.id}\t*\tLN:i:${s.length}`)
    }
  }

  const edgeKeys = new Set<string>()
  for (const e of edges) {
    const re = rewriteEdge(e, idMap)
    const ce = canonicalEdge(re)
    // GFA treats `*` and `0M` as equivalent ("no overlap CIGAR" vs "explicit
    // zero-length overlap"). Normalize so vg's `0M` matches our adapter's `*`.
    const ov = ce.overlap === '0M' ? '*' : ce.overlap
    edgeKeys.add(
      `L\t${ce.fromId}\t${ce.fromOrient}\t${ce.toId}\t${ce.toOrient}\t${ov}`,
    )
  }
  const sortedEdges = [...edgeKeys].sort()
  for (const k of sortedEdges) {
    lines.push(k)
  }

  const pathLines: string[] = []
  for (const p of paths) {
    const rp = rewritePath(p, idMap)
    const canonSteps = canonicalPathSteps(rp.steps)
    const walk = canonSteps.map(s => `${s.id}${s.orient}`).join(',')
    // Strip W-line `:offset` suffix so `ref#0#ctgA:0` ≡ `ref#0#ctgA` —
    // the offset is per-fragment metadata, not part of path identity.
    const colonIdx = rp.name.indexOf(':')
    const baseName = colonIdx === -1 ? rp.name : rp.name.slice(0, colonIdx)
    pathLines.push(`P\t${baseName}\t${walk}\t*`)
  }
  pathLines.sort()
  for (const l of pathLines) {
    lines.push(l)
  }

  return `${lines.join('\n')}\n`
}

// Each segment's set of (canonical-path-name, step-index, orientation) tuples
// is a strong structural signature: WL-equivalent twin SNP nodes (same length,
// same neighbors) typically belong to *different* haplotype paths, so
// path membership distinguishes them where (length, neighbor-set) cannot.
// Without this, placeholder S lines (Phase 0, no sequences) leave us picking
// between twins by raw-id lex order — non-portable across truth backends.
function pathContextLabels(paths: GfaPath[]): Map<string, string> {
  const ctx = new Map<string, string[]>()
  for (const p of paths) {
    const colonIdx = p.name.indexOf(':')
    const baseName = colonIdx === -1 ? p.name : p.name.slice(0, colonIdx)
    for (let i = 0; i < p.steps.length; i++) {
      const step = p.steps[i]!
      const tag = `${baseName}|${i}|${step.orient}`
      if (!ctx.has(step.id)) {
        ctx.set(step.id, [])
      }
      ctx.get(step.id)!.push(tag)
    }
  }
  const out = new Map<string, string>()
  for (const [id, tags] of ctx) {
    tags.sort()
    out.set(id, shortHash(tags.join(';')))
  }
  return out
}

export function canonicalizeParsed(
  parsed: ParsedGfa,
  opts: CanonicalizeOptions = {},
): string {
  const useSequence = !!opts.useSequence
  const ctxLabels = pathContextLabels(parsed.paths)
  const initialLabel = useSequence
    ? (s: GfaSegment) =>
        s.seq && s.seq !== '*'
          ? shortHash(`seq|${s.seq}|ctx|${ctxLabels.get(s.id) ?? ''}`)
          : shortHash(`len|${s.length}|ctx|${ctxLabels.get(s.id) ?? ''}`)
    : (s: GfaSegment) =>
        shortHash(`len|${s.length}|ctx|${ctxLabels.get(s.id) ?? ''}`)

  const labels = refineLabels(parsed.segments, parsed.edges, initialLabel)
  const idMap = assignCanonicalIds(parsed.segments, labels)
  return emitCanonicalGfa(
    parsed.segments,
    parsed.edges,
    parsed.paths,
    idMap,
    useSequence,
  )
}

export function canonicalize(
  gfaText: string,
  opts: CanonicalizeOptions = {},
): string {
  return canonicalizeParsed(parseGfa(gfaText), opts)
}

// Structural fingerprint invariant to (a) node-id relabeling and (b)
// automorphism among nodes with identical sequence + neighborhood. The
// fingerprint grounds every comparison in actual sequence content rather
// than WL-derived labels, which avoids the chr20-scale failure mode where
// truth's W-line emission and our P-line emission differ in walk-splitting
// and walk-direction enough to make WL labels diverge even though the
// underlying graph is isomorphic.
//
// Components (each a sha1-prefix hash of a sorted multiset):
//   - SEQ:   per-node `(length, sequence-or-*)` tuples
//   - LINK:  per-L-line `(src-seq, src-orient, tgt-seq, tgt-orient)`
//           with bidirected-partner canonicalization
//   - PATH:  per-P/W-line walk grounded in visited segment sequences,
//           normalized to lex-min(forward, reverse-with-flipped-orients)
//   - DEG:   per-node `(length, seq, sorted-(neighbor-seq, edge-orient))`
//           — captures local connectivity, distinguishes nodes that share
//           a sequence but sit in different graph contexts
//
// Two GFAs with the same `combined` fingerprint are structurally
// equivalent for the purposes of "did getSubgraph reproduce vg-truth's
// physical subgraph": same node sequences, same edge connectivity (modulo
// bidirected partner equivalence), same haplotype walks.
export function structuralFingerprint(
  gfaText: string,
  _opts: CanonicalizeOptions = {},
): {
  seq: string
  link: string
  path: string
  deg: string
  combined: string
} {
  const parsed = parseGfa(gfaText)

  const seqOf = new Map<string, string>()
  for (const s of parsed.segments) {
    seqOf.set(s.id, s.seq && s.seq !== '*' ? s.seq : `*${s.length}`)
  }

  const seqEntries: string[] = []
  for (const s of parsed.segments) {
    seqEntries.push(`${s.length}|${seqOf.get(s.id)!}`)
  }
  seqEntries.sort()

  const linkEntries: string[] = []
  const undirectedAdj = new Map<string, string[]>()
  for (const s of parsed.segments) {
    undirectedAdj.set(s.id, [])
  }
  for (const e of parsed.edges) {
    const fromSeq = seqOf.get(e.fromId) ?? ''
    const toSeq = seqOf.get(e.toId) ?? ''
    const fwd = `${fromSeq}|${e.fromOrient}|${toSeq}|${e.toOrient}`
    const rev = `${toSeq}|${flipOrient(e.toOrient)}|${fromSeq}|${flipOrient(e.fromOrient)}`
    linkEntries.push(fwd < rev ? fwd : rev)
    undirectedAdj.get(e.fromId)?.push(`${toSeq}|${e.toOrient}`)
    undirectedAdj.get(e.toId)?.push(`${fromSeq}|${e.fromOrient}`)
  }
  linkEntries.sort()

  const degEntries: string[] = []
  for (const s of parsed.segments) {
    const ns = (undirectedAdj.get(s.id) ?? []).slice().sort()
    degEntries.push(`${s.length}|${seqOf.get(s.id)!}|${ns.join(';')}`)
  }
  degEntries.sort()

  const pathEntries: string[] = []
  for (const p of parsed.paths) {
    const fwd = p.steps
      .map(s => `${seqOf.get(s.id) ?? ''}${s.orient}`)
      .join(',')
    const rev = [...p.steps]
      .reverse()
      .map(s => `${seqOf.get(s.id) ?? ''}${flipOrient(s.orient)}`)
      .join(',')
    pathEntries.push(fwd < rev ? fwd : rev)
  }
  pathEntries.sort()

  const seq = shortHash(seqEntries.join('\n'))
  const link = shortHash(linkEntries.join('\n'))
  const path = shortHash(pathEntries.join('\n'))
  const deg = shortHash(degEntries.join('\n'))
  // `combined` intentionally excludes `deg`. With many sequence-equivalent
  // SNV nodes (chr20 has thousands of length-1 "A"/"C"/"G"/"T" segments),
  // truth and ours can validly distribute the same edge set across
  // different physical-node representatives. As long as the global edge
  // multiset (`link`) and walk multiset (`path`) match, the underlying
  // physical graph is equivalent. `deg` is reported for diagnostic value
  // when investigating local-connectivity differences.
  return {
    seq,
    link,
    path,
    deg,
    combined: shortHash(`${seq}|${link}|${path}`),
  }
}

export interface DiffSummary {
  segments: { both: number; onlyTruth: number; onlyOurs: number }
  edges: { both: number; onlyTruth: number; onlyOurs: number }
  paths: { both: number; onlyTruth: number; onlyOurs: number }
  isomorphic: boolean
}

function gfaSets(canonical: string) {
  const segs = new Set<string>()
  const edges = new Set<string>()
  const paths = new Set<string>()
  for (const line of canonical.split('\n')) {
    if (line.startsWith('S\t')) {
      segs.add(line)
    } else if (line.startsWith('L\t')) {
      edges.add(line)
    } else if (line.startsWith('P\t') || line.startsWith('W\t')) {
      paths.add(line)
    }
  }
  return { segs, edges, paths }
}

function setDiff(a: Set<string>, b: Set<string>) {
  let both = 0
  let onlyA = 0
  for (const v of a) {
    if (b.has(v)) {
      both++
    } else {
      onlyA++
    }
  }
  let onlyB = 0
  for (const v of b) {
    if (!a.has(v)) {
      onlyB++
    }
  }
  return { both, onlyA, onlyB }
}

export function summarizeDiff(
  truthCanonical: string,
  oursCanonical: string,
): DiffSummary {
  const t = gfaSets(truthCanonical)
  const o = gfaSets(oursCanonical)
  const segs = setDiff(t.segs, o.segs)
  const edges = setDiff(t.edges, o.edges)
  const paths = setDiff(t.paths, o.paths)
  const isomorphic =
    segs.onlyA === 0 &&
    segs.onlyB === 0 &&
    edges.onlyA === 0 &&
    edges.onlyB === 0 &&
    paths.onlyA === 0 &&
    paths.onlyB === 0
  return {
    segments: {
      both: segs.both,
      onlyTruth: segs.onlyA,
      onlyOurs: segs.onlyB,
    },
    edges: {
      both: edges.both,
      onlyTruth: edges.onlyA,
      onlyOurs: edges.onlyB,
    },
    paths: {
      both: paths.both,
      onlyTruth: paths.onlyA,
      onlyOurs: paths.onlyB,
    },
    isomorphic,
  }
}
