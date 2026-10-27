import { categoricalColor } from '@jbrowse/core/ui/colors'
import { SimpleFeature } from '@jbrowse/core/util'
import { NO_VALUE_LABEL } from '@jbrowse/core/util/categoricalField'
import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { ordinalRange } from '@jbrowse/display-kit/colorConfigSchema'

import { widenAttributeRanges } from './TrackColorsMixin.ts'
import {
  createAttributeChannels,
  writeFeatureChannels,
} from './attributeChannels.ts'
import {
  DEFAULT_RIBBON_COLOR,
  MISSING_VALUE_COLOR,
  UNLABELLED_COLOR,
  categoricalColor as labelColor,
  createComparativeColorFunction,
  makeNameColorFunction,
  makeThresholdColorFunction,
  paletteColorAt,
  refNamePositionFor,
} from './colorFunctions.ts'
import { getColorBySwatch } from './colorLegend.ts'
import { resolveCategoricalMode } from './colorRamps.ts'

import type { ColorFunctionInputs, RefNamePosition } from './colorFunctions.ts'
import type { AttributeRange, SyntenyColorPaint } from './colorRamps.ts'

// what `Assembly.getRefNamePosition` answers, for a fixed chromosome order
function positionIn(order: readonly string[]) {
  return (refName: string) => {
    const i = order.indexOf(refName)
    return i < 0 ? undefined : i
  }
}

function inputs(over: Partial<ColorFunctionInputs> = {}): ColorFunctionInputs {
  return {
    strands: new Int8Array([1]),
    refNameDict: ['chr1'],
    refNameIds: new Uint32Array([0]),
    mateRefNameDict: ['chr1'],
    mateRefNameIds: new Uint32Array([0]),
    attributes: {},
    attributeRanges: {},
    ...over,
  }
}

// The reason this module exists. Both views used to declare their own palette
// under a comment claiming the two could not drift, and they had: synteny handed
// out palette positions by chromosome, dotplot hashed into nine buckets. Nothing
// caught it because nothing compared them.
describe('chromosome painting', () => {
  const karyotype = Array.from({ length: 24 }, (_, i) => `chr${i + 1}`)

  test('distinct colors well past nine, where a nine-bucket hash collides', () => {
    const ids = new Uint32Array(karyotype.map((_, i) => i))
    const fn = makeNameColorFunction(karyotype, ids, positionIn(karyotype))
    const colors = new Set(karyotype.map((_, i) => fn(i)))
    expect(colors.size).toBe(karyotype.length)
  })

  // Rice is the case a figure review actually caught: twelve chromosomes into
  // nine slots is a guaranteed three-way collision by pigeonhole.
  test('a rice karyotype paints twelve distinct colors', () => {
    const rice = karyotype.slice(0, 12)
    const fn = makeNameColorFunction(
      rice,
      new Uint32Array(rice.map((_, i) => i)),
      positionIn(rice),
    )
    expect(new Set(rice.map((_, i) => fn(i))).size).toBe(12)
  })

  // Three laps of nine, then the tones start again — a repeat 27 positions away
  // is one no reader is comparing.
  test('the palette laps at 27, not at 9', () => {
    expect(paletteColorAt(0)).not.toBe(paletteColorAt(9))
    expect(paletteColorAt(0)).not.toBe(paletteColorAt(18))
    expect(paletteColorAt(0)).toBe(paletteColorAt(27))
  })

  // Without an order there is nothing to hand out positions from, so the hash is
  // the answer — an assembly still loading, or a scaffold the assembly does not
  // list. Stable, and stable across the two views because it is one function.
  test('falls back to the hash with no order, and to it per-name with a partial one', () => {
    const dict = ['chr1', 'scaffold_77']
    const ids = new Uint32Array([0, 1])
    const hashed = makeNameColorFunction(dict, ids)
    const partial = makeNameColorFunction(dict, ids, positionIn(['chr1']))
    // chr1 is in the order, so it takes its POSITION's palette color — asserted
    // against a moved position, since chr1's hash bucket happens to be 0 too and
    // position 0 alone would pass either way
    expect(partial(0)).toBe(paletteColorAt(0))
    const moved = makeNameColorFunction(
      dict,
      ids,
      positionIn(['a', 'b', 'c', 'd', 'chr1']),
    )
    expect(moved(0)).toBe(paletteColorAt(4))
    expect(moved(0)).not.toBe(hashed(0))
    // the scaffold is in neither order, so all three answer with the same hash
    expect(partial(1)).toBe(hashed(1))
    expect(moved(1)).toBe(hashed(1))
  })
})

