import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { types } from '@jbrowse/mobx-state-tree'
import {
  remapRetiredAutoscale,
  scoreAxisConfigSchemaFields,
} from '@jbrowse/plugin-wiggle'

import { DEFAULT_MANHATTAN_COLOR } from '../ManhattanRPC/rpcTypes.ts'
import { DEFAULT_POINT_DIAMETER_PX } from './manhattanRenderingBackendTypes.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Declares its own slots rather than extending LinearWiggleDisplay's schema.
// It used to, which put sixteen inherited slots on a GWAS track of which twelve
// did nothing — `defaultRendering: 'density'`, `useBicolor`, `summaryScoreMode`,
// the pos/neg palette, `bicolorPivot`, `lineWidth`, `maxGapMultiple` — all read
// only by wiggle code a Manhattan plot never runs. A config doc that advertises
// a slot is a promise it works; these were promises nothing kept. What Manhattan
// genuinely shares is the score *axis*, so it takes `scoreAxisConfigSchemaFields`
// and nothing else.
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
        // What makes the config editor offer this slot's value/callback toggle
        // at all (SlotEditor gates that switch on a non-empty contextVariable),
        // and what names `feature` in the callback editor's help. Editor
        // affordance only — nothing in the read path consults it, and the
        // display forwards this slot to the worker unevaluated either way.
        contextVariable: ['feature'],
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
        type: 'maybeNumber',
        promotedBase: DEFAULT_POINT_DIAMETER_PX,
        description:
          'Diameter in px of Manhattan points. Unset (the default) follows the session-wide default for this display type',
        // wiggle marks this advanced because scatter is one of its several
        // renderings; Manhattan is only ever a scatter, so point size is a
        // basic setting here and stays out of "Show advanced settings"
        advanced: false,
      },
      /**
       * #slot
       * Draw the LD color key, which labels the r² ramp the points are painted
       * against. Only appears while LD coloring is active — the ramp means
       * nothing under the plain single-color scheme.
       */
      // Named for the LD legend specifically, not `showLegend` like the eight
      // displays whose key is their color scheme's: this display could grow a
      // second key (a chromosome band, a significance threshold) and the two
      // would need separate switches.
      //
      // Promotable, and a config slot at all only as of this change — it was a
      // volatile, so it sat with `hoveredFeature` and `rpcDataMap` and reset
      // on every retick. Read through the resolved `showLdLegend` getter
      // (resolveConf), never raw.
      showLdLegend: {
        type: 'maybeBoolean',
        promotedBase: true,
        description:
          'Draw the LD color key while LD coloring is active. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
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
