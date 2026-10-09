import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { facetConfigSchema } from './facetConfigSchema.ts'

/**
 * #config SectionFacet
 * #category display
 * The facet of a display that stacks labelled sections, each of which a
 * reader can hide from its chip: Facet's `field` and `domain`, and the
 * sections hidden. A hide-set rather than a show-set, so a section a later
 * region discovers shows; a new `field` starts with none hidden.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   facet: { field: 'gene_biotype', hidden: ['misc_RNA'] },
 * }
 * ```
 */
export const sectionFacetConfigSchema = ConfigurationSchema(
  'SectionFacet',
  {
    /**
     * #slot hidden
     * The keys of the sections hidden from the stack, as a section chip's
     * Hide writes them; "Show all" clears it.
     */
    hidden: {
      type: 'stringArray',
      defaultValue: [],
      description: 'keys of the sections hidden from the stack',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: facetConfigSchema,
  },
)