describe('createComparativeColorFunction', () => {
  test('an alignment the filter rejects paints at zero alpha', () => {
    const paint = createComparativeColorFunction({
      field: undefined,
      data: inputs({
        attributes: { identity: Float32Array.from([0.5, 0.9, Number.NaN]) },
      }),
      trackColor: '#123456',
      defaultColor: DEFAULT_RIBBON_COLOR,
      attributeRanges: {},
      filter: [{ field: 'identity', gte: 0.9 }],
    })
    expect([paint(0), paint(1), paint(2)]).toEqual([0, DEFAULT_RIBBON_COLOR, 0])
  })

  test('the filter reads the sequence names and the length it is handed', () => {
    const paint = createComparativeColorFunction({
      field: undefined,
      data: inputs({
        strands: new Int8Array([1, 1, 1]),
        refNameDict: ['chr1', 'chr2'],
        refNameIds: Uint32Array.from([0, 1, 0]),
      }),
      trackColor: '#123456',
      defaultColor: DEFAULT_RIBBON_COLOR,
      attributeRanges: {},
      filter: [
        { field: 'query', oneOf: ['chr1'] },
        { field: 'length', gte: 1000 },
      ],
      filterExtras: { lengthOf: i => [5000, 5000, 10][i]! },
    })
    expect([paint(0), paint(1), paint(2)]).toEqual([DEFAULT_RIBBON_COLOR, 0, 0])
  })

  // The one thing the two views legitimately disagree on, and therefore the one
  // thing that is a parameter rather than a constant.
  test('only the unpainted default differs between the two views', () => {
    const data = inputs()
    const ribbon = createComparativeColorFunction({
      field: undefined,
      data,
      trackColor: '#123456',
      defaultColor: DEFAULT_RIBBON_COLOR,
      attributeRanges: {},
    })
    const point = createComparativeColorFunction({
      field: undefined,
      data,
      trackColor: '#123456',
      defaultColor: 0xff000000,
      attributeRanges: {},
    })
    expect(abgrToCssRgba(ribbon(0))).toBe('rgba(255,0,0,1)')
    expect(abgrToCssRgba(point(0))).toBe('rgba(0,0,0,1)')

    // and every other mode answers identically whatever the default is
    for (const colorBy of ['strand', 'track', 'query', 'target'] as const) {
      const a = createComparativeColorFunction({
        field: colorBy,
        data,
        trackColor: '#123456',
        defaultColor: DEFAULT_RIBBON_COLOR,
        attributeRanges: {},
      })
      const b = createComparativeColorFunction({
        field: colorBy,
        data,
        trackColor: '#123456',
        defaultColor: 0xff000000,
        attributeRanges: {},
      })
      expect(a(0)).toBe(b(0))
    }
  })

  // `rampNorm` clamps to [0,1] itself only when the mode has no custom
  // `normalize`, so the LUT index is clamped on both ends here. Unclamped, an
  // out-of-domain value reads past the LUT (or, negative, truncates to a
  // negative index), gets `undefined`, and a Uint32Array store writes that as 0
  // — a transparent black feature, silently.
  test('an out-of-domain continuous value stays inside the LUT', () => {
    const data = inputs({
      attributes: { identity: new Float32Array([0, 0.5, 1, 99]) },
      strands: new Int8Array([1, 1, 1, 1]),
      refNameIds: new Uint32Array([0, 0, 0, 0]),
      mateRefNameIds: new Uint32Array([0, 0, 0, 0]),
    })
    const fn = createComparativeColorFunction({
      field: 'identity',
      data,
      trackColor: '#123456',
      defaultColor: DEFAULT_RIBBON_COLOR,
      attributeRanges: {},
    })
    for (const i of [0, 1, 2, 3]) {
      expect(Number.isInteger(fn(i))).toBe(true)
    }
    // clamped to the ramp's top rather than read off the end
    expect(fn(3)).toBe(fn(2))
  })

  test('a missing value paints the missing color, not the ramp bottom', () => {
    const data = inputs({
      attributes: { identity: new Float32Array([Number.NaN, 0]) },
      strands: new Int8Array([1, 1]),
      refNameIds: new Uint32Array([0, 0]),
      mateRefNameIds: new Uint32Array([0, 0]),
    })
    const fn = createComparativeColorFunction({
      field: 'identity',
      data,
      trackColor: '#123456',
      defaultColor: 0xff000000,
      attributeRanges: {},
    })
    expect(fn(0)).toBe(MISSING_VALUE_COLOR)
    expect(fn(1)).not.toBe(MISSING_VALUE_COLOR)
  })

  // The domain a column's ramp scales to is the CALLER'S, which is
  // what stops a pan from re-coloring what is already on screen: a fetch's
  // payload only knows the span of the slice it holds, and the view accumulates
  // one that settles. Two calls over the same values under two domains have to
  // answer differently, or the domain is not being read.
  test('an attribute ramp scales to the domain it is handed', () => {
    const data = inputs({
      attributes: { goc: new Float32Array([50]) },
      strands: new Int8Array([1]),
      refNameIds: new Uint32Array([0]),
      mateRefNameIds: new Uint32Array([0]),
    })
    const at = (
      attributeRanges: Record<string, { min: number; max: number }>,
    ) =>
      createComparativeColorFunction({
        field: 'goc',
        data,
        trackColor: '#123456',
        defaultColor: 0,
        attributeRanges,
      })(0)
    // top of a domain that ends at 50, middle of one that ends at 100
    expect(at({ goc: { min: 0, max: 50 } })).not.toBe(
      at({ goc: { min: 0, max: 100 } }),
    )
    expect(at({ goc: { min: 0, max: 50 } })).toBe(
      at({ goc: { min: 0, max: 50 } }),
    )
  })
})

