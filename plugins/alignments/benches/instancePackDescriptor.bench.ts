// Can a GENERATED packer absorb the read pass, and cost nothing for it?
//
//   node --expose-gc plugins/alignments/benches/instancePackDescriptor.bench.ts --only=pileup-typical
//
// Flags: --rounds=<n> (default 40), --only=<fixture substring>, --allow-diff
//
// Quote numbers from separate `--only=` runs, one process per fixture — the
// multi-fixture contamination trap in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION. `packReadSegments` is the largest hand-written interleave left,
// and `instanceAccessors.bench.ts` already settled that no generated form with a
// CALL inside the loop can pay for itself. This asks the next question: a
// generated form with no call, only hoisted PARAMETERS. The read pass cannot
// feed today's `packInstances` for three reasons, and all three are "how do I
// index the source array", which is a parameter, not a computation:
//
//   gather   8 of 11 fields are per READ, reached as `readYs[segmentReadIndices[j]]`
//   strided  startOff/endOff are `segmentPositions[j*2]` and `[j*2+1]`
//   fallback `tagColor` is `hasTagColors ? tagColors[ri] : 0`
//
// The same shapes (plus affine — `freq[i]/255`, `x1[i]-baseH`, `idx[i]+1`) are
// why ~12 other packers in the tree are hand-written, so a form that absorbs
// them would be worth having.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. Three runs at --rounds=80, one process per fixture, on AC.
// Control in brackets; a row whose control is far from 1.00 measured nothing.
//
//                       200k [0.99-1.04]   60k [0.99]   12k [1.00]
//   inline-literal          1.21-1.26x       1.00x        1.00x
//   inline-hoisted          1.16-1.19x       1.00x          -
//   grouped                 1.34-1.42x       1.07x        1.08x
//   grouped-strided         1.31-1.37x       1.00x        1.01x
//   desc-gather             0.95-0.99x       0.72x        0.72x
//   desc-affine             0.69-0.71x       0.52x        0.52x
//   desc-ident              0.53x            0.41x        0.41x
//   desc-branch             0.31-0.33x       0.20x        0.21x
//   twopass                 2.36-2.44x       0.91x        0.95x
//   materialize             0.49-0.53x       0.27x        0.27x
//
// **A generated packer CAN absorb this call site for free — but only if the
// GROUPING is static.** `grouped-strided` is 1.00-1.37x, i.e. the emitted loop
// is the hand loop. What kills every other form is one thing: a per-field index
// loads the index array once PER FIELD, eleven times a record, where the hand
// loop hoists `ri` once and reuses it eight times. That alone is `desc-gather`'s
// 0.72x, before any affine. Adding `* scale + bias` takes it to 0.52x and a
// runtime `* stride + offset` to 0.41x, because both push the index and the
// value off V8's Smi path. A per-field `index ? src[index[i]] : src[i]` branch
// is the worst arm measured at 0.20x.
//
// So: do not propose a per-field descriptor object, an always-on affine, or a
// nullable-index branch. A declared group is the only shape that pays.
//
// WHAT WAS NOT BUILT, AND WHY. A `//! pack-group:` / `//! pack-lanes:` directive
// feeding a generated `packInstancesGrouped` was designed off these numbers and
// declined on the gain: at 60k segments — a typical pileup — it is 0.630ms
// against 0.632ms, i.e. nothing, and the whole win lives in the 200k fixture at
// ~1.3ms per pack, on a pack that runs on layout change and recolor rather than
// per frame. The real prize was never speed, it was that `packInstances` type-
// checks COMPLETENESS and a hand loop does not — add a field to `read.slang` and
// the hand loop silently ships it as zero. A directive buys that for one packer;
// the other thirteen (which fail for computed fields and variable record counts,
// shapes no directive reaches) still need the generic answer.
//
// TWO FINDINGS THAT OUTLIVED THE QUESTION.
//
// `inline-literal` vs `inline` is 1.21-1.26x at 200k, and the ONLY difference is
// `u32[o + 0]` against `u32[o + F_U32.startOff]`. V8 does not fold the property
// load on the imported offset map, so a hand-written packer pays eleven of them
// per record. `inline-hoisted` — destructure the offset maps into locals before
// the loop, no offset hardcoded anywhere, so nothing can drift — recovers most
// of it at 1.16-1.19x. It is 1.00x at 60k and 12k, so this is worth ~0.8ms on
// the deepest pileup only, which is why no packer was changed.
//
// `twopass` at 2.36-2.44x on the 200k fixture is real, reproduces with a clean
// control, and is NOT understood. Two partial passes over an 8.8 MB destination
// beat one pass doing the same stores; at 60k and 12k the same arm is 0.91-0.95x,
// the cost you would expect from walking the buffer twice. Something about the
// single pass's ~10 concurrent streams degrades past L2. Nobody should act on
// this without finding the mechanism first — but it is the one row here worth
// chasing, and it is why the arm stays in the file.
//
// ARMS. Each is a whole loop, transcribed as the codegen would emit it, so the
// result stays reproducible against an emitter that does not exist.
//
//   inline       today's `packReadSegments`, verbatim. THE BASELINE.
//   control      a second, separately-declared copy of it.
//   inline-literal  the baseline with literal word offsets instead of the map.
//   inline-hoisted  the baseline with the offset maps destructured into locals.
//   grouped      one index shared by a declared GROUP of fields, hoisted once
//                per record exactly as the hand loop hoists `ri`, with start/end
//                arriving as two pre-split columns.
//   grouped-strided  the same, taking the interleaved `segmentPositions` with a
//                LITERAL stride — no worker payload change needed.
//   desc-gather  per-field index array, no affine. Splits the cost in two.
//   desc-affine  per-field index plus an always-applied `* scale + bias`.
//   desc-ident   the fully general descriptor: per-field
//                (src, index, stride, offset, scale, bias), direct fields
//                indexing through a shared identity array so it is branch-free.
//   desc-branch  the same without the identity array: a per-field
//                `index ? src[index[i]] : src[i]`.
//   twopass      two PARTIAL packs over one buffer, each body as tight as the
//                baseline's; the whole cost is walking the destination twice.
//   materialize  gather the 8 per-read columns into fresh segment-length arrays,
//                then call the REAL generated `packInstances`. The naive rescue,
//                and the one a reader proposes first.
//
// The gather is deliberately NOT random: `buildSegments` emits segments in read
// order, so `segmentReadIndices` is monotone non-decreasing and the gather walks
// its source forward with repeats. A fixture with a shuffled index would price a
// cache-miss pattern this call site does not have.

