import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import {
  rowHeightConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar'

import type { Instance } from '@jbrowse/mobx-state-tree'

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
export default function configSchemaF() {
  return ConfigurationSchema(
    'LinearMultiRowFeatureDisplay',
    {
      /**
       * #slot
       * Feature attribute whose value assigns each feature to a row (e.g. a BED
       * column name). Features sharing a value stack into the same row.
       *
       * Nothing declares the rows: they are discovered from the values present
       * in the loaded regions, so a file that gains a category needs no config
       * change. `rowOrder` and `sampleColorMap` are how a row's position and
       * color are held fixed while that set changes underfoot.
       *
       * A `jexl:` expression works here too, for a file that carries the
       * category without carrying a column for it. UCSC's `bigRmskBed` is the
       * case this was added for: the repeat class is a suffix on the name
       * (`L1HS#LINE/L1`), so the attribute form can only partition on the full
       * repeat name, which is thousands of rows instead of twenty.
       *
       * #example
       * ```js
       * { partitionField: "jexl:split(split(feature.name,'#')[1],'/')[0]" }
       * ```
       */
      partitionField: {
        type: 'string',
        defaultValue: 'name',
        description:
          'feature attribute that assigns each feature to a row, or a jexl expression deriving one',
        // What makes the config editor offer this slot's value/callback toggle
        // at all (SlotEditor gates that switch on a non-empty contextVariable),
        // and what names `feature` in the callback editor's help. Without it the
        // jexl form documented above was reachable only by hand-writing the
        // `jexl:` string into JSON.
        //
        // Editor affordance only. Nothing in the read path consults it — the
        // reader decides whether to evaluate a callback from whether the read
        // supplied any context, deliberately not from this declaration, so that
        // a slot forgetting it (as this one did) is a missing toggle in the UI
        // and not a silently wrong value.
        contextVariable: ['feature'],
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
      // This display grows to its content instead of scrolling, so the shared
      // sentence about scrolling to the rows that don't fit is wrong here:
      // adding rows shrinks them, and every one of them stays on screen.
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
        type: 'maybeBoolean',
        description:
          'show the categorical color key for per-feature coloring. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track',
        // Promotable: `undefined` (unset) is the inherit state, `promotedBase`
        // (true) is what it resolves to when nothing is promoted. Read through
        // the resolved `showLegend` getter (resolveConf), never raw.
        promotedBase: true,
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
       * **Except under a cluster tree, where it marks without grouping.**
       * Clustering already owns the row order, so partitioning on top of it used
       * to trade the dendrogram away silently (the tree stops describing the
       * rows, and `StaleTreeHint` replaces it). That is also the case where a
       * stripe is worth most: the groups are an axis the clustering never saw,
       * so reading them down the blocks it did find is what says whether the two
       * agree. Both together now means both.
       *
       * Use this when the row identity encodes a grouping the painting does not
       * — cohort IDs whose prefix names a population, say — and the cohort is
       * far too large to enumerate in `layout`. The color tints the swatch only,
       * never the blocks, so it composes with an `itemRgb` painting instead of
       * overwriting it.
       *
       * **Below a pixel a row, mark the small group and not the big one.** The
       * swatch is floored to a whole pixel so it survives at all, which makes
       * every mark taller than the row it points at, so the stripe is a marker
       * rather than a proportional encoding: 307 of 1,987 rows (15%) came out as
       * 48% of the stripe's ink, which reads as a majority, where 63 wolves out
       * of the same 1,987 cost 10% and read correctly as sparse ticks.
       *
       * The floor is the whole of that caveat, so it stops applying once a row
       * clears a pixel. 127 Roadmap epigenomes in 480px is 3.7px a row, and
       * there every one of the 19 published tissue groups can be declared and
       * the stripe stays proportional. Check the row height before deciding how
       * much to mark.
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
      // Turn the labels off when they would cover the data they name: on a
      // whole-chromosome view of a track with long row names, a feature that
      // starts at the chromosome's beginning reads as absent rather than as
      // covered. Pairing a labelled view with an unlabelled one of the same rows
      // is the other way out, and is what a compose figure does.
      ...treeSidebarConfigSchemaFields({
        tree: 'show the cluster tree sidebar',
        rowLabels: 'draw the row name over the left of each row',
      }),
      /**
       * #slot
       * The same 5 Mb `LinearBasicDisplay` uses, raised from the base display's
       * conservative 1 Mb, and for the reason that slot gives: this display
       * reads the same BED/BigBed/tabix files, none of whose adapters declare a
       * limit of their own, and the index estimate is block-granular — a single
       * region still pulls whole BGZF blocks, so a tighter gate banners a view
       * that is not actually large.
       *
       * It matters more here than there. The byte axis is the *only* gate this
       * display has: multi-row paints into fixed lanes, so it turns the density
       * axis off (`densityGateEnabled`) and has no second backstop to fall
       * through to.
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
