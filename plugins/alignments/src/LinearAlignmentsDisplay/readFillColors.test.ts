import { refNamePaletteColorAt } from '@jbrowse/core/ui/colors'
import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { alignmentsColorEncoding } from '../shared/alignmentsColor.ts'
import { colorSettingOf } from '../shared/colorSettingFixture.ts'
import { bakedColorScale } from './bakedColorScale.ts'
import { bakedValueColor } from './colorTagUtils.ts'
import { buildReadFillColors, overlayReadFillColors } from './readFillColors.ts'

import type { RefNamePosition } from './colorTagUtils.ts'
import type { ColorScaleSlots } from '@jbrowse/core/util/colorScale'

const TAG = 'tags.HP'

// Laid out, because that is what the overlay takes: the tag bake runs after
// placement and spreads over its result.
function pileupWith(readTagValues: string[]) {
  return makePileupDataResult({
    readTagValues,
    readStrands: new Int8Array(readTagValues.length).fill(1),
  })
}

function encodingFor(field: string, declared: ColorScaleSlots = {}) {
  return alignmentsColorEncoding(colorSettingOf({ field, scale: declared }))
}

function scaleFor(
  field: string,
  declared: ColorScaleSlots = {},
  position?: RefNamePosition,
) {
  return bakedColorScale(
    field,
    encodingFor(field, declared),
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
    buildReadFillColors(
      pileupWith(names),
      'mateRefName',
      scaleFor('mateRefName', {}, position),
    )

  test('bakes each mate refName the color its own value resolves', () => {
    expect([...build(['chr1', 'chr2'])]).toEqual([
      packed(bakedValueColor('mateRefName', 'chr1')),
      packed(bakedValueColor('mateRefName', 'chr2')),
    ])
  })

  // The bake is the only caller that can supply the assembly order, so it is
  // the one that has to pass it through — bakedValueColor's own test covers
  // what the order then does to the color. A pileup on hg38 without it puts
  // chr1 and chr12 on one color.
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
    expect(packed(bakedValueColor('mateRefName', ''))).not.toBe(0)
  })

  test('every read is colored', () => {
    expect(build(['chr1', 'chr2', 'chr3'])).toHaveLength(3)
  })
})

describe('categorical tag colors', () => {
  const build = (values: string[]) =>
    buildReadFillColors(pileupWith(values), TAG, scaleFor(TAG))

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

  // '' names the no-value read, which the category table colors; the scale
  // hands the other range entries to the values beside it.
  test("'' in the domain leaves the scale with its color", () => {
    const scale = scaleFor(TAG, {
      domain: ['', '1'],
      range: ['#ff0000', '#00ff00'],
    })
    expect([...buildReadFillColors(pileupWith(['1', '']), TAG, scale)]).toEqual(
      [packed('#00ff00'), 0],
    )
  })
})

describe('strand tag colors', () => {
  test('a value that is neither strand packs the palette fallback', () => {
    const field = 'tags.XS'
    const [fwd, rev, dot, absent] = buildReadFillColors(
      pileupWith(['+', '-', '.', '']),
      field,
      scaleFor(field),
    )
    expect(fwd).toBe(packed(colorFwdStrand))
    expect(rev).toBe(packed(colorRevStrand))
    expect([dot, absent]).toEqual([0, 0])
  })
})

describe('overlayReadFillColors', () => {
  const overlay = (field: string) =>
    overlayReadFillColors(
      new Map([[0, pileupWith(['chr1'])]]),
      field,
      scaleFor(field),
    ).get(0)!.readFillColors.length

  test('bakes colors for mateRefName', () => {
    expect(overlay('mateRefName')).toBe(1)
  })

  test('bakes colors for a tag', () => {
    expect(overlay('tags.HP')).toBe(1)
  })

  // The worker only fills readTagValues for the baked schemes, so any other
  // scheme must leave the array empty and the shader on its palette path.
  test('bakes nothing for schemes the shader colors itself', () => {
    expect(overlay('strand')).toBe(0)
    expect(overlay('')).toBe(0)
  })
})

