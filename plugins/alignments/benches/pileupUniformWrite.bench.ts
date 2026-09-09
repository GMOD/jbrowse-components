// What would the pileup band's uniform write cost as a MARK's writer?
//
//   node plugins/alignments/benches/pileupUniformWrite.bench.ts --sections=1
//   node plugins/alignments/benches/pileupUniformWrite.bench.ts --sections=40 \
//     --blocks=3 --reps=100
//   node plugins/alignments/benches/pileupUniformWrite.bench.ts --sections=40 \
//     --reps=40
//
// Flags: --sections=<n> (required), --blocks=<n>, --rounds=<n>, --reps=<n>.
// 3 x 40 is the 120 section blocks per frame `Canvas2DAlignmentsRenderer` names
// at MAX_GROUPS; 8 x 40 is the wider shape and 8 x 1 the ungrouped default.
//
// The harness rules (interleave, min-of-rounds, a separately-declared control,
// an identity check before any timing is believed) are in
// agent-docs/reference/BENCHMARKING.md. ONE SECTION COUNT PER PROCESS, for the
// reason that file gives under "Looping several DATASETS through the same arm
// function objects": arm function objects reused across fixtures contaminate
// every fixture after the first.
//
// THE QUESTION. `GpuAlignmentsRenderer` is the tree's last offset-poke uniform
// writer. It writes the 640-byte pileup struct's frame-constant half — the
// palette, `readCategoryColor[23]` and `linkedReadColor[8]` included, ~150
// stores — ONCE ahead of the block loop (`writePalette`), then pokes the 18
// per-section-block slots and stages the buffer. A `MarkShape.writeUniforms` is
// handed a bare `ArrayBuffer` and has no frame hook, so converting the thirteen
// pileup layers to a mark list moves that palette write inside the loop.
//
// NINE ARMS, one a control. The first five price the WRITE against `poke`; the
// last three price today's section block against the two mark walks that could
// replace it, which is the comparison `poke` cannot make because it omits the
// gate loop.
//   poke     — today's write: per-frame palette + per-section-block pokes
//   control  — a separately-declared duplicate of `poke`, so `control / poke`
//              is what this harness could resolve at all
//   total    — a whole-struct generated `writeUniforms` per section block, the
//              form `writeArcBandUniforms` and every other packer in tree take:
//              an object literal with its nested `float4[]` tuples, three
//              typed-array views, 158 stores
//   hoisted  — `total` with the two `float4[]` tables and the thirteen packs
//              resolved once per palette, the memo `coverageMarks.ts` keeps
//   template — the whole struct packed once per frame into a template, then
//              `scratch.set(template)` plus the 7 slots that actually vary per
//              section block
//   pokeview — `poke`, but the writer takes a bare `ArrayBuffer` and derives
//              its two views per call, which is what a module-level
//              `MarkShape.writeUniforms` has to do; the renderer keeps the
//              per-frame palette write into that same buffer
//   pokegate — `poke` plus the thirteen `layer.enabled(state)` calls today's
//              GPU section block runs, i.e. all of today
//   preseed  — the conversion with the write left where it is: the renderer
//              stages the struct and hands the thirteen marks a staged record
//              already naming that writer and lens, so no mark writes. What is
//              left is the walk, and `preseed / pokegate` is its price
//   plan     — the conversion through `planMarks` / `drawPlannedPasses`: the
//              thirteen gates are asked ONCE per frame and the section block
//              draws the planned pass list off the renderer's own write, so
//              the per-block loop is two field reads and a `drawPass` per
//              enabled mark. `plan / pokegate` is what the mark list costs
//              once the frame question leaves the block loop
//
// The HAL stub stages the way `WebGPUHal.writeUniforms` does (a `set` into the
// ring's CPU staging array, slot post-incremented). `drawPass` is a counter —
// thirteen per section block in every arm, so it cannot move the delta.
//
// Written out longhand, nine times. Do NOT refactor the drivers or the writers
// into one parameterized function: a shared driver makes the call site
// polymorphic and hands all arms one set of inline caches, which has scored a
// byte-identical control at 1.14x in this repo's sibling benches.

import {
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32,
  UNIFORM_OFFSET_I32,
  UNIFORM_OFFSET_U32,
  UNIFORM_SLOT_ARRAYS,
  setUniformLinkedReadColor,
  setUniformReadCategoryColor,
  writeUniforms,
} from '../src/shaders/slang/read.iface.generated.ts'

import type { Uniforms } from '../src/shaders/slang/read.iface.generated.ts'

