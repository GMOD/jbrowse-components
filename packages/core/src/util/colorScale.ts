/**
 * The scales a color object paints through, in a module that imports
 * nothing: `jbrowse validate` carries a copy of it, so the validator and the
 * displays read one statement.
 */

/** How a color object maps its `field`; `none` paints `value`. */
export const COLOR_SCALES = [
  'none',
  'categorical',
  'linear',
  'log',
  'threshold',
] as const

/**
 * The scale that maps no field: each feature paints the color it carries, and
 * the key names the colors `domain` lists. Only a display whose features
 * carry colors of their own declares it.
 */
export const IDENTITY_SCALE = 'identity'

export type ColorScaleName =
  | (typeof COLOR_SCALES)[number]
  | typeof IDENTITY_SCALE

/**
 * A field's defaults on a display: the scale it paints through while `scale`
 * is unset, and the members that scale reads while the config leaves them
 * unwritten, so a field with a vocabulary or ramp of its own is the color
 * object's defaults rather than a painter beside it.
 */
export interface FieldPreset<S extends string = ColorScaleName> {
  scale: S
  /** The key a feature carrying no value files under. */
  missing?: string
  domain?: readonly string[]
  range?: readonly string[]
  labels?: readonly string[]
  title?: string
  domainMin?: number
  domainMax?: number
  domainMid?: number
  scheme?: string
  reverse?: boolean
}

/** Each field's preset, `*` for any other field. */
export type FieldPresets<S extends string = ColorScaleName> = Readonly<
  Record<string, FieldPreset<S>>
>

const CATEGORICAL_PRESET: FieldPreset<'categorical'> = { scale: 'categorical' }

/**
 * The fields whose values have names, an order and colors of their own on
 * every display, beneath each display's own presets. The synteny ribbons
 * paint strand from this range too. The SV classes are
 * `svClassOf`'s, deletion red and duplication blue as dbVar and gnomAD-SV
 * paint them, insertion the pileup's purple, and the rest kept apart under
 * deuteranopia and protanopia. A record with no class files under `''`, so
 * each display keeps its own no-value color for it.
 */
export const UNIVERSAL_FIELD_PRESETS = {
  strand: {
    scale: 'categorical',
    missing: '0',
    domain: ['1', '-1', '0'],
    range: ['tomato', 'cornflowerblue', 'goldenrod'],
    labels: ['Forward strand', 'Reverse strand', 'No strand'],
  },
  svType: {
    scale: 'categorical',
    domain: ['DEL', 'DUP', 'INS', 'INV', 'CNV', 'TR', 'BND', 'CPX', 'OTHER'],
    range: [
      '#e41a1c',
      '#377eb8',
      '#800080',
      '#ff7f00',
      '#7e6148',
      '#e7298a',
      '#17becf',
      '#66a61e',
      '#000000',
    ],
    labels: [
      'Deletion',
      'Duplication',
      'Insertion',
      'Inversion',
      'Copy-number variable',
      'Tandem repeat',
      'Breakend / translocation',
      'Complex',
      'Other / mixed',
    ],
    title: 'SV type',
  },
} as const satisfies FieldPresets<'categorical'>

/** The universal preset of `field`, if it has one. */
export function universalPresetOf(
  field: string,
): FieldPreset<'categorical'> | undefined {
  return Object.hasOwn(UNIVERSAL_FIELD_PRESETS, field)
    ? UNIVERSAL_FIELD_PRESETS[field as keyof typeof UNIVERSAL_FIELD_PRESETS]
    : undefined
}

/** Every field categorical while `scale` is unset, with nothing preset. */
export const CATEGORICAL_FIELD_PRESETS = {
  '*': CATEGORICAL_PRESET,
} as const satisfies FieldPresets

/**
 * What a feature's field paints through while `scale` is unset: `score` a
 * ramp, any other field categories.
 */
export const FEATURE_FIELD_PRESETS = {
  score: { scale: 'linear' },
  '*': CATEGORICAL_PRESET,
} as const satisfies FieldPresets

/**
 * A field's preset under `presets`: its own, else a universal one, else
 * `*`'s, else categorical.
 */
export function presetOf<S extends string>(
  presets: FieldPresets<S>,
  field: string,
): FieldPreset<S | 'categorical'> {
  return (
    (Object.hasOwn(presets, field)
      ? presets[field]
      : (universalPresetOf(field) ?? presets['*'])) ?? CATEGORICAL_PRESET
  )
}

/** What a field paints through under `presets` while `scale` is unset. */
export function fieldScaleOf<S extends string>(
  presets: FieldPresets<S>,
  field: string,
): S | 'categorical' {
  return presetOf(presets, field).scale
}

function unwritten(value: unknown) {
  return value === undefined || (Array.isArray(value) && value.length === 0)
}

