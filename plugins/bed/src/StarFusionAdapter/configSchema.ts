import {
  ConfigurationSchema,
  expandUriShorthand,
} from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandUriShorthand(snap, 'starFusionLocation')
}

/**
 * #config StarFusionAdapter
 * #trackType VariantTrack
 * #fileFormat variants | STAR-Fusion
 * Reads the gene fusions that STAR-Fusion predicts, from its
 * `star-fusion.fusion_predictions.tsv` output.
 *
 * #example
 * ```js
 * {
 *   type: 'StarFusionAdapter',
 *   uri: 'https://example.com/star-fusion.fusion_predictions.tsv',
 * }
 * ```
 */

const StarFusionAdapter = ConfigurationSchema(
  'StarFusionAdapter',
  {
    /**
     * #slot
     */
    starFusionLocation: {
      type: 'fileLocation',
      description: 'STAR-Fusion TSV output file (plain text or gzipped)',
      defaultValue: {
        uri: '/path/to/star-fusion.fusion_predictions.tsv',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,
    closed: true,
    /**
     * #preProcessSnapshot
     *
     * Allows minimal config:
     * ```json
     * { "type": "StarFusionAdapter", "uri": "star-fusion.tsv" }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type StarFusionAdapterConfig = Instance<typeof StarFusionAdapter>

export default StarFusionAdapter
