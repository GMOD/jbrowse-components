import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayConfigSchema } from '@jbrowse/plugin-wiggle'

// Reuses LinearWiggleDisplay's schema, but overrides `color` so we don't
// inherit wiggle's bicolor sentinel (`#f0f`). Manhattan is single-color and
// supports per-feature jexl callbacks.
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearManhattanDisplay',
    {
      color: {
        type: 'color',
        defaultValue: '#0068d1',
        description: 'CSS color or jexl callback for Manhattan points',
      },
      // LocusZoom-style coloring. 'normal' uses `color`; 'ld' colors each point
      // by its r² to the index SNP, read from `ldAdapter`.
      colorBy: {
        type: 'stringEnum',
        model: types.enumeration('GwasColorBy', ['normal', 'ld']),
        defaultValue: 'normal',
        description: 'How to color Manhattan points',
      },
      // PLINK .ld adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying
      // pairwise r² used when colorBy is 'ld'.
      ldAdapter: {
        type: 'frozen',
        defaultValue: null,
        description: 'Adapter config for PLINK .ld pairwise r² data',
      },
      // Horizontal reference lines at the conventional GWAS p-value cutoffs,
      // expressed in the same pre-transformed -log10(p) units as the scores.
      showSignificanceLines: {
        type: 'boolean',
        defaultValue: false,
        description: 'Show genome-wide and suggestive significance lines',
      },
      // -log10(5e-8) ≈ 7.3, the standard genome-wide significance cutoff.
      genomeWideSignificance: {
        type: 'number',
        defaultValue: 7.30103,
        description: 'Genome-wide significance threshold, in -log10(p) units',
      },
      // -log10(1e-5) = 5, the standard suggestive-significance cutoff.
      suggestiveSignificance: {
        type: 'number',
        defaultValue: 5,
        description: 'Suggestive significance threshold, in -log10(p) units',
      },
    },
    {
      baseConfiguration: linearWiggleDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
