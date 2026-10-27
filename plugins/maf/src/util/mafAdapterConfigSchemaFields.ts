import { samplesTsvAdapterConfigSchemaFields } from '@jbrowse/core/util/samplesTsv'

/**
 * The slots every MAF adapter has beyond its own file format, the ones
 * `MafAdapterBase` reads. The config-doc generator renders a spread slot's
 * `description`, never the JSDoc above it, so the description is the whole
 * explanation. `summaryAdapter` is the parameter because what a zoom-out read
 * costs depends on the file it reads.
 */
export function mafAdapterConfigSchemaFields({
  summaryAdapter,
}: {
  /** e.g. "The zoom-out tier. A tabix MAF holds every species' bases…" */
  summaryAdapter: string
}) {
  return {
    /**
     * #slot
     */
    samples: {
      type: 'frozen',
      description:
        'string[] or {id:string,label:string,color?:string,assemblyName?:string,assemblyConfigLocation?:UriLocation}[]; assemblyName makes rows for that sample navigable to the genome named by assemblyName, and assemblyConfigLocation gives the location to load that assembly from when the session lacks it',
      defaultValue: [],
    },
    /**
     * #slot
     */
    nhLocation: {
      type: 'maybeFileLocation',
      description:
        'newick tree naming and ordering the species rows; its leaf names are the sample ids, and any `samples` entries supply label/color overrides matched by id',
    },
    /**
     * #slot
     */
    summaryAdapter: {
      type: 'maybeFrozen',
      description: summaryAdapter,
    },
    ...samplesTsvAdapterConfigSchemaFields,
    /**
     * #slot
     */
    framesAdapter: {
      type: 'maybeFrozen',
      description:
        "optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying each species' CDS reading frames for the frames strip, the codon view and the codon conservation band; leave it unset to disable",
    },
  } as const
}
