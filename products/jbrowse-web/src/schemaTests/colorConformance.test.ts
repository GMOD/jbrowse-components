import { refusingUndeclaredKeys } from '@jbrowse/core/configuration'
import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
  abgrToHex,
  cssColorToABGR,
} from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import {
  colorConfigSchema,
  colorEncodingOf,
  colorSnapshotOf,
  ordinalRange,
} from '@jbrowse/display-kit/colorConfigSchema'
import { paintColors, thresholdBandOf } from '@jbrowse/render-core/marks'
import { SCALE_TYPE_LINEAR } from '@jbrowse/render-core/scoreScale'

import { orderAttributeLabels } from '../../../../packages/synteny-core/src/TrackColorsMixin.ts'
import {
  DEFAULT_RIBBON_COLOR,
  createComparativeColorFunction,
} from '../../../../packages/synteny-core/src/colorFunctions.ts'
import { colorPaintOf } from '../../../../packages/synteny-core/src/colorRamps.ts'
import { syntenyColorConfigSchema } from '../../../../packages/synteny-core/src/syntenyColorConfigSchema.ts'
import { alignmentsColorConfigSchema } from '../../../../plugins/alignments/src/LinearAlignmentsDisplay/alignmentsColorConfigSchema.ts'
import { bakedColorScale } from '../../../../plugins/alignments/src/LinearAlignmentsDisplay/bakedColorScale.ts'
import {
  alignmentsColorEncoding,
  alignmentsColorSettingOf,
  readColorFieldOf,
  writtenReadCategoryColors,
} from '../../../../plugins/alignments/src/shared/alignmentsColor.ts'
import { featureColorViews } from '../../../../plugins/canvas/src/shared/featureColorViews.ts'
import {
  dealGeneColors,
  geneColors,
} from '../../../../plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/geneColor.ts'
import { geneColorConfigSchema } from '../../../../plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/geneColorConfigSchema.ts'
import { configSlotViews } from '../../../../plugins/maf/src/LinearMafDisplay/configSlotViews.ts'
import { mafColorConfigSchema } from '../../../../plugins/maf/src/LinearMafDisplay/mafColorConfigSchema.ts'
import { paintScaleOf } from '../../../../plugins/marks/src/LinearMarkDisplay/legend.ts'
import {
  markColorOf,
  withMarkColor,
} from '../../../../plugins/marks/src/LinearMarkDisplay/markColor.ts'
import { markColorSchema } from '../../../../plugins/marks/src/LinearMarkDisplay/markColorConfigSchema.ts'
import { cellColorConfigSchema } from '../../../../plugins/variants/src/LinearMultiSampleVariantDisplay/cellColorConfigSchema.ts'
import { cellHueOf } from '../../../../plugins/variants/src/shared/cellHue.ts'
import { makeDensityLutFillFn } from '../../../../plugins/wiggle/src/shared/getDensityColor.ts'
import {
  paintedWiggleColor,
  resolveWiggleColor,
  wiggleColorEncoding,
  wiggleColorSettingOf,
} from '../../../../plugins/wiggle/src/shared/wiggleColor.ts'
import { wiggleColorSchema } from '../../../../plugins/wiggle/src/shared/wiggleColorConfigSchema.ts'

import type { AttributeRange } from '../../../../packages/synteny-core/src/colorRamps.ts'
import type { MultiWaySyntenyDisplayConfig } from '../../../../plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/configSchema.ts'
import type { ConfigSlotSelf } from '../../../../plugins/maf/src/LinearMafDisplay/configSlotViews.ts'
import type { MarkConfig } from '../../../../plugins/marks/src/LinearMarkDisplay/configSchema.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { EncodedChannels } from '@jbrowse/core/util/markEncoding'

// One table of `encoding.color` specs, each run through every display's own
// resolver, and each display's answer per sample value compared with the
// canvas feature display's. A divergence passes only while EXCEPTIONS names
// it, and a listed one that stops diverging fails, so the list only shrinks.

type Sample = string | number | undefined

interface Spec {
  name: string
  color: ColorSlots
  values: readonly Sample[]
}

