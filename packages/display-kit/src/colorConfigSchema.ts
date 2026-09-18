import { ConfigurationSchema } from '@jbrowse/core/configuration'

/** The `color` object as written: a constant, or a field through a categorical scale. */
export interface ColorSetting {
  value: string | undefined
  field: string
  domain: readonly string[]
  palette: readonly string[]
}

/**
 * The rules every colour object shares, `name` being the setting's key: a
 * `domain` or `palette` is a list, and one that is not empty scales a
 * `field`, so naming none is refused rather than dropped. A `domain` written
 * as numbers is carried as strings.
 */
export function normalizeColor(
  snap: Record<string, unknown> = {},
  name = 'color',
): Record<string, unknown> {
  const obj = { ...snap }
  for (const key of ['domain', 'palette']) {
    if (obj[key] !== undefined && !Array.isArray(obj[key])) {
      throw new Error(`${name}.${key} is a list`)
    }
    if (Array.isArray(obj[key]) && obj[key].length > 0 && !obj.field) {
      throw new Error(`${name}.${key} scales a field: name one`)
    }
  }
  if (Array.isArray(obj.domain)) {
    obj.domain = obj.domain.map(String)
  }
  return obj
}

/**
 * A colour object whose `scale` names a display's own schemes beside
 * `categorical`: a `field` with no `scale` reads through `categorical`, and a
 * `field` under any other scale, or `categorical` with no `field`, is refused.
 */
export function normalizeScaledColor(
  snap: Record<string, unknown> = {},
  name: string,
): Record<string, unknown> {
  const obj = normalizeColor(snap, name)
  const field = typeof obj.field === 'string' ? obj.field : ''
  const scale = obj.scale ?? (field ? 'categorical' : undefined)
  if (field && scale !== 'categorical') {
    throw new Error(
      `${name}.field is read by the categorical scale, not ${String(scale)}`,
    )
  }
  if (scale === 'categorical' && !field) {
    throw new Error(`${name}.scale categorical reads a field: name one`)
  }
  return scale === undefined ? obj : { ...obj, scale }
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
    preProcessSnapshot: snap => normalizeColor(snap),
  },
)
