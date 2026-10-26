import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { GENE_GLYPH_DEFAULTS } from '../RenderFeatureDataRPC/renderConfig.ts'

/**
 * #config FeatureContainers
 * #category display
 * The feature display's `containers`: the top-level types whose children
 * always stack on rows of their own, as a proteoform's ORFs do.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', containers: { types: ['proteoform_orf'] } }
 * ```
 */
export const featureContainersConfigSchema = ConfigurationSchema(
  'FeatureContainers',
  {
    /**
     * #slot
     * The container types; each also counts as `geneLike`.
     */
    types: {
      type: 'stringArray',
      defaultValue: GENE_GLYPH_DEFAULTS.containerTypes,
    },
  },
  { closed: true },
)
