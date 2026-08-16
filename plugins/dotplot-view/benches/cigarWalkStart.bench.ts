// What does sharing the CIGAR walk's start-corner derivation cost the geometry
// loop?
//
//   node plugins/dotplot-view/benches/cigarWalkStart.bench.ts
//   node plugins/dotplot-view/benches/cigarWalkStart.bench.ts --rounds=15
//
// `buildLineSegments` (main thread, per geometry rebuild — a zoom, a drawCigar
// toggle, a minAlignmentLength change) and `buildSyntenyGeometry` (worker, per
// fetch) both derive the same four values per FEATURE before walking its CIGAR:
// which corner op 0 sits at, and which way each axis steps. Both had it written
// out, and the dotplot's copy was wrong for eight months — a reverse-strand
// CIGAR laid down mirrored — because nothing made the two agree.
//
// Sharing it as one helper returning the four values means an object per
// feature, and the sibling bench `cumBpProjection.bench.ts` is here because that
// class of consolidation measured 1.44-1.47x on the Canvas2D loop. The
// difference this time is that the derivation is per FEATURE, not per segment,
// and the loop body it sits in walks the whole CIGAR — so the question is its
// SHARE, not its cost in isolation. Both are below.
//
// Four arms:
//
// - INLINE: the derivation spelled out at the call site and HOISTED above the
//   draw-detail gate, as both copies had it.
// - OBJECT: one helper returning `{bp1, bp2, rev1, rev2}`, called behind the
//   gate. The shape at risk: an allocation per feature, unless V8's escape
//   analysis scalar-replaces it.
// - SCALAR: four primitive-returning helpers behind the gate, the shape
//   `dotplotProject.ts` settled on for the same reason. Allocation-free, and
//   recomputes the strand test in each.
// - CONTROL: byte-identical to INLINE, separately declared.
//
// WHAT IT SAID, across three runs on a contended box (controls landed anywhere
// from 0.95 to 1.15, so read the rows against their own control, not against
// 1.00):
//
//   derivation alone    object 1.37-1.61    scalar 1.04-1.30   control 0.95-1.04
//   real loop           object 0.79-1.14    scalar 0.80-1.09   control 0.79-1.15
//
// Two conclusions, and only the first is about the shape. The object allocation
// is REAL — 1.37-1.61x where nothing dilutes it, well clear of every control, so
// V8 is not scalar-replacing it — and the scalars are most of the way to free.
// In the real loop neither is distinguishable from its control, so the shape
// does not decide anything there; the scalars win because they cost nothing in
// the one place that could resolve a difference.
//
// The second is not about the shape at all. Both gated arms beat the inline
// baseline by ~10-20% at 98% flat, and that is the GATE, not the helper: the
// inline copies derived above it, for every feature, including the ones drawn as
// a single flat line.
//
// 98% flat is the whole-genome case and the one that decides this: the worker
// ships CIGARs within 8x zoom headroom that the geometry builder is then too
// zoomed out to walk, so nearly every feature is drawn as one flat line.
//
// Same four rules as the sibling benches — separate drivers per arm, a control
// that is the baseline declared twice, min of interleaved rounds, identity
// before timing. See `agent-docs/reference/BENCHMARKING.md`.
import { visitCigarRenderedSegments } from '@jbrowse/cigar-utils'

interface Fixture {
  p11: Float64Array
  p12: Float64Array
  p21: Float64Array
  p22: Float64Array
  strands: Int8Array
  cigarData: Uint32Array
  cigarOffsets: Uint32Array
  count: number
}

interface Out {
  x1: Float64Array
  y1: Float64Array
  x2: Float64Array
  y2: Float64Array
  ops: Uint8Array
}

// --- the two candidate consolidations ---

function cigarWalkStart(
  p11: number,
  p12: number,
  p21: number,
  p22: number,
  strand: number,
) {
  const reverse = strand === -1
  const bp1 = reverse ? p12 : p11
  const far1 = reverse ? p11 : p12
  return {
    bp1,
    bp2: reverse ? p22 : p21,
    rev1: bp1 < far1 ? 1 : -1,
    rev2: (p21 < p22 ? 1 : -1) * (reverse ? -1 : 1),
  }
}

