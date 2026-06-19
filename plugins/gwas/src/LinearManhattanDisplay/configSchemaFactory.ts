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
 * Minimal `GWASTrack` config. See the
 * [GWAS track guide](/docs/config_guides/gwas_track) for all options:
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
 * }
 * ```
 *
 * #example
 * Taller track, LocusZoom-style coloring: `colorBy: 'ld'` colors each point
 * by its r² to the index SNP read from `ldAdapter`. The `displays` object
 * shorthand is equivalent to `displays: [{ type: 'LinearManhattanDisplay',
 * displayId: '...', ... }]` — see
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
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
 *   displays: {
 *     height: 400,
 *     colorBy: 'ld',
 *     ldAdapter: {
 *       type: 'PlinkLDTabixAdapter',
 *       uri: 'https://example.com/plink.ld.gz',
 *     },
 *   },
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
