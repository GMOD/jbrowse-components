import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import {
  remapRetiredAutoscale,
  scoreAxisConfigSchemaFields,
  scoreFieldConfigSchemaFields,
} from '@jbrowse/wiggle-core'

import { manhattanColorConfigSchema } from './colorConfigSchema.ts'
import { DEFAULT_POINT_DIAMETER_PX } from './manhattanRenderingBackendTypes.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Declares its own slots rather than extending LinearWiggleDisplay's schema.
// It used to, which put sixteen inherited slots on a GWAS track of which twelve
// did nothing — `defaultRendering: 'density'`, `useBicolor`, `summaryScoreMode`,
// the pos/neg palette, `bicolorPivot`, `lineWidth`, `maxGapMultiple` — all read
// only by wiggle code a Manhattan plot never runs. A config doc that advertises
// a slot is a promise it works; these were promises nothing kept. What Manhattan
// genuinely shares is the score *axis*, so it takes `scoreAxisConfigSchemaFields`
// and nothing else. `baseLinearDisplayConfigSchema` went the same way and for
// the same reason: of its five slots only `height` is read here, so this schema
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
 * Taller track, LocusZoom-style coloring: `color: { scale: 'ld' }` colors
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
 *     color: { scale: 'ld' },
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
       * key; `{ scale: "ld" }` colours by r² to the index SNP. See
       * [ManhattanColor](ManhattanColor).
       */
      color: manhattanColorConfigSchema,
      ...scoreFieldConfigSchemaFields,
      // The score axis. `scaleType`, `autoscale` and `numStdDev` come with it
      // because `ScoreScaleMixin` reads all five, but only the min/max bounds
      // reach this plot: -log10 p values are pre-transformed so the axis is
      // linear-only, and `domain` takes plain min/max over the loaded regions.
      // The track menu says so — it drops both radio submenus.
      ...scoreAxisConfigSchemaFields,
      /**
       * #slot
       * Draw a horizontal line across the plot at this score, for the threshold
       * a scan is read against: genome-wide significance on a GWAS, or an
       * empirical outlier cutoff on a differentiation scan. Unset (the default)
       * draws none, since there is no threshold that is right for every scan.
       *
       * On the plot's own scale, so it is a `-log10(p)` where the points are
       * and an Fst where `scoreColumn` names an Fst column. The autoscaled
       * y-axis widens to reach it, so a window where nothing clears the
       * threshold still shows the threshold; an explicit `minScore`/`maxScore`
       * that excludes it still wins, and there the line is not drawn.
       */
      significanceLine: {
        type: 'maybeNumber',
        description:
          'Score to draw a horizontal threshold line at, on the same scale as the plotted points. Unset draws none',
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
      // Carried over from the wiggle schema this used to extend: retired
      // `global`/`globalsd` autoscale values appear in old configs and would
      // otherwise sit outside the narrowed enum. `colorImpliesSolid` is NOT
      // carried over — it keys on `useBicolor`, which a Manhattan plot has no
      // notion of.
      preProcessSnapshot: (snap: Record<string, unknown>) =>
        remapRetiredAutoscale(snap),
    },
  )
}

export type LinearManhattanDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>

export type LinearManhattanDisplayConfig =
  Instance<LinearManhattanDisplayConfigModel>
