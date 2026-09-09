import { makeTestRenderState } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { frequencyFadeGate } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { qualityFade } from '../../shaders/slang/mismatch.js.generated.ts'
import { PER_BASE_LETTER_MARK } from './mark.ts'

import type { PerBaseLetterUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Pack against draw, on the layer where the two could actually disagree:
// per-base lettering borrows mismatch.slang, which applies a frequency fade AND
// a quality fade to whatever the instance carries. The Canvas2D painter has
// neither, so `PER_BASE_LETTER_MARK` declares `Fade.opaque` — and the packer is the only
// thing that can make the GPU agree.
//
// A slot left at the buffer's zero default is not "unset" to this shader. It is
// full-frequency-off and Phred 0, the worst score in the file, and
// `qualityFade` sends that to alpha 0 — `vs_main` then discards the vertex. The
// SOFTCLIP-bases packer carries a comment saying exactly this; this pass shared
// the shader without sharing the conclusion, so with "fade by base quality" on,
// the GPU drew nothing where Canvas2D drew every base opaque. Neither backend
// looked wrong on its own, which is what a cross-backend gate is for — and this
// combination of two independent settings was not in its scope.

const DATA: PerBaseLetterUploadData = {
  perBaseLetterPositions: new Uint32Array([1000, 1001, 1002]),
  perBaseLetterYs: new Uint16Array([0, 0, 1]),
  perBaseLetterBases: new Uint8Array([65, 67, 71]),
}

// Zoomed out far enough that the frequency fade bites if the packer left it to
// the default: at 4 bp/px a base covers a quarter of a pixel.
const PX_PER_BP = 0.25
const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 1000,
  end: 1400,
  screenStartPx: 0,
  screenEndPx: 400 * PX_PER_BP,
  reversed: false,
}

function instances() {
  const buf = PER_BASE_LETTER_MARK.pass.pack(DATA) as ArrayBuffer
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const s32 = mismatchShader.INSTANCE_STRIDE_WORDS
  const F_U32 = mismatchShader.INSTANCE_OFFSET_U32
  const F_F32 = mismatchShader.INSTANCE_OFFSET_F32
  const out: { position: number; frequency: number; qual: number }[] = []
  for (let o = 0; o < u32.length; o += s32) {
    out.push({
      position: u32[o + F_U32.position]!,
      frequency: f32[o + F_F32.frequency]!,
      qual: f32[o + F_F32.qual]!,
    })
  }
  return out
}

// mismatch.slang's `vs_main`, as the two generated twins it is assembled from.
function shaderAlpha(
  instance: { frequency: number; qual: number },
  mismatchAlpha: boolean,
  filterByFrequency: boolean,
) {
  return (
    frequencyFadeGate(PX_PER_BP, instance.frequency, filterByFrequency) *
    qualityFade(instance.qual, mismatchAlpha)
  )
}

// The fills the painter set, under the same two settings.
function paintedFills(mismatchAlpha: boolean, filterByFrequency: boolean) {
  const fills: string[] = []
  let fill = ''
  const ctx = {
    set fillStyle(v: string) {
      fill = v
    },
    get fillStyle() {
      return fill
    },
    fillRect() {
      fills.push(fill)
    },
  } as unknown as Ctx2D
  PER_BASE_LETTER_MARK.paintBlock(
    ctx,
    DATA,
    BLOCK,
    makeTestRenderState({
      showPerBaseLetter: true,
      mismatchAlpha,
      filterMismatchesByFrequency: filterByFrequency,
    }),
  )
  return fills
}

// The mark paints every base opaque whatever the settings, so what the shader
// has to reproduce is that — under both advanced fades, which is the
// combination the packer's zero default failed.
test.each([
  ['both fades off', false, false],
  ['frequency filtering on', false, true],
  ['fade by base quality on', true, false],
  ['both on', true, true],
])(
  'the shader resolves the painted alpha with %s',
  (_name, mismatchAlpha, filterByFrequency) => {
    const fills = paintedFills(mismatchAlpha, filterByFrequency)
    expect(fills).toHaveLength(DATA.perBaseLetterYs.length)
    for (const fill of fills) {
      expect(fill).toMatch(/^rgb\(/)
    }
    for (const instance of instances()) {
      expect(shaderAlpha(instance, mismatchAlpha, filterByFrequency)).toBe(1)
    }
  },
)

test('every instance is the base the mark declares', () => {
  for (const [i, instance] of instances().entries()) {
    expect(instance.position).toBe(DATA.perBaseLetterPositions[i])
  }
})