const arg = (name: string, dflt: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt

const SECTIONS = Number(arg('sections', '0'))
const BLOCKS = Number(arg('blocks', '8'))
const ROUNDS = Number(arg('rounds', '25'))
const REPS = Number(arg('reps', '400'))

if (!Number.isInteger(SECTIONS) || SECTIONS < 1) {
  console.error('--sections=<n>, one section count per process')
  process.exit(1)
}

const SLOT_BYTES = UNIFORMS_SIZE_BYTES
const RING_SLOTS = 8192
const LAYERS = 13

/** Shaped like `WebGPUHal.writeUniforms`'s in-frame path. */
class TimingHal {
  staging = new Uint8Array(RING_SLOTS * SLOT_BYTES)
  slot = 0
  writes = 0
  draws = 0
  writeUniforms(data: ArrayBuffer) {
    this.staging.set(new Uint8Array(data), this.slot * SLOT_BYTES)
    this.slot++
    this.writes++
  }
  drawPass(_passId?: string, _bufferPassId?: string) {
    this.draws++
  }
}

// ---------------------------------------------------------------- fixtures

const CANVAS_W = 1600
const CANVAS_H = 800

interface Block {
  bpHi: number
  bpLo: number
  bpLen: number
  canvasW: number
  reversed: boolean
}

const BLOCK_LIST: Block[] = []
for (let i = 0; i < BLOCKS; i++) {
  const start = 1_000_000 + i * 20_000
  BLOCK_LIST.push({
    bpHi: Math.floor(start / 4096) * 4096,
    bpLo: start % 4096,
    bpLen: 20_000,
    canvasW: CANVAS_W / BLOCKS,
    reversed: i % 4 === 3,
  })
}

// One stacked section's pileup top, the one uniform that varies per section.
const SECTION_TOPS: number[] = []
for (let s = 0; s < SECTIONS; s++) {
  SECTION_TOPS.push(s * 120)
}

type Rgb = readonly [number, number, number]

const NAMED_KEYS = [
  'colorBaseA',
  'colorBaseC',
  'colorBaseG',
  'colorBaseT',
  'colorBaseN',
  'colorInsertion',
  'colorDeletion',
  'colorSkip',
  'colorSoftclip',
  'colorHardclip',
  'colorConnectingLine',
  'colorOverlapTint',
  'colorOverlap',
] as const

const LINKED_COUNT = UNIFORM_SLOT_ARRAYS.linkedReadColor.length
const CATEGORY_COUNT = UNIFORM_SLOT_ARRAYS.readCategoryColor.length

// A palette of the real cardinality: thirteen named slots plus the two indexed
// tables the shader declares. The VALUES are arbitrary; what the arms pay for
// is the slot count and the per-slot pack.
function palette() {
  const named: Record<string, Rgb> = {}
  NAMED_KEYS.forEach((k, i) => {
    named[k] = [(i * 17) / 255, (i * 29) / 255, (i * 41) / 255]
  })
  const linked: Rgb[] = []
  for (let i = 0; i < LINKED_COUNT; i++) {
    linked.push([(i * 13) / 255, (i * 23) / 255, (i * 37) / 255])
  }
  const category: Rgb[] = []
  for (let i = 0; i < CATEGORY_COUNT; i++) {
    category.push([(i * 7) / 255, (i * 11) / 255, (i * 19) / 255])
  }
  return { named, linked, category }
}

const COLORS = palette()

// `normalizedRgbToABGR`, inlined so the bench imports nothing but the
// generated interface.
function packRgb(rgb: Rgb) {
  return (
    ((255 << 24) |
      (Math.round(rgb[2] * 255) << 16) |
      (Math.round(rgb[1] * 255) << 8) |
      Math.round(rgb[0] * 255)) >>>
    0
  )
}

interface FrameState {
  scrollTop: number
  featureHeight: number
  featureSpacing: number
  colorScheme: number
  chainMode: boolean
  showStroke: boolean
  filterMismatchesByFrequency: boolean
  mismatchAlpha: boolean
  dpr: number
}

const STATE: FrameState = {
  scrollTop: 40,
  featureHeight: 7,
  featureSpacing: 1,
  colorScheme: 3,
  chainMode: false,
  showStroke: true,
  filterMismatchesByFrequency: true,
  mismatchAlpha: false,
  dpr: 2,
}

const F = UNIFORM_OFFSET_F32
const I = UNIFORM_OFFSET_I32
const U = UNIFORM_OFFSET_U32

// ------------------------------------------------------------- arm "poke"
// Today's `GpuAlignmentsRenderer`: `writePalette` once ahead of the block loop,
// `fillFrameUniforms` per section block.

const POKE_BUF = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
const POKE_F32 = new Float32Array(POKE_BUF)
const POKE_I32 = new Int32Array(POKE_BUF)
const POKE_U32 = new Uint32Array(POKE_BUF)

function pokePalette(f32: Float32Array, u32: Uint32Array) {
  for (let i = 0; i < NAMED_KEYS.length; i++) {
    u32[U[NAMED_KEYS[i]!]] = packRgb(COLORS.named[NAMED_KEYS[i]!]!)
  }
  for (let i = 0; i < LINKED_COUNT; i++) {
    const rgb = COLORS.linked[i]!
    setUniformLinkedReadColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
  for (let i = 0; i < CATEGORY_COUNT; i++) {
    const rgb = COLORS.category[i]!
    setUniformReadCategoryColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
}

function pokeFrame(
  f32: Float32Array,
  i32: Int32Array,
  block: Block,
  top: number,
) {
  f32[F.devicePixelRatio] = STATE.dpr
  f32[F.bpHi] = block.bpHi
  f32[F.bpLo] = block.bpLo
  f32[F.bpLen] = block.bpLen
  f32[F.hpZero] = 0
  f32[F.canvasW] = block.canvasW
  f32[F.pxPerBp] = block.canvasW / block.bpLen
  f32[F.canvasH] = CANVAS_H
  f32[F.rangeY0] = STATE.scrollTop
  f32[F.covOffset] = top
  f32[F.featHeight] = STATE.featureHeight
  f32[F.featSpacing] = STATE.featureSpacing
  i32[I.filterMismatchesByFrequency] = STATE.filterMismatchesByFrequency ? 1 : 0
  i32[I.mismatchAlpha] = STATE.mismatchAlpha ? 1 : 0
  i32[I.colorScheme] = STATE.colorScheme
  i32[I.chainMode] = STATE.chainMode ? 1 : 0
  i32[I.showStroke] = STATE.showStroke ? 1 : 0
  f32[F.reversed] = block.reversed ? 1 : 0
}

function runPoke(hal: TimingHal, reps: number) {
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    pokePalette(POKE_F32, POKE_U32)
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      for (let s = 0; s < SECTION_TOPS.length; s++) {
        pokeFrame(POKE_F32, POKE_I32, block, SECTION_TOPS[s]!)
        hal.writeUniforms(POKE_BUF)
        for (let l = 0; l < LAYERS; l++) {
          hal.drawPass()
        }
      }
    }
  }
}

// ---------------------------------------------------------- arm "control"
// A second, separately-declared copy of `poke`, so its ratio against `poke` is
// this harness's own resolution. The duplication is deliberate; see the header.

const CTRL_BUF = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
const CTRL_F32 = new Float32Array(CTRL_BUF)
const CTRL_I32 = new Int32Array(CTRL_BUF)
const CTRL_U32 = new Uint32Array(CTRL_BUF)

function ctrlPalette(f32: Float32Array, u32: Uint32Array) {
  for (let i = 0; i < NAMED_KEYS.length; i++) {
    u32[U[NAMED_KEYS[i]!]] = packRgb(COLORS.named[NAMED_KEYS[i]!]!)
  }
  for (let i = 0; i < LINKED_COUNT; i++) {
    const rgb = COLORS.linked[i]!
    setUniformLinkedReadColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
  for (let i = 0; i < CATEGORY_COUNT; i++) {
    const rgb = COLORS.category[i]!
    setUniformReadCategoryColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
}

function ctrlFrame(
  f32: Float32Array,
  i32: Int32Array,
  block: Block,
  top: number,
) {
  f32[F.devicePixelRatio] = STATE.dpr
  f32[F.bpHi] = block.bpHi
  f32[F.bpLo] = block.bpLo
  f32[F.bpLen] = block.bpLen
  f32[F.hpZero] = 0
  f32[F.canvasW] = block.canvasW
  f32[F.pxPerBp] = block.canvasW / block.bpLen
  f32[F.canvasH] = CANVAS_H
  f32[F.rangeY0] = STATE.scrollTop
  f32[F.covOffset] = top
  f32[F.featHeight] = STATE.featureHeight
  f32[F.featSpacing] = STATE.featureSpacing
  i32[I.filterMismatchesByFrequency] = STATE.filterMismatchesByFrequency ? 1 : 0
  i32[I.mismatchAlpha] = STATE.mismatchAlpha ? 1 : 0
  i32[I.colorScheme] = STATE.colorScheme
  i32[I.chainMode] = STATE.chainMode ? 1 : 0
  i32[I.showStroke] = STATE.showStroke ? 1 : 0
  f32[F.reversed] = block.reversed ? 1 : 0
}

function runControl(hal: TimingHal, reps: number) {
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    ctrlPalette(CTRL_F32, CTRL_U32)
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      for (let s = 0; s < SECTION_TOPS.length; s++) {
        ctrlFrame(CTRL_F32, CTRL_I32, block, SECTION_TOPS[s]!)
        hal.writeUniforms(CTRL_BUF)
        for (let l = 0; l < LAYERS; l++) {
          hal.drawPass()
        }
      }
    }
  }
}

// ------------------------------------------------------------ arm "total"
// The generated object packer per section block, the shape every other uniform
// writer in tree takes.

const TOTAL_BUF = new ArrayBuffer(UNIFORMS_SIZE_BYTES)

type Slot4 = [number, number, number, number]

function totalSlot(rgb: Rgb): Slot4 {
  return [rgb[0], rgb[1], rgb[2], 1]
}

function totalValues(block: Block, top: number): Uniforms {
  const c = COLORS
  return {
    bpHi: block.bpHi,
    bpLo: block.bpLo,
    bpLen: block.bpLen,
    hpZero: 0,
    canvasW: block.canvasW,
    canvasH: CANVAS_H,
    rangeY0: STATE.scrollTop,
    covOffset: top,
    featHeight: STATE.featureHeight,
    featSpacing: STATE.featureSpacing,
    colorScheme: STATE.colorScheme,
    chainMode: STATE.chainMode ? 1 : 0,
    showStroke: STATE.showStroke ? 1 : 0,
    filterMismatchesByFrequency: STATE.filterMismatchesByFrequency ? 1 : 0,
    mismatchAlpha: STATE.mismatchAlpha ? 1 : 0,
    reversed: block.reversed ? 1 : 0,
    colorBaseA: packRgb(c.named.colorBaseA!),
    colorBaseC: packRgb(c.named.colorBaseC!),
    colorBaseG: packRgb(c.named.colorBaseG!),
    colorBaseT: packRgb(c.named.colorBaseT!),
    colorBaseN: packRgb(c.named.colorBaseN!),
    colorInsertion: packRgb(c.named.colorInsertion!),
    colorDeletion: packRgb(c.named.colorDeletion!),
    colorSkip: packRgb(c.named.colorSkip!),
    colorSoftclip: packRgb(c.named.colorSoftclip!),
    colorHardclip: packRgb(c.named.colorHardclip!),
    colorConnectingLine: packRgb(c.named.colorConnectingLine!),
    colorOverlapTint: packRgb(c.named.colorOverlapTint!),
    colorOverlap: packRgb(c.named.colorOverlap!),
    linkedReadColor: [
      totalSlot(c.linked[0]!),
      totalSlot(c.linked[1]!),
      totalSlot(c.linked[2]!),
      totalSlot(c.linked[3]!),
      totalSlot(c.linked[4]!),
      totalSlot(c.linked[5]!),
      totalSlot(c.linked[6]!),
      totalSlot(c.linked[7]!),
    ],
    readCategoryColor: [
      totalSlot(c.category[0]!),
      totalSlot(c.category[1]!),
      totalSlot(c.category[2]!),
      totalSlot(c.category[3]!),
      totalSlot(c.category[4]!),
      totalSlot(c.category[5]!),
      totalSlot(c.category[6]!),
      totalSlot(c.category[7]!),
      totalSlot(c.category[8]!),
      totalSlot(c.category[9]!),
      totalSlot(c.category[10]!),
      totalSlot(c.category[11]!),
      totalSlot(c.category[12]!),
      totalSlot(c.category[13]!),
      totalSlot(c.category[14]!),
      totalSlot(c.category[15]!),
      totalSlot(c.category[16]!),
      totalSlot(c.category[17]!),
      totalSlot(c.category[18]!),
      totalSlot(c.category[19]!),
      totalSlot(c.category[20]!),
      totalSlot(c.category[21]!),
      totalSlot(c.category[22]!),
    ],
    pxPerBp: block.canvasW / block.bpLen,
    devicePixelRatio: STATE.dpr,
  }
}

function runTotal(hal: TimingHal, reps: number) {
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      for (let s = 0; s < SECTION_TOPS.length; s++) {
        writeUniforms(TOTAL_BUF, totalValues(block, SECTION_TOPS[s]!))
        hal.writeUniforms(TOTAL_BUF)
        for (let l = 0; l < LAYERS; l++) {
          hal.drawPass()
        }
      }
    }
  }
}