function walkBp1(p11: number, p12: number, strand: number) {
  return strand === -1 ? p12 : p11
}
function walkBp2(p21: number, p22: number, strand: number) {
  return strand === -1 ? p22 : p21
}
function walkRev1(p11: number, p12: number, strand: number) {
  return (strand === -1 ? p12 < p11 : p11 < p12) ? 1 : -1
}
function walkRev2(p21: number, p22: number, strand: number) {
  return (p21 < p22 ? 1 : -1) * (strand === -1 ? -1 : 1)
}

// --- arms. Each is `buildLineSegments`' inner loop verbatim apart from the
// derivation: the four lane reads, the on-screen width test, the CIGAR walk and
// the six lane writes per emitted segment.

function buildInline(f: Fixture, o: Out, bpPerPxH: number, bpPerPxV: number) {
  const { p11, p12, p21, p22, strands, cigarData, cigarOffsets, count } = f
  const invH = 1 / bpPerPxH
  const invV = 1 / bpPerPxV
  let n = 0
  for (let i = 0; i < count; i++) {
    const x1 = p11[i]!
    const x2 = p12[i]!
    const y1 = p21[i]!
    const y2 = p22[i]!
    const strand = strands[i]!
    // hoisted above the gate, as the tree had it
    const k1 = strand === -1 ? x2 : x1
    const k2 = strand === -1 ? x1 : x2
    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (y1 < y2 ? 1 : -1) * strand
    if (Math.max(Math.abs(x2 - x1) * invH, Math.abs(y2 - y1) * invV) < 2) {
      o.x1[n] = x1
      o.y1[n] = y1
      o.x2[n] = x2
      o.y2[n] = y2
      o.ops[n] = 0
      n++
      continue
    }
    visitCigarRenderedSegments(
      cigarData.subarray(cigarOffsets[i], cigarOffsets[i + 1]),
      k1,
      strand === -1 ? y2 : y1,
      bpPerPxH,
      bpPerPxV,
      rev1,
      rev2,
      (op, a, b, c, d) => {
        o.x1[n] = a
        o.y1[n] = c
        o.x2[n] = b
        o.y2[n] = d
        o.ops[n] = op
        n++
      },
    )
  }
  return n
}

// CONTROL: byte-identical to INLINE, its own function literal so it gets its own
// inline caches. Whatever it scores against INLINE is what the harness resolved.
function buildControl(f: Fixture, o: Out, bpPerPxH: number, bpPerPxV: number) {
  const { p11, p12, p21, p22, strands, cigarData, cigarOffsets, count } = f
  const invH = 1 / bpPerPxH
  const invV = 1 / bpPerPxV
  let n = 0
  for (let i = 0; i < count; i++) {
    const x1 = p11[i]!
    const x2 = p12[i]!
    const y1 = p21[i]!
    const y2 = p22[i]!
    const strand = strands[i]!
    const k1 = strand === -1 ? x2 : x1
    const k2 = strand === -1 ? x1 : x2
    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (y1 < y2 ? 1 : -1) * strand
    if (Math.max(Math.abs(x2 - x1) * invH, Math.abs(y2 - y1) * invV) < 2) {
      o.x1[n] = x1
      o.y1[n] = y1
      o.x2[n] = x2
      o.y2[n] = y2
      o.ops[n] = 0
      n++
      continue
    }
    visitCigarRenderedSegments(
      cigarData.subarray(cigarOffsets[i], cigarOffsets[i + 1]),
      k1,
      strand === -1 ? y2 : y1,
      bpPerPxH,
      bpPerPxV,
      rev1,
      rev2,
      (op, a, b, c, d) => {
        o.x1[n] = a
        o.y1[n] = c
        o.x2[n] = b
        o.y2[n] = d
        o.ops[n] = op
        n++
      },
    )
  }
  return n
}

