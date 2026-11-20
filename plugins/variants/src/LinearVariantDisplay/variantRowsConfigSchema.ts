import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ROWS_WRITES } from '@jbrowse/display-kit/rowsConfigSchema'
import { rowsWithStepConfigSchema } from '@jbrowse/display-kit/rowsWithStepConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { VARIANT_ROWS_FIELDS } from '../shared/constants.ts'

/**
 * #config VariantRows
 * #category display
 * The variant display's `rows`: one per sample, or with `field:
 * 'haplotype'` one per phased haplotype, with the
 * [RowsWithStep](../rowswithstep) arrangement, axis and row height.
 *
 * #example
 * ```js
 * { type: 'LinearVariantDisplay', rows: { sort: ['HG002'], step: 10 } }
 * ```
 * ```js
 * { type: 'LinearVariantDisplay', rows: 'haplotype' }
 * ```
 */
export const variantRowsConfigSchema = ConfigurationSchema(
  'VariantRows',
  {
    /**
     * #slot field
     * What one row is: `sample`, a row per sample colored by its allele
     * dosage, or `haplotype`, a row per phased haplotype of each sample,
     * named `"<sample> HP1"`, `"<sample> HP2"`. That number is JBrowse's,
     * counting a sample's alleles from 1, not the VCF's `HP` tag. A
     * haplotype row answers to its sample's name, so a `sort`, `labels`,
     * `colors`, `tree` or `kept` entry naming a sample reaches its
     * haplotype rows, and switching between the two keeps them: a haplotype
     * entry waits unseen in `sample` mode, and a sample ranks at its first
     * haplotype entry. A haplotype row's label is its own `labels` entry
     * exactly, else its sample's label and its haplotype (`Mother HP1`), and
     * a haploid sample's one row takes the sample's label alone.
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('VariantRowsField', [...VARIANT_ROWS_FIELDS]),
      defaultValue: 'sample',
      description:
        "what one row is: 'sample', a row per sample colored by allele dosage, or 'haplotype', a row per phased haplotype, named '<sample> HP1', '<sample> HP2', each answering to its sample's name",
    },
    /**
     * #slot subtitle
     * The row attribute drawn after each row's label as quieter text:
     * `relationship` by default, which a `pedigreeLocation` gives each
     * sample related to another in the VCF, so a trio's rows read
     * `HG02024 (daughter)`, `HG02025 (mother)` and `HG02026 (father)`, and
     * each haplotype row its sample's. A row with no `relationship` draws
     * none, so a VCF with no pedigree draws none. `''` turns it off.
     */
    subtitle: {
      type: 'string',
      defaultValue: 'relationship',
      description:
        "the row attribute drawn after each row's label as quieter text in parentheses: relationship by default, which a pedigreeLocation gives each related sample, as HG02024 (daughter); a row lacking it draws none, and '' turns it off",
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowsWithStepConfigSchema,
    writes: { ...ROWS_WRITES, refines: { haplotype: 'sample' } },
  },
)
