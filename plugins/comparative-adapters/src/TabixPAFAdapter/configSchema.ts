import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config TabixPAFAdapter
 *
 * Reads a standard PAF that has been sorted by its target columns, bgzipped,
 * and tabix-indexed (`tabix -0 -s6 -b8 -e9`). Unlike PairwiseIndexedPAFAdapter
 * (which reads the JBrowse-specific dual-indexed `.pif.gz`), this consumes a
 * plain PAF directly — the output of `odgi untangle -R <ref> | sort | bgzip`.
 * Each query line is one block of a haplotype path projected onto a reference
 * path; query genomes are grouped by their PanSN `sample#hap` prefix.
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const TabixPAFAdapter = ConfigurationSchema(
  'TabixPAFAdapter',
  {
    /**
     * #slot
     */
    pafGzLocation: {
      type: 'fileLocation',
      description: 'location of bgzipped, tabix-indexed PAF',
      defaultValue: {
        uri: '/path/to/data/file.paf.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    index: ConfigurationSchema('TabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/file.paf.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
    /**
     * #slot
     *
     * The list of query (non-reference) genome names. Normally read from a
     * `#genomes=` header line in the PAF; set here when the file has no
     * header.
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'query genome names; overrides the #genomes= header line if set',
    },
    /**
     * #slot
     *
     * Drop blocks whose `jc:f:` (jaccard) tag is below this floor. The PAF is
     * baked permissive so the floor can be raised at runtime; 0 keeps every
     * block.
     */
    jaccardFilter: {
      type: 'number',
      defaultValue: 0,
      description: 'minimum jc:f: jaccard value; blocks below this are dropped',
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes file.paf.gz.tbi:
     * ```json
     * {
     *   "type": "TabixPAFAdapter",
     *   "uri": "file.paf.gz"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            pafGzLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
            index: {
              location: {
                uri: `${snap.uri}.tbi`,
                baseUri: snap.baseUri,
              },
            },
          }
        : snap
    },
  },
)

export default TabixPAFAdapter
