import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'

import { effectiveBaseColors } from '../../features/mismatch/baseColors.ts'
import { LINKED_READ_SLOT_KEYS } from '../../shaders/palettes.ts'
import * as readShader from '../../shaders/slang/read.generated.ts'
import { READ_COLOR_CATEGORY, readCategoryPaletteKeys } from '../colorUtils.ts'
import { shouldOutlineReads } from './rendererTypes.ts'

import type { ReadColorCategory } from '../colorUtils.ts'
import type { ColorPalette, RGBColor, RenderState } from './rendererTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Every pileup pass shares the same Uniforms struct (see
// shaders/slang/alignmentsUniforms.slang), so any module's offsets serve.
const U = readShader.UNIFORM_OFFSET_F32
const UI = readShader.UNIFORM_OFFSET_I32
const UU = readShader.UNIFORM_OFFSET_U32
const USLOTS = readShader.UNIFORM_SLOT_ARRAYS

export const PILEUP_UNIFORMS_SIZE_BYTES = readShader.UNIFORMS_SIZE_BYTES

/** The three views one pileup uniform buffer is written through. */
export interface PileupUniformViews {
  f32: Float32Array
  i32: Int32Array
  u32: Uint32Array
}

export function pileupUniformViews(scratch: ArrayBuffer): PileupUniformViews {
  return {
    f32: new Float32Array(scratch),
    i32: new Int32Array(scratch),
    u32: new Uint32Array(scratch),
  }
}

// Which ColorPalette entry backs each NAMED shader color uniform — the ones a
// pass reads by name (`u.colorBaseA` in snpCoverage, `u.colorInsertion` in
// insertion). The indexed palettes are separate and written below.
//
// EVERY ENTRY IS A MARK, none a read fill: a read's colour is its RC_* category
// and reaches the GPU through `readCategoryColor` (see alignmentsUniforms.slang).
export const PALETTE_UNIFORM_FIELDS = {
  colorBaseA: 'colorBaseA',
  colorBaseC: 'colorBaseC',
  colorBaseG: 'colorBaseG',
  colorBaseT: 'colorBaseT',
  colorBaseN: 'colorBaseN',
  colorInsertion: 'colorInsertion',
  colorDeletion: 'colorDeletion',
  colorSkip: 'colorSkip',
  colorSoftclip: 'colorSoftclip',
  colorHardclip: 'colorHardclip',
  colorConnectingLine: 'colorConnectingLine',
  colorOverlap: 'colorOverlap',
  colorOverlapTint: 'colorOverlapTint',
} satisfies Record<string, keyof ColorPalette>

function packRgb(rgb: RGBColor) {
  return normalizedRgbToABGR(rgb[0], rgb[1], rgb[2])
}

// The two tables resolved to `[uboWordIndex, paletteKey]` once at module load:
// the palette VALUES are read per frame from the themed `ColorPalette`, only the
// indices are constant.
type PaletteKey = keyof ColorPalette

const PALETTE_UBO_SLOTS: readonly (readonly [number, PaletteKey])[] =
  Object.entries(PALETTE_UNIFORM_FIELDS).map(
    ([uniform, key]) => [UU[uniform as keyof typeof UU], key] as const,
  )

const READ_CATEGORY_UBO_SLOTS: readonly (readonly [number, PaletteKey])[] =
  Object.entries(readCategoryPaletteKeys).map(
    ([category, key]) =>
      [READ_COLOR_CATEGORY[category as ReadColorCategory], key] as const,
  )

// Takes the shader's own generated setter, which writes every component of an
// element — so the alpha lane cannot be left out here. The shaders read `.xyz`
// and set their own, which is what made the fourth store look optional, and a
// uniform slot left unwritten keeps whatever the last block render put there.
function writePaletteSlots(
  f: Float32Array,
  c: ColorPalette,
  set: (
    f32: Float32Array,
    i: number,
    v0: number,
    v1: number,
    v2: number,
    v3: number,
  ) => void,
  slotCount: number,
  keys: readonly PaletteKey[],
) {
  for (let i = 0; i < slotCount; i++) {
    const rgb = c[keys[i]!]
    set(f, i, rgb[0], rgb[1], rgb[2], 1)
  }
}

/**
 * The colour half of the struct, which is frame-constant: every input is
 * display-wide, so the renderer writes it once ahead of the block loop.
 *
 * Two representations on purpose. The NAMED colors are packed ABGR u32, one
 * slot each. The two INDEXED palettes are `float4[]` in the shader and so are
 * written as four floats per slot, through the generated setter: std140 pads
 * an array element to 16 bytes whatever it holds. Four to a `uint4` element
 * would not, and compiles — measured and declined, see colorPack.slang.
 */
