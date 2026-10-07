import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { rowsConfigSchema } from './rowsConfigSchema.ts'

/**
 * #config SampleRows
 * #category display
 * The `rows` of a display whose rows are the file's samples, one each, with
 * nothing else a row could be: the multi-sample variant display and the
 * multiple alignment display. `sample` is the one field, so the object is
 * the arrangement a reader gives the rows, written whole as every display's
 * `rows` is; `rows: "sample"` names the field and arranges nothing.
 *
 * #example
 * ```js
 * { type: 'LinearMultiSampleVariantDisplay', rows: { domain: ['HG002', 'HG003'] } }
 * ```
 * ```js
 * {
 *   type: 'LinearMafDisplay',
 *   rows: { domain: ['mm10'], labels: { mm10: 'Mouse' }, kept: ['mm10', 'hg38'] },
 * }
 * ```
 */
export const sampleRowsConfigSchema = ConfigurationSchema(
  'SampleRows',
  {
    /**
     * #slot field
     * `sample`, the one field a row of these displays can be: a sample or a
     * haplotype of one on the variant display, a genome on the alignment.
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('SampleRowsField', ['sample']),
      defaultValue: 'sample',
      description: 'sample, the one field a row can be',
    },
  },
  { baseConfiguration: rowsConfigSchema },
)
