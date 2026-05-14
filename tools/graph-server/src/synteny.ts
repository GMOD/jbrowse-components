import { RE_PATH_SUBWALK_COLON, parsePanSN } from './datasets.ts'

// MultiPairFeature shape compatible with what GfaTabixAdapter emits.
export interface SyntenyBlock {
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
  // Optional cs string describing how the query alt sequence differs from the
  // ref alt sequence within a bubble span. Populated only on bubble features;
  // colinear identity=1 blocks leave it undefined.
  cs?: string
}

interface NodeSeg {
  ord: number
  // signed orientation: +1 forward, -1 reverse
  orient: 1 | -1
  startInPath: number
  endInPath: number
}

interface ParsedPath {
  name: string
  genome: string
  refName: string
  // start offset in the original full-genome coordinate system, parsed from
  // the path-range suffix that odgi extract appends (e.g. "ref#0#ctgA:3957-8351").
  baseOffset: number
  segs: NodeSeg[]
}

// Parse the GFA emitted by `odgi view -g` (after `odgi extract`).
// Returns segment lengths (from S lines) keyed by node ord, and per-path
// node walks (from W or P lines) with running coordinates. Also keeps the
// per-segment sequence when present, so bubble CS strings can be derived
// without going back to a side index.
export function parseExtractedGfa(gfa: string) {
  const segLens = new Map<number, number>()
  const segSeqs = new Map<number, string>()
  const paths: ParsedPath[] = []
  for (const line of gfa.split('\n')) {
    if (line.startsWith('S\t')) {
      // S\t<id>\t<seq|*>\t[LN:i:<n>]
      const cols = line.split('\t')
      const ord = Number(cols[1])
      let len = 0
      const seq = cols[2] ?? ''
      if (seq && seq !== '*') {
        len = seq.length
        segSeqs.set(ord, seq)
      } else {
        for (let i = 3; i < cols.length; i++) {
          const f = cols[i]!
          if (f.startsWith('LN:i:')) {
            len = Number(f.slice(5))
            break
          }
        }
      }
      segLens.set(ord, len)
    } else if (line.startsWith('P\t')) {
      // P\t<name>\t<seg1+,seg2-,...>\t<overlaps>
      const cols = line.split('\t')
      const fullName = cols[1]!
      const stepsRaw = cols[2] ?? ''
      const baseName = fullName.replace(RE_PATH_SUBWALK_COLON, '')
      const m = RE_PATH_SUBWALK_COLON.exec(fullName)
      const baseOffset = m ? Number(m[1]) : 0
      const { genome, refName } = parsePanSN(baseName)
      const segs = parsePSteps(stepsRaw, segLens)
      paths.push({ name: baseName, genome, refName, baseOffset, segs })
    } else if (line.startsWith('W\t')) {
      // W\t<sample>\t<hapidx>\t<seqid>\t<start>\t<end>\t<walk>
      // vg's `vg paths -L` strips the haplotype field for hap=0 reference paths
      // (so GRCh38 appears as "GRCh38#chr20", not "GRCh38#0#chr20"). Mirror that
      // here so genome/refName tags line up with the names emitted at /setup.
      // Haplotype indices > 0 always get the full three-part PanSN name.
      const cols = line.split('\t')
      const sample = cols[1]!
      const hapIdx = cols[2]!
      const seqid = cols[3]!
      const start = Number(cols[4])
      const walk = cols[6] ?? ''
      const baseName =
        hapIdx === '0' ? `${sample}#${seqid}` : `${sample}#${hapIdx}#${seqid}`
      const { genome, refName } = parsePanSN(baseName)
      const segs = parseWWalk(walk, segLens)
      paths.push({
        name: baseName,
        genome,
        refName,
        baseOffset: start,
        segs,
      })
    }
  }
  return { segLens, segSeqs, paths }
}

function complement(b: string): string {
  if (b === 'A' || b === 'a') {
    return 'T'
  }
  if (b === 'T' || b === 't') {
    return 'A'
  }
  if (b === 'C' || b === 'c') {
    return 'G'
  }
  if (b === 'G' || b === 'g') {
    return 'C'
  }
  return 'N'
}

function revcomp(seq: string): string {
  let out = ''
  for (let i = seq.length - 1; i >= 0; i--) {
    out += complement(seq[i]!)
  }
  return out
}

function orientedSeq(
  ord: number,
  orient: 1 | -1,
  segSeqs: Map<number, string>,
) {
  const s = segSeqs.get(ord)
  if (s === undefined) {
    return undefined
  }
  return orient === 1 ? s : revcomp(s)
}