import {
  INSTANCE_OFFSET_F32 as F_F32,
  INSTANCE_OFFSET_I32 as F_I32,
  INSTANCE_OFFSET_U32 as F_U32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
  packInstances,
} from '../src/shaders/slang/read.iface.generated.ts'

const arg = (name: string, dflt: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt

const ROUNDS = Number(arg('rounds', '40'))
const ONLY = arg('only', '')
const ALLOW_DIFF = process.argv.includes('--allow-diff')

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// The read pass's upload payload, cut down to what the packer reads.
interface Data {
  numSegments: number
  segmentPositions: Uint32Array // interleaved [start, end] per segment
  segmentReadIndices: Uint32Array
  segmentEdgeFlags: Uint32Array
  readYs: Uint32Array
  readFlags: Uint32Array
  readMapqs: Uint32Array
  readInsertSizes: Float32Array
  readStrands: Int32Array
  readTagColors: Uint32Array
  readColorCategories: Uint32Array
  readInterchrom: Uint32Array
}

// ------------------------------------------------------------------ baseline

// BASELINE. `plugins/alignments/src/features/read/packGpu.ts`, verbatim.
const packInline = (data: Data, buf: ArrayBuffer) => {
  const n = data.numSegments
  const stride32 = INSTANCE_STRIDE_WORDS
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const tagColors = data.readTagColors
  const hasTagColors = tagColors.length > 0
  const colorCategories = data.readColorCategories
  const interchrom = data.readInterchrom
  const readYs = data.readYs
  const readFlags = data.readFlags
  const readMapqs = data.readMapqs
  const readInsertSizes = data.readInsertSizes
  const readStrands = data.readStrands
  const segmentPositions = data.segmentPositions
  const segmentReadIndices = data.segmentReadIndices
  const segmentEdgeFlags = data.segmentEdgeFlags
  for (let j = 0; j < n; j++) {
    const ri = segmentReadIndices[j]!
    const o = j * stride32
    u32[o + F_U32.startOff] = segmentPositions[j * 2]!
    u32[o + F_U32.endOff] = segmentPositions[j * 2 + 1]!
    u32[o + F_U32.y] = readYs[ri]!
    u32[o + F_U32.flags] = readFlags[ri]!
    u32[o + F_U32.mapq] = readMapqs[ri]!
    f32[o + F_F32.insertSize] = readInsertSizes[ri]!
    i32[o + F_I32.strand] = readStrands[ri]!
    u32[o + F_U32.tagColor] = hasTagColors ? tagColors[ri]! : 0
    u32[o + F_U32.edgeFlags] = segmentEdgeFlags[j]!
    u32[o + F_U32.interchrom] = interchrom[ri]!
    u32[o + F_U32.colorCategory] = colorCategories[ri]!
  }
  return buf
}

// CONTROL. Byte-identical to packInline, separate literal on purpose — separate
// function literals is what gives separate inline caches.
const packControl = (data: Data, buf: ArrayBuffer) => {
  const n = data.numSegments
  const stride32 = INSTANCE_STRIDE_WORDS
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const tagColors = data.readTagColors
  const hasTagColors = tagColors.length > 0
  const colorCategories = data.readColorCategories
  const interchrom = data.readInterchrom
  const readYs = data.readYs
  const readFlags = data.readFlags
  const readMapqs = data.readMapqs
  const readInsertSizes = data.readInsertSizes
  const readStrands = data.readStrands
  const segmentPositions = data.segmentPositions
  const segmentReadIndices = data.segmentReadIndices
  const segmentEdgeFlags = data.segmentEdgeFlags
  for (let j = 0; j < n; j++) {
    const ri = segmentReadIndices[j]!
    const o = j * stride32
    u32[o + F_U32.startOff] = segmentPositions[j * 2]!
    u32[o + F_U32.endOff] = segmentPositions[j * 2 + 1]!
    u32[o + F_U32.y] = readYs[ri]!
    u32[o + F_U32.flags] = readFlags[ri]!
    u32[o + F_U32.mapq] = readMapqs[ri]!
    f32[o + F_F32.insertSize] = readInsertSizes[ri]!
    i32[o + F_I32.strand] = readStrands[ri]!
    u32[o + F_U32.tagColor] = hasTagColors ? tagColors[ri]! : 0
    u32[o + F_U32.edgeFlags] = segmentEdgeFlags[j]!
    u32[o + F_U32.interchrom] = interchrom[ri]!
    u32[o + F_U32.colorCategory] = colorCategories[ri]!
  }
  return buf
}

// The baseline with LITERAL word offsets instead of `F_U32.startOff` property
// loads. Generated code always writes literals; hand-written code reads the
// offset map. This arm separates that from everything else, so no other row can
// be credited with a win that is only literals-vs-property.
const packInlineLiteral = (data: Data, buf: ArrayBuffer) => {
  const n = data.numSegments
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const tagColors = data.readTagColors
  const hasTagColors = tagColors.length > 0
  const colorCategories = data.readColorCategories
  const interchrom = data.readInterchrom
  const readYs = data.readYs
  const readFlags = data.readFlags
  const readMapqs = data.readMapqs
  const readInsertSizes = data.readInsertSizes
  const readStrands = data.readStrands
  const segmentPositions = data.segmentPositions
  const segmentReadIndices = data.segmentReadIndices
  const segmentEdgeFlags = data.segmentEdgeFlags
  for (let j = 0; j < n; j++) {
    const ri = segmentReadIndices[j]!
    const o = j * INSTANCE_STRIDE_WORDS
    u32[o + 0] = segmentPositions[j * 2]!
    u32[o + 1] = segmentPositions[j * 2 + 1]!
    u32[o + 2] = readYs[ri]!
    u32[o + 3] = readFlags[ri]!
    u32[o + 4] = readMapqs[ri]!
    f32[o + 5] = readInsertSizes[ri]!
    i32[o + 6] = readStrands[ri]!
    u32[o + 7] = hasTagColors ? tagColors[ri]! : 0
    u32[o + 8] = segmentEdgeFlags[j]!
    u32[o + 9] = interchrom[ri]!
    u32[o + 10] = colorCategories[ri]!
  }
  return buf
}

// The baseline with the offset MAPS DESTRUCTURED into locals before the loop,
// and nothing else changed. `F_U32.startOff` is a property load on an imported
// object, eleven of them per record; this is the one-line fix available to a
// hand-written packer that does not hardcode a single offset, so it cannot
// drift. Separates "generated code is faster" from "generated code spells
// literals where hand code spells a property".
const packInlineHoisted = (data: Data, buf: ArrayBuffer) => {
  const n = data.numSegments
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const {
    startOff: W_startOff,
    endOff: W_endOff,
    y: W_y,
    flags: W_flags,
    mapq: W_mapq,
    tagColor: W_tagColor,
    edgeFlags: W_edgeFlags,
    interchrom: W_interchrom,
    colorCategory: W_colorCategory,
  } = F_U32
  const { insertSize: W_insertSize } = F_F32
  const { strand: W_strand } = F_I32
  const tagColors = data.readTagColors
  const hasTagColors = tagColors.length > 0
  const colorCategories = data.readColorCategories
  const interchrom = data.readInterchrom
  const readYs = data.readYs
  const readFlags = data.readFlags
  const readMapqs = data.readMapqs
  const readInsertSizes = data.readInsertSizes
  const readStrands = data.readStrands
  const segmentPositions = data.segmentPositions
  const segmentReadIndices = data.segmentReadIndices
  const segmentEdgeFlags = data.segmentEdgeFlags
  for (let j = 0; j < n; j++) {
    const ri = segmentReadIndices[j]!
    const o = j * INSTANCE_STRIDE_WORDS
    u32[o + W_startOff] = segmentPositions[j * 2]!
    u32[o + W_endOff] = segmentPositions[j * 2 + 1]!
    u32[o + W_y] = readYs[ri]!
    u32[o + W_flags] = readFlags[ri]!
    u32[o + W_mapq] = readMapqs[ri]!
    f32[o + W_insertSize] = readInsertSizes[ri]!
    i32[o + W_strand] = readStrands[ri]!
    u32[o + W_tagColor] = hasTagColors ? tagColors[ri]! : 0
    u32[o + W_edgeFlags] = segmentEdgeFlags[j]!
    u32[o + W_interchrom] = interchrom[ri]!
    u32[o + W_colorCategory] = colorCategories[ri]!
  }
  return buf
}

// ---------------------------------------------------------- descriptor form
//
// What a `packInstancesFrom(desc, n, buf)` emitter would produce. A descriptor
// is one of: a plain array (direct), a number (constant field), or
// `{ src, index?, stride?, offset?, scale?, bias? }`. Normalization to the six
// hoisted locals happens per CALL, not per record, and is inside the timed
// region because a real caller pays it.

interface Source {
  src: ArrayLike<number>
  index?: ArrayLike<number>
  stride?: number
  offset?: number
  scale?: number
  bias?: number
}

type Desc = ArrayLike<number> | number | Source

const ZERO: number[] = []

// Normalized to (src, index, stride, offset, scale, bias). A constant field
// becomes a zero-length source with bias = the constant and scale = 0, so the
// loop body stays one shape — which is the whole point of this arm.
function norm(d: Desc, identity: Uint32Array) {
  if (typeof d === 'number') {
    return { s: ZERO, x: identity, t: 0, f: 0, m: 0, b: d }
  }
  if ('src' in d) {
    return {
      s: d.src,
      x: d.index ?? identity,
      t: d.stride ?? 1,
      f: d.offset ?? 0,
      m: d.scale ?? 1,
      b: d.bias ?? 0,
    }
  }
  return { s: d, x: identity, t: 1, f: 0, m: 1, b: 0 }
}

interface ReadDesc {
  startOff: Desc
  endOff: Desc
  y: Desc
  flags: Desc
  mapq: Desc
  insertSize: Desc
  strand: Desc
  tagColor: Desc
  edgeFlags: Desc
  interchrom: Desc
  colorCategory: Desc
}

const packDescIdent = (
  d: ReadDesc,
  n: number,
  identity: Uint32Array,
  buf: ArrayBuffer,
) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const a_ = norm(d.startOff, identity)
  const aS = a_.s
  const aX = a_.x
  const aT = a_.t
  const aF = a_.f
  const aM = a_.m
  const aB = a_.b
  const b_ = norm(d.endOff, identity)
  const bS = b_.s
  const bX = b_.x
  const bT = b_.t
  const bF = b_.f
  const bM = b_.m
  const bB = b_.b
  const c_ = norm(d.y, identity)
  const cS = c_.s
  const cX = c_.x
  const cT = c_.t
  const cF = c_.f
  const cM = c_.m
  const cB = c_.b
  const e_ = norm(d.flags, identity)
  const eS = e_.s
  const eX = e_.x
  const eT = e_.t
  const eF = e_.f
  const eM = e_.m
  const eB = e_.b
  const g_ = norm(d.mapq, identity)
  const gS = g_.s
  const gX = g_.x
  const gT = g_.t
  const gF = g_.f
  const gM = g_.m
  const gB = g_.b
  const h_ = norm(d.insertSize, identity)
  const hS = h_.s
  const hX = h_.x
  const hT = h_.t
  const hF = h_.f
  const hM = h_.m
  const hB = h_.b
  const k_ = norm(d.strand, identity)
  const kS = k_.s
  const kX = k_.x
  const kT = k_.t
  const kF = k_.f
  const kM = k_.m
  const kB = k_.b
  const l_ = norm(d.tagColor, identity)
  const lS = l_.s
  const lX = l_.x
  const lT = l_.t
  const lF = l_.f
  const lM = l_.m
  const lB = l_.b
  const p_ = norm(d.edgeFlags, identity)
  const pS = p_.s
  const pX = p_.x
  const pT = p_.t
  const pF = p_.f
  const pM = p_.m
  const pB = p_.b
  const q_ = norm(d.interchrom, identity)
  const qS = q_.s
  const qX = q_.x
  const qT = q_.t
  const qF = q_.f
  const qM = q_.m
  const qB = q_.b
  const r_ = norm(d.colorCategory, identity)
  const rS = r_.s
  const rX = r_.x
  const rT = r_.t
  const rF = r_.f
  const rM = r_.m
  const rB = r_.b
  for (let i = 0; i < n; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    u32[o + 0] = aS[aX[i]! * aT + aF]! * aM + aB
    u32[o + 1] = bS[bX[i]! * bT + bF]! * bM + bB
    u32[o + 2] = cS[cX[i]! * cT + cF]! * cM + cB
    u32[o + 3] = eS[eX[i]! * eT + eF]! * eM + eB
    u32[o + 4] = gS[gX[i]! * gT + gF]! * gM + gB
    f32[o + 5] = hS[hX[i]! * hT + hF]! * hM + hB
    i32[o + 6] = kS[kX[i]! * kT + kF]! * kM + kB
    u32[o + 7] = lS[lX[i]! * lT + lF]! * lM + lB
    u32[o + 8] = pS[pX[i]! * pT + pF]! * pM + pB
    u32[o + 9] = qS[qX[i]! * qT + qF]! * qM + qB
    u32[o + 10] = rS[rX[i]! * rT + rF]! * rM + rB
  }
  return buf
}

