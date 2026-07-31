import { ConfigurationSchema } from '@jbrowse/core/configuration'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        tafGzLocation: { uri: snap.uri, baseUri: snap.baseUri },
        taiLocation: { uri: `${snap.uri}.tai`, baseUri: snap.baseUri },
      }
    : snap
}

/**
 * #config BgzipTaffyAdapter
 * #trackType MafTrack
 * #fileFormat maf | TAF (bgzipped Taffy)
 * used to configure BgzipTaffy adapter
 *
 * #example
 * The `uri` shorthand auto-resolves the sibling `.tai` index:
 * ```js
 * {
 *   type: 'BgzipTaffyAdapter',
 *   uri: 'https://example.com/aln.taf.gz',
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'BgzipTaffyAdapter',
  {
    /**
     * #slot
     */
    samples: {
      type: 'frozen',
      description:
        'string[] or {id:string,label:string,color?:string,assemblyName?:string}[]; assemblyName makes rows for that sample navigable to its own genome',
      defaultValue: [],
    },
    /**
     * #slot
     */
    tafGzLocation: {
      type: 'fileLocation',
      description: 'bgzip taffy file',
      defaultValue: {
        uri: '/path/to/my.taf.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    taiLocation: {
      type: 'fileLocation',
      description: 'taffy index',
      defaultValue: {
        uri: '/path/to/my.taf.gz.tai',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    nhLocation: {
      type: 'fileLocation',
      description: 'newick tree',
      defaultValue: {
        uri: '/path/to/my.nh',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    annotationAdapter: {
      type: 'frozen',
      description:
        'optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it',
      defaultValue: null,
    },
  },
  {
    explicitlyTyped: true,
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default configSchema