const SPECS: readonly Spec[] = [
  { name: 'constant', color: { value: 'tomato' }, values: ['a', 'b'] },
  {
    name: 'numeric field, no scale',
    color: { field: 'score' },
    values: [1, 5, 10],
  },
  {
    name: 'numeric field other than score, no scale',
    color: { field: 'depth' },
    values: [1, 5, 10],
  },
  {
    name: 'text field, no scale',
    color: { field: 'type' },
    values: ['mRNA', 'gene', 'exon', 'gene'],
  },
  {
    name: 'ordinal domain, range, invalid',
    color: {
      field: 'type',
      scale: {
        type: 'ordinal',
        domain: ['gene', 'exon'],
        range: ['#d95f02', '#1b9e77'],
        invalid: '#cccccc',
      },
    },
    values: ['gene', 'exon', 'tRNA', undefined],
  },
  {
    name: 'ordinal domain, range, unknown, invalid',
    color: {
      field: 'type',
      scale: {
        type: 'ordinal',
        domain: ['gene', 'exon'],
        range: ['#d95f02', '#1b9e77'],
        unknown: '#999999',
        invalid: '#cccccc',
      },
    },
    values: ['gene', 'exon', 'tRNA', undefined],
  },
  {
    name: 'ordinal scheme over a domain',
    color: {
      field: 'type',
      scale: { domain: ['gene', 'exon', 'tRNA'], scheme: 'viridis' },
    },
    values: ['gene', 'exon', 'tRNA'],
  },
  {
    name: 'linear, pinned ends, scheme, reverse',
    color: {
      field: 'identity',
      scale: {
        type: 'linear',
        domainMin: 0.2,
        domainMax: 0.8,
        scheme: 'viridis',
        reverse: true,
      },
    },
    values: [0, 0.2, 0.5, 0.8, 1],
  },
  {
    name: 'linear over the data, scheme',
    color: { field: 'score', scale: { type: 'linear', scheme: 'magma' } },
    values: [0, 2.5, 5, 10],
  },
  {
    name: 'threshold cuts',
    color: {
      field: 'score',
      scale: {
        type: 'threshold',
        domain: ['3', '7'],
        range: ['#2166ac', '#f7f7f7', '#b2182b'],
      },
    },
    values: [1, 3, 5, 7, 9],
  },
]

const DISPLAYS = [
  'canvas',
  'mark',
  'variant',
  'multiway',
  'wiggle',
  'alignments',
  'maf',
  'synteny',
] as const

type Display = (typeof DISPLAYS)[number]

const REFERENCE: Display = 'canvas'

interface Exception {
  display: Display
  spec: string
  why: string
}

function listed(display: Display, why: string, ...specs: string[]) {
  return specs.map(spec => ({ display, spec, why }))
}

const ORDINAL_DEFAULT =
  'an unset scale.type is ordinal on every field, where canvas runs score along a ramp'

const WIGGLE_SCORE_ONLY =
  'colors only the score it plots, so it declares no field; its ramp spans the y domain, and its scale is linear or threshold'

const MAF_FIELDS =
  'fills cells by identity or refNameRank alone, each with its one scale, so it declares no other field and no scale.type'

const DISCRETE_SCALES =
  'paints ordinal and threshold scales alone, so its scale declares no ramp members'

const EXCEPTIONS: readonly Exception[] = [
  ...listed('variant', ORDINAL_DEFAULT, 'numeric field, no scale'),
  ...listed('multiway', ORDINAL_DEFAULT, 'numeric field, no scale'),
  ...listed(
    'wiggle',
    'an unset scale.type is the bicolor pair cut at the origin',
    'numeric field, no scale',
  ),
  ...listed(
    'alignments',
    'a tag or attribute with no domain, range or unknown colors each value by a function of the value alone (bakedValueColor), where canvas deals colors into held slots',
    'numeric field, no scale',
    'numeric field other than score, no scale',
    'text field, no scale',
  ),
  ...listed(
    'synteny',
    "an unset scale.type follows the loaded column, a ramp while every value is a number, since its adapters state a column's kind only in the data",
    'numeric field other than score, no scale',
  ),
  ...listed(
    'synteny',
    'declares no scale.unknown, which its closed schema refuses',
    'ordinal domain, range, unknown, invalid',
  ),
  ...listed(
    'variant',
    DISCRETE_SCALES,
    'ordinal scheme over a domain',
    'linear, pinned ends, scheme, reverse',
    'linear over the data, scheme',
  ),
  ...listed(
    'multiway',
    DISCRETE_SCALES,
    'ordinal scheme over a domain',
    'linear, pinned ends, scheme, reverse',
    'linear over the data, scheme',
  ),
  ...listed(
    'wiggle',
    WIGGLE_SCORE_ONLY,
    'numeric field other than score, no scale',
    'text field, no scale',
    'ordinal domain, range, invalid',
    'ordinal domain, range, unknown, invalid',
    'ordinal scheme over a domain',
    'linear, pinned ends, scheme, reverse',
  ),
  ...listed(
    'maf',
    MAF_FIELDS,
    'numeric field, no scale',
    'numeric field other than score, no scale',
    'text field, no scale',
    'ordinal domain, range, invalid',
    'ordinal domain, range, unknown, invalid',
    'ordinal scheme over a domain',
    'linear over the data, scheme',
    'threshold cuts',
  ),
]