// --------------------------------------------------------- arm "template"
// The whole struct packed once per frame, then a 640-byte copy plus the seven
// slots that actually vary per section block.

const TEMPLATE_BUF = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
const TEMPLATE_U8 = new Uint8Array(TEMPLATE_BUF)
const TMPL_BUF = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
const TMPL_U8 = new Uint8Array(TMPL_BUF)
const TMPL_F32 = new Float32Array(TMPL_BUF)

function templateValues(): Uniforms {
  const c = COLORS
  return {
    bpHi: 0,
    bpLo: 0,
    bpLen: 1,
    hpZero: 0,
    canvasW: 0,
    canvasH: CANVAS_H,
    rangeY0: STATE.scrollTop,
    covOffset: 0,
    featHeight: STATE.featureHeight,
    featSpacing: STATE.featureSpacing,
    colorScheme: STATE.colorScheme,
    chainMode: STATE.chainMode ? 1 : 0,
    showStroke: STATE.showStroke ? 1 : 0,
    filterMismatchesByFrequency: STATE.filterMismatchesByFrequency ? 1 : 0,
    mismatchAlpha: STATE.mismatchAlpha ? 1 : 0,
    reversed: 0,
    colorBaseA: packRgb(c.named.colorBaseA!),
    colorBaseC: packRgb(c.named.colorBaseC!),
    colorBaseG: packRgb(c.named.colorBaseG!),
    colorBaseT: packRgb(c.named.colorBaseT!),
    colorBaseN: packRgb(c.named.colorBaseN!),
    colorInsertion: packRgb(c.named.colorInsertion!),
    colorDeletion: packRgb(c.named.colorDeletion!),
    colorSkip: packRgb(c.named.colorSkip!),
    colorSoftclip: packRgb(c.named.colorSoftclip!),
    colorHardclip: packRgb(c.named.colorHardclip!),
    colorConnectingLine: packRgb(c.named.colorConnectingLine!),
    colorOverlapTint: packRgb(c.named.colorOverlapTint!),
    colorOverlap: packRgb(c.named.colorOverlap!),
    linkedReadColor: [
      totalSlot(c.linked[0]!),
      totalSlot(c.linked[1]!),
      totalSlot(c.linked[2]!),
      totalSlot(c.linked[3]!),
      totalSlot(c.linked[4]!),
      totalSlot(c.linked[5]!),
      totalSlot(c.linked[6]!),
      totalSlot(c.linked[7]!),
    ],
    readCategoryColor: [
      totalSlot(c.category[0]!),
      totalSlot(c.category[1]!),
      totalSlot(c.category[2]!),
      totalSlot(c.category[3]!),
      totalSlot(c.category[4]!),
      totalSlot(c.category[5]!),
      totalSlot(c.category[6]!),
      totalSlot(c.category[7]!),
      totalSlot(c.category[8]!),
      totalSlot(c.category[9]!),
      totalSlot(c.category[10]!),
      totalSlot(c.category[11]!),
      totalSlot(c.category[12]!),
      totalSlot(c.category[13]!),
      totalSlot(c.category[14]!),
      totalSlot(c.category[15]!),
      totalSlot(c.category[16]!),
      totalSlot(c.category[17]!),
      totalSlot(c.category[18]!),
      totalSlot(c.category[19]!),
      totalSlot(c.category[20]!),
      totalSlot(c.category[21]!),
      totalSlot(c.category[22]!),
    ],
    pxPerBp: 0,
    devicePixelRatio: STATE.dpr,
  }
}

