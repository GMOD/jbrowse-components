import { ConfigurationSchema } from '@jbrowse/core/configuration'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        starFusionLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
          locationType: 'UriLocation',
        },
      }
    : snap
}

/**
 * #config StarFusionAdapter
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

export default StarFusionAdapter
