import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import {
  scalesSchema,
  scoreFieldConfigSchemaFields,
  valueScaleSchema,
} from '@jbrowse/wiggle-core'

import { manhattanColorConfigSchema } from './colorConfigSchema.ts'
import { DEFAULT_POINT_DIAMETER_PX } from './manhattanRenderingBackendTypes.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Declares its own slots rather than extending LinearWiggleDisplay's schema.
// It used to, which put sixteen inherited slots on a GWAS track of which twelve
// did nothing — `defaultRendering: 'density'`, `useBicolor`, `summaryScoreMode`,
// the pos/neg palette, `origin`, `lineWidth`, `maxGapMultiple` — all read
// only by wiggle code a Manhattan plot never runs. A config doc that advertises
// a slot is a promise it works; these were promises nothing kept. What Manhattan
// genuinely shares is the value scale, so it takes `scales.y` and nothing else.
// `baseLinearDisplayConfigSchema` went the same way and for the same reason: of its five slots only `height` is read here, so this schema
// declares that one and drops `mouseover`, `jexlFilters`,
// `maxFeatureScreenDensity` and the byte-gate pair a display that never enables
// the gate cannot honour.
/**
 * #config LinearManhattanDisplay
 * #category display
 * configuration for the Manhattan plot display: the default display of a GWAS
 * track, and one a FeatureTrack can switch to, plotting any numeric feature
 * field as a scored scatter
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
 * Taller track, LocusZoom-style coloring: `color: { field: 'ld' }` colors
 * each point by its r² to the index SNP read from the adapter's `ldAdapter`
 * sub-adapter. The LD data is a second source on `GWASAdapter` (mirroring
 * MAF's `annotationAdapter`), so it nests under `adapter`, while display-only
 * options like `height`/`color` go in `displayDefaults` — see
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
 *     color: { field: 'ld' },
 *   },
 * }
 * ```
 *
 * #example
 * A selection scan as a plain `FeatureTrack`: the plot reads the file's `fst`
 * column through `scoreField` and colors each point by its `population`
 * column, with the color key derived from the values it meets:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'fst_scan',
 *   name: 'Fst scan',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BedTabixAdapter',
 *     uri: 'https://example.com/fst.bed.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearManhattanDisplay',
 *       scoreField: 'fst',
 *       color: { field: 'population' },
 *     },
 *   ],
 * }
 * ```
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearManhattanDisplay',
    {
      ...trackHeightConfigSchemaFields(),
      /**
       * #slot color
       * `"goldenrod"` or a `jexl:` callback paints every point;
       * `{ field: "population" }` gives each value a palette colour with a
       * key; `{ field: "ld" }` colours by r² to the index SNP.
       */
      color: manhattanColorConfigSchema,
      ...scoreFieldConfigSchemaFields,
      /**
       * #slot scales
       * The y scale: `domainMin`, `domainMax` and `rules`. -log10 p values are
       * pre-transformed, so `type` admits `linear` only and the plot's domain
       * is plain min/max over the loaded regions with no autoscale mode to
       * consult — the track menu draws neither radio, because the scale
       * declares neither.
       *
       * A threshold a scan is read against — genome-wide significance on a
       * GWAS, an empirical outlier cutoff on a differentiation scan — is a
       * `scales.y.rules` entry, on the plot's own scale, so it is a
       * `-log10(p)` where the points are and an Fst where `scoreColumn` names
       * an Fst column. A scan read against two thresholds, suggestive and
       * genome-wide, names both. The axis widens to reach a rule, so a window
       * where nothing clears the threshold still shows it.
       */
      scales: scalesSchema(
        valueScaleSchema({
          types: ['linear'],
          rules: true,
        }),
      ),
      /**
       * #slot
       */
      displayCrossHatches: {
        type: 'boolean',
        defaultValue: false,
        description:
          'Rule the score axis with horizontal cross hatches at the tick positions',
      },
      /**
       * #slot
       */
      minimalTicks: {
        type: 'boolean',
        defaultValue: false,
        description: 'Draw only the min/max Y-axis ticks',
        advanced: true,
      },
      /**
       * #slot
       * Manhattan point diameter in px (adjustable from the track menu). Larger
       * default than wiggle's since Manhattan points are the primary glyph.
       */
      scatterPointSize: {
        type: 'number',
        defaultValue: DEFAULT_POINT_DIAMETER_PX,
        description: 'Diameter in px of Manhattan points',
        // wiggle marks this advanced because scatter is one of its several
        // renderings; Manhattan is only ever a scatter, so point size is a
        // basic setting here and stays out of "Show advanced settings"
        advanced: false,
      },
      /**
       * #slot
       * Draw the color key: the r² ramp under LD coloring, the value table
       * under field coloring. Nothing under the plain single-color scheme,
       * which has no key to draw.
       */
      showLegend: {
        type: 'boolean',
        defaultValue: true,
        description:
          'Draw the color key while LD or field coloring is active. Defaults to on',
      },
    },
    {
      explicitlyTyped: true,
      explicitIdentifier: 'displayId',
    },
  )
}

export type LinearManhattanDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>

export type LinearManhattanDisplayConfig =
  Instance<LinearManhattanDisplayConfigModel>