function buildObject(f: Fixture, o: Out, bpPerPxH: number, bpPerPxV: number) {
  const { p11, p12, p21, p22, strands, cigarData, cigarOffsets, count } = f
  const invH = 1 / bpPerPxH
  const invV = 1 / bpPerPxV
  let n = 0
  for (let i = 0; i < count; i++) {
    const x1 = p11[i]!
    const x2 = p12[i]!
    const y1 = p21[i]!
    const y2 = p22[i]!
    if (Math.max(Math.abs(x2 - x1) * invH, Math.abs(y2 - y1) * invV) < 2) {
      o.x1[n] = x1
      o.y1[n] = y1
      o.x2[n] = x2
      o.y2[n] = y2
      o.ops[n] = 0
      n++
      continue
    }
    // behind the gate, as the tree has it: a feature drawn as one flat line
    // never asks where its CIGAR would have started
    const { bp1, bp2, rev1, rev2 } = cigarWalkStart(x1, x2, y1, y2, strands[i]!)
    visitCigarRenderedSegments(
      cigarData.subarray(cigarOffsets[i], cigarOffsets[i + 1]),
      bp1,
      bp2,
      bpPerPxH,
      bpPerPxV,
      rev1,
      rev2,
      (op, a, b, c, d) => {
        o.x1[n] = a
        o.y1[n] = c
        o.x2[n] = b
        o.y2[n] = d
        o.ops[n] = op
        n++
      },
    )
  }
  return n
}

function buildScalar(f: Fixture, o: Out, bpPerPxH: number, bpPerPxV: number) {
  const { p11, p12, p21, p22, strands, cigarData, cigarOffsets, count } = f
  const invH = 1 / bpPerPxH
  const invV = 1 / bpPerPxV
  let n = 0
  for (let i = 0; i < count; i++) {
    const x1 = p11[i]!
    const x2 = p12[i]!
    const y1 = p21[i]!
    const y2 = p22[i]!
    const strand = strands[i]!
    if (Math.max(Math.abs(x2 - x1) * invH, Math.abs(y2 - y1) * invV) < 2) {
      o.x1[n] = x1
      o.y1[n] = y1
      o.x2[n] = x2
      o.y2[n] = y2
      o.ops[n] = 0
      n++
      continue
    }
    visitCigarRenderedSegments(
      cigarData.subarray(cigarOffsets[i], cigarOffsets[i + 1]),
      walkBp1(x1, x2, strand),
      walkBp2(y1, y2, strand),
      bpPerPxH,
      bpPerPxV,
      walkRev1(x1, x2, strand),
      walkRev2(y1, y2, strand),
      (op, a, b, c, d) => {
        o.x1[n] = a
        o.y1[n] = c
        o.x2[n] = b
        o.y2[n] = d
        o.ops[n] = op
        n++
      },
    )
  }
  return n
}

// --- the derivation on its own, to bound its cost where nothing dilutes it ---

function deriveInline(f: Fixture) {
  const { p11, p12, p21, p22, strands, count } = f
  let sink = 0
  for (let i = 0; i < count; i++) {
    const x1 = p11[i]!
    const x2 = p12[i]!
    const y1 = p21[i]!
    const y2 = p22[i]!
    const strand = strands[i]!
    const k1 = strand === -1 ? x2 : x1
    const k2 = strand === -1 ? x1 : x2
    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (y1 < y2 ? 1 : -1) * strand
    sink += k1 + (strand === -1 ? y2 : y1) + rev1 + rev2
  }
  return sink
}
function deriveControl(f: Fixture) {
  const { p11, p12, p21, p22, strands, count } = f
  let sink = 0
  for (let i = 0; i < count; i++) {
    const x1 = p11[i]!
    const x2 = p12[i]!
    const y1 = p21[i]!
    const y2 = p22[i]!
    const strand = strands[i]!
    const k1 = strand === -1 ? x2 : x1
    const k2 = strand === -1 ? x1 : x2
    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (y1 < y2 ? 1 : -1) * strand
    sink += k1 + (strand === -1 ? y2 : y1) + rev1 + rev2
  }
  return sink
}
function deriveObject(f: Fixture) {
  const { p11, p12, p21, p22, strands, count } = f
  let sink = 0
  for (let i = 0; i < count; i++) {
    const { bp1, bp2, rev1, rev2 } = cigarWalkStart(
      p11[i]!,
      p12[i]!,
      p21[i]!,
      p22[i]!,
      strands[i]!,
    )
    sink += bp1 + bp2 + rev1 + rev2
  }
  return sink
}
function deriveScalar(f: Fixture) {
  const { p11, p12, p21, p22, strands, count } = f
  let sink = 0
  for (let i = 0; i < count; i++) {
    const x1 = p11[i]!
    const x2 = p12[i]!
    const y1 = p21[i]!
    const y2 = p22[i]!
    const strand = strands[i]!
    sink +=
      walkBp1(x1, x2, strand) +
      walkBp2(y1, y2, strand) +
      walkRev1(x1, x2, strand) +
      walkRev2(y1, y2, strand)
  }
  return sink
}

