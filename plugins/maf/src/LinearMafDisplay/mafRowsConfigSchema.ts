import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowAxisConfigSchema } from '@jbrowse/display-kit/rowAxisConfigSchema'
import { sampleRowsConfigSchema } from '@jbrowse/display-kit/sampleRowsConfigSchema'

/**
 * #config MafRows
 * #category display
 * The MAF display's `rows`: the [SampleRows](../samplerows) arrangement, and
 * an axis with no `grid`, since the species rows keep a gap instead.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', rows: { sort: ['mm10'], axis: { tree: false } } }
 * ```
 */
export const mafRowsConfigSchema = ConfigurationSchema(
  'MafRows',
  {
    /**
     * #slot axis
     * The guide down the left of the species rows, a [RowAxis](../rowaxis):
     * the species tree and each species' name.
     */
    axis: rowAxisConfigSchema,
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: sampleRowsConfigSchema,
  },
)