// A text column paints one color per label: the file's own where the row put
// one beside it, else the palette slot of the label's position in the VIEW's
// first-seen order, which is what keeps a label one color across fetches.
describe('a categorical attribute', () => {
  const fetchLabels = { labels: ['B1', 'A1a'], colors: { A1a: '#4DB5E3' } }
  const data = inputs({
    attributes: { group: new Float32Array([0, 1, Number.NaN]) },
    attributeRanges: { group: fetchLabels },
  })

  test('paints a label its own color whatever order the view met it in, and the file color where given', () => {
    const paint = (labels: string[], domain?: string[]) =>
      createComparativeColorFunction({
        field: 'group',
        data,
        trackColor: '#000',
        defaultColor: 0,
        attributeRanges: {
          group: { labels, colors: fetchLabels.colors, domain },
        },
      })
    const fn = paint(['C1', 'B1', 'A1a'])
    expect(fn(0)).toBe(cssColorToABGR(categoricalColor('B1')))
    expect(paint(['B1', 'C1', 'A1a'])(0)).toBe(fn(0))
    expect(fn(1)).toBe(cssColorToABGR('#4DB5E3'))
    expect(fn(2)).toBe(UNLABELLED_COLOR)
    expect(paint(['B1', 'C1', 'A1a'], ['C1', 'B1'])(0)).toBe(
      cssColorToABGR(categoricalColor('B1', ['C1', 'B1'])),
    )
  })

  test('deals labels the hash puts on one color a color each, and keeps them as labels arrive', () => {
    const colorsOf = (labels: string[]) => {
      const mode = resolveCategoricalMode('group', {
        group: { labels, colors: {} },
      })!
      return labels.map(label => labelColor(mode, label))
    }
    const three = colorsOf(['protein_coding', 'snRNA', 'TEC'])
    expect(new Set(three).size).toBe(3)
    expect(
      colorsOf(['protein_coding', 'snRNA', 'TEC', 'lncRNA']).slice(0, 3),
    ).toEqual(three)
  })

  test("the view's range paints the domain's labels in order, and the file color still wins", () => {
    const fn = createComparativeColorFunction({
      field: 'group',
      data,
      trackColor: '#000',
      defaultColor: 0,
      attributeRanges: {
        group: {
          ...fetchLabels,
          domain: ['B1', 'A1a'],
          palette: ['#ff0000', '#00ff00'],
        },
      },
    })
    expect(fn(0)).toBe(cssColorToABGR('#ff0000'))
    expect(fn(1)).toBe(cssColorToABGR('#4DB5E3'))
  })

  test('scale.invalid paints a row with no label, as the multi-way ribbons do', () => {
    const fn = createComparativeColorFunction({
      field: 'group',
      data,
      trackColor: '#000',
      defaultColor: 0,
      attributeRanges: { group: fetchLabels },
      paint: { invalid: 'orange' },
    })
    expect(fn(1)).toBe(cssColorToABGR('#4DB5E3'))
    expect(fn(2)).toBe(cssColorToABGR('orange'))
  })

  test('hideUnlabelled draws the unlabelled row at zero alpha and leaves the rest', () => {
    const fn = createComparativeColorFunction({
      field: 'group',
      data,
      trackColor: '#000',
      defaultColor: 0,
      attributeRanges: { group: fetchLabels },
      hideUnlabelled: true,
    })
    expect(fn(1)).toBe(cssColorToABGR('#4DB5E3'))
    expect(fn(2) >>> 24).toBe(0)
    expect(fn(2) & 0xffffff).toBe(UNLABELLED_COLOR & 0xffffff)
  })

  test('a numeric column under the same mode string still ramps', () => {
    const fn = createComparativeColorFunction({
      field: 'group',
      data: inputs({
        attributes: { group: new Float32Array([0, 10]) },
        attributeRanges: { group: { min: 0, max: 10 } },
      }),
      trackColor: '#000',
      defaultColor: 0,
      attributeRanges: { group: { min: 0, max: 10 } },
    })
    expect(fn(0)).not.toBe(fn(1))
    expect(fn(0)).not.toBe(MISSING_VALUE_COLOR)
  })
})

