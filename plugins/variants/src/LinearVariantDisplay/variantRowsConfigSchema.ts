import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowFilterList } from '@jbrowse/display-kit/rowPredicateConfigSchema'
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
     * #slot filter
     * The rows shown by attribute: a list of [RowPredicate](../rowpredicate)
     * entries over a samplesTsv column, each one a row must pass, as
     * `[{ field: 'population', oneOf: ['EUR', 'AFR'] }]`. A row missing the attribute fails every test but
     * `valid: false`. It narrows the rows before `kept`, and a write changing
     * `field` keeps it, since it names no row by its value; a row's name goes
     * in `kept`.
     */
    filter: rowFilterList(),
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
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowsWithStepConfigSchema,
    writes: { ...ROWS_WRITES, refines: { haplotype: 'sample' } },
  },
)