/**
 * A color object with its field's preset under it: each member the preset
 * names and the config leaves unwritten, an empty list counting as unwritten.
 * Only while the color paints through the preset's own scale, so the cuts of
 * a threshold preset never reach a field read through a ramp. A categorical
 * preset's `range` and `labels` name its `domain`'s values in order, and a
 * threshold preset's `labels` its intervals, so they fill only while `domain`
 * does too: a written order keeps each value's own color and name, and written
 * cuts keep the preset's palette and lose its interval names.
 */
export function withPreset<C extends { field?: string; scale?: string }>(
  color: C,
  presets: FieldPresets<string>,
): C {
  const field = color.field ?? ''
  const preset = presetOf(presets, field)
  if (!field || (color.scale ?? preset.scale) !== preset.scale) {
    return color
  }
  const written = new Map<string, unknown>(Object.entries(color))
  const ownDomain = !preset.domain || unwritten(written.get('domain'))
  const named =
    preset.scale === 'categorical' ? ['range', 'labels'] : ['labels']
  const filled = Object.entries(preset).filter(
    ([key]) =>
      key !== 'scale' &&
      key !== 'missing' &&
      (ownDomain || !named.includes(key)) &&
      unwritten(written.get(key)),
  )
  return filled.length > 0 ? { ...color, ...Object.fromEntries(filled) } : color
}

/**
 * The scale a color object paints through: `none` while no `field` is
 * named, else its own `scale`, or `fieldScale` where that is unset.
 */
export function paintedScale<S extends string, F extends string>(
  { scale, field }: { scale: S | undefined; field: string },
  fieldScale: F,
): S | F | 'none' {
  return field ? (scale ?? fieldScale) : 'none'
}

/** A combination of a scale's slots the display cannot draw as written. */
export interface ScaleProblem {
  rule:
    | 'threshold-cuts'
    | 'threshold-range'
    | 'ramp-domain'
    | 'ramp-range'
    | 'domain-ends'
    | 'domain-quantile'
    | 'log-floor'
    | 'labels-domain'
  /** the slot to look at, relative to the scale's own object */
  slot: string
  message: string
}

/**
 * The members a quantitative scale's ends are read by, as a color ramp,
 * `scales.y` and a mark's width spell them alike.
 */
export interface ScaleEnds {
  domainMin?: number
  domainMax?: number
  domainQuantile?: number
  /** the scale's kind, `scales.y.type` or a color's `scale`, where it bears on the ends */
  type?: string
}

/**
 * What a quantitative scale's ends say together that neither can refuse
 * alone: a `domainMax` below its `domainMin`, which every such scale draws in
 * order either way, and a `domainQuantile` outside 0.5 to 1, where the quantile
 * an open end follows is clamped; and a log scale's `domainMin` at or below 0,
 * which no log scale can hold, so the end floors above it. `reverse` is whether
 * the scale turns round by a member of its own, which is then the spelling to
 * point at.
 */
export function scaleEndProblems(
  { domainMin, domainMax, domainQuantile, type }: ScaleEnds,
  { reverse = false }: { reverse?: boolean } = {},
): ScaleProblem[] {
  return [
    ...(type === 'log' && domainMin !== undefined && domainMin <= 0
      ? [
          {
            rule: 'log-floor' as const,
            slot: 'domainMin',
            message: `a log scale has no ${domainMin}: the end floors to a positive value, so leave domainMin unset to follow the data or pin it above 0`,
          },
        ]
      : []),
    ...(domainMin !== undefined &&
    domainMax !== undefined &&
    domainMin > domainMax
      ? [
          {
            rule: 'domain-ends' as const,
            slot: 'domainMax',
            message: `domainMax is below domainMin: the scale spans the two in order either way${reverse ? ', and reverse is what turns it round' : ''}`,
          },
        ]
      : []),
    ...(domainQuantile !== undefined &&
    !(domainQuantile >= 0.5 && domainQuantile <= 1)
      ? [
          {
            rule: 'domain-quantile' as const,
            slot: 'domainQuantile',
            message:
              'domainQuantile is a fraction from 0.5 to 1, not a percent: 1 follows the extremes and 0.99 clips the outermost 1% at each end; above 1 reads as 1 and below 0.5 as 0.5',
          },
        ]
      : []),
  ]
}

/** Problems as the lines a display's corner notice lists, under the setting that holds the scale. */
export function noticeLines(
  setting: string,
  problems: readonly ScaleProblem[],
): string[] {
  return problems.map(({ slot, message }) => `${setting}.${slot}: ${message}`)
}

/** The slots `colorProblems` reads, as a snapshot or a resolved setting holds them. */
export interface ColorSlots {
  value?: string
  field?: string
  scale?: string
  domain?: readonly unknown[]
  range?: readonly unknown[]
  domainMin?: number
  domainMax?: number
  domainQuantile?: number
  labels?: readonly unknown[]
}