// --- drivers, one per arm. Do not refactor into a shared helper taking the
// implementation as a parameter: that call site goes polymorphic and every arm
// pays for it, which is the first trap in the catalogue.
function timeBuildInline(f: Fixture, o: Out, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildInline(f, o, 100, 100)
  }
  return (performance.now() - t0) / reps
}
function timeBuildControl(f: Fixture, o: Out, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildControl(f, o, 100, 100)
  }
  return (performance.now() - t0) / reps
}
function timeBuildObject(f: Fixture, o: Out, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildObject(f, o, 100, 100)
  }
  return (performance.now() - t0) / reps
}
function timeBuildScalar(f: Fixture, o: Out, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildScalar(f, o, 100, 100)
  }
  return (performance.now() - t0) / reps
}
function timeDeriveInline(f: Fixture, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    deriveInline(f)
  }
  return (performance.now() - t0) / reps
}
function timeDeriveControl(f: Fixture, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    deriveControl(f)
  }
  return (performance.now() - t0) / reps
}
function timeDeriveObject(f: Fixture, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    deriveObject(f)
  }
  return (performance.now() - t0) / reps
}
function timeDeriveScalar(f: Fixture, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    deriveScalar(f)
  }
  return (performance.now() - t0) / reps
}

// A fetch's worth of alignments: a mix of strands (so the derivation's branch is
// not perfectly predicted), a mix of region orientations on the mate axis, and a
// CIGAR per feature of ~40 ops with indels big enough to survive
// visitCigarRenderedSegments' sub-pixel merge at the bpPerPx the arms run at.
//
// `subPixel` is the fraction drawn as one flat line instead of a walked CIGAR,
// which is what decides how much of this loop the derivation is. At whole-genome
// zoom it is nearly all of them — the worker ships CIGARs within 8x zoom
// headroom that the geometry builder is then too zoomed out to walk — so that is
// where the DERIVATION's own cost is least diluted and the gating matters most.
function makeFixture(
  count: number,
  opsPerFeature: number,
  subPixel = 0,
): Fixture {
  const p11 = new Float64Array(count)
  const p12 = new Float64Array(count)
  const p21 = new Float64Array(count)
  const p22 = new Float64Array(count)
  const strands = new Int8Array(count)
  const cigarOffsets = new Uint32Array(count + 1)
  const cigarData = new Uint32Array(count * opsPerFeature)
  let w = 0
  for (let i = 0; i < count; i++) {
    const reverse = i % 3 === 0
    const mateReversed = i % 7 === 0
    const anchor = (i * 7919) % 20_000_000
    const mate = (i * 104_729) % 20_000_000
    // 20kb is 200px at the arms' bpPerPx=100 (walked); 20bp is 0.2px (flat)
    const span = i % 100 < subPixel * 100 ? 20 : 20_000
    // the anchor lanes arrive already swapped for a reverse-strand feature
    p11[i] = reverse ? anchor + span : anchor
    p12[i] = reverse ? anchor : anchor + span
    p21[i] = mateReversed ? mate + span : mate
    p22[i] = mateReversed ? mate : mate + span
    strands[i] = reverse ? -1 : 1
    for (let j = 0; j < opsPerFeature; j++) {
      const op = j % 5 === 4 ? 2 : j % 5 === 3 ? 1 : 0
      const len = op === 0 ? 400 : 300
      cigarData[w++] = (len << 4) | op
    }
    cigarOffsets[i + 1] = w
  }
  return { p11, p12, p21, p22, strands, cigarData, cigarOffsets, count }
}

function makeOut(cap: number): Out {
  return {
    x1: new Float64Array(cap),
    y1: new Float64Array(cap),
    x2: new Float64Array(cap),
    y2: new Float64Array(cap),
    ops: new Uint8Array(cap),
  }
}

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.slice(9) ?? 7,
)
const OPS = 40