function runTemplate(hal: TimingHal, reps: number) {
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    writeUniforms(TEMPLATE_BUF, templateValues())
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      for (let s = 0; s < SECTION_TOPS.length; s++) {
        TMPL_U8.set(TEMPLATE_U8)
        TMPL_F32[F.bpHi] = block.bpHi
        TMPL_F32[F.bpLo] = block.bpLo
        TMPL_F32[F.bpLen] = block.bpLen
        TMPL_F32[F.canvasW] = block.canvasW
        TMPL_F32[F.pxPerBp] = block.canvasW / block.bpLen
        TMPL_F32[F.reversed] = block.reversed ? 1 : 0
        TMPL_F32[F.covOffset] = SECTION_TOPS[s]!
        hal.writeUniforms(TMPL_BUF)
        for (let l = 0; l < LAYERS; l++) {
          hal.drawPass()
        }
      }
    }
  }
}

// --------------------------------------------------------- arm "pokeview"
// `poke` reached the way a mark reaches it: one module-level writer handed the
// bare scratch, deriving its views per call. The palette still goes in once per
// frame, from the renderer, into the same buffer.

const VIEW_BUF = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
const VIEW_F32 = new Float32Array(VIEW_BUF)
const VIEW_U32 = new Uint32Array(VIEW_BUF)

function viewPalette(f32: Float32Array, u32: Uint32Array) {
  for (let i = 0; i < NAMED_KEYS.length; i++) {
    u32[U[NAMED_KEYS[i]!]] = packRgb(COLORS.named[NAMED_KEYS[i]!]!)
  }
  for (let i = 0; i < LINKED_COUNT; i++) {
    const rgb = COLORS.linked[i]!
    setUniformLinkedReadColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
  for (let i = 0; i < CATEGORY_COUNT; i++) {
    const rgb = COLORS.category[i]!
    setUniformReadCategoryColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
}

function viewFrame(scratch: ArrayBuffer, block: Block, top: number) {
  const f32 = new Float32Array(scratch)
  const i32 = new Int32Array(scratch)
  f32[F.devicePixelRatio] = STATE.dpr
  f32[F.bpHi] = block.bpHi
  f32[F.bpLo] = block.bpLo
  f32[F.bpLen] = block.bpLen
  f32[F.hpZero] = 0
  f32[F.canvasW] = block.canvasW
  f32[F.pxPerBp] = block.canvasW / block.bpLen
  f32[F.canvasH] = CANVAS_H
  f32[F.rangeY0] = STATE.scrollTop
  f32[F.covOffset] = top
  f32[F.featHeight] = STATE.featureHeight
  f32[F.featSpacing] = STATE.featureSpacing
  i32[I.filterMismatchesByFrequency] = STATE.filterMismatchesByFrequency ? 1 : 0
  i32[I.mismatchAlpha] = STATE.mismatchAlpha ? 1 : 0
  i32[I.colorScheme] = STATE.colorScheme
  i32[I.chainMode] = STATE.chainMode ? 1 : 0
  i32[I.showStroke] = STATE.showStroke ? 1 : 0
  f32[F.reversed] = block.reversed ? 1 : 0
}

function runPokeView(hal: TimingHal, reps: number) {
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    viewPalette(VIEW_F32, VIEW_U32)
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      for (let s = 0; s < SECTION_TOPS.length; s++) {
        viewFrame(VIEW_BUF, block, SECTION_TOPS[s]!)
        hal.writeUniforms(VIEW_BUF)
        for (let l = 0; l < LAYERS; l++) {
          hal.drawPass()
        }
      }
    }
  }
}

