import {
  PAIR_DIRECTION_NUM,
  READ_DISCORDANT,
  READ_SPLICED,
  READ_SPLIT,
  READ_SV_DELETION,
  withSvTier,
} from '@jbrowse/alignments-core'
import {
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { refNamePaletteColorAt } from '@jbrowse/core/ui/colors'
import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  alignmentsColorEncoding,
  colorFieldOf,
} from '../shared/alignmentsColor.ts'
import { bakedColorScale } from './bakedColorScale.ts'
import { bakedValueColor } from './colorTagUtils.ts'
import { buildReadFillColors, overlayReadFillColors } from './readFillColors.ts'

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
  range: [],
  scheme: undefined,
  reverse: false,
  domainMin: undefined,
  domainMax: undefined,
  domainMid: undefined,
}

function encodingFor(
  colorBy: ColorBy,
  declared: Partial<AlignmentsColorSetting> = {},
) {
  return alignmentsColorEncoding({
    ...UNDECLARED,
    field: colorFieldOf(colorBy),
    ...declared,
  })
}

function scaleFor(
  colorBy: ColorBy,
  declared: Partial<AlignmentsColorSetting> = {},
  position?: RefNamePosition,
) {
  return bakedColorScale(
    colorBy,
    encodingFor(colorBy, declared),
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
    expect(packed(bakedValueColor({ type: 'mateRefName' }, ''))).not.toBe(0)
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
    const colorBy: ColorBy = { type: 'tag', tag: 'XS' }
    const [fwd, rev, dot, absent] = buildReadFillColors(
      pileupWith(['+', '-', '.', '']),
      colorBy,
      scaleFor(colorBy),
    )
    expect(fwd).toBe(packed(colorFwdStrand))
    expect(rev).toBe(packed(colorRevStrand))
    expect([dot, absent]).toEqual([0, 0])
  })
})

describe('overlayReadFillColors', () => {
  const overlay = (colorBy: Parameters<typeof overlayReadFillColors>[1]) =>
    overlayReadFillColors(
      new Map([[0, pileupWith(['chr1'])]]),
      colorBy,
      colorBy && scaleFor(colorBy),
    ).get(0)!.readFillColors.length

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
      scale: 'linear',
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
      encodingFor(NM, { scale: 'linear', range: ['#000000', '#ffffff'] }),
      undefined,
      [4, 8],
    )
    const [low, high] = buildReadFillColors(pileupWith(['4', '8']), NM, scale)
    expect([low, high]).toEqual([packed('#000000'), packed('#ffffff')])
  })

  // Ends written high to low used to read as no pin at all, so the ramp
  // stretched over the reads instead; reverse is now the one way to turn it.
  test('ends written high to low still pin, and reverse turns the ramp round', () => {
    const colorsOf = (declared: Partial<AlignmentsColorSetting>) =>
      buildReadFillColors(
        pileupWith(['0', '10']),
        NM,
        bakedColorScale(
          NM,
          encodingFor(NM, {
            scale: 'linear',
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
        scale: 'linear',
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
      scale: 'threshold',
      domain: ['5'],
      range: ['#00ff00', '#ff0000'],
    })
    expect([
      ...buildReadFillColors(pileupWith(['1', '5', '9']), NM, scale),
    ]).toEqual([packed('#00ff00'), packed('#ff0000'), packed('#ff0000')])
  })

  test('a domain and range reach a mate reference too', () => {
    const MATE: ColorBy = { type: 'mateRefName' }
    const scale = scaleFor(MATE, { domain: ['chr2'], range: ['#ff0000'] })
    expect(scale.declared).toBe(true)
    expect(scale.color('chr2')).toBe('#ff0000')
  })

  test('threshold cuts written high to low are read ascending', () => {
    const scale = scaleFor(NM, {
      scale: 'threshold',
      domain: ['0.5', '0.1'],
      range: ['#0000ff', '#00ff00', '#ff0000'],
    })
    expect(scale.color('0.3')).toBe('#00ff00')
    expect(
      scale.kind === 'threshold' ? scale.bins.map(b => b.label) : [],
    ).toEqual(['< 0.1', '0.1 – 0.5', '≥ 0.5'])
  })

  test('a declared scale over a strand tag replaces the strand vocabulary', () => {
    const XS: ColorBy = { type: 'tag', tag: 'XS' }
    const scale = scaleFor(XS, { domain: ['+'], range: ['#123456'] })
    expect(buildReadFillColors(pileupWith(['+']), XS, scale)[0]).toBe(
      packed('#123456'),
    )
  })
})