type Answer = number | string

function text(value: Sample) {
  return value === undefined ? '' : String(value)
}

function numbers(values: readonly Sample[]) {
  return values.map(v => (v === undefined ? Number.NaN : Number(v)))
}

function extentOf(values: readonly Sample[]): [number, number] {
  const finite = numbers(values).filter(Number.isFinite)
  return [Math.min(...finite), Math.max(...finite)]
}

function created<T>(make: () => T): T | string {
  try {
    return refusingUndeclaredKeys(make)
  } catch (e) {
    return `refused: ${e instanceof Error ? e.message.split('\n')[0] : e}`
  }
}

function packed(color: string | number | undefined, otherwise: string) {
  return color === undefined
    ? otherwise
    : typeof color === 'number'
      ? color
      : cssColorToABGR(color)
}

function withoutField({ field: _field, ...rest }: ColorSlots) {
  return rest
}

function withoutType({
  type: _type,
  ...rest
}: NonNullable<ColorSlots['scale']>) {
  return rest
}

function canvas({ color, values }: Spec): Answer[] | string {
  const node = created(() => colorConfigSchema.create(color))
  if (typeof node === 'string') {
    return node
  }
  const views = featureColorViews({
    conf: { encoding: { color: node } },
    rpcDataMap: new Map([
      [
        0,
        {
          colorValues: { field: color.field ?? '', values: values.map(text) },
          rectColorValues: undefined,
        },
      ],
    ]),
  })
  const encoding = views.colorEncoding
  if (typeof encoding !== 'object') {
    return values.map(() => packed(encoding, 'none: own color'))
  }
  const table = views.fieldPalette!.tableOf(values.map(text), false)
  return values.map((_, i) => table[i * 3]!)
}

function mark({ color, values }: Spec): Answer[] | string {
  const node = created(() => markColorSchema.create(color))
  if (typeof node === 'string') {
    return node
  }
  const markConfig = {
    mark: { type: 'point' },
    encoding: { color: node, y: '' },
  } as unknown as MarkConfig
  const source = markColorOf(markConfig, {}, {})
  const count = values.length
  const base: EncodedChannels = {
    count,
    skipped: 0,
    yMin: 0,
    yMax: 0,
    x: new Uint32Array(count),
    x2: new Uint32Array(count),
  }
  if (source.kind === 'constant') {
    return values.map(() => source.color)
  }
  if (source.kind === 'categories') {
    const keys = [...new Set(values.map(text))]
    const layer = withMarkColor(
      {
        ...base,
        colorKey: Uint32Array.from(values, v => keys.indexOf(text(v))),
        scale: {
          kind: 'categorical',
          field: source.encoding.field,
          domain: [],
          entries: keys.map(value => ({ value, color: 0 })),
        },
      },
      source,
    )
    return values.map((_, i) => (layer.color as Uint32Array)[i]!)
  }
  if (source.kind === 'numbers') {
    const layer = withMarkColor(
      {
        ...base,
        colorValue: Float32Array.from(numbers(values)),
        scale: { kind: 'threshold', field: source.encoding.field, domain: [] },
      },
      source,
    )
    const colors = paintColors(layer, count, paintScaleOf(layer.scale))
    return values.map((_, i) => colors[i]!)
  }
  return `none: ${source.kind}`
}

