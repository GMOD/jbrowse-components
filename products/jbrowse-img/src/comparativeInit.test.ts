import {
  comparativeViews,
  dotplotInit,
  syntenyInit,
  syntenyViewKnobs,
} from './comparativeInit.ts'

import type { Assembly, Config, Track } from './types.ts'

function asm(name: string): Assembly {
  return { name, sequence: { type: 'ReferenceSequenceTrack' } }
}

function syntenyTrack(trackId: string, assemblyNames: string[]): Track {
  return { trackId, type: 'SyntenyTrack', assemblyNames }
}

function config(assemblies: Assembly[], tracks: Track[] = []): Config {
  return { assemblies, assembly: assemblies[0]!, tracks }
}

describe('syntenyViewKnobs', () => {
  test('omits every knob when no flag is set, leaving the view its defaults', () => {
    expect(syntenyViewKnobs({})).toEqual({})
  })

  test('omits a boolean flag that is off rather than sending false', () => {
    // the view applies an explicit false (its guard is `!== undefined`), which
    // would override its own default
    expect(
      syntenyViewKnobs({
        autoDiagonalize: false,
        drawCurves: false,
        showColorLegend: false,
      }),
    ).toEqual({})
  })

  test('passes the knobs that are set', () => {
    expect(
      syntenyViewKnobs({
        autoDiagonalize: true,
        drawCurves: true,
        showColorLegend: true,
        colorBy: 'query',
        cigarMode: 'full',
        minAlignmentLength: 10_000,
        levelHeights: [300, 300],
      }),
    ).toEqual({
      autoDiagonalize: true,
      drawCurves: true,
      showColorLegend: true,
      colorBy: 'query',
      cigarMode: 'full',
      minAlignmentLength: 10_000,
      levelHeights: [300, 300],
    })
  })

  test('keeps a meaningful zero', () => {
    // alpha 0 (fully transparent) and minAlignmentLength 0 are real values, not
    // "unset" — a truthiness filter would drop both
    expect(syntenyViewKnobs({ alpha: 0, minAlignmentLength: 0 })).toEqual({
      alpha: 0,
      minAlignmentLength: 0,
    })
  })
})

describe('comparativeViews', () => {
  test('throws when fewer than two assemblies were supplied', () => {
    expect(() => comparativeViews(config([asm('a')]))).toThrow(
      /at least two assemblies/,
    )
  })

  test('keeps assembly order and attaches each per-assembly loc', () => {
    const data = { ...config([asm('a'), asm('b')]), assemblyLocs: ['chr1'] }
    expect(comparativeViews(data)).toEqual([
      { assembly: 'a', loc: 'chr1' },
      { assembly: 'b' },
    ])
  })
})

describe('dotplotInit', () => {
  test('takes only the first two assemblies and the comparisons between them', () => {
    const data = config(
      [asm('a'), asm('b'), asm('c')],
      [syntenyTrack('a_b', ['a', 'b']), syntenyTrack('b_c', ['b', 'c'])],
    )
    expect(dotplotInit(data, {})).toEqual({
      views: [{ assembly: 'a' }, { assembly: 'b' }],
      tracks: ['a_b'],
    })
  })

  test('carries the shared comparative knobs', () => {
    // colorBy and minAlignmentLength are read by DotplotView's init
    // (applyInitDisplaySettings) but used to be dropped here, so `jb2export
    // dotplot --colorBy query` silently rendered the default red
    const data = config([asm('a'), asm('b')])
    expect(
      dotplotInit(data, {
        colorBy: 'query',
        minAlignmentLength: 5000,
        autoDiagonalize: true,
        showColorLegend: true,
      }),
    ).toEqual({
      views: [{ assembly: 'a' }, { assembly: 'b' }],
      tracks: [],
      colorBy: 'query',
      minAlignmentLength: 5000,
      autoDiagonalize: true,
      showColorLegend: true,
    })
  })

  test('omits the synteny-only knobs a dotplot has no equivalent for', () => {
    const data = config([asm('a'), asm('b')])
    const init = dotplotInit(data, {
      drawCurves: true,
      cigarMode: 'full',
      alpha: 0.4,
      levelHeights: [300],
    })
    expect(init).not.toHaveProperty('drawCurves')
    expect(init).not.toHaveProperty('cigarMode')
    expect(init).not.toHaveProperty('alpha')
    expect(init).not.toHaveProperty('levelHeights')
  })
})

describe('syntenyInit', () => {
  test('stacks every assembly and places each comparison at its own level', () => {
    const data = config(
      [asm('a'), asm('b'), asm('c')],
      [syntenyTrack('a_b', ['a', 'b']), syntenyTrack('b_c', ['b', 'c'])],
    )
    expect(syntenyInit(data, { drawCurves: true })).toEqual({
      views: [{ assembly: 'a' }, { assembly: 'b' }, { assembly: 'c' }],
      tracks: [['a_b'], ['b_c']],
      drawCurves: true,
    })
  })
})