// Same descriptor surface, no identity array: the direct case is a branch on a
// per-field hoisted null instead of an indirection through 0,1,2,….
function normB(d: Desc) {
  if (typeof d === 'number') {
    return { s: ZERO, x: undefined, t: 0, f: 0, m: 0, b: d }
  }
  if ('src' in d) {
    return {
      s: d.src,
      x: d.index,
      t: d.stride ?? 1,
      f: d.offset ?? 0,
      m: d.scale ?? 1,
      b: d.bias ?? 0,
    }
  }
  return { s: d, x: undefined, t: 1, f: 0, m: 1, b: 0 }
}

const packDescBranch = (d: ReadDesc, n: number, buf: ArrayBuffer) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const a_ = normB(d.startOff)
  const aS = a_.s
  const aX = a_.x
  const aT = a_.t
  const aF = a_.f
  const aM = a_.m
  const aB = a_.b
  const b_ = normB(d.endOff)
  const bS = b_.s
  const bX = b_.x
  const bT = b_.t
  const bF = b_.f
  const bM = b_.m
  const bB = b_.b
  const c_ = normB(d.y)
  const cS = c_.s
  const cX = c_.x
  const cT = c_.t
  const cF = c_.f
  const cM = c_.m
  const cB = c_.b
  const e_ = normB(d.flags)
  const eS = e_.s
  const eX = e_.x
  const eT = e_.t
  const eF = e_.f
  const eM = e_.m
  const eB = e_.b
  const g_ = normB(d.mapq)
  const gS = g_.s
  const gX = g_.x
  const gT = g_.t
  const gF = g_.f
  const gM = g_.m
  const gB = g_.b
  const h_ = normB(d.insertSize)
  const hS = h_.s
  const hX = h_.x
  const hT = h_.t
  const hF = h_.f
  const hM = h_.m
  const hB = h_.b
  const k_ = normB(d.strand)
  const kS = k_.s
  const kX = k_.x
  const kT = k_.t
  const kF = k_.f
  const kM = k_.m
  const kB = k_.b
  const l_ = normB(d.tagColor)
  const lS = l_.s
  const lX = l_.x
  const lT = l_.t
  const lF = l_.f
  const lM = l_.m
  const lB = l_.b
  const p_ = normB(d.edgeFlags)
  const pS = p_.s
  const pX = p_.x
  const pT = p_.t
  const pF = p_.f
  const pM = p_.m
  const pB = p_.b
  const q_ = normB(d.interchrom)
  const qS = q_.s
  const qX = q_.x
  const qT = q_.t
  const qF = q_.f
  const qM = q_.m
  const qB = q_.b
  const r_ = normB(d.colorCategory)
  const rS = r_.s
  const rX = r_.x
  const rT = r_.t
  const rF = r_.f
  const rM = r_.m
  const rB = r_.b
  for (let i = 0; i < n; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    u32[o + 0] = aS[(aX ? aX[i]! : i) * aT + aF]! * aM + aB
    u32[o + 1] = bS[(bX ? bX[i]! : i) * bT + bF]! * bM + bB
    u32[o + 2] = cS[(cX ? cX[i]! : i) * cT + cF]! * cM + cB
    u32[o + 3] = eS[(eX ? eX[i]! : i) * eT + eF]! * eM + eB
    u32[o + 4] = gS[(gX ? gX[i]! : i) * gT + gF]! * gM + gB
    f32[o + 5] = hS[(hX ? hX[i]! : i) * hT + hF]! * hM + hB
    i32[o + 6] = kS[(kX ? kX[i]! : i) * kT + kF]! * kM + kB
    u32[o + 7] = lS[(lX ? lX[i]! : i) * lT + lF]! * lM + lB
    u32[o + 8] = pS[(pX ? pX[i]! : i) * pT + pF]! * pM + pB
    u32[o + 9] = qS[(qX ? qX[i]! : i) * qT + qF]! * qM + qB
    u32[o + 10] = rS[(rX ? rX[i]! : i) * rT + rF]! * rM + rB
  }
  return buf
}