// ---------------------------------------------------------- arm "hoisted"
// The generated packer again, but the two `float4[]` tables and the thirteen
// named packs are resolved once per palette rather than per call — the memo
// `coverageMarks.ts`'s `bandColors` already keeps beside this one. Still a
// total write: 158 stores and three views per section block, no template.

const HOIST_BUF = new ArrayBuffer(UNIFORMS_SIZE_BYTES)

interface HoistedColors {
  named: Record<string, number>
  linked: Uniforms['linkedReadColor']
  category: Uniforms['readCategoryColor']
}

function hoistColors(): HoistedColors {
  const named: Record<string, number> = {}
  for (const k of NAMED_KEYS) {
    named[k] = packRgb(COLORS.named[k]!)
  }
  const slot = (rgb: Rgb): Slot4 => [rgb[0], rgb[1], rgb[2], 1]
  return {
    named,
    linked: [
      slot(COLORS.linked[0]!),
      slot(COLORS.linked[1]!),
      slot(COLORS.linked[2]!),
      slot(COLORS.linked[3]!),
      slot(COLORS.linked[4]!),
      slot(COLORS.linked[5]!),
      slot(COLORS.linked[6]!),
      slot(COLORS.linked[7]!),
    ],
    category: [
      slot(COLORS.category[0]!),
      slot(COLORS.category[1]!),
      slot(COLORS.category[2]!),
      slot(COLORS.category[3]!),
      slot(COLORS.category[4]!),
      slot(COLORS.category[5]!),
      slot(COLORS.category[6]!),
      slot(COLORS.category[7]!),
      slot(COLORS.category[8]!),
      slot(COLORS.category[9]!),
      slot(COLORS.category[10]!),
      slot(COLORS.category[11]!),
      slot(COLORS.category[12]!),
      slot(COLORS.category[13]!),
      slot(COLORS.category[14]!),
      slot(COLORS.category[15]!),
      slot(COLORS.category[16]!),
      slot(COLORS.category[17]!),
      slot(COLORS.category[18]!),
      slot(COLORS.category[19]!),
      slot(COLORS.category[20]!),
      slot(COLORS.category[21]!),
      slot(COLORS.category[22]!),
    ],
  }
}

const HOISTED = hoistColors()

function hoistValues(block: Block, top: number): Uniforms {
  const c = HOISTED
  return {
    bpHi: block.bpHi,
    bpLo: block.bpLo,
    bpLen: block.bpLen,
    hpZero: 0,
    canvasW: block.canvasW,
    canvasH: CANVAS_H,
    rangeY0: STATE.scrollTop,
    covOffset: top,
    featHeight: STATE.featureHeight,
    featSpacing: STATE.featureSpacing,
    colorScheme: STATE.colorScheme,
    chainMode: STATE.chainMode ? 1 : 0,
    showStroke: STATE.showStroke ? 1 : 0,
    filterMismatchesByFrequency: STATE.filterMismatchesByFrequency ? 1 : 0,
    mismatchAlpha: STATE.mismatchAlpha ? 1 : 0,
    reversed: block.reversed ? 1 : 0,
    colorBaseA: c.named.colorBaseA!,
    colorBaseC: c.named.colorBaseC!,
    colorBaseG: c.named.colorBaseG!,
    colorBaseT: c.named.colorBaseT!,
    colorBaseN: c.named.colorBaseN!,
    colorInsertion: c.named.colorInsertion!,
    colorDeletion: c.named.colorDeletion!,
    colorSkip: c.named.colorSkip!,
    colorSoftclip: c.named.colorSoftclip!,
    colorHardclip: c.named.colorHardclip!,
    colorConnectingLine: c.named.colorConnectingLine!,
    colorOverlapTint: c.named.colorOverlapTint!,
    colorOverlap: c.named.colorOverlap!,
    linkedReadColor: c.linked,
    readCategoryColor: c.category,
    pxPerBp: block.canvasW / block.bpLen,
    devicePixelRatio: STATE.dpr,
  }
}

function runHoisted(hal: TimingHal, reps: number) {
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      for (let s = 0; s < SECTION_TOPS.length; s++) {
        writeUniforms(HOIST_BUF, hoistValues(block, SECTION_TOPS[s]!))
        hal.writeUniforms(HOIST_BUF)
        for (let l = 0; l < LAYERS; l++) {
          hal.drawPass()
        }
      }
    }
  }
}

// -------------------------------------------------------- arm "pokegate"
// `poke` plus the gate loop today's GPU section block actually runs —
// `for (const layer of PILEUP_LAYERS) if (layer.enabled(state))`, thirteen
// closures over one call site. Every arm here would carry the same loop after a
// conversion, so it is a constant on both sides of every write delta; isolating
// it is what makes `preseed` comparable to today rather than to a `poke` that
// skipped it.

const GATE_BUF = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
const GATE_F32 = new Float32Array(GATE_BUF)
const GATE_I32 = new Int32Array(GATE_BUF)
const GATE_U32 = new Uint32Array(GATE_BUF)

