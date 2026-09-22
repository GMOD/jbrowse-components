import {
  ConfigurationSchema,
  ConfigurationSchemaUnion,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { AUTO_BIN } from './autoBin.ts'
import {
  AGGREGATE_OPS,
  DEFAULT_AGGREGATE_OP,
  DEFAULT_BIN_AS,
  DEFAULT_BIN_FIELD,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FLATTEN_FIELD,
  DEFAULT_FORMULA_AS,
  DEFAULT_PILEUP_AS,
  DEFAULT_PILEUP_FIELDS,
} from './markVocabulary.ts'

import type { StepSnapshot } from './markProblems.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

const STEP = { explicitlyTyped: true, closed: true } as const

const filter = ConfigurationSchema(
  'filter',
  {
    /**
     * #slot filter.expr
     * A jexl callback over `feature`. The features it admits are kept and the
     * rest dropped before the steps behind it run.
     */
    expr: {
      type: 'string',
      defaultValue: '',
      description: 'jexl callback over feature',
      contextVariable: ['feature'],
    },
  },
  STEP,
)

const formula = ConfigurationSchema(
  'formula',
  {
    /**
     * #slot formula.expr
     * A jexl callback over `feature` whose value is written into `as`.
     */
    expr: {
      type: 'string',
      defaultValue: '',
      description: 'jexl callback over feature',
      contextVariable: ['feature'],
    },
    /**
     * #slot formula.as
     * The field the value is written to.
     */
    as: {
      type: 'string',
      defaultValue: DEFAULT_FORMULA_AS,
      description: 'output field',
    },
  },
  STEP,
)

const bin = ConfigurationSchema(
  'bin',
  {
    /**
     * #slot bin.step
     * The bin width in bp, aligned to the genome, or `"auto"` for a width that
     * follows the view's zoom — the target of four pixels per bin, snapped up
     * to the next 1/2/5 rung, resolved before the fetch and keyed into it.
     */
    step: {
      type: 'number',
      model: types.union(types.number, types.literal(AUTO_BIN)),
      defaultValue: 10000,
      description: 'bin width in bp, or "auto" to follow the zoom',
    },
    /**
     * #slot bin.field
     * The field placing a feature in a bin: a name, or a dotted path into a
     * structured field (`INFO.END`). A `formula` step in front computes one.
     */
    field: {
      type: 'string',
      defaultValue: DEFAULT_BIN_FIELD,
      description: 'field placing a feature in a bin',
    },
    /**
     * #slot bin.as
     * The two fields the bin's edges are written to. An `aggregate` behind the
     * bin that names no `groupby` groups by these.
     */
    as: {
      type: 'stringArray',
      defaultValue: DEFAULT_BIN_AS,
      description: "the bin's start and end fields",
    },
  },
  STEP,
)

const aggregateOpSchema = ConfigurationSchema(
  'MarkAggregateOp',
  {
    /**
     * #slot aggregate.ops.op
     * `count` needs no field; `sum`, `mean`, `min` and `max` read one.
     */
    op: {
      type: 'stringEnum',
      model: types.enumeration('MarkAggregateOpName', [...AGGREGATE_OPS]),
      defaultValue: DEFAULT_AGGREGATE_OP,
      description: 'count, sum, mean, min or max',
    },
    /**
     * #slot aggregate.ops.field
     * The feature field the op reads, for every op but `count`.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description: 'field the op reads',
    },
    /**
     * #slot aggregate.ops.as
     * The output field. Empty is `count`, or `<op>_<field>`.
     */
    as: {
      type: 'string',
      defaultValue: '',
      description: 'output field',
    },
  },
  { closed: true },
)

const aggregate = ConfigurationSchema(
  'aggregate',
  {
    /**
     * #slot aggregate.groupby
     * The fields whose distinct value sets make the groups. Empty takes the
     * edges a `bin` in front of it in the same `transform` wrote, so binning
     * and counting needs no restatement; with none there it folds the whole
     * region into one feature, even behind a `bin` in the display's own
     * `transform`, which names its edges here.
     */
    groupby: {
      type: 'stringArray',
      defaultValue: [],
      description: 'grouping fields; empty follows a preceding bin',
    },
    /**
     * #slot aggregate.ops
     * The summaries each group carries.
     */
    ops: types.array(aggregateOpSchema),
  },
  STEP,
)

const coverage = ConfigurationSchema(
  'coverage',
  {
    /**
     * #slot coverage.as
     * The field each run's depth is written to.
     */
    as: {
      type: 'string',
      defaultValue: DEFAULT_COVERAGE_AS,
      description: 'depth field',
    },
  },
  STEP,
)

const flatten = ConfigurationSchema(
  'flatten',
  {
    /**
     * #slot flatten.field
     * The array field fanned out, one feature per element: a name or a dotted
     * path.
     */
    field: {
      type: 'string',
      defaultValue: DEFAULT_FLATTEN_FIELD,
      description: 'array field fanned out',
    },
    /**
     * #slot flatten.index
     * The field each element's position in its array is written to. Empty
     * writes none.
     */
    index: {
      type: 'string',
      defaultValue: '',
      description: "field for the element's position",
    },
    /**
     * #slot flatten.keepEmpty
     * Keep a feature whose array field holds nothing, which is otherwise
     * dropped.
     */
    keepEmpty: {
      type: 'boolean',
      defaultValue: false,
      description: 'keep a feature whose array field is empty',
    },
  },
  STEP,
)

const pileup = ConfigurationSchema(
  'pileup',
  {
    /**
     * #slot pileup.as
     * The field each feature's row is written to, which a `span` encoding
     * `row` then reads.
     */
    as: {
      type: 'string',
      defaultValue: DEFAULT_PILEUP_AS,
      description: 'row field',
    },
    /**
     * #slot pileup.fields
     * The two fields giving the interval it packs.
     */
    fields: {
      type: 'stringArray',
      defaultValue: DEFAULT_PILEUP_FIELDS,
      description: 'start and end fields of the packed interval',
    },
    /**
     * #slot pileup.padding
     * bp of clearance kept between two features sharing a row, so a pileup
     * does not butt its reads together.
     */
    padding: {
      type: 'number',
      defaultValue: 0,
      description: 'bp between two features on one row',
    },
  },
  STEP,
)

/**
 * #config MarkTransform
 * #category display
 * One step of a `transform` list, which runs over the region's features in
 * order, each step reading what the one before it answered. A step names its
 * `type` and takes that step's own settings; a key belonging to another step
 * is refused at load.
 *
 * `filter` keeps the features an expression admits; `formula` writes an
 * expression's value into a field; `bin` snaps each feature to a
 * genome-aligned bin; `aggregate` folds each group into one feature carrying
 * its summaries; `coverage` replaces the features with runs of how many
 * overlap each stretch; `flatten` fans out an array field; `pileup` writes
 * each feature's row in a greedy first-fit packing.
 *
 * #example
 * Count features per bin that follows the zoom:
 * ```js
 * transform: [
 *   { type: 'bin', step: 'auto' },
 *   { type: 'aggregate', ops: [{ op: 'count' }] },
 * ]
 * ```
 */
export const markTransformStep = ConfigurationSchemaUnion('MarkTransform', {
  filter,
  formula,
  bin,
  aggregate,
  coverage,
  flatten,
  pileup,
} satisfies Record<StepSnapshot['type'], AnyConfigurationSchemaType>)

export type MarkTransformStepConfig = Instance<typeof markTransformStep>
