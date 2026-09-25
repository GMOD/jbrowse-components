/**
 * The scales a colour object paints through, in a module that imports
 * nothing: `jbrowse validate` carries a copy of it, so the validator and the
 * displays read one statement.
 */

/** How a colour object maps its `field`; `none` paints `value`. */
export const COLOR_SCALES = [
  'none',
  'categorical',
  'linear',
  'log',
  'threshold',
] as const

/**
 * The scale that maps no field: each feature paints the colour it carries, and
 * the key names the colours `domain` lists. Only a display whose features
 * carry colours of their own declares it.
 */
export const IDENTITY_SCALE = 'identity'

export type ColorScaleName =
  | (typeof COLOR_SCALES)[number]
  | typeof IDENTITY_SCALE

/**
 * A field's defaults on a display: the scale it paints through while `scale`
 * is unset, and the members that scale reads while the config leaves them
 * unwritten, so a field with a vocabulary or ramp of its own is the colour
 * object's defaults rather than a painter beside it.
 */
export interface FieldPreset<S extends string = ColorScaleName> {
  scale: S
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

/** Every field categorical while `scale` is unset, with nothing preset. */
export const CATEGORICAL_FIELD_PRESETS = {
  '*': CATEGORICAL_PRESET,
} as const satisfies FieldPresets

/** A field's preset under `presets`: its own, else `*`'s, else categorical. */
export function presetOf<S extends string>(
  presets: FieldPresets<S>,
  field: string,
): FieldPreset<S | 'categorical'> {
  return (
    (Object.hasOwn(presets, field) ? presets[field] : presets['*']) ??
    CATEGORICAL_PRESET
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
 * A colour object with its field's preset under it: each member the preset
 * names and the config leaves unwritten, an empty list counting as unwritten.
 * Only while the colour paints through the preset's own scale, so the cuts of
 * a threshold preset never reach a field read through a ramp.
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
  const filled = Object.entries(preset).filter(
    ([key]) => key !== 'scale' && unwritten(written.get(key)),
  )
  return filled.length > 0 ? { ...color, ...Object.fromEntries(filled) } : color
}

/**
 * The scale a colour object paints through: `none` while no `field` is
 * named, else its own `scale`, or `fieldScale` where that is unset.
 */
export function paintedScale<S extends string, F extends string>(
  { scale, field }: { scale: S | undefined; field: string },
  fieldScale: F,
): S | F | 'none' {
  return field ? (scale ?? fieldScale) : 'none'
}

/** A combination of a colour object's slots the display cannot paint as written. */
export interface ColorProblem {
  rule:
    | 'threshold-cuts'
    | 'threshold-range'
    | 'ramp-domain'
    | 'ramp-ends'
    | 'labels-domain'
  /** the slot to look at, relative to the colour object */
  slot: string
  message: string
}

/** The slots `colorProblems` reads, as a snapshot or a resolved setting holds them. */
export interface ColorSlots {
  field?: string
  scale?: string
  domain?: readonly unknown[]
  range?: readonly unknown[]
  domainMin?: number
  domainMax?: number
  labels?: readonly unknown[]
}

function pinned(entry: unknown) {
  return entry !== '' && Number.isFinite(Number(entry))
}

/**
 * What a colour object's slots say together that no single slot can refuse,
 * since the config editor writes one slot at a time (ADR-133), read with its
 * field's preset under it. A display shows these as a notice and draws what
 * it can.
 */
export function colorProblems(
  written: ColorSlots,
  presets: FieldPresets<string>,
): ColorProblem[] {
  const color = withPreset(written, presets)
  const { domain = [], range = [], domainMin, domainMax } = color
  const scale =
    color.scale === IDENTITY_SCALE
      ? IDENTITY_SCALE
      : paintedScale(
          { scale: color.scale, field: color.field ?? '' },
          fieldScaleOf(presets, color.field ?? ''),
        )
  const problems: ColorProblem[] = []
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
        message: `${domain.length} threshold ${domain.length === 1 ? 'cut makes' : 'cuts make'} ${domain.length + 1} intervals, one colour each, and range lists ${range.length}: a missing colour comes from the default palette and an extra one is never read`,
      })
    }
  }
  if (scale === 'linear' || scale === 'log') {
    if (domain.length > 0) {
      problems.push({
        rule: 'ramp-domain',
        slot: 'domain',
        message:
          "a linear or log scale reads no domain, which is a categorical scale's order and a threshold scale's cuts; a ramp's ends are domainMin and domainMax where the colour has them",
      })
    }
    if (
      domainMin !== undefined &&
      domainMax !== undefined &&
      domainMin > domainMax
    ) {
      problems.push({
        rule: 'ramp-ends',
        slot: 'domainMax',
        message:
          'domainMax is below domainMin: the ramp spans the two either way, and reverse is what turns it round',
      })
    }
  }
  const { labels = [] } = color
  const named =
    scale === 'categorical' || scale === IDENTITY_SCALE
      ? domain.length
      : scale === 'threshold'
        ? domain.length + 1
        : undefined
  if (labels.length > 0 && (named === undefined || labels.length > named)) {
    const what =
      scale === 'categorical'
        ? 'value'
        : scale === IDENTITY_SCALE
          ? 'colour'
          : 'interval'
    problems.push({
      rule: 'labels-domain',
      slot: 'labels',
      message:
        named === undefined
          ? "labels names a categorical scale's values, a threshold scale's intervals or an identity scale's colours, and this colour paints none of them"
          : `labels names one ${what} each, and ${labels.length} ${labels.length === 1 ? 'label names' : 'labels name'} ${named} ${named === 1 ? what : `${what}s`}: a label past them names nothing`,
    })
  }
  return problems
}

/** `colorProblems` as the lines a display's corner notice lists, under the setting's own name. */
export function colorNotices(
  color: ColorSlots,
  presets: FieldPresets<string>,
  name = 'color',
): string[] {
  return colorProblems(color, presets).map(
    ({ slot, message }) => `${name}.${slot}: ${message}`,
  )
}
