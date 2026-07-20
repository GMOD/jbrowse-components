import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayConfigSchema } from '@jbrowse/plugin-wiggle'

import { DEFAULT_POINT_DIAMETER_PX } from './manhattanRenderingBackendTypes.ts'
import { DEFAULT_MANHATTAN_COLOR } from '../ManhattanRPC/rpcTypes.ts'

// Reuses LinearWiggleDisplay's schema, but overrides `color`: wiggle's is the
// single-color fallback for when `useBicolor` is off. Manhattan is always
// single-color and supports per-feature jexl callbacks.
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
 * Taller track, LocusZoom-style coloring: `colorBy: 'ld'` colors each point by
 * its r² to the index SNP read from the adapter's `ldAdapter` sub-adapter. The
 * LD data is a second source on `GWASAdapter` (mirroring MAF's
 * `annotationAdapter`), so it nests under `adapter`, while display-only options
 * like `height`/`colorBy` go in `displayDefaults` — see
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
 *     ldAdapter: {
 *       type: 'PlinkLDTabixAdapter',
 *       uri: 'https://example.com/plink.ld.gz',
 *     },
 *   },
 *   displayDefaults: {
 *     height: 400,
 *     colorBy: 'ld',
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
        defaultValue: DEFAULT_MANHATTAN_COLOR,
        description: 'CSS color or jexl callback for Manhattan points',
      },
      /**
       * #slot
       * LocusZoom-style coloring. 'normal' uses `color`; 'ld' colors each point
       * by its r² to the index SNP, read from the `GWASAdapter`'s `ldAdapter`
       * sub-adapter.
       */
      colorBy: {
        type: 'stringEnum',
        model: types.enumeration('GwasColorBy', ['normal', 'ld']),
        defaultValue: 'normal',
        description: 'How to color Manhattan points',
      },
      /**
       * #slot
       * Manhattan point diameter in px (adjustable from the track menu). Larger
       * default than wiggle's since Manhattan points are the primary glyph.
       */
      scatterPointSize: {
        type: 'maybeNumber',
        defaultValue: undefined,
        promotedBase: DEFAULT_POINT_DIAMETER_PX,
        description:
          'Diameter in px of Manhattan points. Unset (the default) follows the session-wide default for this display type',
        promotable: true,
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

export type LinearManhattanDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
