import { baseColorFallback, buildBaseCssMap } from './baseColors.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

function state(showModifications: boolean) {
  return {
    showModifications,
    colors: {
      colorBaseA: [1, 0, 0],
      colorBaseC: [0, 1, 0],
      colorBaseG: [0, 0, 1],
      colorBaseT: [1, 1, 0],
      colorBaseN: [0, 0, 1],
      colorMutedSnpBase: [0.5, 0.5, 0.5],
    } as RenderState['colors'],
  } as RenderState
}

const GREY = 'rgb(128,128,128)'

// BAM's 4-bit alphabet is `=ACMGRSVTWYHKDBN`, so an IUPAC ambiguity code is an
// ordinary byte to reach a per-base draw. The extractors only upper-case it
// (`& ~0x20`), they don't fold it to N.
const IUPAC_R = 'R'.charCodeAt(0)

describe('per-base canvas palette', () => {
  test('A/C/G/T/N take their own colors', () => {
    const css = buildBaseCssMap(state(false))
    expect({
      A: css[65],
      C: css[67],
      G: css[71],
      T: css[84],
      N: css[78],
    }).toEqual({
      A: 'rgb(255,0,0)',
      C: 'rgb(0,255,0)',
      G: 'rgb(0,0,255)',
      T: 'rgb(255,255,0)',
      N: 'rgb(0,0,255)',
    })
  })

  test('every base mutes to grey under show-modifications', () => {
    const css = buildBaseCssMap(state(true))
    expect([css[65], css[67], css[71], css[84], css[78]]).toEqual([
      GREY,
      GREY,
      GREY,
      GREY,
      GREY,
    ])
  })

  // The GPU reaches this case via mismatch.slang's `default: colorBaseN`, and
  // writeUniforms has already swapped colorBaseN to grey by then. The Canvas2D
  // call sites used to read the RAW `colors.colorBaseN` for their `??` fallback,
  // so a stray IUPAC base painted blue on canvas and grey on the GPU.
  test('a non-ACGTN byte mutes too, matching the shader catch-all', () => {
    expect(buildBaseCssMap(state(true))[IUPAC_R]).toBe(GREY)
    expect(buildBaseCssMap(state(false))[IUPAC_R]).toBe('rgb(0,0,255)')
  })

  test('the fallback tuple is the muted color under modifications', () => {
    expect(baseColorFallback(state(true))).toEqual([0.5, 0.5, 0.5])
    expect(baseColorFallback(state(false))).toEqual([0, 0, 1])
  })
})
