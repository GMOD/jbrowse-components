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

  // The table is memoized across draws, and `state()` above hands out a fresh
  // `colors` object every call — so every case above invalidates it on palette
  // identity alone and none of them reaches the other half of the key. A
  // modifications toggle does not change the palette object: it is the same
  // theme, read through a different rule. Keyed on the palette alone, the memo
  // would serve the unmuted table for the rest of the session.
  test('the memo reacts to a modifications toggle at a fixed palette', () => {
    const colors = state(false).colors
    const shared = (showModifications: boolean) =>
      ({ showModifications, colors }) as RenderState
    expect(buildBaseCssMap(shared(false))[65]).toBe('rgb(255,0,0)')
    expect(buildBaseCssMap(shared(true))[65]).toBe(GREY)
    expect(buildBaseCssMap(shared(false))[65]).toBe('rgb(255,0,0)')
  })

  // The other direction: a theme change at a fixed toggle. Palette identity is
  // the memo's only signal here, which is why the model must rebuild the object
  // rather than mutate it.
  test('the memo reacts to a new palette at a fixed toggle', () => {
    expect(buildBaseCssMap(state(false))[65]).toBe('rgb(255,0,0)')
    const dark = state(false)
    dark.colors = { ...dark.colors, colorBaseA: [0, 0, 0] }
    expect(buildBaseCssMap(dark)[65]).toBe('rgb(0,0,0)')
  })
})