test('refNamePositionFor reads query off the first assembly and target off the second', () => {
  const positions: Record<string, RefNamePosition> = {
    hg38: () => 1,
    mm10: () => 2,
  }
  const assemblyManager = {
    get: (name: string) =>
      positions[name] ? { getRefNamePosition: positions[name] } : undefined,
  }
  const at = (field: string, sides: (string | undefined)[]) =>
    refNamePositionFor(field, sides, assemblyManager)?.('chr1')
  expect(at('query', ['hg38', 'mm10'])).toBe(1)
  expect(at('target', ['hg38', 'mm10'])).toBe(2)
  expect(at('strand', ['hg38', 'mm10'])).toBeUndefined()
  expect(at('target', ['hg38', undefined])).toBeUndefined()
  expect(at('query', ['unloaded', 'mm10'])).toBeUndefined()
})

// A value's color on the ribbons and the key's stop at its place on the bar
// are the same color, through a middle `domainMid` moved off the centre.
test('a declared ramp paints what its key shows', () => {
  const ramp = { domainMax: 4, domainMid: 1 }
  const values = [0, 0.5, 1, 2, 4]
  const paint = createComparativeColorFunction({
    field: 'dnds',
    data: inputs({ attributes: { dnds: new Float32Array(values) } }),
    trackColor: 'black',
    defaultColor: DEFAULT_RIBBON_COLOR,
    attributeRanges: {},
    paint: ramp,
  })
  const swatch = getColorBySwatch('dnds', { paint: ramp })
  if (swatch?.kind !== 'ramp') {
    throw new Error('dnds keys as a ramp')
  }
  const rgb = (css: string) => css.match(/\d+/g)!.slice(0, 3).map(Number)
  for (const [i, value] of values.entries()) {
    const stop = swatch.stops.find(s => s.offset === value / 4)!
    const painted = rgb(abgrToCssRgba(paint(i)))
    for (const [c, channel] of rgb(stop.color).entries()) {
      expect(Math.abs(painted[c]! - channel)).toBeLessThanOrEqual(3)
    }
  }
})

// The key's bins and the ribbons are one mode, so a bin's chip is the color
// every value inside it paints.
test('mapq paints the bins its key lists, and no value grey', () => {
  const values = [0, 5, 20, 60, Number.NaN]
  const paint = createComparativeColorFunction({
    field: 'mapq',
    data: inputs({ attributes: { mappingQual: new Float32Array(values) } }),
    trackColor: 'black',
    defaultColor: DEFAULT_RIBBON_COLOR,
    attributeRanges: {},
  })
  const swatch = getColorBySwatch('mapq')
  if (swatch?.kind !== 'chips') {
    throw new Error('mapq keys as chips')
  }
  const bins = swatch.chips.map(chip => cssColorToABGR(chip.color!))
  expect(values.map((_, i) => paint(i))).toEqual([
    bins[3],
    bins[2],
    bins[1],
    bins[0],
    MISSING_VALUE_COLOR,
  ])
})

test('a float32 value on a cut that float32 rounds down takes the color above it', () => {
  const paint = makeThresholdColorFunction(
    {
      scale: 'threshold',
      attribute: 'identity',
      cuts: [0.7],
      colors: ['red', 'blue'],
    },
    { identity: new Float32Array([0.7, 0.69]) },
  )
  expect([paint(0), paint(1)]).toEqual([
    cssColorToABGR('blue'),
    cssColorToABGR('red'),
  ])
})

test('strand paints the range a color object writes, in domain order', () => {
  const data = inputs({ strands: new Int8Array([1, -1]) })
  const paint = createComparativeColorFunction({
    field: 'strand',
    data,
    trackColor: 'black',
    defaultColor: DEFAULT_RIBBON_COLOR,
    attributeRanges: {},
    paint: { domain: ['-1', '1'], range: ['black', 'gold'] },
  })
  expect([paint(0), paint(1)]).toEqual([
    cssColorToABGR('gold'),
    cssColorToABGR('black'),
  ])
})

