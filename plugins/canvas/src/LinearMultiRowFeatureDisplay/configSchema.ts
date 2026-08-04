import { ConfigurationSchema } from '@jbrowse/core/configuration'

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
 * palette color — unless the features carry an `itemRgb`, which is honored as
 * the per-feature color with no configuration at all. To color per feature off
 * some other attribute, set the `color` slot to a `jexl:` expression reading it.
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
       * Feature attribute holding a **signed bp length change** against the
       * reference, which turns on alignment-style indel glyphs over the blocks:
       * a positive value draws the insertion marker `plugins/alignments` and
       * `plugins/maf` draw (a bar whose width follows the length, with the bp
       * count when the row is tall enough), a negative one draws a deletion line
       * across the block, and 0 draws nothing.
       *
       * This exists because a block's own width can only ever show how much
       * *reference* a feature covers. An insertion covers almost none of it, so
       * a 113 kb allele and a 1 bp one draw identically without this — the
       * length has to come from a separate attribute.
       *
       * Empty (the default) leaves the display a plain block painter.
       *
       * #example
       * A pangenome-graph path BED, where `delta` is each haplotype's bp gained
       * or lost at that bubble (`scripts/build_minigraph_paths.sh`):
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
       * coloring (e.g. ``jexl:`rgb(${get(feature,'ancestryRgb')})` ``). Unset,
       * a feature's own `itemRgb` is used if it has one, and otherwise each row
       * gets a distinct color from a categorical palette.
       */
      // `maybeColor` so unset stays distinct from every real color: unset is
      // what lets a feature's own itemRgb, or the per-row palette, paint. With a
      // concrete default that behavior would swallow anyone writing that exact
      // color. See maybeColor in configurationSlot.ts.
      color: {
        type: 'maybeColor',
        defaultValue: undefined,
        description:
          "fill color of each block (CSS color or jexl expression for per-feature coloring). Unset, a feature's own itemRgb paints it if it has one, else each row gets a distinct color from a categorical palette",
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
        defaultValue: 1,
        description: 'fraction of the row height each block fills',
        advanced: true,
      },
      /**
       * #slot
       * Draw a hairline between adjacent rows. Off by default: a painting whose
       * neighbouring rows differ in color already separates itself, and the line
       * only earns its pixel where they don't — a run of same-colored rows (an
       * ancestry painting where most animals are one color, a cohort sorted so
       * like sits next to like) reads as one block without it, and the row count
       * can't be recovered by eye.
       *
       * Only drawn once rows are at least 4px tall. Below
       * that the line is as thick as the row it borders, so a dense painting
       * would be turned into a grid of hairlines with a little color between
       * them.
       */
      showRowSeparators: {
        type: 'boolean',
        defaultValue: false,
        description: 'draw separator lines between rows',
      },
      /**
       * #slot
       * Show the categorical color key (swatch + label per distinct per-feature
       * color). Only appears in per-feature color mode; in per-row palette /
       * sampleColorMap mode the sidebar labels are already the key, so nothing
       * shows regardless. The entries come from `legend` when set, else are
       * auto-derived from named, categorical features (e.g. chromHMM states).
       */
      showLegend: {
        type: 'boolean',
        defaultValue: true,
        description: 'show the categorical color key for per-feature coloring',
      },
      /**
       * #slot
       * Explicit color key: an array of `{ label, color }`. Use this when the
       * category is encoded only in the block color (e.g. an `itemRgb` ancestry
       * painting) so there's no feature attribute to auto-derive a legend from —
       * the mapping is a semantic the data doesn't carry, so the config declares
       * it. `color` is any CSS color and should match what `color` paints.
       * Overrides the auto-derived legend when non-empty.
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
       * Group and mark rows: an array of `{ match, group, color }` where
       * `match` is a regex tested against the row name (the partition value).
       * The first matching entry wins, its `color` becomes that row's sidebar
       * swatch, and matched rows are pulled into contiguous blocks in the order
       * the entries are declared, ahead of everything unmatched.
       *
       * It groups as well as marks because marking alone does not survive a
       * large cohort: rows spread through a couple of thousand sorted neighbours
       * land as a few specks that read as noise, where the same rows in one
       * block read as a group whose colors can be compared against the rest.
       * Within a block the incoming order is kept, so a `sortRowsBy` still
       * orders each block by the value it sorted on.
       *
       * Use this when the row identity encodes a grouping the painting does not
       * — cohort IDs whose prefix names a population, say — and the cohort is
       * far too large to enumerate in `layout`. The color tints the swatch only,
       * never the blocks, so it composes with an `itemRgb` painting instead of
       * overwriting it.
       *
       * **Mark the small group, not the big one.** Rows matching nothing get no
       * swatch, and that is the point: below a pixel a row the swatch is floored
       * to a pixel so it stays visible, which makes every mark taller than the
       * row it points at. The stripe is then a marker, not a proportional
       * encoding — 307 of 1,987 rows (15%) came out as 48% of the stripe's ink,
       * which reads as a majority. Marking 63 wolves out of the same 1,987 costs
       * 10% of the ink and reads correctly, as sparse ticks. Keep the matched
       * groups to the ones a reader is hunting for.
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
        defaultValue: true,
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