{
  const f = makeFixture(4096, OPS)
  const cap = 4096 * (OPS + 1)
  const arms: [string, number, Float64Array][] = []
  for (const [name, fn] of [
    ['inline', buildInline],
    ['control', buildControl],
    ['object', buildObject],
    ['scalar', buildScalar],
  ] as const) {
    const o = makeOut(cap)
    arms.push([name, fn(f, o, 100, 100), o.x1])
  }
  const [firstName, firstN, firstX] = arms[0]!
  for (const [name, n, x] of arms.slice(1)) {
    if (n !== firstN) {
      throw new Error(`${name} emitted ${n} segments, ${firstName} ${firstN}`)
    }
    for (let i = 0; i < firstN; i++) {
      if (x[i] !== firstX[i]) {
        throw new Error(
          `${name} segment ${i} x1 ${x[i]}, ${firstName} ${firstX[i]}`,
        )
      }
    }
  }
  const d = [
    deriveInline(f),
    deriveControl(f),
    deriveObject(f),
    deriveScalar(f),
  ]
  if (d.some(v => v !== d[0])) {
    throw new Error(`derivation arms disagree: ${d.join(' ')}`)
  }
  console.log(
    `identity: all four arms emit ${firstN} identical segments and the same derivation sum`,
  )
}

console.log(
  `\nTHE REAL LOOP (derivation + width gate + CIGAR walk + lane writes)\n` +
    `${'features'.padStart(16)}  ${'inline'.padStart(8)}  ${'object'.padStart(7)}  ` +
    `${'scalar'.padStart(7)}  ${'control'.padStart(7)}`,
)
for (const [n, subPixel] of [
  [200_000, 0],
  [200_000, 0.85],
  [200_000, 0.98],
] as const) {
  const f = makeFixture(n, OPS, subPixel)
  const o = makeOut(n * (OPS + 1))
  const reps = 3
  for (let r = 0; r < 8; r++) {
    timeBuildInline(f, o, 1)
    timeBuildObject(f, o, 1)
    timeBuildScalar(f, o, 1)
    timeBuildControl(f, o, 1)
  }
  let inl = Infinity
  let obj = Infinity
  let sca = Infinity
  let ctl = Infinity
  for (let round = 0; round < rounds; round++) {
    inl = Math.min(inl, timeBuildInline(f, o, reps))
    obj = Math.min(obj, timeBuildObject(f, o, reps))
    sca = Math.min(sca, timeBuildScalar(f, o, reps))
    ctl = Math.min(ctl, timeBuildControl(f, o, reps))
  }
  console.log(
    [
      `${n / 1000}k @${(subPixel * 100).toFixed(0)}% flat`.padStart(16),
      inl.toFixed(2).padStart(8),
      ...[obj, sca, ctl].map(v => (v / inl).toFixed(3).padStart(7)),
    ].join('  '),
  )
}

console.log(
  `\nTHE DERIVATION ALONE (nothing to dilute it)\n` +
    `${'features'.padStart(16)}  ${'inline'.padStart(8)}  ${'object'.padStart(7)}  ` +
    `${'scalar'.padStart(7)}  ${'control'.padStart(7)}`,
)
for (const n of [1_000_000, 5_000_000]) {
  const f = makeFixture(n, 1)
  const reps = n > 2_000_000 ? 5 : 20
  for (let r = 0; r < 12; r++) {
    timeDeriveInline(f, 1)
    timeDeriveObject(f, 1)
    timeDeriveScalar(f, 1)
    timeDeriveControl(f, 1)
  }
  let inl = Infinity
  let obj = Infinity
  let sca = Infinity
  let ctl = Infinity
  for (let round = 0; round < rounds; round++) {
    inl = Math.min(inl, timeDeriveInline(f, reps))
    obj = Math.min(obj, timeDeriveObject(f, reps))
    sca = Math.min(sca, timeDeriveScalar(f, reps))
    ctl = Math.min(ctl, timeDeriveControl(f, reps))
  }
  console.log(
    [
      n.toLocaleString().padStart(16),
      inl.toFixed(2).padStart(8),
      ...[obj, sca, ctl].map(v => (v / inl).toFixed(3).padStart(7)),
    ].join('  '),
  )
}

console.log(
  '\ninline is ms per pass; the rest are ratios to it, so above 1.00 means the\n' +
    'consolidation costs. Min of interleaved rounds. A control far from 1.00\n' +
    'means the row measured nothing.',
)