// Build a cs string describing how altQ differs from altR. cs is a
// minimap2-style tag with lowercase operators (`:N`, `*xy`, `+seq`, `-seq`).
// For same-length alt sequences this emits a position-wise diff. For
// different-length sequences it falls back to a 3-segment "match-prefix /
// indel-middle / match-suffix" encoding using the common prefix and suffix.
// Good enough for SNP visualization; full Needleman-Wunsch would be more
// accurate but is overkill for the typical <200 bp bubble.
function buildCs(altR: string, altQ: string): string {
  if (altR.length === 0 && altQ.length === 0) {
    return ''
  }
  if (altR.length === altQ.length) {
    return csFromSameLength(altR, altQ)
  }
  let prefix = 0
  const minLen = Math.min(altR.length, altQ.length)
  while (
    prefix < minLen &&
    altR.charCodeAt(prefix) === altQ.charCodeAt(prefix)
  ) {
    prefix++
  }
  let suffix = 0
  while (
    suffix < minLen - prefix &&
    altR.charCodeAt(altR.length - 1 - suffix) ===
      altQ.charCodeAt(altQ.length - 1 - suffix)
  ) {
    suffix++
  }
  const midR = altR.slice(prefix, altR.length - suffix)
  const midQ = altQ.slice(prefix, altQ.length - suffix)
  let cs = ''
  if (prefix > 0) {
    cs += `:${prefix}`
  }
  if (midR.length > 0 && midQ.length === 0) {
    cs += `-${midR.toLowerCase()}`
  } else if (midQ.length > 0 && midR.length === 0) {
    cs += `+${midQ.toLowerCase()}`
  } else if (midR.length > 0 && midQ.length > 0) {
    // Mixed indel + substitution: emit as deletion of midR then insertion of midQ
    cs += `-${midR.toLowerCase()}+${midQ.toLowerCase()}`
  }
  if (suffix > 0) {
    cs += `:${suffix}`
  }
  return cs
}

function csFromSameLength(r: string, q: string): string {
  let cs = ''
  let runMatches = 0
  for (let i = 0; i < r.length; i++) {
    if (r.charCodeAt(i) === q.charCodeAt(i)) {
      runMatches++
    } else {
      if (runMatches > 0) {
        cs += `:${runMatches}`
        runMatches = 0
      }
      cs += `*${r[i]!.toLowerCase()}${q[i]!.toLowerCase()}`
    }
  }
  if (runMatches > 0) {
    cs += `:${runMatches}`
  }
  return cs
}

// Collect oriented sequences for the path segments that fall in a
// half-open [startBp, endBp) bp range of the path. Used to extract bubble
// alt sequences between two anchor blocks. Returns undefined if any segment
// in the range has no sequence data — the bubble can't be CS-annotated then.
function concatOrientedSeq(
  segs: NodeSeg[],
  startBp: number,
  endBp: number,
  segSeqs: Map<number, string>,
): string | undefined {
  if (endBp <= startBp) {
    return ''
  }
  let out = ''
  for (const s of segs) {
    if (s.endInPath <= startBp || s.startInPath >= endBp) {
      continue
    }
    const seq = orientedSeq(s.ord, s.orient, segSeqs)
    if (seq === undefined) {
      return undefined
    }
    const localStart = Math.max(0, startBp - s.startInPath)
    const localEnd = Math.min(seq.length, endBp - s.startInPath)
    out += seq.slice(localStart, localEnd)
  }
  return out
}

function parsePSteps(
  stepsRaw: string,
  segLens: Map<number, number>,
): NodeSeg[] {
  const out: NodeSeg[] = []
  let cursor = 0
  for (const tok of stepsRaw.split(',')) {
    if (!tok) {
      continue
    }
    const last = tok[tok.length - 1]
    const orient: 1 | -1 = last === '-' ? -1 : 1
    const ordStr = last === '+' || last === '-' ? tok.slice(0, -1) : tok
    const ord = Number(ordStr)
    const len = segLens.get(ord) ?? 0
    out.push({ ord, orient, startInPath: cursor, endInPath: cursor + len })
    cursor += len
  }
  return out
}

function parseWWalk(walk: string, segLens: Map<number, number>): NodeSeg[] {
  const out: NodeSeg[] = []
  let cursor = 0
  let i = 0
  while (i < walk.length) {
    const sign = walk[i]
    if (sign !== '>' && sign !== '<') {
      i++
      continue
    }
    i++
    let j = i
    while (j < walk.length && walk[j] !== '>' && walk[j] !== '<') {
      j++
    }
    const ord = Number(walk.slice(i, j))
    const len = segLens.get(ord) ?? 0
    out.push({
      ord,
      orient: sign === '<' ? -1 : 1,
      startInPath: cursor,
      endInPath: cursor + len,
    })
    cursor += len
    i = j
  }
  return out
}

