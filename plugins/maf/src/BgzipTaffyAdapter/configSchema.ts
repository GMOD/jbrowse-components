import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BgzipTaffyAdapter
 * #trackType MafTrack
 * #fileFormat maf | TAF (bgzipped Taffy)
 * used to configure BgzipTaffy adapter
 */

const configSchema = ConfigurationSchema(
  'BgzipTaffyAdapter',
  {
    /**
     * #slot
     */
    samples: {
      type: 'frozen',
      description: 'string[] or {id:string,label:string,color?:string}[]',
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
  },
)

export default configSchema
