/**
 * The four slots every MAF adapter has beyond its own file format — the same
 * four `MafAdapterBase` reads, which is why they belong beside it rather than
 * in four schemas.
 *
 * They were copied out verbatim into each, and two had already drifted: the
 * `samples` description on both bgzip schemas stopped at `assemblyName` and
 * never mentioned `assemblyConfigLocation`, which the other two document and
 * `normalizeSamples` honors on all four. So the config page for a `.maf.gz`
 * track said the field did not exist.
 *
 * **The description is the whole explanation.** The config-doc generator
 * renders a spread slot's `description` and never the JSDoc above it (see
 * `regionTooLargeConfigSchemaFields`), so anything written up here reaches
 * neither the docs page nor the config editor.
 *
 * `summaryAdapter` is the parameter because it is the one genuinely per-format
 * slot: what a zoom-out read costs depends on the file it reads, and the two
 * `.tai` formats have measured numbers to quote. The other three are identical
 * across the four by construction.
 */
export function mafAdapterConfigSchemaFields({
  summaryAdapter,
}: {
  /** e.g. "The zoom-out tier. A tabix MAF carries every species' bases…" */
  summaryAdapter: string
}) {
  return {
    /**
     * #slot
     */
    samples: {
      type: 'frozen',
      description:
        'string[] or {id:string,label:string,color?:string,assemblyName?:string,assemblyConfigLocation?:UriLocation}[]; assemblyName makes rows for that sample navigable to its own genome, and assemblyConfigLocation says where to load that assembly from when the session lacks it',
      defaultValue: [],
    },
    /**
     * #slot
     */
    nhLocation: {
      type: 'fileLocation',
      description:
        'newick tree naming and ordering the species rows; its leaf names are the sample ids, and any `samples` entries supply label/color overrides matched by id',
      defaultValue: {
        uri: '/path/to/my.nh',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    summaryAdapter: {
      type: 'frozen',
      description: summaryAdapter,
      defaultValue: null,
    },
    /**
     * #slot
     */
    annotationAdapter: {
      type: 'frozen',
      description:
        'optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it. The display looks this slot up by path off the parent track and is otherwise format-blind, so every MAF adapter takes it the same way',
      defaultValue: null,
    },
  } as const
}
