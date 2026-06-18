import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayConfigSchema } from '@jbrowse/plugin-wiggle'

// Reuses LinearWiggleDisplay's schema, but overrides `color` so we don't
// inherit wiggle's bicolor sentinel (`#f0f`). Manhattan is single-color and
// supports per-feature jexl callbacks.
/**
 * #config LinearManhattanDisplay
 * #category display
 * configuration for the Manhattan plot display used by GWAS tracks
 *
 * #example
 * A complete `GWASTrack` config to paste into `tracks`, LocusZoom-style:
 * `colorBy: 'ld'` colors each point by its r² to the index SNP, read from
 * `ldAdapter`:
 * ```js
 * {
 *   type: 'GWASTrack',
 *   trackId: 'gwas',
 *   name: 'GWAS results',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'GWASAdapter',
 *     uri: 'https://example.com/gwas.bed.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearManhattanDisplay',
 *       displayId: 'gwas-LinearManhattanDisplay',
 *       colorBy: 'ld',
 *       ldAdapter: {
 *         type: 'PlinkLDTabixAdapter',
 *         uri: 'https://example.com/plink.ld.gz',
 *       },
 *     },
 *   ],
 * }
 * ```
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearManhattanDisplay',
    {
      /**
       * #slot
       */
      color: {
        type: 'color',
        defaultValue: '#0068d1',
        description: 'CSS color or jexl callback for Manhattan points',
      },
      /**
       * #slot
       * LocusZoom-style coloring. 'normal' uses `color`; 'ld' colors each point
       * by its r² to the index SNP, read from `ldAdapter`.
       */
      colorBy: {
        type: 'stringEnum',
        model: types.enumeration('GwasColorBy', ['normal', 'ld']),
        defaultValue: 'normal',
        description: 'How to color Manhattan points',
      },
      /**
       * #slot
       * PLINK .ld adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying
       * pairwise r² used when colorBy is 'ld'.
       */
      ldAdapter: {
        type: 'frozen',
        defaultValue: null,
        description: 'Adapter config for PLINK .ld pairwise r² data',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: linearWiggleDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