function gatePalette(f32: Float32Array, u32: Uint32Array) {
  for (let i = 0; i < NAMED_KEYS.length; i++) {
    u32[U[NAMED_KEYS[i]!]] = packRgb(COLORS.named[NAMED_KEYS[i]!]!)
  }
  for (let i = 0; i < LINKED_COUNT; i++) {
    const rgb = COLORS.linked[i]!
    setUniformLinkedReadColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
  for (let i = 0; i < CATEGORY_COUNT; i++) {
    const rgb = COLORS.category[i]!
    setUniformReadCategoryColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
}

function gateFrame(
  f32: Float32Array,
  i32: Int32Array,
  block: Block,
  top: number,
) {
  f32[F.devicePixelRatio] = STATE.dpr
  f32[F.bpHi] = block.bpHi
  f32[F.bpLo] = block.bpLo
  f32[F.bpLen] = block.bpLen
  f32[F.hpZero] = 0
  f32[F.canvasW] = block.canvasW
  f32[F.pxPerBp] = block.canvasW / block.bpLen
  f32[F.canvasH] = CANVAS_H
  f32[F.rangeY0] = STATE.scrollTop
  f32[F.covOffset] = top
  f32[F.featHeight] = STATE.featureHeight
  f32[F.featSpacing] = STATE.featureSpacing
  i32[I.filterMismatchesByFrequency] = STATE.filterMismatchesByFrequency ? 1 : 0
  i32[I.mismatchAlpha] = STATE.mismatchAlpha ? 1 : 0
  i32[I.colorScheme] = STATE.colorScheme
  i32[I.chainMode] = STATE.chainMode ? 1 : 0
  i32[I.showStroke] = STATE.showStroke ? 1 : 0
  f32[F.reversed] = block.reversed ? 1 : 0
}

interface GateLayer {
  id: string
  enabled: (s: FrameState) => boolean
}

const GATE_LAYERS: GateLayer[] = [
  { id: 'connLine', enabled: s => s.showStroke },
  { id: 'linkedReadLine', enabled: s => s.showStroke },
  { id: 'read', enabled: () => true },
  { id: 'overlap', enabled: s => s.showStroke },
  { id: 'mod', enabled: s => s.filterMismatchesByFrequency },
  { id: 'perBaseQual', enabled: s => s.filterMismatchesByFrequency },
  { id: 'skip', enabled: () => true },
  { id: 'deletion', enabled: s => s.filterMismatchesByFrequency },
  { id: 'mismatch', enabled: s => s.filterMismatchesByFrequency },
  { id: 'insertion', enabled: s => s.filterMismatchesByFrequency },
  { id: 'clip', enabled: () => true },
  { id: 'softclipBases', enabled: s => s.showStroke },
  { id: 'perBaseLetter', enabled: s => s.showStroke },
]

function runPokeGate(hal: TimingHal, reps: number) {
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    gatePalette(GATE_F32, GATE_U32)
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      for (let s = 0; s < SECTION_TOPS.length; s++) {
        gateFrame(GATE_F32, GATE_I32, block, SECTION_TOPS[s]!)
        hal.writeUniforms(GATE_BUF)
        for (const layer of GATE_LAYERS) {
          if (layer.enabled(STATE)) {
            hal.drawPass()
          }
        }
      }
    }
  }
}

// --------------------------------------------------------- arm "preseed"
// The conversion with the write left where it is: the renderer stages the
// pileup struct per section block exactly as `poke` does, then hands the
// thirteen marks a `StagedUniforms` already naming that writer and lens, so
// every one of them skips the write and draws. What it prices is the mark walk
// itself — the identity lens, `paintsBlock` and the staged compare, thirteen
// times per section block, against today's thirteen `layer.enabled(state)`.

const PRESEED_BUF = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
const PRESEED_F32 = new Float32Array(PRESEED_BUF)
const PRESEED_I32 = new Int32Array(PRESEED_BUF)
const PRESEED_U32 = new Uint32Array(PRESEED_BUF)

function preseedPalette(f32: Float32Array, u32: Uint32Array) {
  for (let i = 0; i < NAMED_KEYS.length; i++) {
    u32[U[NAMED_KEYS[i]!]] = packRgb(COLORS.named[NAMED_KEYS[i]!]!)
  }
  for (let i = 0; i < LINKED_COUNT; i++) {
    const rgb = COLORS.linked[i]!
    setUniformLinkedReadColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
  for (let i = 0; i < CATEGORY_COUNT; i++) {
    const rgb = COLORS.category[i]!
    setUniformReadCategoryColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
}

function preseedFrame(
  f32: Float32Array,
  i32: Int32Array,
  block: Block,
  top: number,
) {
  f32[F.devicePixelRatio] = STATE.dpr
  f32[F.bpHi] = block.bpHi
  f32[F.bpLo] = block.bpLo
  f32[F.bpLen] = block.bpLen
  f32[F.hpZero] = 0
  f32[F.canvasW] = block.canvasW
  f32[F.pxPerBp] = block.canvasW / block.bpLen
  f32[F.canvasH] = CANVAS_H
  f32[F.rangeY0] = STATE.scrollTop
  f32[F.covOffset] = top
  f32[F.featHeight] = STATE.featureHeight
  f32[F.featSpacing] = STATE.featureSpacing
  i32[I.filterMismatchesByFrequency] = STATE.filterMismatchesByFrequency ? 1 : 0
  i32[I.mismatchAlpha] = STATE.mismatchAlpha ? 1 : 0
  i32[I.colorScheme] = STATE.colorScheme
  i32[I.chainMode] = STATE.chainMode ? 1 : 0
  i32[I.showStroke] = STATE.showStroke ? 1 : 0
  f32[F.reversed] = block.reversed ? 1 : 0
}

interface Staged {
  writer: unknown
  params: unknown
}

// `defineMark`'s `drawRegion` for a mark with no band and no borrowed buffer,
// hand-copied for the reason the header gives.
interface MarkArm {
  passId: string
  writer: unknown
  paintsBlock(state: FrameState): boolean
  draw(hal: TimingHal, staged: Staged, state: FrameState): void
}

const PRESEED_LENS = (s: FrameState) => s
const PRESEED_WRITER = preseedFrame

function preseedMark(passId: string, enabled: (s: FrameState) => boolean) {
  const mark: MarkArm = {
    passId,
    writer: PRESEED_WRITER,
    paintsBlock: enabled,
    draw(hal, staged, state) {
      const p = PRESEED_LENS(state)
      if (mark.paintsBlock(p)) {
        if (
          staged.writer !== PRESEED_WRITER ||
          staged.params !== PRESEED_LENS
        ) {
          staged.writer = PRESEED_WRITER
          staged.params = PRESEED_LENS
        }
        hal.drawPass()
      }
    },
  }
  return mark
}

// The real gate SHAPE — nine of the thirteen read a flag, four are
// unconditional — with every flag true, so the draw count matches the other
// arms and the identity check can compare staged bytes.
const PRESEED_MARKS: MarkArm[] = [
  preseedMark('connLine', s => s.showStroke),
  preseedMark('linkedReadLine', s => s.showStroke),
  preseedMark('read', () => true),
  preseedMark('overlap', s => s.showStroke),
  preseedMark('mod', s => s.filterMismatchesByFrequency),
  preseedMark('perBaseQual', s => s.filterMismatchesByFrequency),
  preseedMark('skip', () => true),
  preseedMark('deletion', s => s.filterMismatchesByFrequency),
  preseedMark('mismatch', s => s.filterMismatchesByFrequency),
  preseedMark('insertion', s => s.filterMismatchesByFrequency),
  preseedMark('clip', () => true),
  preseedMark('softclipBases', s => s.showStroke),
  preseedMark('perBaseLetter', s => s.showStroke),
]

function runPreseed(hal: TimingHal, reps: number) {
  const staged: Staged = { writer: undefined, params: undefined }
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    preseedPalette(PRESEED_F32, PRESEED_U32)
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      for (let s = 0; s < SECTION_TOPS.length; s++) {
        preseedFrame(PRESEED_F32, PRESEED_I32, block, SECTION_TOPS[s]!)
        hal.writeUniforms(PRESEED_BUF)
        staged.writer = PRESEED_WRITER
        staged.params = PRESEED_LENS
        for (const mark of PRESEED_MARKS) {
          mark.draw(hal, staged, STATE)
        }
      }
    }
  }
}

