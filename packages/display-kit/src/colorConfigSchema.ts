import { ConfigurationSchema } from '@jbrowse/core/configuration'

/** The `color` object as written: a constant, or a field through a categorical scale. */
export interface ColorSetting {
  value: string | undefined
  field: string
  domain: readonly string[]
  palette: readonly string[]
}

const COLOR_KEYS = new Set(['value', 'field', 'domain', 'palette'])

/**
 * A key the object does not declare, or a `domain` or `palette` with no
 * `field` to scale, is refused here rather than dropped. A `domain` written
 * as numbers is carried as strings.
 */
export function normalizeColor(
  snap: Record<string, unknown> = {},
): Record<string, unknown> {
  const obj = { ...snap }
  const unknown = Object.keys(obj).filter(key => !COLOR_KEYS.has(key))
  if (unknown.length > 0) {
    throw new Error(
      `color takes value, field, domain and palette, not ${unknown.join(', ')}`,
    )
  }
  for (const key of ['domain', 'palette']) {
    if (obj[key] !== undefined && !Array.isArray(obj[key])) {
      throw new Error(`color.${key} is a list`)
    }
  }
  if (Array.isArray(obj.domain)) {
    obj.domain = obj.domain.map(String)
  }
  const scaled =
    (Array.isArray(obj.domain) && obj.domain.length > 0) ||
    (Array.isArray(obj.palette) && obj.palette.length > 0)
  if (scaled && !obj.field) {
    throw new Error('color.domain and color.palette scale a field: name one')
  }
  return obj
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
  { shorthand: 'value', preProcessSnapshot: normalizeColor },
)