describe('read-level fields', () => {
  // Placed records, so a category bit is evidence; the last read is none.
  const bits = [READ_SPLIT, READ_DISCORDANT, READ_SPLICED, 0].map(b =>
    withSvTier(b, 60, b & READ_SPLIT ? 'ctgA,1,+,50M,60,0;' : '', undefined),
  )
  const data = makePileupDataResult({
    readCategoryBits: Uint8Array.from(bits),
    readFlags: new Uint16Array(bits.length),
    readPairOrientations: new Uint8Array(bits.length),
  })
  const SV: ColorBy = { type: 'svSignal' }

  test('svSignal paints each kind of evidence and leaves the rest plain', () => {
    expect([...buildReadFillColors(data, SV, scaleFor(SV))]).toEqual([
      packed('#D55E00'),
      packed('#0072B2'),
      0,
      0,
    ])
  })

  test('split and spliced paint their own reads', () => {
    const split: ColorBy = { type: 'split' }
    const spliced: ColorBy = { type: 'spliced' }
    expect([...buildReadFillColors(data, split, scaleFor(split))]).toEqual([
      packed('#D55E00'),
      0,
      0,
      0,
    ])
    expect([...buildReadFillColors(data, spliced, scaleFor(spliced))]).toEqual([
      0,
      0,
      packed('#009E73'),
      0,
    ])
  })

  test('an SV-size indel paints its own color', () => {
    const indel = makePileupDataResult({
      readCategoryBits: Uint8Array.of(
        withSvTier(READ_SV_DELETION, 60, '', undefined),
      ),
      readFlags: new Uint16Array(1),
      readPairOrientations: new Uint8Array(1),
    })
    expect([...buildReadFillColors(indel, SV, scaleFor(SV))]).toEqual([
      packed('#CC79A7'),
    ])
  })

  test('a domain alone reorders the levels and keeps their colors', () => {
    const scale = scaleFor(SV, {
      scale: 'categorical',
      domain: ['discordantPair', 'splitRead'],
    })
    expect([...buildReadFillColors(data, SV, scale)].slice(0, 2)).toEqual([
      packed('#D55E00'),
      packed('#0072B2'),
    ])
  })

  test('pairing leaves concordant pairs plain and colors the rest', () => {
    const LR = PAIR_DIRECTION_NUM.LR
    const pairs = makePileupDataResult({
      readCategoryBits: new Uint8Array(4),
      readFlags: Uint16Array.of(
        SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR,
        SAM_FLAG_PAIRED,
        SAM_FLAG_PAIRED | SAM_FLAG_MATE_UNMAPPED,
        SAM_FLAG_PAIRED | SAM_FLAG_SUPPLEMENTARY,
      ),
      readPairOrientations: Uint8Array.of(LR, LR, LR, LR),
    })
    const pairing: ColorBy = { type: 'pairing' }
    expect([...buildReadFillColors(pairs, pairing, scaleFor(pairing))]).toEqual(
      [0, packed('#0072B2'), packed('#E69F00'), packed('#CC79A7')],
    )
  })

  test('a written domain and range recolor the levels', () => {
    const scale = scaleFor(SV, {
      scale: 'categorical',
      domain: ['discordantPair', 'splitRead'],
      range: ['#111111', '#222222'],
    })
    expect([...buildReadFillColors(data, SV, scale)].slice(0, 2)).toEqual([
      packed('#222222'),
      packed('#111111'),
    ])
  })
})