// ------------------------------------------------------------- arm "plan"
// `planMarks` once per frame over the thirteen gates, then `drawPlannedPasses`
// per section block: the renderer's own palette and frame writes exactly as
// `poke` makes them, and a loop over `{ id, bufferOf }` records with no gate,
// no lens and no staged compare left in it. Hand-copied from
// `render-core/src/marks/markPlan.ts` and `markBackend.ts` for the reason the
// header gives.

const PLAN_BUF = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
const PLAN_F32 = new Float32Array(PLAN_BUF)
const PLAN_I32 = new Int32Array(PLAN_BUF)
const PLAN_U32 = new Uint32Array(PLAN_BUF)

function planPalette(f32: Float32Array, u32: Uint32Array) {
  for (let i = 0; i < NAMED_KEYS.length; i++) {
    u32[U[NAMED_KEYS[i]!]] = packRgb(COLORS.named[NAMED_KEYS[i]!]!)
  }
  for (let i = 0; i < LINKED_COUNT; i++) {
    const rgb = COLORS.linked[i]!
    setUniformLinkedReadColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
  for (let i = 0; i < CATEGORY_COUNT; i++) {
    const rgb = COLORS.category[i]!
    setUniformReadCategoryColor(f32, i, rgb[0], rgb[1], rgb[2], 1)
  }
}

function planFrame(
  f32: Float32Array,
  i32: Int32Array,
  block: Block,
  top: number,
) {
  f32[F.devicePixelRatio] = STATE.dpr
  f32[F.bpHi] = block.bpHi
  f32[F.bpLo] = block.bpLo
  f32[F.bpLen] = block.bpLen
  f32[F.hpZero] = 0
  f32[F.canvasW] = block.canvasW
  f32[F.pxPerBp] = block.canvasW / block.bpLen
  f32[F.canvasH] = CANVAS_H
  f32[F.rangeY0] = STATE.scrollTop
  f32[F.covOffset] = top
  f32[F.featHeight] = STATE.featureHeight
  f32[F.featSpacing] = STATE.featureSpacing
  i32[I.filterMismatchesByFrequency] = STATE.filterMismatchesByFrequency ? 1 : 0
  i32[I.mismatchAlpha] = STATE.mismatchAlpha ? 1 : 0
  i32[I.colorScheme] = STATE.colorScheme
  i32[I.chainMode] = STATE.chainMode ? 1 : 0
  i32[I.showStroke] = STATE.showStroke ? 1 : 0
  f32[F.reversed] = block.reversed ? 1 : 0
}

interface PlanMark {
  pass: { id: string }
  enabled: ((s: FrameState) => boolean) | undefined
  planned: { id: string; bufferOf: string | undefined } | undefined
}

function planMark(
  id: string,
  enabled: ((s: FrameState) => boolean) | undefined,
) {
  const mark: PlanMark = {
    pass: { id },
    enabled,
    planned: { id, bufferOf: undefined },
  }
  return mark
}

// The real gate SHAPE again — nine flagged, four unconditional, an
// `undefined` gate being what `defineMark` leaves for a mark with no `enabled`.
const PLAN_MARKS: PlanMark[] = [
  planMark('connLine', s => s.showStroke),
  planMark('linkedReadLine', s => s.showStroke),
  planMark('read', undefined),
  planMark('overlap', s => s.showStroke),
  planMark('mod', s => s.filterMismatchesByFrequency),
  planMark('perBaseQual', s => s.filterMismatchesByFrequency),
  planMark('skip', undefined),
  planMark('deletion', s => s.filterMismatchesByFrequency),
  planMark('mismatch', s => s.filterMismatchesByFrequency),
  planMark('insertion', s => s.filterMismatchesByFrequency),
  planMark('clip', undefined),
  planMark('softclipBases', s => s.showStroke),
  planMark('perBaseLetter', s => s.showStroke),
]

function planMarksArm(marks: PlanMark[], state: FrameState) {
  const enabled: PlanMark[] = []
  const passes: { id: string; bufferOf: string | undefined }[] = []
  for (const mark of marks) {
    if (!mark.enabled || mark.enabled(state)) {
      if (!mark.planned) {
        throw new Error(`mark ${mark.pass.id} declares a band or a block gate`)
      }
      enabled.push(mark)
      passes.push(mark.planned)
    }
  }
  return { marks: enabled, passes }
}

function drawPlannedArm(
  hal: TimingHal,
  plan: { passes: { id: string; bufferOf: string | undefined }[] },
) {
  const { passes } = plan
  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i]!
    hal.drawPass(pass.id, pass.bufferOf)
  }
}