// Index array ONLY -- no stride, scale or bias. A strided source is expressed by
// the index array itself (evens / odds), so this form still covers gather AND
// stride; what it drops is the affine. Splits desc-ident's cost in two.
interface Gathered {
  src: ArrayLike<number>
  index: Uint32Array
  scale: number
  bias: number
}
type ReadGathered = Record<keyof ReadDesc, Gathered>

const packDescGather = (g: ReadGathered, n: number, buf: ArrayBuffer) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const aS = g.startOff.src
  const aX = g.startOff.index
  const bS = g.endOff.src
  const bX = g.endOff.index
  const cS = g.y.src
  const cX = g.y.index
  const eS = g.flags.src
  const eX = g.flags.index
  const gS = g.mapq.src
  const gX = g.mapq.index
  const hS = g.insertSize.src
  const hX = g.insertSize.index
  const kS = g.strand.src
  const kX = g.strand.index
  const lS = g.tagColor.src
  const lX = g.tagColor.index
  const pS = g.edgeFlags.src
  const pX = g.edgeFlags.index
  const qS = g.interchrom.src
  const qX = g.interchrom.index
  const rS = g.colorCategory.src
  const rX = g.colorCategory.index
  for (let i = 0; i < n; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    u32[o + 0] = aS[aX[i]!]!
    u32[o + 1] = bS[bX[i]!]!
    u32[o + 2] = cS[cX[i]!]!
    u32[o + 3] = eS[eX[i]!]!
    u32[o + 4] = gS[gX[i]!]!
    f32[o + 5] = hS[hX[i]!]!
    i32[o + 6] = kS[kX[i]!]!
    u32[o + 7] = lS[lX[i]!]!
    u32[o + 8] = pS[pX[i]!]!
    u32[o + 9] = qS[qX[i]!]!
    u32[o + 10] = rS[rX[i]!]!
  }
  return buf
}

