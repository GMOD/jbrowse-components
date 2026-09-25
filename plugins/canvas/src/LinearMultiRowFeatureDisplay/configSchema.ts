import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { colorConfigSchema } from '@jbrowse/display-kit/colorConfigSchema'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { densityTierConfigSchemaFields } from '@jbrowse/display-kit/densityTierConfigSchemaFields'
import { facetConfigSchema } from '@jbrowse/display-kit/facetConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'
import { rowHeightConfigSchemaFields } from '@jbrowse/tree-sidebar/rowHeightConfigSchemaFields'
import {
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields'

import { refuseRetiredConfig } from './retiredSettings.ts'

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
 * ```text
 * #chrom  start    end      name  sample
 * chr1    0        2000000  seg1  HG00096
 * chr1    2000000  5500000  seg2  HG00096
 * chr1    0        3500000  seg3  HG00097
 * ```
 * Paint one row per `sample`, coloring each row from `rowColor` and fixing
 * HG00097 above HG00096 regardless of file order:
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
 *       rows: { field: 'sample', domain: ['HG00097', 'HG00096'] },
 *       rowColor: {
 *         domain: ['HG00096', 'HG00097'],
 *         range: ['#4e79a7', '#f28e2b'],
 *       },
 *     },
 *   ],
 * }
 * ```
 * Omit `rowColor` entirely and each row is auto-assigned a distinct palette
 * color — unless the features carry an `itemRgb`, which is honored as the
 * per-feature color with no configuration at all, and which `color.scale:
 * 'identity'` names in the key. To color per feature off some other attribute,
 * set the `color` slot to a `jexl:` expression reading it.
 * Omit `rows.domain` and the rows sort by value.
 */
export default function configSchemaF() {
  return ConfigurationSchema(
    'LinearMultiRowFeatureDisplay',
    {
      /**
       * #slot rows
       * One row per value of a feature attribute, and the arrangement a reader
       * gives the rows. `field` names the attribute, or a `jexl:` expression
       * derives one; empty, the default, picks one off the data (`repClass`
       * where the features carry it, else `name`). `domain` is the row order:
       * the values it lists lead, and the rest sort, digits by magnitude, with
       * the row of features carrying no value last. `labels`, `tree`,
       * `treeProvenance` and `kept` are what the arrangement dialog, a
       * clustering run and a focus write, each as a session edit to this
       * object.
       *
       * #example
       * ```js
       * { rows: 'sample' }
       * ```
       * ```js
       * { rows: { field: 'sample', domain: ['HG00097', 'HG00096'] } }
       * ```
       * ```js
       * { rows: "jexl:split(split(feature.name,'#')[1],'/')[0]" }
       * ```
       */
      rows: rowsConfigSchema,
      /**
       * #slot
       * Feature attribute whose value each row is clustered on; `auto` (the
       * default) takes the attribute the `color` slot reads, else `name`, and
       * an empty string clusters on presence alone — which bins each row
       * covers. A `jexl:` expression derives the value.
       *
       * #example
       * ```js
       * { clusterField: 'state' }
       * ```
       */
      clusterField: {
        type: 'featureField',
        defaultValue: 'auto',
        description:
          "feature attribute the rows cluster on, or a jexl expression deriving one. 'auto' = the attribute the color slot reads, else name; empty = cluster on presence alone",
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
       * { rows: 'strain', lengthField: 'delta' }
       * ```
       */
      lengthField: {
        type: 'string',
        defaultValue: '',
        description:
          'feature attribute holding a signed bp length change vs the reference; enables indel glyphs. Empty = off',
      },
      /**
       * #slot color
       * Each block's fill, the FeatureColor object: a CSS color or `jexl:`
       * callback in `value`, or a field whose values each take a colour
       * through a scale, with a key. Unset, a feature's own itemRgb paints it
       * if it has one, else each row takes a colour from a categorical
       * palette. `scale: 'identity'` keeps each feature's own colour and
       * names the `domain` colours in the key, which is how a file's itemRgb
       * states get their names.
       *
       * #example
       * ```js
       * {
       *   color: {
       *     field: 'segmean',
       *     scale: 'threshold',
       *     domain: ['-1', '-0.3', '0.3', '1'],
       *     range: ['#2166ac', '#92c5de', '#f7f7f7', '#f4a582', '#b2182b'],
       *     labels: ['Deep loss', 'Loss', 'Balanced', 'Gain', 'Amplification'],
       *   },
       * }
       * ```
       * ```js
       * {
       *   color: {
       *     scale: 'identity',
       *     domain: ['rgb(227,26,28)', 'rgb(31,120,180)', 'rgb(170,170,170)'],
       *     labels: ['Maternal', 'Paternal', 'Unknown'],
       *   },
       * }
       * ```
       */
      color: colorConfigSchema,
      /**
       * #slot rowColor
       * A colour per row, by value, as `domain`/`range` pairs, painting the
       * row's blocks over each feature's own colour. The arrangement dialog
       * writes it.
       *
       * #example
       * ```js
       * { rowColor: { domain: ['HG00096'], range: ['#4e79a7'] } }
       * ```
       */
      rowColor: rowColorConfigSchema,
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
       * in; a `rowGroups` swatch wins over it, and per-feature color mode leaves
       * no one row color to tint with.
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
        type: 'boolean',
        description:
          'show the categorical color key for per-feature coloring. Defaults to on',
        defaultValue: true,
      },
      /**
       * #slot
       * An array of `{ match, group, color }` tagging each row with the group
       * of the first entry whose regex its name matches, and tinting its
       * sidebar swatch — never its blocks. `facet: 'group'` stacks the groups
       * in bands.
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
       * #slot facet
       * Stacks the rows in labelled bands: `group` bands them by their
       * `rowGroups` group, the groups in the order `rowGroups` declares them
       * unless `domain` lists some first, and the rows no entry matches last.
       * Each band keeps the rows' arranged order and, where the cluster tree
       * holds a clade of exactly its rows, draws that clade; a clustering run
       * clusters each band apart.
       *
       * #example
       * ```js
       * { facet: 'group' }
       * ```
       */
      facet: facetConfigSchema,
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
      preProcessSnapshot: refuseRetiredConfig,
    },
  )
}

export type LinearMultiRowFeatureDisplayConfigModel = ReturnType<
  typeof configSchemaF
>
export type LinearMultiRowFeatureDisplayConfig =
  Instance<LinearMultiRowFeatureDisplayConfigModel>
