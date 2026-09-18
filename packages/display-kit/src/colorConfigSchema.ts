import { ConfigurationSchema } from '@jbrowse/core/configuration'

/** The `color` object as written: a constant, or a field through a categorical scale. */
export interface ColorSetting {
  value: string | undefined
  field: string
  domain: readonly string[]
  palette: readonly string[]
}

/**
 * What every channel object checks on the way in, `name` being the setting's
 * key: a `domain` or `palette` is a list, and a `domain` written as numbers is
 * carried as strings. No combination of slots is refused, since the config
 * editor writes one slot at a time: a `domain` with no `field`, or a `field`
 * under a scale that reads none, waits unread until it paints again.
 */
export function normalizeChannel(
  snap: Record<string, unknown> = {},
  name: string,
): Record<string, unknown> {
  for (const key of ['domain', 'palette']) {
    if (snap[key] !== undefined && !Array.isArray(snap[key])) {
      throw new Error(`${name}.${key} is a list`)
    }
  }
  return Array.isArray(snap.domain)
    ? { ...snap, domain: snap.domain.map(String) }
    : snap
}

const FIELD_SCALES: ReadonlySet<string> = new Set([
  'categorical',
  'linear',
  'log',
])

/**
 * The scale a colour object paints through: its own `scale`, or, left unset,
 * `fieldScale` beside a `field` and `none` without one. A scale that reads a
 * field paints `value` until one is named.
 */
export function paintedScale<S extends string>(
  { scale, field }: { scale: S | undefined; field: string },
  fieldScale: S,
): S | 'none' {
  const written = scale ?? (field ? fieldScale : 'none')
  return field || !FIELD_SCALES.has(written) ? written : 'none'
}

/**
 * #config FeatureColor
 * #category display
 * The canvas feature displays' `color` setting: a CSS colour or `jexl:`
 * callback in `value`, or a field whose values each take a palette colour,
 * with a key. A string is the constant; the object binds the field.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', color: 'goldenrod' }
 * ```
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   color: { field: 'gene_biotype', palette: ['#1f77b4', '#ff7f0e'] },
 * }
 * ```
 */
export const colorConfigSchema = ConfigurationSchema(
  'FeatureColor',
  {
    /**
     * #slot value
     * A CSS colour, or a jexl callback over `feature` returning one. Writing
     * `color: "red"` or `color: "jexl:…"` lands here. Unset, a feature's own
     * BED itemRgb paints it if it has one, else goldenrod.
     */
    // `maybeColor` so unset stays distinct from every real colour: unset
    // means a feature's own itemRgb paints it, and a concrete default would
    // swallow anyone writing that exact colour.
    value: {
      type: 'maybeColor',
      description: 'CSS colour or jexl callback',
      contextVariable: ['feature'],
    },
    /**
     * #slot field
     * A feature field, or a `jexl:` expression over `feature`, whose values
     * each paint one palette colour, with a key saying which. A transcript
     * and all its parts paint the transcript's value, or its gene's where
     * the transcript has none. `strand` paints forward tomato and reverse
     * cornflowerblue unless `domain` or `palette` says otherwise.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description:
        'feature field (or jexl expression) to color by, one palette color per value',
    },
    /**
     * #slot domain
     * The values that take the palette first, in order. A value left out
     * keeps a colour derived from itself that no listed value paints, so
     * every region agrees on it.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: 'values that take the palette first, in order',
    },
    /**
     * #slot palette
     * The CSS colours `domain` hands out, in order, continuing into the
     * default palette past its end. Empty is the default palette.
     */
    palette: {
      type: 'stringArray',
      defaultValue: [],
      description: 'CSS colors the values take, in order',
    },
  },
  {
    shorthand: 'value',
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'color'),
  },
)