describe('a declared scale', () => {
  const NM = 'tags.NM'

  test('a domain and range hand the listed values their colors in order', () => {
    const scale = scaleFor(TAG, {
      domain: ['2', '1'],
      range: ['#ff0000', '#0000ff'],
    })
    expect([
      ...buildReadFillColors(pileupWith(['1', '2', '']), TAG, scale),
    ]).toEqual([packed('#0000ff'), packed('#ff0000'), 0])
  })

  test('a linear scale runs the ramp across its pinned ends and clamps past them', () => {
    const scale = scaleFor(NM, {
      type: 'linear',
      domainMin: 0,
      domainMax: 10,
      range: ['#000000', '#ffffff'],
    })
    const [low, high, past, text] = buildReadFillColors(
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
      encodingFor(NM, { type: 'linear', range: ['#000000', '#ffffff'] }),
      undefined,
      [4, 8],
    )
    const [low, high] = buildReadFillColors(pileupWith(['4', '8']), NM, scale)
    expect([low, high]).toEqual([packed('#000000'), packed('#ffffff')])
  })

  // Ends written high to low used to read as no pin at all, so the ramp
  // stretched over the reads instead; reverse is now the one way to turn it.
  test('ends written high to low still pin, and reverse turns the ramp round', () => {
    const colorsOf = (declared: ColorScaleSlots) =>
      buildReadFillColors(
        pileupWith(['0', '10']),
        NM,
        bakedColorScale(
          NM,
          encodingFor(NM, {
            type: 'linear',
            range: ['#000000', '#ffffff'],
            ...declared,
          }),
          undefined,
          [4, 8],
        ),
      )
    expect([...colorsOf({ domainMin: 10, domainMax: 0 })]).toEqual([
      packed('#000000'),
      packed('#ffffff'),
    ])
    expect([
      ...colorsOf({ domainMin: 0, domainMax: 10, reverse: true }),
    ]).toEqual([packed('#ffffff'), packed('#000000')])
  })

  test('a pinned floor holds while the open ceiling follows the reads', () => {
    const scale = bakedColorScale(
      NM,
      encodingFor(NM, {
        type: 'linear',
        domainMin: 0,
        range: ['#000000', '#ffffff'],
      }),
      undefined,
      [4, 8],
    )
    const [floor, ceiling] = buildReadFillColors(
      pileupWith(['0', '8']),
      NM,
      scale,
    )
    expect([floor, ceiling]).toEqual([packed('#000000'), packed('#ffffff')])
  })

  test('a threshold scale paints the bin a value falls in', () => {
    const scale = scaleFor(NM, {
      type: 'threshold',
      domain: ['5'],
      range: ['#00ff00', '#ff0000'],
    })
    expect([
      ...buildReadFillColors(pileupWith(['1', '5', '9']), NM, scale),
    ]).toEqual([packed('#00ff00'), packed('#ff0000'), packed('#ff0000')])
  })

  test('a domain and range reach a mate reference too', () => {
    const MATE = 'mateRefName'
    const scale = scaleFor(MATE, { domain: ['chr2'], range: ['#ff0000'] })
    expect(scale.declared).toBe(true)
    expect(scale.color('chr2')).toBe('#ff0000')
  })

  test('threshold cuts written high to low are read ascending', () => {
    const scale = scaleFor(NM, {
      type: 'threshold',
      domain: ['0.5', '0.1'],
      range: ['#0000ff', '#00ff00', '#ff0000'],
    })
    expect(scale.color('0.3')).toBe('#00ff00')
    expect(
      scale.kind === 'threshold' ? scale.bins.map(b => b.label) : [],
    ).toEqual(['< 0.1', '0.1 – 0.5', '≥ 0.5'])
  })

  test('a declared scale over a strand tag replaces the strand vocabulary', () => {
    const XS = 'tags.XS'
    const scale = scaleFor(XS, { domain: ['+'], range: ['#123456'] })
    expect(buildReadFillColors(pileupWith(['+']), XS, scale)[0]).toBe(
      packed('#123456'),
    )
  })
})