describe('a column read off the loaded data', () => {
  function fetchOf(field: string, rows: Record<string, unknown>[]) {
    const channels = createAttributeChannels([field], rows.length)
    rows.forEach((row, i) => {
      writeFeatureChannels(
        channels.list,
        i,
        new SimpleFeature({
          uniqueId: `f${i}`,
          refName: 'chr1',
          start: 0,
          end: 1,
          ...row,
        }),
      )
    })
    return channels.finish(rows.length)
  }
  const merged = (...fetches: ReturnType<typeof fetchOf>[]) =>
    fetches.reduce<Record<string, AttributeRange>>(
      (acc, f) => widenAttributeRanges(acc, f.attributeRanges),
      {},
    )
  const painter = (
    field: string,
    fetch: ReturnType<typeof fetchOf>,
    view: Record<string, AttributeRange>,
    paint?: SyntenyColorPaint,
  ) =>
    createComparativeColorFunction({
      field,
      data: inputs(fetch),
      trackColor: '#000',
      defaultColor: DEFAULT_RIBBON_COLOR,
      attributeRanges: view,
      paint,
    })

  test('a written linear scale ramps a column holding text, and the text paints as missing', () => {
    const mixed = fetchOf('x', [{ x: 0.5 }, { x: 2 }, { x: 'high' }])
    const numbers = fetchOf('x', [{ x: 0.5 }, { x: 2 }])
    const linear = { type: 'linear' } as const
    const fn = painter('x', mixed, merged(mixed), linear)
    const reference = painter('x', numbers, merged(numbers), linear)
    expect(fn(0)).toBe(reference(0))
    expect(fn(1)).toBe(reference(1))
    expect(fn(0)).not.toBe(fn(1))
    expect(fn(2)).toBe(MISSING_VALUE_COLOR)
  })

  test('an ordinal scale paints a numeric column one color per value', () => {
    const ids = fetchOf('grp', [{ grp: 3 }, { grp: 1 }, { grp: 3 }, {}])
    const view = merged(ids)
    const ordinal = { type: 'ordinal' } as const
    const mode = resolveCategoricalMode('grp', view, ordinal)
    expect(mode?.labels).toEqual(['3', '1'])
    const fn = painter('grp', ids, view, ordinal)
    expect(fn(0)).toBe(cssColorToABGR(labelColor(mode!, '3')))
    expect(fn(1)).toBe(cssColorToABGR(labelColor(mode!, '1')))
    expect(fn(2)).toBe(fn(0))
    expect(fn(0)).not.toBe(fn(1))
    expect(fn(3)).toBe(UNLABELLED_COLOR)
    const swatch = getColorBySwatch('grp', {
      attributeRanges: view,
      paint: ordinal,
    })
    expect(
      swatch?.kind === 'chips' ? swatch.chips.map(c => c.label) : [],
    ).toEqual(['3', '1', NO_VALUE_LABEL])
  })

  test('an ordinal scale over a numeric column samples its scheme, reversed under reverse', () => {
    const ids = fetchOf('grp', [{ grp: 3 }, { grp: 1 }])
    const view = merged(ids)
    const domain = ['1', '3']
    const forward = { type: 'ordinal', domain, scheme: 'viridis' } as const
    const palette = ordinalRange({ ...forward, range: [] })
    expect(palette).toHaveLength(2)
    expect(resolveCategoricalMode('grp', view, forward)?.palette).toEqual(
      palette,
    )
    expect(
      resolveCategoricalMode('grp', view, { ...forward, reverse: true })
        ?.palette,
    ).toEqual([...palette].reverse())
  })

  test("a fetch of numbers paints through the view's labels when another fetch held text", () => {
    const text = fetchOf('grp', [
      { grp: 'a' },
      { grp: 'b' },
      { grp: 'c' },
      { grp: 'd' },
    ])
    const numbers = fetchOf('grp', [{ grp: 0.93 }, { grp: 3 }])
    const view = merged(text, numbers)
    const mode = resolveCategoricalMode('grp', view)!
    const fn = painter('grp', numbers, view)
    expect(fn(0)).toBe(cssColorToABGR(labelColor(mode, '0.93')))
    expect(fn(1)).toBe(cssColorToABGR(labelColor(mode, '3')))
    expect(fn(1)).not.toBe(cssColorToABGR(labelColor(mode, 'd')))
  })
})
