import { refNamePaletteColorAt } from '@jbrowse/core/ui/colors'
import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { bakedColorScale } from './bakedColorScale.ts'
import { bakedValueColor } from './colorTagUtils.ts'
import { buildReadTagColors, overlayReadTagColors } from './readTagColors.ts'

import type { AlignmentsColorSetting } from '../shared/alignmentsColor.ts'
import type { ColorBy } from '../shared/types.ts'
import type { RefNamePosition } from './colorTagUtils.ts'

const TAG: ColorBy = { type: 'tag', tag: 'HP' }

// Laid out, because that is what the overlay takes: the tag bake runs after
// placement and spreads over its result.
function pileupWith(readTagValues: string[]) {
  return makePileupDataResult({
    readTagValues,
    readStrands: new Int8Array(readTagValues.length).fill(1),
  })
}

const UNDECLARED: AlignmentsColorSetting = {
  value: undefined,
  field: '',
  scale: undefined,
  domain: [],
  palette: [],
  ramp: [],
  domainMid: undefined,
}

function scaleFor(
  colorBy: ColorBy,
  declared: Partial<AlignmentsColorSetting> = {},
  position?: RefNamePosition,
) {
  return bakedColorScale(
    colorBy,
    { ...UNDECLARED, ...declared },
    position,
    undefined,
  )
}

const packed = (color: string) => {
  const [r, g, b] = cssColorToRgb(color)
  return packAbgr(r, g, b, 255)
}

describe('mateRefName (chromosome painting) colors', () => {
  const build = (
    names: string[],
    position?: (n: string) => number | undefined,
  ) =>
    buildReadTagColors(
      pileupWith(names),
      { type: 'mateRefName' },
      scaleFor({ type: 'mateRefName' }, {}, position),
    )

  test('bakes each mate refName the color its own value resolves', () => {
    expect([...build(['chr1', 'chr2'])]).toEqual([
      packed(bakedValueColor({ type: 'mateRefName' }, 'chr1')),
      packed(bakedValueColor({ type: 'mateRefName' }, 'chr2')),
    ])
  })

  // The bake is the only caller that can supply the assembly order, so it is
  // the one that has to pass it through — bakedValueColor's own test covers
  // what the order then does to the colour. A pileup on hg38 without it puts
  // chr1 and chr12 on one colour.
  test('an assembly position reaches the resolver', () => {
    const at = new Map([
      ['chr1', 0],
      ['chr12', 11],
    ])
    const [a, b] = build(['chr1', 'chr12'], n => at.get(n))
    expect(a).not.toBe(b)
    expect(a).toBe(packed(refNamePaletteColorAt(0)))
    expect(b).toBe(packed(refNamePaletteColorAt(11)))
  })

  test('the same refName always paints the same color', () => {
    const out = build(['chr1', 'chr7', 'chr1'])
    expect(out[0]).toBe(out[2])
    expect(out[0]).not.toBe(out[1])
  })

  test('a feature with no mate falls back to the palette rather than coloring an empty name', () => {
    expect([...build([''])]).toEqual([0])
    expect(packed(bakedValueColor({ type: 'mateRefName' }, ''))).not.toBe(0)
  })

  test('every read is colored', () => {
    expect(build(['chr1', 'chr2', 'chr3'])).toHaveLength(3)
  })
})

describe('categorical tag colors', () => {
  const build = (values: string[]) =>
    buildReadTagColors(pileupWith(values), TAG, scaleFor(TAG))

  // The color comes from the value itself (`bakedValueColor`), so a read paints
  // the moment its value is known rather than once some earlier fetch had
  // discovered it into a table.
  test('paints each value the color its own value resolves', () => {
    expect([...build(['1', '2'])]).toEqual([
      packed(bakedValueColor(TAG, '1')),
      packed(bakedValueColor(TAG, '2')),
    ])
  })

  // Nothing has to have seen the value before. Under the discovered-value map
  // this packed 0 and the read painted the neutral fallback until the fetch
  // that found it had assigned a color.
  test('a value no earlier fetch saw still paints', () => {
    expect([...build(['3'])]).toEqual([packed(bakedValueColor(TAG, '3'))])
  })

  // "No color", so the shader and the Canvas2D twin both fall back to
  // colorPairLR, which darkens with the theme.
  test('a read the tag is absent from packs the palette fallback, not a strand color', () => {
    expect([...build([''])]).toEqual([0])
  })
})

