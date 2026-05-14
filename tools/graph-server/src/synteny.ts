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
// node walks (from W or P lines) with running coordinates.
export function parseExtractedGfa(gfa: string) {
  const segLens = new Map<number, number>()
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
  return { segLens, paths }
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
// block. Adjacent blocks that are co-linear on both axes are merged into one
// SyntenyBlock with identity=1.
export function computeSyntenyBlocks({
  refName,
  refGenome,
  paths,
}: {
  refName: string
  refGenome: string
  paths: ParsedPath[]
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
    for (const block of mergeColinear(raw)) {
      block.featureId = String(featureId++)
      blocks.push(block)
    }
  }
  return blocks
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
