import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { densityTierConfigSchemaFields } from '@jbrowse/display-kit/densityTierConfigSchemaFields'
import {
  rowHeightConfigSchemaFields,
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearMultiRowFeatureDisplay
 * #category display
 * Paints interval features as colored blocks on stacked rows partitioned by a
 * feature attribute ("chromosome / ancestry painting").
 *
 * #example
 * A custom BED with a column naming each row, its columns named by a
 * `#`-prefixed header line (tab-separated, shown space-aligned):
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
 * palette color — unless the features carry an `itemRgb`, which is honored as
 * the per-feature color with no configuration at all. To color per feature off
 * some other attribute, set the `color` slot to a `jexl:` expression reading it.
 */
export default function configSchemaF() {
  return ConfigurationSchema(
    'LinearMultiRowFeatureDisplay',
    {
      /**
       * #slot
       * Feature attribute whose value assigns each feature to a row; empty (the
       * default) picks one off the data, and a `jexl:` expression derives one.
       *
       * #example
       * ```js
       * { partitionField: "jexl:split(split(feature.name,'#')[1],'/')[0]" }
       * ```
       */
      partitionField: {
        type: 'string',
        defaultValue: '',
        description:
          'feature attribute that assigns each feature to a row, or a jexl expression deriving one. Empty = pick one off the data (repClass if present, else name)',
        // Editor affordance only: SlotEditor gates its value/callback toggle
        // on a non-empty contextVariable, and nothing in the read path consults
        // it.
        contextVariable: ['feature'],
      },
      /**
       * #slot
       * Feature attribute holding a signed bp length change against the
       * reference, which turns on indel glyphs over the blocks; empty (the
       * default) leaves the display a plain block painter.
       *
       * #example
       * A pangenome-graph path BED, where `delta` is each haplotype's bp gained
       * or lost at that bubble:
       * ```js
       * { partitionField: 'strain', lengthField: 'delta' }
       * ```
       */
      lengthField: {
        type: 'string',
        defaultValue: '',
        description:
          'feature attribute holding a signed bp length change vs the reference; enables indel glyphs. Empty = off',
      },
      /**
       * #slot
       * Per-block fill: a CSS color, or a `jexl:` expression for per-feature
       * coloring (e.g. ``jexl:`rgb(${get(feature,'ancestryRgb')})` ``).
       */
      // `maybeColor` so unset stays distinct from every real color — unset is
      // what lets a feature's own itemRgb, or the per-row palette, paint.
      color: {
        type: 'maybeColor',
        description:
          "fill color of each block (CSS color or jexl expression for per-feature coloring). Unset, a feature's own itemRgb paints it if it has one, else each row gets a distinct color from a categorical palette",
        contextVariable: ['feature'],
      },
      /**
       * #slot
       * Optional map of `partitionField` value to color, e.g.
       * `{ HG00096: '#4e79a7' }`, overriding the `color` slot where it matches.
       */
      sampleColorMap: {
        type: 'frozen',
        defaultValue: {},
        description:
          'map of partition value to color; overrides the color slot for matching features',
      },
      /**
       * #slot
       * Optional explicit row order; rows listed here come first, remaining
       * partition values are appended sorted.
       */
      rowOrder: {
        type: 'stringArray',
        defaultValue: [],
        description: 'optional explicit row order (by partition value)',
      },
      ...rowHeightConfigSchemaFields({
        rowHeight:
          'fixed row height in px; 0 (the default) auto-fits all rows to the display height, so adding rows shrinks them instead of growing the track',
      }),
      /**
       * #slot
       * Fraction of the row height each block fills (1 = full, leaving no gap
       * between rows).
       */
      rowProportion: {
        type: 'number',
        defaultValue: 1,
        description: 'fraction of the row height each block fills',
        advanced: true,
      },
      ...rowSeparatorsConfigSchemaFields(),
      ...densityTierConfigSchemaFields,
      /**
       * #slot
       * Tint each sidebar label box with the color that row's blocks are painted
       * in; `rowGroups` and a dialog-set color both win over it, and per-feature
       * color mode leaves no one row color to tint with.
       */
      colorRowLabels: {
        type: 'boolean',
        defaultValue: false,
        description:
          "tint each sidebar label with the color that row's blocks are painted in",
      },
      /**
       * #slot
       * Show the categorical color key, which appears only in per-feature color
       * mode — elsewhere the sidebar labels are already the key.
       */
      showLegend: {
        type: 'maybeBoolean',
        description:
          'show the categorical color key for per-feature coloring. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track',
        // Promotable: read through the resolved `showLegend` getter, never raw.
        promotedBase: true,
      },
      /**
       * #slot
       * Explicit color key, for a category encoded only in the block color and
       * so unavailable to the auto-derived legend this overrides.
       *
       * #example
       * ```js
       * legend: [
       *   { label: 'Maternal', color: 'rgb(227,26,28)' },
       *   { label: 'Paternal', color: 'rgb(31,120,180)' },
       *   { label: 'Unknown', color: 'rgb(170,170,170)' },
       * ]
       * ```
       */
      legend: {
        type: 'frozen',
        defaultValue: [],
        description:
          'explicit {label,color} color key for color-encoded categories; overrides the auto-derived legend',
      },
      /**
       * #slot
       * An array of `{ match, group, color }` tagging rows by a regex on their
       * name, pulling matched rows into contiguous blocks (except under a
       * cluster tree, which already owns the row order) and tinting their
       * sidebar swatch — never their blocks.
       *
       * #example
       * ```js
       * rowGroups: [
       *   { match: '^CLUP', group: 'Wolf', color: 'rgb(27,120,55)' },
       *   { match: '^CLAT', group: 'Coyote', color: 'rgb(224,130,20)' },
       * ]
       * ```
       */
      rowGroups: {
        type: 'frozen',
        defaultValue: [],
        description:
          'array of {match,group,color} tagging rows by a regex on their name; color tints the sidebar swatch only',
      },
      ...treeSidebarConfigSchemaFields({
        tree: 'show the cluster tree sidebar',
        rowLabels: 'draw the row name over the left of each row',
      }),
      /**
       * #slot
       * The byte axis is the only gate this display has: it paints into fixed
       * lanes, so it composes no density axis to fall through to.
       */
      fetchSizeLimit: {
        type: 'number',
        defaultValue: 5_000_000,
        description:
          'maximum data to attempt to download for a given feature track',
        advanced: true,
      },
    },
    {
      /**
       * #baseConfiguration
       */
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