describe('strand tag colors', () => {
  test('a value that is neither strand packs the palette fallback', () => {
    const colorBy: ColorBy = { type: 'tag', tag: 'XS' }
    const [fwd, rev, dot, absent] = buildReadTagColors(
      pileupWith(['+', '-', '.', '']),
      colorBy,
      scaleFor(colorBy),
    )
    expect(fwd).toBe(packed(colorFwdStrand))
    expect(rev).toBe(packed(colorRevStrand))
    expect([dot, absent]).toEqual([0, 0])
  })
})

describe('overlayReadTagColors', () => {
  const overlay = (colorBy: Parameters<typeof overlayReadTagColors>[1]) =>
    overlayReadTagColors(
      new Map([[0, pileupWith(['chr1'])]]),
      colorBy,
      colorBy && scaleFor(colorBy),
    ).get(0)!.readTagColors.length

  test('bakes colors for mateRefName', () => {
    expect(overlay({ type: 'mateRefName' })).toBe(1)
  })

  test('bakes colors for a tag scheme with a tag', () => {
    expect(overlay({ type: 'tag', tag: 'HP' })).toBe(1)
  })

  // The worker only fills readTagValues for the baked schemes, so any other
  // scheme must leave the array empty and the shader on its palette path.
  test('bakes nothing for schemes the shader colors itself', () => {
    expect(overlay({ type: 'strand' })).toBe(0)
    expect(overlay({ type: 'tag' })).toBe(0)
    expect(overlay(undefined)).toBe(0)
  })
})

describe('a declared scale', () => {
  const NM: ColorBy = { type: 'tag', tag: 'NM' }

  test('a domain and palette hand the listed values their colours in order', () => {
    const scale = scaleFor(TAG, {
      domain: ['2', '1'],
      palette: ['#ff0000', '#0000ff'],
    })
    expect([
      ...buildReadTagColors(pileupWith(['1', '2', '']), TAG, scale),
    ]).toEqual([packed('#0000ff'), packed('#ff0000'), 0])
  })

  test('a linear scale runs the ramp across a pinned domain and clamps past it', () => {
    const scale = scaleFor(NM, {
      scale: 'linear',
      domain: ['0', '10'],
      ramp: ['#000000', '#ffffff'],
    })
    const [low, high, past, text] = buildReadTagColors(
      pileupWith(['0', '10', '99', 'x']),
      NM,
      scale,
    )
    expect(low).toBe(packed('#000000'))
    expect(high).toBe(packed('#ffffff'))
    expect(past).toBe(high)
    expect(text).toBe(0)
  })

  test('an unpinned linear scale stretches over the loaded extent', () => {
    const scale = bakedColorScale(
      NM,
      { ...UNDECLARED, scale: 'linear', ramp: ['#000000', '#ffffff'] },
      undefined,
      [4, 8],
    )
    const [low, high] = buildReadTagColors(pileupWith(['4', '8']), NM, scale)
    expect([low, high]).toEqual([packed('#000000'), packed('#ffffff')])
  })

  test('a threshold scale paints the bin a value falls in', () => {
    const scale = scaleFor(NM, {
      scale: 'threshold',
      domain: ['5'],
      palette: ['#00ff00', '#ff0000'],
    })
    expect([
      ...buildReadTagColors(pileupWith(['1', '5', '9']), NM, scale),
    ]).toEqual([packed('#00ff00'), packed('#ff0000'), packed('#ff0000')])
  })

  test('a domain and palette reach a mate reference too', () => {
    const MATE: ColorBy = { type: 'mateRefName' }
    const scale = scaleFor(MATE, { domain: ['chr2'], palette: ['#ff0000'] })
    expect(scale.declared).toBe(true)
    expect(scale.color('chr2')).toBe('#ff0000')
  })

  test('a declared scale over a strand tag replaces the strand vocabulary', () => {
    const XS: ColorBy = { type: 'tag', tag: 'XS' }
    const scale = scaleFor(XS, { domain: ['+'], palette: ['#123456'] })
    expect(buildReadTagColors(pileupWith(['+']), XS, scale)[0]).toBe(
      packed('#123456'),
    )
  })
})