// The same, plus an always-applied `* scale + bias`.
const packDescAffine = (g: ReadGathered, n: number, buf: ArrayBuffer) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const aS = g.startOff.src
  const aX = g.startOff.index
  const aM = g.startOff.scale
  const aB = g.startOff.bias
  const bS = g.endOff.src
  const bX = g.endOff.index
  const bM = g.endOff.scale
  const bB = g.endOff.bias
  const cS = g.y.src
  const cX = g.y.index
  const cM = g.y.scale
  const cB = g.y.bias
  const eS = g.flags.src
  const eX = g.flags.index
  const eM = g.flags.scale
  const eB = g.flags.bias
  const gS = g.mapq.src
  const gX = g.mapq.index
  const gM = g.mapq.scale
  const gB = g.mapq.bias
  const hS = g.insertSize.src
  const hX = g.insertSize.index
  const hM = g.insertSize.scale
  const hB = g.insertSize.bias
  const kS = g.strand.src
  const kX = g.strand.index
  const kM = g.strand.scale
  const kB = g.strand.bias
  const lS = g.tagColor.src
  const lX = g.tagColor.index
  const lM = g.tagColor.scale
  const lB = g.tagColor.bias
  const pS = g.edgeFlags.src
  const pX = g.edgeFlags.index
  const pM = g.edgeFlags.scale
  const pB = g.edgeFlags.bias
  const qS = g.interchrom.src
  const qX = g.interchrom.index
  const qM = g.interchrom.scale
  const qB = g.interchrom.bias
  const rS = g.colorCategory.src
  const rX = g.colorCategory.index
  const rM = g.colorCategory.scale
  const rB = g.colorCategory.bias
  for (let i = 0; i < n; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    u32[o + 0] = aS[aX[i]!]! * aM + aB
    u32[o + 1] = bS[bX[i]!]! * bM + bB
    u32[o + 2] = cS[cX[i]!]! * cM + cB
    u32[o + 3] = eS[eX[i]!]! * eM + eB
    u32[o + 4] = gS[gX[i]!]! * gM + gB
    f32[o + 5] = hS[hX[i]!]! * hM + hB
    i32[o + 6] = kS[kX[i]!]! * kM + kB
    u32[o + 7] = lS[lX[i]!]! * lM + lB
    u32[o + 8] = pS[pX[i]!]! * pM + pB
    u32[o + 9] = qS[qX[i]!]! * qM + qB
    u32[o + 10] = rS[rX[i]!]! * rM + rB
  }
  return buf
}

