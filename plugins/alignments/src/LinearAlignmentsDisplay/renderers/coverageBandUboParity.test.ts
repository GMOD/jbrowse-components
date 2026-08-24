import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { MockHal } from '@jbrowse/render-core/hal'
import {
  UNIFORM_OFFSET_F32,
  UNIFORM_OFFSET_I32,
  UNIFORM_OFFSET_U32,
} from '@jbrowse/render-core/shaders/coverageBar'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { makeTestPalette, makeTestRenderState } from '../testUtils.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'

import type { ColorPalette, RGBColor } from '../../shaders/colors.ts'
import type { AlignmentsSources, RenderState } from './rendererTypes.ts'

/**
 * The coverage band writes its OWN uniform struct — render-core's
 * `CoverageBandUniforms`, shared with the MAF display — rather than a slice of
 * this plugin's `Uniforms`. Which means `paletteUboParity.test.ts` no longer
 * reaches the band's four colour slots and `fillFrameUniforms` no longer holds
 * its geometry, so this is where both are pinned.
 *
 * It has to be checked off the BAND's own draw. Two structs are staged per
 * section per block now, the pileup's second, so the frame's last uniform write
 * is a completely different layout — reading a band field out of it lands on
 * whatever the pileup put at that word, which is a plausible number.
 */

// One distinct colour per palette key, so a transposition between two band
// slots cannot pass by both happening to agree.
function distinctPalette() {
  const overrides: Record<string, RGBColor> = {}
  const keys = Object.keys(makeTestPalette()) as (keyof ColorPalette)[]
  for (let i = 0; i < keys.length; i++) {
    overrides[keys[i]!] = [(i + 1) / 255, ((i + 1) * 2) / 255, 0.5]
  }
  return makeTestPalette(overrides)
}

const COLORS = distinctPalette()

// A band with a real clip band and a resolved domain, which is what
// `drewCoverage` and `hasCoverageScale` between them require before any of this
// is written at all.
function bandState(overrides: Partial<RenderState> = {}) {
  return makeTestRenderState({
    colors: COLORS,
    showCoverage: true,
    showInterbaseIndicators: true,
    coverageHeight: 60,
    coverageYOffset: 5,
    coverageMaxDepth: 200,
    coverageSnpMinFrequency: 0.1,
    sections: [
      {
        pileupTopOffset: 60,
        coverageTopOffset: 0,
        covClipTop: 0,
        covClipHeight: 60,
        pileupClipTop: 60,
        pileupClipHeight: 40,
      },
    ],
    ...overrides,
  })
}

function bandUniforms(state: RenderState) {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  const sources: AlignmentsSources = {
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, makePileupDataResult({})]]),
        arcsRpcDataMap: new Map(),
      },
    ],
    readConnectionsLineWidth: 1,
  }
  renderer.upload('sources', sources)
  renderer.renderBlocks(
    [
      {
        displayedRegionIndex: 0,
        start: 0,
        end: 100,
        screenStartPx: 0,
        screenEndPx: 200,
        reversed: false,
      },
    ],
    state,
  )
  const draw = hal.draws().find(d => d.passId === 'coverage')!
  const buf = hal.getUniformWritesF32()[draw.uniformWrite]!.buffer
  return {
    f32: new Float32Array(buf),
    u32: new Uint32Array(buf),
    i32: new Int32Array(buf),
  }
}

const packed = (key: keyof ColorPalette) => {
  const rgb = COLORS[key]
  return normalizedRgbToABGR(rgb[0], rgb[1], rgb[2])
}

// Each band colour slot against the palette entry it must carry. The base slots
// are excluded here and pinned by `baseColorParity.test.ts` instead, since
// `effectiveBaseColors` — not the raw palette — is what fills them.
const BAND_COLOR_SLOTS = {
  colorCoverage: 'colorCoverage',
  colorInsertionIndicator: 'colorInsertionIndicator',
  colorSoftclipIndicator: 'colorSoftclipIndicator',
  colorHardclipIndicator: 'colorHardclipIndicator',
} satisfies Partial<Record<keyof typeof UNIFORM_OFFSET_U32, keyof ColorPalette>>

describe('the coverage band UBO', () => {
  const { f32, u32, i32 } = bandUniforms(bandState())

  test.each(Object.entries(BAND_COLOR_SLOTS))(
    '%s holds the packed color of %s',
    (uniform, key) => {
      expect(
        u32[UNIFORM_OFFSET_U32[uniform as keyof typeof UNIFORM_OFFSET_U32]],
      ).toBe(packed(key as keyof ColorPalette))
    },
  )

  test('every band colour slot is a distinct colour, so a transposition would show', () => {
    const slots = Object.values(UNIFORM_OFFSET_U32).map(o => u32[o])
    expect(new Set(slots).size).toBe(slots.length)
  })

  test('carries the band box, not the canvas', () => {
    expect(f32[UNIFORM_OFFSET_F32.covHeight]).toBe(60)
    expect(f32[UNIFORM_OFFSET_F32.covYOffset]).toBe(5)
    expect(f32[UNIFORM_OFFSET_F32.covTop]).toBe(0)
    expect(f32[UNIFORM_OFFSET_F32.canvasH]).toBe(100)
  })

  test('carries both ends of the depth domain and the scale it is read on', () => {
    expect(f32[UNIFORM_OFFSET_F32.depthDomainMax]).toBe(200)
    expect(f32[UNIFORM_OFFSET_F32.depthDomainMin]).toBe(0)
    expect(i32[UNIFORM_OFFSET_I32.coverageScaleType]).toBe(0)
    expect(f32[UNIFORM_OFFSET_F32.snpMinFreq]).toBeCloseTo(0.1)
  })

  test('hpZero is 0 — the HP split collapses without it', () => {
    expect(f32[UNIFORM_OFFSET_F32.hpZero]).toBe(0)
  })

  // The one derived slot: it un-bakes the region's own peak from the buffers'
  // `relDepth` so the bars land on the display's domain. An empty region has no
  // peak to un-bake, and 1 is the identity that leaves `relDepth` alone — the
  // failure the other value would give is silently rescaled bars.
  test('depthScale is the identity for a region with no depth', () => {
    expect(f32[UNIFORM_OFFSET_F32.depthScale]).toBe(1)
  })

  test('a grouped section moves covTop rather than the band box', () => {
    const { f32: scrolled } = bandUniforms(
      bandState({
        // Tall enough to hold the scrolled band: `devBand` clamps a scissor past
        // the backing store, and a clamped-to-zero band draws nothing at all.
        canvasHeight: 300,
        sections: [
          {
            pileupTopOffset: 200,
            coverageTopOffset: 140,
            covClipTop: 140,
            covClipHeight: 60,
            pileupClipTop: 200,
            pileupClipHeight: 40,
          },
        ],
      }),
    )
    expect(scrolled[UNIFORM_OFFSET_F32.covTop]).toBe(140)
    expect(scrolled[UNIFORM_OFFSET_F32.covHeight]).toBe(60)
    expect(scrolled[UNIFORM_OFFSET_F32.canvasH]).toBe(300)
  })
})