function variant({ color, values }: Spec): Answer[] | string {
  const node = created(() => cellColorConfigSchema.create(color))
  if (typeof node === 'string') {
    return node
  }
  const hue = cellHueOf(
    colorEncodingOf(colorSnapshotOf(node)),
    undefined,
    new Map(),
  )
  hue.deal?.(values.map(text))
  return values.map(v =>
    packed(hue.hueOf?.(text(v)) ?? hue.constant, 'none: genotype colors'),
  )
}

function multiway({ color, values }: Spec): Answer[] | string {
  const node = created(() => geneColorConfigSchema.create(color))
  if (typeof node === 'string') {
    return node
  }
  const jexl = createJexlInstance()
  const encoding = colorEncodingOf(colorSnapshotOf(node))
  const held = new Map()
  const features = values.map(
    (v, i) =>
      new SimpleFeature({
        uniqueId: `g${i}`,
        refName: 'ctgA',
        start: i * 10,
        end: i * 10 + 5,
        ...(color.field && v !== undefined ? { [color.field]: v } : {}),
      }),
  )
  dealGeneColors(encoding, held, jexl, features)
  const conf = {
    encoding: { color: node },
  } as unknown as MultiWaySyntenyDisplayConfig
  const colors = geneColors(conf, encoding, undefined, jexl, held)
  return features.map(f => colors.fill(f, undefined).packed)
}

function wiggle({ color, values }: Spec): Answer[] | string {
  const written = color.field === 'score' ? withoutField(color) : color
  const node = created(() => wiggleColorSchema.create(written))
  if (typeof node === 'string') {
    return node
  }
  const resolved = resolveWiggleColor(
    wiggleColorEncoding(
      paintedWiggleColor(wiggleColorSettingOf(node), {
        rect: false,
        origin: 0,
      }),
    ),
    0,
  )
  const scores = numbers(values)
  if (resolved.rampLut) {
    const [min, max] = extentOf(values)
    const fill = makeDensityLutFillFn(
      min,
      max,
      SCALE_TYPE_LINEAR,
      resolved.rampLut,
      resolved.rampMid,
    )
    return scores.map(score => cssColorToABGR(fill(score)))
  }
  const bands = [resolved.negColor, ...resolved.innerColors, resolved.posColor]
  return scores.map(score =>
    cssColorToABGR(bands[thresholdBandOf(score, resolved.cuts)]!),
  )
}

function alignments({ color, values }: Spec): Answer[] | string {
  const node = created(() => alignmentsColorConfigSchema.create(color))
  if (typeof node === 'string') {
    return node
  }
  const setting = alignmentsColorSettingOf(node)
  const encoding = alignmentsColorEncoding(setting)
  const categories = writtenReadCategoryColors(setting, encoding)
  const rgb = (c: readonly number[] | undefined) =>
    c && cssColorToABGR(`rgb(${c.map(x => Math.round(x * 255)).join(',')})`)
  const field = readColorFieldOf(encoding)
  if (field === undefined) {
    return values.map(() => packed(rgb(categories.plain), 'none: theme fill'))
  }
  const scale = bakedColorScale(field, encoding, undefined, extentOf(values))
  return values.map(v =>
    v === undefined
      ? packed(rgb(categories.noTagValue), 'none: no-value fill')
      : packed(scale.color(text(v)), 'none: plain fill'),
  )
}

function maf({ color, values }: Spec): Answer[] | string {
  const written =
    color.field === 'identity' && color.scale?.type === 'linear'
      ? { ...color, scale: withoutType(color.scale) }
      : color
  const node = created(() => mafColorConfigSchema.create(written))
  if (typeof node === 'string') {
    return node
  }
  const views = configSlotViews({
    configuration: { encoding: { color: node } },
  } as unknown as ConfigSlotSelf)
  const encoding = views.colorEncoding
  if (typeof encoding !== 'object') {
    return values.map(() => packed(encoding, 'none: theme match tone'))
  }
  if (encoding.field !== 'identity') {
    return `none: ${encoding.field}`
  }
  const lut = views.identityColors
  return numbers(values).map(v => lut[Math.round(v * 100)]!)
}

function syntenyRanges(field: string, values: readonly Sample[]) {
  const named = values.filter(v => v !== undefined)
  const missing = named.length < values.length
  if (named.every(v => typeof v === 'number')) {
    const [min, max] = extentOf(values)
    return {
      lane: Float32Array.from(numbers(values)),
      range: {
        min,
        max,
        values: [...new Set(named)],
        ...(missing ? { missing } : {}),
      } as AttributeRange,
    }
  }
  const labels = [...new Set(named.map(String))]
  return {
    lane: Float32Array.from(values, v =>
      v === undefined ? Number.NaN : labels.indexOf(String(v)),
    ),
    range: { labels, colors: {}, ...(missing ? { missing } : {}) },
  }
}

