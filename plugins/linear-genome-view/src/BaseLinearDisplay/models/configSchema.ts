import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BaseLinearDisplay
 * #category display
 *
 * Shared base config for linear displays — its slots (`height`,
 * `maxFeatureScreenDensity`, `fetchSizeLimit`, `mouseover`, `jexlFilters`) are
 * common to all of them. The GPU stack's `LinearCanvasBaseDisplay` config
 * extends it, and third-party plugins extend it too.
 */

const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    /**
     * #slot
     */
    maxFeatureScreenDensity: {
      type: 'number',
      description:
        'maximum features per pixel before showing a "too many features" message, used if byte size estimates are not available',
      defaultValue: 1,
      advanced: true,
    },
    /**
     * #slot
     */
    fetchSizeLimit: {
      type: 'number',
      defaultValue: 1_000_000,
      description:
        "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
      advanced: true,
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 100,
      description: 'default height for the track',
    },
    /**
     * #slot
     */
    mouseover: {
      type: 'string',
      description: 'text to display when the cursor hovers over a feature',
      // `function` (INSDC/GFF3 qualifier) before the id fallback so hovering a
      // feature with no name — e.g. an NCBI viral `stem_loop` — surfaces its
      // descriptor rather than a bare id. get() since `function` is reserved.
      defaultValue: `jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')`,
      contextVariable: ['feature'],
    },
    /**
     * #slot
     * config jexlFilters are deferred evaluated so they are prepended with
     * jexl at runtime rather than being stored with jexl in the config
     */
    jexlFilters: {
      type: 'stringArray',
      description:
        'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
      // Hide the NCBI whole-sequence "source" record by default. NCBI RefSeq
      // GFF3 emits one type=region feature per molecule spanning the entire
      // sequence (taxon/strain/mol_type metadata); it's never biologically
      // interesting and clutters the track. It always carries gbkey=Src (the
      // GenBank source feature key), a far tighter marker than type=region — so
      // this leaves other region features (CpG islands, centromeres, ...)
      // untouched, and is a no-op on non-NCBI tracks (no gbkey → passes).
      // Editable/removable via the "Filter by..." dialog like any other filter.
      defaultValue: [`get(feature,'gbkey')!='Src'`],
    },
  },
  {
    /**
     * #identifier
     */
    explicitIdentifier: 'displayId',
  },
)

export default baseLinearDisplayConfigSchema