// GROUPED. One index shared by a whole GROUP of fields, hoisted once per record
// exactly as the hand loop hoists `ri` -- so the emitted loop is the hand loop.
// The grouping ("these fields are per-read, these are per-segment") is a static
// property of the instance struct, so a `//! pack-groups:` directive can state
// it and the emitter can specialize on it. This arm is what that emitter would
// produce, transcribed.
interface SegmentFields {
  startOff: ArrayLike<number>
  endOff: ArrayLike<number>
  edgeFlags: ArrayLike<number>
}
interface ReadFields {
  y: ArrayLike<number>
  flags: ArrayLike<number>
  mapq: ArrayLike<number>
  insertSize: ArrayLike<number>
  strand: ArrayLike<number>
  tagColor: ArrayLike<number>
  interchrom: ArrayLike<number>
  colorCategory: ArrayLike<number>
}

const packGrouped = (
  seg: SegmentFields,
  read: ReadFields,
  readIndex: ArrayLike<number>,
  n: number,
  buf: ArrayBuffer,
) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const { startOff, endOff, edgeFlags } = seg
  const {
    y,
    flags,
    mapq,
    insertSize,
    strand,
    tagColor,
    interchrom,
    colorCategory,
  } = read
  for (let i = 0; i < n; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    const g0 = readIndex[i]!
    u32[o + 0] = startOff[i]!
    u32[o + 1] = endOff[i]!
    u32[o + 2] = y[g0]!
    u32[o + 3] = flags[g0]!
    u32[o + 4] = mapq[g0]!
    f32[o + 5] = insertSize[g0]!
    i32[o + 6] = strand[g0]!
    u32[o + 7] = tagColor[g0]!
    u32[o + 8] = edgeFlags[i]!
    u32[o + 9] = interchrom[g0]!
    u32[o + 10] = colorCategory[g0]!
  }
  return buf
}

// The same, taking the strided source directly rather than pre-split columns --
// i.e. what the emitter produces when `startOff`/`endOff` stay two scalar fields
// in the .slang and the caller declares the source stride. `i * 2` with a
// LITERAL stride is what the emitter can write, and is not the runtime `* aT`
// that cost desc-ident.
const packGroupedStrided = (
  segmentPositions: ArrayLike<number>,
  edgeFlags: ArrayLike<number>,
  read: ReadFields,
  readIndex: ArrayLike<number>,
  n: number,
  buf: ArrayBuffer,
) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const {
    y,
    flags,
    mapq,
    insertSize,
    strand,
    tagColor,
    interchrom,
    colorCategory,
  } = read
  for (let i = 0; i < n; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    const g0 = readIndex[i]!
    u32[o + 0] = segmentPositions[i * 2]!
    u32[o + 1] = segmentPositions[i * 2 + 1]!
    u32[o + 2] = y[g0]!
    u32[o + 3] = flags[g0]!
    u32[o + 4] = mapq[g0]!
    f32[o + 5] = insertSize[g0]!
    i32[o + 6] = strand[g0]!
    u32[o + 7] = tagColor[g0]!
    u32[o + 8] = edgeFlags[i]!
    u32[o + 9] = interchrom[g0]!
    u32[o + 10] = colorCategory[g0]!
  }
  return buf
}

// ------------------------------------------------------------ two-pass form
//
// Two partial packs into one buffer, each loop body as tight as the baseline's.
// The only cost over `inline` is that the destination is walked twice — which is
// what this arm exists to price.

const packTwoPass = (data: Data, buf: ArrayBuffer) => {
  const n = data.numSegments
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const segmentPositions = data.segmentPositions
  const segmentEdgeFlags = data.segmentEdgeFlags
  for (let i = 0; i < n; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    u32[o + 0] = segmentPositions[i * 2]!
    u32[o + 1] = segmentPositions[i * 2 + 1]!
    u32[o + 8] = segmentEdgeFlags[i]!
  }
  const index = data.segmentReadIndices
  const readYs = data.readYs
  const readFlags = data.readFlags
  const readMapqs = data.readMapqs
  const readInsertSizes = data.readInsertSizes
  const readStrands = data.readStrands
  const tagColors = data.readTagColors
  const interchrom = data.readInterchrom
  const colorCategories = data.readColorCategories
  for (let i = 0; i < n; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    const ri = index[i]!
    u32[o + 2] = readYs[ri]!
    u32[o + 3] = readFlags[ri]!
    u32[o + 4] = readMapqs[ri]!
    f32[o + 5] = readInsertSizes[ri]!
    i32[o + 6] = readStrands[ri]!
    u32[o + 7] = tagColors[ri]!
    u32[o + 9] = interchrom[ri]!
    u32[o + 10] = colorCategories[ri]!
  }
  return buf
}

// --------------------------------------------------------- materialize form
//
// Gather every per-read column into a fresh segment-length array, then hand the
// REAL generated `packInstances` eleven parallel arrays. Allocates on every call
// by construction — that is the shape being priced, not an oversight.

const packMaterialize = (data: Data, buf: ArrayBuffer) => {
  const n = data.numSegments
  const index = data.segmentReadIndices
  const y = new Uint32Array(n)
  const flags = new Uint32Array(n)
  const mapq = new Uint32Array(n)
  const insertSize = new Float32Array(n)
  const strand = new Int32Array(n)
  const tagColor = new Uint32Array(n)
  const interchrom = new Uint32Array(n)
  const colorCategory = new Uint32Array(n)
  const startOff = new Uint32Array(n)
  const endOff = new Uint32Array(n)
  const sp = data.segmentPositions
  const readYs = data.readYs
  const readFlags = data.readFlags
  const readMapqs = data.readMapqs
  const readInsertSizes = data.readInsertSizes
  const readStrands = data.readStrands
  const readTagColors = data.readTagColors
  const readInterchrom = data.readInterchrom
  const readColorCategories = data.readColorCategories
  for (let i = 0; i < n; i++) {
    const ri = index[i]!
    startOff[i] = sp[i * 2]!
    endOff[i] = sp[i * 2 + 1]!
    y[i] = readYs[ri]!
    flags[i] = readFlags[ri]!
    mapq[i] = readMapqs[ri]!
    insertSize[i] = readInsertSizes[ri]!
    strand[i] = readStrands[ri]!
    tagColor[i] = readTagColors[ri]!
    interchrom[i] = readInterchrom[ri]!
    colorCategory[i] = readColorCategories[ri]!
  }
  return packInstances(
    {
      startOff,
      endOff,
      y,
      flags,
      mapq,
      insertSize,
      strand,
      tagColor,
      edgeFlags: data.segmentEdgeFlags,
      interchrom,
      colorCategory,
    },
    n,
    buf,
  )
}