function synteny({ color, values }: Spec): Answer[] | string {
  const node = created(() => syntenyColorConfigSchema.create(color))
  if (typeof node === 'string') {
    return node
  }
  const { value, field } = colorSnapshotOf(node)
  const { scale } = node as AnyConfigurationModel
  const domain: string[] = scale.domain
  const { lane, range } = field
    ? syntenyRanges(field, values)
    : { lane: new Float32Array(0), range: undefined }
  const fetched = field && range ? { [field]: range } : {}
  const paint = createComparativeColorFunction({
    field: field || undefined,
    data: {
      strands: new Int8Array(values.length),
      refNameDict: [],
      refNameIds: new Uint32Array(values.length),
      mateRefNameDict: [],
      mateRefNameIds: new Uint32Array(values.length),
      attributes: field ? { [field]: lane } : {},
      attributeRanges: fetched,
    },
    trackColor: '#000',
    defaultColor:
      value === undefined ? DEFAULT_RIBBON_COLOR : cssColorToABGR(value),
    attributeRanges: orderAttributeLabels(
      fetched,
      domain,
      ordinalRange({ domain, range: scale.range, scheme: scale.scheme }),
    ),
    paint: colorPaintOf(node),
  })
  return values.map((_, i) => paint(i))
}

const ADAPTERS: Record<Display, (spec: Spec) => Answer[] | string> = {
  canvas,
  mark,
  variant,
  multiway,
  wiggle,
  alignments,
  maf,
  synteny,
}

const TOLERANCE = 3

function same(a: Answer, b: Answer) {
  if (typeof a === 'string' || typeof b === 'string') {
    return a === b
  }
  return [abgrRed, abgrGreen, abgrBlue, abgrAlpha].every(
    channel => Math.abs(channel(a) - channel(b)) <= TOLERANCE,
  )
}

function shown(answer: Answer) {
  return typeof answer === 'string' ? answer : abgrToHex(answer)
}

function disagreement(
  answers: Answer[] | string,
  reference: Answer[],
  values: readonly Sample[],
) {
  if (typeof answers === 'string') {
    return answers
  }
  const lines = values.flatMap((v, i) =>
    same(answers[i]!, reference[i]!)
      ? []
      : [
          `${JSON.stringify(v ?? null)}: ${shown(answers[i]!)}, ${REFERENCE} ${shown(reference[i]!)}`,
        ],
  )
  return lines.length > 0 ? lines.join('; ') : undefined
}

const CASES = SPECS.flatMap(spec =>
  DISPLAYS.filter(d => d !== REFERENCE).map(
    display => [display, spec] as const,
  ),
)

test.each(SPECS.map(spec => [spec.name, spec] as const))(
  '%s paints on the reference display',
  (_, spec) => {
    expect(typeof ADAPTERS[REFERENCE](spec)).not.toBe('string')
  },
)

test.each(CASES.map(([display, spec]) => [display, spec.name, spec] as const))(
  '%s paints %s as the reference does, or EXCEPTIONS says why not',
  (display, _, spec) => {
    const reference = ADAPTERS[REFERENCE](spec) as Answer[]
    const diverges = disagreement(
      ADAPTERS[display](spec),
      reference,
      spec.values,
    )
    const listed = EXCEPTIONS.find(
      e => e.display === display && e.spec === spec.name,
    )
    if (diverges && !listed) {
      throw new Error(
        `${display} paints "${spec.name}" unlike ${REFERENCE}, and EXCEPTIONS does not list it: ${diverges}`,
      )
    }
    if (!diverges && listed) {
      throw new Error(
        `${display} now paints "${spec.name}" as ${REFERENCE} does: remove its EXCEPTIONS entry (${listed.why})`,
      )
    }
  },
)

test('every exception names a display and a spec in the table', () => {
  const names = new Set(SPECS.map(spec => spec.name))
  expect(
    EXCEPTIONS.filter(e => !names.has(e.spec) || e.display === REFERENCE),
  ).toEqual([])
})