// Detect whether a query path is a reverse-complemented contig relative to
// the reference. Mirrors the gfa-to-tabix Rust tool's normalization: if >99%
// of shared bp are in the opposite orientation to the reference, the contig
// was assembled from the other strand and needs to be flipped before synteny
// block computation so it doesn't produce false strand=-1 alignments.
function isReversedContig(
  q: ParsedPath,
  refIndex: Map<number, NodeSeg[]>,
): boolean {
  let sharedBp = 0
  let oppositeBp = 0
  for (const qseg of q.segs) {
    const refSegs = refIndex.get(qseg.ord)
    if (!refSegs) {
      continue
    }
    for (const refseg of refSegs) {
      const bp = refseg.endInPath - refseg.startInPath
      sharedBp += bp
      if (refseg.orient !== qseg.orient) {
        oppositeBp += bp
      }
    }
  }
  return sharedBp > 0 && oppositeBp * 100 >= sharedBp * 99
}

// Flip a reverse-complemented path to forward orientation. Iterates segs in
// reverse order and flips each orientation, reassigning path coordinates so
// they increase monotonically from 0. After flipping, shared nodes appear in
// the same orientation as the reference path, producing strand=1 blocks.
function flipPath(p: ParsedPath): ParsedPath {
  const totalLen = p.segs.length > 0 ? p.segs[p.segs.length - 1]!.endInPath : 0
  const flippedSegs: NodeSeg[] = []
  for (let i = p.segs.length - 1; i >= 0; i--) {
    const seg = p.segs[i]!
    flippedSegs.push({
      ord: seg.ord,
      orient: seg.orient === 1 ? -1 : 1,
      startInPath: totalLen - seg.endInPath,
      endInPath: totalLen - seg.startInPath,
    })
  }
  return { ...p, segs: flippedSegs }
}

// Compute synteny blocks between a designated ref path and every other path.
// Algorithm: build node→[ref-position] index from the ref path; for each query
// path, walk its segs and where the same node ord appears in ref, emit a
// block. Adjacent blocks that are co-linear on both axes are merged. Between
// consecutive merged blocks for the same query, emit a "bubble" feature whose
// `cs` string captures the alt-vs-alt sequence diff — that's the per-SNP
// signal the multi-LGV display picks up via extractMismatchesFromCs.
export function computeSyntenyBlocks({
  refName,
  refGenome,
  paths,
  segSeqs,
}: {
  refName: string
  refGenome: string
  paths: ParsedPath[]
  segSeqs?: Map<number, string>
}): SyntenyBlock[] {
  const ref = paths.find(p => p.refName === refName && p.genome === refGenome)
  if (!ref) {
    return []
  }
  const refIndex = new Map<number, NodeSeg[]>()
  for (const seg of ref.segs) {
    let arr = refIndex.get(seg.ord)
    if (!arr) {
      arr = []
      refIndex.set(seg.ord, arr)
    }
    arr.push(seg)
  }
  const blocks: SyntenyBlock[] = []
  let featureId = 0
  for (const q of paths) {
    if (q === ref) {
      continue
    }
    const qEffective = isReversedContig(q, refIndex) ? flipPath(q) : q
    const raw: SyntenyBlock[] = []
    for (const qseg of qEffective.segs) {
      const matches = refIndex.get(qseg.ord)
      if (!matches) {
        continue
      }
      for (const refseg of matches) {
        const sameOrient = refseg.orient === qseg.orient ? 1 : -1
        raw.push({
          queryGenome: qEffective.genome,
          origRefName: refName,
          start: ref.baseOffset + refseg.startInPath,
          end: ref.baseOffset + refseg.endInPath,
          mateStart: qEffective.baseOffset + qseg.startInPath,
          mateEnd: qEffective.baseOffset + qseg.endInPath,
          mateRefName: qEffective.refName,
          strand: sameOrient,
          identity: 1,
          featureId: '',
        })
      }
    }
    raw.sort((a, b) => a.start - b.start || a.mateStart - b.mateStart)
    const merged = mergeColinear(raw)
    const annotated = segSeqs
      ? collapseRunsWithBubbleCs(merged, ref, qEffective, segSeqs)
      : merged
    for (const block of annotated) {
      block.featureId = String(featureId++)
      blocks.push(block)
    }
  }
  return blocks
}