function runPlan(hal: TimingHal, reps: number) {
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    planPalette(PLAN_F32, PLAN_U32)
    const plan = planMarksArm(PLAN_MARKS, STATE)
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      for (let s = 0; s < SECTION_TOPS.length; s++) {
        planFrame(PLAN_F32, PLAN_I32, block, SECTION_TOPS[s]!)
        hal.writeUniforms(PLAN_BUF)
        drawPlannedArm(hal, plan)
      }
    }
  }
}

// ---------------------------------------------------- identity + call counts

const halPoke = new TimingHal()
const halCtrl = new TimingHal()
const halTotal = new TimingHal()
const halTmpl = new TimingHal()
const halView = new TimingHal()
const halHoist = new TimingHal()
const halSeed = new TimingHal()
const halGate = new TimingHal()
const halPlan = new TimingHal()

runPoke(halPoke, 1)
runControl(halCtrl, 1)
runTotal(halTotal, 1)
runTemplate(halTmpl, 1)
runPokeView(halView, 1)
runHoisted(halHoist, 1)
runPreseed(halSeed, 1)
runPokeGate(halGate, 1)
runPlan(halPlan, 1)

const STAGED_BYTES = halPoke.slot * SLOT_BYTES

function firstDiff(a: Uint8Array, b: Uint8Array) {
  for (let i = 0; i < STAGED_BYTES; i++) {
    if (a[i] !== b[i]) {
      return i
    }
  }
  return -1
}

for (const [name, hal] of [
  ['control', halCtrl],
  ['total', halTotal],
  ['template', halTmpl],
  ['pokeview', halView],
  ['hoisted', halHoist],
  ['preseed', halSeed],
  ['pokegate', halGate],
  ['plan', halPlan],
] as const) {
  if (hal.slot !== halPoke.slot || hal.draws !== halPoke.draws) {
    console.error(
      `CALL-COUNT FAIL ${name}: ${hal.slot} writes / ${hal.draws} draws vs poke ${halPoke.slot} / ${halPoke.draws}`,
    )
    process.exit(1)
  }
  const at = firstDiff(halPoke.staging, hal.staging)
  if (at >= 0) {
    console.error(
      `IDENTITY FAIL ${name} at staged byte ${at} (slot ${Math.floor(at / SLOT_BYTES)}, offset ${at % SLOT_BYTES}): poke ${halPoke.staging[at]}, ${name} ${hal.staging[at]}`,
    )
    process.exit(1)
  }
}

console.log(
  `blocks=${BLOCKS} sections=${SECTIONS} layers=${LAYERS} rounds=${ROUNDS} reps=${REPS}`,
)
console.log(
  `per frame: ${halPoke.slot} uniform writes, ${halPoke.draws} draws, ${STAGED_BYTES} staged bytes`,
)

// -------------------------------------------------------------------- timing

runPoke(halPoke, 200)
runControl(halCtrl, 200)
runTotal(halTotal, 200)
runTemplate(halTmpl, 200)
runPokeView(halView, 200)
runHoisted(halHoist, 200)
runPreseed(halSeed, 200)
runPokeGate(halGate, 200)
runPlan(halPlan, 200)

let minPoke = Infinity
let minCtrl = Infinity
let minTotal = Infinity
let minTmpl = Infinity
let minView = Infinity
let minHoist = Infinity
let minSeed = Infinity
let minGate = Infinity
let minPlan = Infinity
// The arms rotate position within the round, so no arm always runs first (or
// always inherits the one before it).
for (let round = 0; round < ROUNDS; round++) {
  for (let slot = 0; slot < 9; slot++) {
    const t = Number(process.hrtime.bigint())
    const which = (round + slot) % 9
    if (which === 0) {
      runPoke(halPoke, REPS)
      minPoke = Math.min(minPoke, Number(process.hrtime.bigint()) - t)
    } else if (which === 1) {
      runControl(halCtrl, REPS)
      minCtrl = Math.min(minCtrl, Number(process.hrtime.bigint()) - t)
    } else if (which === 2) {
      runTotal(halTotal, REPS)
      minTotal = Math.min(minTotal, Number(process.hrtime.bigint()) - t)
    } else if (which === 3) {
      runTemplate(halTmpl, REPS)
      minTmpl = Math.min(minTmpl, Number(process.hrtime.bigint()) - t)
    } else if (which === 4) {
      runPokeView(halView, REPS)
      minView = Math.min(minView, Number(process.hrtime.bigint()) - t)
    } else if (which === 5) {
      runHoisted(halHoist, REPS)
      minHoist = Math.min(minHoist, Number(process.hrtime.bigint()) - t)
    } else if (which === 6) {
      runPreseed(halSeed, REPS)
      minSeed = Math.min(minSeed, Number(process.hrtime.bigint()) - t)
    } else if (which === 7) {
      runPokeGate(halGate, REPS)
      minGate = Math.min(minGate, Number(process.hrtime.bigint()) - t)
    } else {
      runPlan(halPlan, REPS)
      minPlan = Math.min(minPlan, Number(process.hrtime.bigint()) - t)
    }
  }
}

const usPerFrame = (ns: number) => ns / REPS / 1000
const poke = usPerFrame(minPoke)
const ctrl = usPerFrame(minCtrl)
const total = usPerFrame(minTotal)
const tmpl = usPerFrame(minTmpl)
const view = usPerFrame(minView)
const hoist = usPerFrame(minHoist)
const seed = usPerFrame(minSeed)
const gate = usPerFrame(minGate)
const plan = usPerFrame(minPlan)

console.log('')
console.log('arm         us/frame   vs poke      delta us/frame')
const row = (name: string, v: number) => {
  console.log(
    `${name.padEnd(10)}  ${v.toFixed(3).padStart(8)}   ${(v / poke).toFixed(2)}x${' '.repeat(7)}${(v - poke >= 0 ? '+' : '') + (v - poke).toFixed(3)}`,
  )
}
row('poke', poke)
row('control', ctrl)
row('total', total)
row('template', tmpl)
row('pokeview', view)
row('hoisted', hoist)
row('pokegate', gate)
row('preseed', seed)
row('plan', plan)