// ------------------------------------------------------------------ harness

function fail(msg: string) {
  console.error(`  IDENTITY FAIL: ${msg}`)
  if (!ALLOW_DIFF) {
    process.exit(1)
  }
}

function sameBytes(name: string, a: ArrayBuffer, b: ArrayBuffer) {
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  if (x.length !== y.length) {
    fail(`${name}: length ${x.length} vs ${y.length}`)
    return
  }
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) {
      fail(`${name}: byte ${i} is ${x[i]} vs ${y[i]}`)
      return
    }
  }
}

declare const gc: (() => void) | undefined

const FIXTURES = [
  // A deep pileup at long-read density — the largest read buffer this pipeline
  // packs, 8.8 MB at a 44-byte stride.
  { name: 'pileup-deep', segments: 200_000 },
  // A full-height short-read pileup over a typical window.
  { name: 'pileup-typical', segments: 60_000 },
  // A shallow window, small enough to stay resident.
  { name: 'pileup-small', segments: 12_000 },
]

const ARMS = [
  'inline',
  'inline-literal',
  'inline-hoisted',
  'grouped',
  'grouped-strided',
  'desc-gather',
  'desc-affine',
  'desc-ident',
  'desc-branch',
  'twopass',
  'materialize',
  'control',
]

for (const fx of FIXTURES) {
  if (ONLY && !fx.name.includes(ONLY)) {
    continue
  }
  const rand = rng(4242)
  const n = fx.segments
  // ~1.2 segments per read, emitted in read order — so the gather index is
  // monotone non-decreasing, as buildSegments produces it.
  const segmentReadIndices = new Uint32Array(n)
  let ri = 0
  for (let j = 0; j < n; j++) {
    segmentReadIndices[j] = ri
    if (rand() > 0.2) {
      ri++
    }
  }
  const numReads = ri + 1
  const data: Data = {
    numSegments: n,
    segmentPositions: new Uint32Array(n * 2),
    segmentReadIndices,
    segmentEdgeFlags: new Uint32Array(n),
    readYs: new Uint32Array(numReads),
    readFlags: new Uint32Array(numReads),
    readMapqs: new Uint32Array(numReads),
    readInsertSizes: new Float32Array(numReads),
    readStrands: new Int32Array(numReads),
    readTagColors: new Uint32Array(numReads),
    readColorCategories: new Uint32Array(numReads),
    readInterchrom: new Uint32Array(numReads),
  }
  for (let j = 0; j < n; j++) {
    const start = 1_000_000 + j * 30
    data.segmentPositions[j * 2] = start
    data.segmentPositions[j * 2 + 1] = start + 150
    data.segmentEdgeFlags[j] = 1 + Math.floor(rand() * 3)
  }
  for (let i = 0; i < numReads; i++) {
    data.readYs[i] = i % 400
    data.readFlags[i] = Math.floor(rand() * 4096)
    data.readMapqs[i] = Math.floor(rand() * 61)
    data.readInsertSizes[i] = Math.floor(rand() * 1000) - 500
    data.readStrands[i] = rand() > 0.5 ? 1 : -1
    data.readTagColors[i] = Math.floor(rand() * 4_000_000_000)
    data.readColorCategories[i] = Math.floor(rand() * 23)
    data.readInterchrom[i] = rand() > 0.9 ? 1 : 0
  }

  const identity = new Uint32Array(n)
  const evens = new Uint32Array(n)
  const odds = new Uint32Array(n)
  // Pre-split start/end columns, for the `grouped` arm only: it is the form the
  // emitter produces when the worker hands it two columns instead of one
  // interleaved array. `grouped-strided` is the same arm without this.
  const evensView = new Uint32Array(n)
  const oddsView = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    identity[i] = i
    evens[i] = i * 2
    odds[i] = i * 2 + 1
    evensView[i] = data.segmentPositions[i * 2]!
    oddsView[i] = data.segmentPositions[i * 2 + 1]!
  }
  const desc: ReadDesc = {
    startOff: { src: data.segmentPositions, stride: 2 },
    endOff: { src: data.segmentPositions, stride: 2, offset: 1 },
    y: { src: data.readYs, index: segmentReadIndices },
    flags: { src: data.readFlags, index: segmentReadIndices },
    mapq: { src: data.readMapqs, index: segmentReadIndices },
    insertSize: { src: data.readInsertSizes, index: segmentReadIndices },
    strand: { src: data.readStrands, index: segmentReadIndices },
    tagColor: { src: data.readTagColors, index: segmentReadIndices },
    edgeFlags: data.segmentEdgeFlags,
    interchrom: { src: data.readInterchrom, index: segmentReadIndices },
    colorCategory: {
      src: data.readColorCategories,
      index: segmentReadIndices,
    },
  }

  const gathered: ReadGathered = {
    startOff: { src: data.segmentPositions, index: evens, scale: 1, bias: 0 },
    endOff: { src: data.segmentPositions, index: odds, scale: 1, bias: 0 },
    y: { src: data.readYs, index: segmentReadIndices, scale: 1, bias: 0 },
    flags: {
      src: data.readFlags,
      index: segmentReadIndices,
      scale: 1,
      bias: 0,
    },
    mapq: { src: data.readMapqs, index: segmentReadIndices, scale: 1, bias: 0 },
    insertSize: {
      src: data.readInsertSizes,
      index: segmentReadIndices,
      scale: 1,
      bias: 0,
    },
    strand: {
      src: data.readStrands,
      index: segmentReadIndices,
      scale: 1,
      bias: 0,
    },
    tagColor: {
      src: data.readTagColors,
      index: segmentReadIndices,
      scale: 1,
      bias: 0,
    },
    edgeFlags: {
      src: data.segmentEdgeFlags,
      index: identity,
      scale: 1,
      bias: 0,
    },
    interchrom: {
      src: data.readInterchrom,
      index: segmentReadIndices,
      scale: 1,
      bias: 0,
    },
    colorCategory: {
      src: data.readColorCategories,
      index: segmentReadIndices,
      scale: 1,
      bias: 0,
    },
  }

  const segFields: SegmentFields = {
    startOff: evensView,
    endOff: oddsView,
    edgeFlags: data.segmentEdgeFlags,
  }
  const readFields: ReadFields = {
    y: data.readYs,
    flags: data.readFlags,
    mapq: data.readMapqs,
    insertSize: data.readInsertSizes,
    strand: data.readStrands,
    tagColor: data.readTagColors,
    interchrom: data.readInterchrom,
    colorCategory: data.readColorCategories,
  }

  // One destination per arm, so no arm inherits another's memory state.
  const bufs = Object.fromEntries(
    ARMS.map(a => [a, new ArrayBuffer(n * INSTANCE_STRIDE_BYTES)]),
  )
  const call = (arm: string) => {
    const buf = bufs[arm]!
    if (arm === 'inline') {
      return packInline(data, buf)
    }
    if (arm === 'inline-literal') {
      return packInlineLiteral(data, buf)
    }
    if (arm === 'inline-hoisted') {
      return packInlineHoisted(data, buf)
    }
    if (arm === 'grouped') {
      return packGrouped(segFields, readFields, segmentReadIndices, n, buf)
    }
    if (arm === 'grouped-strided') {
      return packGroupedStrided(
        data.segmentPositions,
        data.segmentEdgeFlags,
        readFields,
        segmentReadIndices,
        n,
        buf,
      )
    }
    if (arm === 'desc-gather') {
      return packDescGather(gathered, n, buf)
    }
    if (arm === 'desc-affine') {
      return packDescAffine(gathered, n, buf)
    }
    if (arm === 'desc-ident') {
      return packDescIdent(desc, n, identity, buf)
    }
    if (arm === 'desc-branch') {
      return packDescBranch(desc, n, buf)
    }
    if (arm === 'twopass') {
      return packTwoPass(data, buf)
    }
    if (arm === 'materialize') {
      return packMaterialize(data, buf)
    }
    return packControl(data, buf)
  }

  // Warm every arm the same number of times — asymmetric warmup is its own
  // entry in the trap catalogue. `call` is warmup only; the timed region below
  // dispatches to each arm from its own call site.
  for (let w = 0; w < 20; w++) {
    for (const arm of ARMS) {
      call(arm)
    }
  }
  for (const arm of ARMS) {
    if (arm !== 'inline') {
      sameBytes(`${fx.name} ${arm}`, bufs.inline!, bufs[arm]!)
    }
  }

  const best: Record<string, number> = {}
  for (const a of ARMS) {
    best[a] = Infinity
  }
  const N = ARMS.length
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    for (let k = 0; k < N; k++) {
      const which = (r + k) % N
      const t = performance.now()
      if (which === 0) {
        packInline(data, bufs.inline!)
      } else if (which === 1) {
        packInlineLiteral(data, bufs['inline-literal']!)
      } else if (which === 2) {
        packInlineHoisted(data, bufs['inline-hoisted']!)
      } else if (which === 3) {
        packGrouped(segFields, readFields, segmentReadIndices, n, bufs.grouped!)
      } else if (which === 4) {
        packGroupedStrided(
          data.segmentPositions,
          data.segmentEdgeFlags,
          readFields,
          segmentReadIndices,
          n,
          bufs['grouped-strided']!,
        )
      } else if (which === 5) {
        packDescGather(gathered, n, bufs['desc-gather']!)
      } else if (which === 6) {
        packDescAffine(gathered, n, bufs['desc-affine']!)
      } else if (which === 7) {
        packDescIdent(desc, n, identity, bufs['desc-ident']!)
      } else if (which === 8) {
        packDescBranch(desc, n, bufs['desc-branch']!)
      } else if (which === 9) {
        packTwoPass(data, bufs.twopass!)
      } else if (which === 10) {
        packMaterialize(data, bufs.materialize!)
      } else {
        packControl(data, bufs.control!)
      }
      best[ARMS[which]!] = Math.min(best[ARMS[which]!]!, performance.now() - t)
    }
  }

  const fmt = (x: number) => x.toFixed(3)
  const base = best.inline!
  console.log(
    `\n${fx.name}  (${n.toLocaleString()} segments, ${numReads.toLocaleString()} reads, ` +
      `${((n * INSTANCE_STRIDE_BYTES) / 1e6).toFixed(1)} MB buffer)`,
  )
  console.log(`  inline ${fmt(base)} ms`)
  for (const a of ARMS) {
    if (a !== 'inline') {
      console.log(
        `  ${a.padEnd(12)} ${fmt(best[a]!)} ms  (${(base / best[a]!).toFixed(3)}x)`,
      )
    }
  }
}