export function writePileupPalette(
  { f32, u32 }: PileupUniformViews,
  state: RenderState,
) {
  const c = state.colors
  for (const [slot, key] of PALETTE_UBO_SLOTS) {
    u32[slot] = packRgb(c[key])
  }
  // Driven by the SHADER's slot count, not the palette's, so a palette that
  // fell out of step leaves an undefined behind here rather than silently
  // painting stale colors in the slots it didn't reach. arcYScale.test.ts pins
  // the two lengths equal. Resolved against `c`, the themed palette: these used
  // to be module constants, which is how a dark-mode pileup ended up with
  // dimmed reads under undimmed arcs. The arc palette is the arc band's, and
  // travels in `ArcBandUniforms`.
  writePaletteSlots(
    f32,
    c,
    readShader.setUniformLinkedReadColor,
    USLOTS.linkedReadColor.length,
    LINKED_READ_SLOT_KEYS,
  )
  // One color per read category, indexed by the RC_* the CPU classifier baked
  // into each instance, from the one table the legend also reads.
  for (const [slot, key] of READ_CATEGORY_UBO_SLOTS) {
    const rgb = c[key]
    readShader.setUniformReadCategoryColor(f32, slot, rgb[0], rgb[1], rgb[2], 1)
  }
  // The five base slots again, resolved: `effectiveBaseColors` is where the
  // modifications-mode mute is decided for both backends.
  const base = effectiveBaseColors(state)
  u32[UU.colorBaseA] = packRgb(base.A)
  u32[UU.colorBaseC] = packRgb(base.C)
  u32[UU.colorBaseG] = packRgb(base.G)
  u32[UU.colorBaseT] = packRgb(base.T)
  u32[UU.colorBaseN] = packRgb(base.N)
}

/**
 * The per-section-block half: the block's clip and the section's offsets.
 * Every field here corresponds to a `u.fieldName` in alignmentsUniforms.slang;
 * adding a field means updating both.
 */
export function writePileupFrame(
  { f32, i32 }: PileupUniformViews,
  clip: BlockClipResult,
  block: RenderBlock,
  state: RenderState,
) {
  // Set on every frame, not just the arc passes: a zero here would divide by
  // zero in strokeCoverage for anything else that antialiases a stroke.
  f32[U.devicePixelRatio] = getDpr()
  f32[U.bpHi] = clip.bpStartHi
  f32[U.bpLo] = clip.bpStartLo
  // Keep bpLen POSITIVE for reversed regions — this plugin applies the flip via
  // the separate `reversed` uniform (flipX in the shaders), NOT by negating the
  // span length. So bpToClipX stays monotonic and span shaders (mismatch/gap/
  // overlap/read) need no abs/min/max. If you ever bake reversal into bpLen (as
  // wiggle/manhattan/variants do), all of those break at once.
  f32[U.bpLen] = clip.clippedLengthBp
  f32[U.hpZero] = 0
  f32[U.canvasW] = clip.scissorW
  f32[U.pxPerBp] = clip.scissorW / clip.clippedLengthBp
  f32[U.canvasH] = state.canvasHeight
  // The pileup top in scrolled px: pileupY and the connecting/linked-read
  // shaders all read this as rangeY0 (via pileupRowCenterPx).
  f32[U.rangeY0] = state.scrollTop
  f32[U.covOffset] = state.pileupTopOffset
  f32[U.featHeight] = state.featureHeight
  f32[U.featSpacing] = state.featureSpacing
  // The coverage band's own slots are NOT here: its marks write render-core's
  // `CoverageBandUniforms` into their own buffer before each of their passes.
  i32[UI.filterMismatchesByFrequency] = state.filterMismatchesByFrequency
    ? 1
    : 0
  i32[UI.mismatchAlpha] = state.mismatchAlpha ? 1 : 0
  i32[UI.colorScheme] = state.colorScheme
  // Chevron gating only — chain mode's effect on read COLOR is resolved on the
  // CPU into `readColorCategories`, so the shader no longer branches on it for
  // fills.
  i32[UI.chainMode] = state.chainMode ? 1 : 0
  // The frame-level half of the outline gate, which the uniform is the natural
  // home for: `featSize.y` is `u.featHeight` for every read, so deciding it once
  // here is what makes the shader's own y test redundant rather than a second
  // opinion. Shared with the Canvas2D painter — see `shouldOutlineReads`.
  i32[UI.showStroke] = shouldOutlineReads(state) ? 1 : 0
  f32[U.reversed] = block.reversed ? 1 : 0
}

/**
 * The whole struct for one block, as a `MarkShape.writeUniforms`: what a caller
 * drawing the pileup marks through `drawMarks` would stage. The renderer takes
 * the two halves above instead, and `pileupUniformsParity.test.ts` pins that
 * the two spellings stage the same bytes.
 */
export function writePileupUniforms(
  scratch: ArrayBuffer,
  clip: BlockClipResult,
  block: RenderBlock,
  _frame: unknown,
  state: RenderState,
) {
  const views = pileupUniformViews(scratch)
  writePileupPalette(views, state)
  writePileupFrame(views, clip, block, state)
}