// Collapse a list of merged colinear blocks for one path pair into bigger
// run features whose `cs` strings thread through the bubbles between them.
// Mirrors the GfaTabixAdapter `bubbleOverlay` shape (one long feature per
// haplotype path, with a cumulative cs covering every SNP/indel along the
// path) so MultiLGVSyntenyDisplay's SNP-coverage pipeline gets the dense
// per-position signal it expects, rather than thousands of point features.
//
// Strand handling: cs is always emitted in ref-forward orientation (PAF /
// minimap2 convention). For reverse-strand chains the mate walks backward
// as ref advances, and the alt-query gap sequence is reverse-complemented
// before diffing against altR so the resulting cs aligns to ref forward.
function collapseRunsWithBubbleCs(
  blocks: SyntenyBlock[],
  ref: ParsedPath,
  q: ParsedPath,
  segSeqs: Map<number, string>,
): SyntenyBlock[] {
  if (blocks.length === 0) {
    return blocks
  }
  const out: SyntenyBlock[] = []
  let cur: SyntenyBlock | undefined
  for (const b of blocks) {
    if (!cur) {
      cur = { ...b, cs: `:${b.end - b.start}` }
      continue
    }
    const sameStrand = cur.strand === b.strand
    const sameGenome = cur.queryGenome === b.queryGenome
    const refGoesForward = b.start >= cur.end
    const mateContinues =
      cur.strand === 1 ? b.mateStart >= cur.mateEnd : b.mateEnd <= cur.mateStart
    if (!sameStrand || !sameGenome || !refGoesForward || !mateContinues) {
      finalizeRun(cur)
      out.push(cur)
      cur = { ...b, cs: `:${b.end - b.start}` }
      continue
    }
    const altR = concatOrientedSeq(
      ref.segs,
      cur.end - ref.baseOffset,
      b.start - ref.baseOffset,
      segSeqs,
    )
    const altQRaw =
      cur.strand === 1
        ? concatOrientedSeq(
            q.segs,
            cur.mateEnd - q.baseOffset,
            b.mateStart - q.baseOffset,
            segSeqs,
          )
        : concatOrientedSeq(
            q.segs,
            b.mateEnd - q.baseOffset,
            cur.mateStart - q.baseOffset,
            segSeqs,
          )
    if (altR === undefined || altQRaw === undefined) {
      finalizeRun(cur)
      out.push(cur)
      cur = { ...b, cs: `:${b.end - b.start}` }
      continue
    }
    const altQ = cur.strand === 1 ? altQRaw : revcomp(altQRaw)
    const bubbleCs = buildCs(altR, altQ)
    const colinearLen = b.end - b.start
    cur.end = b.end
    if (cur.strand === 1) {
      cur.mateEnd = b.mateEnd
    } else {
      cur.mateStart = b.mateStart
    }
    cur.cs = `${cur.cs ?? ''}${bubbleCs}:${colinearLen}`
  }
  if (cur) {
    finalizeRun(cur)
    out.push(cur)
  }
  return out
}

function finalizeRun(run: SyntenyBlock) {
  if (!run.cs) {
    return
  }
  // Drop the cs entirely if it has no informative content (pure matches).
  // Keeps colinear-only runs lean for the wire and matches the pre-bubble
  // shape callers expect when no bubble detail is available.
  if (!/[*+-]/.test(run.cs)) {
    run.cs = undefined
    return
  }
  const matches = countCsMatches(run.cs)
  const denom = run.end - run.start
  if (denom > 0) {
    run.identity = Math.min(1, matches / denom)
  }
}

function countCsMatches(cs: string): number {
  let n = 0
  let i = 0
  while (i < cs.length) {
    const ch = cs[i]!
    if (ch === ':') {
      i++
      let v = 0
      while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
        v = v * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      n += v
    } else if (ch === '*') {
      i += 3
    } else if (ch === '+' || ch === '-') {
      i++
      while (
        i < cs.length &&
        cs[i] !== ':' &&
        cs[i] !== '*' &&
        cs[i] !== '+' &&
        cs[i] !== '-'
      ) {
        i++
      }
    } else {
      i++
    }
  }
  return n
}

function mergeColinear(blocks: SyntenyBlock[]): SyntenyBlock[] {
  if (blocks.length === 0) {
    return blocks
  }
  const out: SyntenyBlock[] = [{ ...blocks[0]! }]
  for (let i = 1; i < blocks.length; i++) {
    const prev = out[out.length - 1]!
    const cur = blocks[i]!
    const sameStrand = prev.strand === cur.strand
    const refContig = prev.end === cur.start
    const matContig =
      cur.strand === 1
        ? prev.mateEnd === cur.mateStart
        : prev.mateStart === cur.mateEnd
    if (
      sameStrand &&
      refContig &&
      matContig &&
      prev.queryGenome === cur.queryGenome
    ) {
      prev.end = cur.end
      if (cur.strand === 1) {
        prev.mateEnd = cur.mateEnd
      } else {
        prev.mateStart = cur.mateStart
      }
    } else {
      out.push({ ...cur })
    }
  }
  return out
}
