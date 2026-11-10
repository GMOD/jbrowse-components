import { ConfigurationSchema, refuseOnWrite } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { colorLegendOptions } from './colorConfigSchema.ts'
import { RANGE, rowColorScaleConfigSchema } from './rowColorConfigSchema.ts'

/** What a `rows.annotations` entry naming no field is refused with. */
export const ROW_ANNOTATION_NO_FIELD =
  "a rows.annotations entry needs a field, the row attribute its column colors by, as annotations: ['sex']"

/** What a `rows.annotations` entry on `name` is refused with. */
export const ROW_ANNOTATION_ON_NAME =
  "field 'name' is the row itself, which its label already shows: a rows.annotations entry colors by an attribute of the row, such as sex"

/**
 * #config RowAnnotation
 * #category display
 * One entry of `rows.annotations`: a color column beside the row labels, the
 * row attribute `field` through a categorical `scale` as `rows.color` deals
 * one, with a key of its own titled `legend.title`. A string is the field.
 * An entry naming no field, or `name`, which the label already shows, is
 * refused.
 *
 * #example
 * ```js
 * { type: 'LinearVariantDisplay', rows: { annotations: ['population', 'sex'] } }
 * ```
 * ```js
 * {
 *   type: 'LinearVariantDisplay',
 *   rows: {
 *     annotations: [
 *       {
 *         field: 'sex',
 *         scale: { domain: ['female', 'male'], range: ['#d95f02', '#1b9e77'] },
 *         legend: { title: 'Sex (reported)' },
 *       },
 *     ],
 *   },
 * }
 * ```
 */
export const rowAnnotationConfigSchema = ConfigurationSchema(
  'RowAnnotation',
  {
    /**
     * #slot field
     * The row attribute whose values take the column's colors: a column of
     * a multi-sample adapter's `samplesTsvLocation`, such as `population`,
     * or a subtrack's `group`.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description:
        "the row attribute whose values take the column's colors, such as a column of a multi-sample adapter's samplesTsvLocation, e.g. population, or a subtrack's group; not name, which the row label shows",
    },
    /**
     * #slot scale
     * Which color each value of the field takes: `domain` paired with
     * `range`, the rest dealt from the column's own palette.
     */
    scale: rowColorScaleConfigSchema({
      name: 'RowAnnotationScale',
      path: 'rows.annotations.scale',
      /**
       * #slot scale.domain
       * The field's values that get a color, in order.
       */
      domain: "the field's values that get a color, in order",
      /**
       * #slot scale.range
       * The CSS color each value in `domain` takes, in the same order; past
       * them, the column's palette.
       */
      range: RANGE,
      /**
       * #slot scale.unknown
       * The color every row the scale leaves out takes; `''` for none.
       */
      unknown:
        'a color: every row the scale leaves out takes it. Unset: each value deals the next color of the column\'s palette; "" leaves the rows domain does not list without a color',
    }),
    /**
     * #slot legend
     * The column's key.
     */
    legend: ConfigurationSchema(
      'RowAnnotationLegend',
      {
        /**
         * #slot title
         * The title of the column's key and the label over its column;
         * unset, the field capitalised.
         */
        title: {
          type: 'maybeString',
          description:
            "the title of the column's key and the label over its column; unset, the field capitalised",
        },
      },
      colorLegendOptions,
    ),
  },
  {
    shorthand: 'field',
    writes: 'whole',
    plot: true,
    closed: true,
    description:
      "a color column beside the row labels, 'sex' or { field, scale, legend: { title } }",
    requires: [
      {
        id: 'row-annotation-field',
        when: {},
        slots: ['field'],
        message: ROW_ANNOTATION_NO_FIELD,
      },
    ],
    // an empty snapshot is the schema's own default, which no config writes
    preProcessSnapshot: snap => {
      if (Object.keys(snap).length > 0 && fieldOf(snap) === '') {
        refuseOnWrite(ROW_ANNOTATION_NO_FIELD)
      }
      return snap
    },
    refuses: [
      {
        id: 'row-annotation-name',
        when: { field: ['name'] },
        slots: ['field'],
        message: ROW_ANNOTATION_ON_NAME,
      },
    ],
  },
)

// The field an entry names, a bare string being the field
function fieldOf(entry: unknown) {
  return typeof entry === 'string'
    ? entry
    : typeof entry === 'object' &&
        entry !== null &&
        'field' in entry &&
        typeof entry.field === 'string'
      ? entry.field
      : ''
}

// Whether an entry is one `RowAnnotation` refuses: named once and dropped on
// a load, thrown on a write
function refusedEntry(entry: unknown) {
  const field = fieldOf(entry)
  const refusal =
    field === ''
      ? ROW_ANNOTATION_NO_FIELD
      : field === 'name'
        ? ROW_ANNOTATION_ON_NAME
        : undefined
  if (refusal) {
    refuseOnWrite(refusal)
  }
  return refusal !== undefined
}

// Whether `entry` is dropped, never throwing, so a write keeps the entry for
// its own creation to refuse with its own words
function dropped(entry: unknown) {
  try {
    return refusedEntry(entry)
  } catch {
    return false
  }
}

/**
 * `rows.annotations`'s type: a list of row annotations. A config loading an
 * entry `RowAnnotation` refuses loads without it, never as an entry missing
 * its field.
 */
export function rowAnnotationList() {
  return types.snapshotProcessor(types.array(rowAnnotationConfigSchema), {
    preProcessor: (snap: unknown) =>
      Array.isArray(snap) ? snap.filter(entry => !dropped(entry)) : snap,
  })
}