function numberOf(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function stringOf(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function listOf(value: unknown) {
  return Array.isArray(value) ? (value as unknown[]) : undefined
}

/** A quantitative scale's ends among the members `member` reads, each a number or unset. */
export function scaleEndsOf(member: (name: string) => unknown): ScaleEnds {
  return {
    domainMin: numberOf(member('domainMin')),
    domainMax: numberOf(member('domainMax')),
    domainQuantile: numberOf(member('domainQuantile')),
    type: stringOf(member('type')),
  }
}

/**
 * The members `colorProblems` reads among the ones `member` reads, each of the
 * type it reads or unset, so a config snapshot and a config node answer alike.
 */
export function colorSlotsOf(member: (name: string) => unknown): ColorSlots {
  return {
    ...scaleEndsOf(member),
    field: stringOf(member('field')) ?? '',
    scale: stringOf(member('scale')),
    domain: listOf(member('domain')),
    range: listOf(member('range')),
    labels: listOf(member('labels')),
  }
}

function pinned(entry: unknown) {
  return entry !== '' && Number.isFinite(Number(entry))
}

/**
 * What a color object's slots say together that no single slot can refuse,
 * since the config editor writes one slot at a time (ADR-133), read with its
 * field's preset under it. A display shows these as a notice and draws what
 * it can. A threshold naming no cuts leaves its intervals to the display —
 * the alignments insert-size band samples its cuts, the wiggle plot cuts at
 * its origin — so its `labels` go uncounted.
 */
export function colorProblems(
  written: ColorSlots,
  presets: FieldPresets<string>,
): ScaleProblem[] {
  const color = withPreset(written, presets)
  const { domain = [] } = color
  const { range = [] } = written
  const scale =
    color.scale === IDENTITY_SCALE
      ? IDENTITY_SCALE
      : paintedScale(
          { scale: color.scale, field: color.field ?? '' },
          fieldScaleOf(presets, color.field ?? ''),
        )
  const problems: ScaleProblem[] = []
  if (scale === 'threshold') {
    if (
      domain.some(
        (cut, i) => !pinned(cut) || Number(cut) <= Number(domain[i - 1]),
      )
    ) {
      problems.push({
        rule: 'threshold-cuts',
        slot: 'domain',
        message:
          'threshold cuts are distinct numbers, read in ascending order, with the range running from the lowest interval; a repeated cut leaves an interval no value falls in',
      })
    }
    if (
      domain.length > 0 &&
      range.length > 0 &&
      range.length !== domain.length + 1
    ) {
      problems.push({
        rule: 'threshold-range',
        slot: 'range',
        message: `${domain.length} threshold ${domain.length === 1 ? 'cut makes' : 'cuts make'} ${domain.length + 1} intervals, one color each, and range lists ${range.length}: a missing color comes from the default palette and an extra one is never read`,
      })
    }
  }
  if (scale === 'linear' || scale === 'log') {
    if (domain.length > 0) {
      problems.push({
        rule: 'ramp-domain',
        slot: 'domain',
        message:
          "a linear or log scale reads no domain, which is a categorical scale's order and a threshold scale's cuts; a ramp's ends are domainMin and domainMax where the color has them",
      })
    }
    if (range.length === 1) {
      problems.push({
        rule: 'ramp-range',
        slot: 'range',
        message:
          'a linear or log ramp runs between at least two colors, and one paints every value alike; a single color is value',
      })
    }
    problems.push(
      ...scaleEndProblems({ ...color, type: scale }, { reverse: true }),
    )
  }
  const { labels = [] } = color
  const named =
    scale === 'categorical' || scale === IDENTITY_SCALE
      ? domain.length
      : scale === 'threshold'
        ? domain.length + 1
        : undefined
  const cutsFromData = scale === 'threshold' && domain.length === 0
  if (
    labels.length > 0 &&
    !cutsFromData &&
    (named === undefined || labels.length > named)
  ) {
    const what =
      scale === 'categorical'
        ? 'value'
        : scale === IDENTITY_SCALE
          ? 'color'
          : 'interval'
    problems.push({
      rule: 'labels-domain',
      slot: 'labels',
      message:
        named === undefined
          ? "labels names a categorical scale's values, a threshold scale's intervals or an identity scale's colors, and this color paints none of them"
          : `labels names one ${what} each, and ${labels.length} ${labels.length === 1 ? 'label names' : 'labels name'} ${named} ${named === 1 ? what : `${what}s`}: a label past them names nothing`,
    })
  }
  return problems
}

/** `colorProblems` as the lines a display's corner notice lists, under `color`. */
export function colorNotices(
  color: ColorSlots,
  presets: FieldPresets<string>,
): string[] {
  return noticeLines('color', colorProblems(color, presets))
}
