import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { MULTIROW_DEFAULT_COLOR } from '../MultiRowGetFeaturesRPC/multiRowColors.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

/**
 * #config LinearMultiRowFeatureDisplay
 * #category display
 * Paints interval features as colored blocks on stacked rows ("chromosome /
 * ancestry painting"). Rows are partitioned by a feature attribute
 * (`partitionField`). Block color comes from `sampleColorMap` (keyed by the
 * partition value) when set, else a customized per-feature `color` slot, else an
 * automatically-assigned per-row color from a categorical palette. A row color
 * picked interactively in the "Edit colors/arrangement..." track-menu dialog
 * overrides all of these for that row (applied at render time, no refetch).
 *
 * These are display-level slots. This is not a `FeatureTrack`'s default display,
 * so configure it with an explicit `displays` entry (rather than the
 * `displayDefaults` shorthand, whose `color` would also reach the default
 * `LinearBasicDisplay`).
 *
 * #example
 * The data is a custom BED with a column naming each row (`partitionField`).
 * Name the columns with a `#`-prefixed header line so the adapter picks them up
 * (tab-separated, shown space-aligned):
 * ```
 * #chrom  start    end      name  sample
 * chr1    0        2000000  seg1  HG00096
 * chr1    2000000  5500000  seg2  HG00096
 * chr1    0        3500000  seg3  HG00097
 * ```
 * Paint one row per `sample`, coloring each row from `sampleColorMap`:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'ancestry_painting',
 *   name: 'Ancestry painting',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BedTabixAdapter',
 *     uri: 'https://example.com/painting.bed.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearMultiRowFeatureDisplay',
 *       displayId: 'ancestry_painting-LinearMultiRowFeatureDisplay',
 *       partitionField: 'sample',
 *       sampleColorMap: { HG00096: '#4e79a7', HG00097: '#f28e2b' },
 *     },
 *   ],
 * }
 * ```
 * Omit `sampleColorMap` entirely and each row is auto-assigned a distinct
 * palette color. For per-feature (not per-row) colors, set the `color` slot
 * instead: `color: "jexl:get(feature,'itemRgb')"` for a standard BED12, or read
 * a custom color column.
 */
export default function configSchemaF(pluginManager: PluginManager) {
  const LinearGenomePlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { baseLinearDisplayConfigSchema } = LinearGenomePlugin.exports
  return ConfigurationSchema(
    'LinearMultiRowFeatureDisplay',
    {
      /**
       * #slot
       * Feature attribute whose value assigns each feature to a row (e.g. a BED
       * column name). Features sharing a value stack into the same row.
       */
      partitionField: {
        type: 'string',
        defaultValue: 'name',
        description: 'feature attribute that assigns each feature to a row',
      },
      /**
       * #slot
       * Per-block fill (a CSS color, or a `jexl:` expression for per-feature
       * coloring, e.g. `jexl:get(feature,'itemRgb')`). Left at its default, each
       * row instead gets a distinct color from a categorical palette.
       */
      color: {
        type: 'color',
        defaultValue: MULTIROW_DEFAULT_COLOR,
        description:
          'fill color of each block (CSS color or jexl expression for per-feature coloring); the default auto-assigns a per-row palette color',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       * Optional map of `partitionField` value to color, e.g.
       * `{ HG00096: '#4e79a7' }`. When a feature's partition value has an entry
       * here it overrides the `color` slot, so whole rows can be colored without
       * a per-feature color column.
       */
      sampleColorMap: {
        type: 'frozen',
        defaultValue: {},
        description:
          'map of partition value to color; overrides the color slot for matching features',
      },
      /**
       * #slot
       * Optional explicit row order. Rows listed here come first in this order;
       * any remaining partition values are appended in sorted order. Empty =
       * fully auto (sorted).
       */
      rowOrder: {
        type: 'stringArray',
        defaultValue: [],
        description: 'optional explicit row order (by partition value)',
      },
      /**
       * #slot
       * Fixed height in pixels of each row. `0` (the default) auto-fits: all rows
       * stretch to fill the display height, so adding rows shrinks them instead of
       * growing the track — a dense, fully-visible painting.
       */
      rowHeight: {
        type: 'number',
        defaultValue: 0,
        description:
          'fixed row height in px; 0 (default) auto-fits all rows to the display height',
      },
      /**
       * #slot
       * Fraction of the row height each block fills (1 = full, leaving no gap
       * between rows).
       */
      rowProportion: {
        type: 'number',
        defaultValue: 0.9,
        description: 'fraction of the row height each block fills',
        advanced: true,
      },
      /**
       * #slot
       * Show the categorical color key (swatch + feature name per distinct
       * per-feature color). Only appears in per-feature color mode with named,
       * categorical features (e.g. chromHMM states); in per-row palette /
       * sampleColorMap mode the sidebar labels are already the key, so nothing
       * shows regardless.
       */
      showLegend: {
        type: 'boolean',
        defaultValue: true,
        description: 'show the categorical color key for per-feature coloring',
      },
      /**
       * #slot
       */
      showTree: {
        type: 'boolean',
        defaultValue: true,
        description: 'show the cluster tree sidebar',
      },
      /**
       * #slot
       * Position tree nodes by cluster merge height (dendrogram) vs. evenly by
       * topology (cladogram).
       */
      showBranchLength: {
        type: 'boolean',
        defaultValue: false,
        description: 'position tree nodes by branch length (dendrogram)',
      },
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearMultiRowFeatureDisplayConfigModel = ReturnType<
  typeof configSchemaF
>
export type LinearMultiRowFeatureDisplayConfig =
  Instance<LinearMultiRowFeatureDisplayConfigModel>
