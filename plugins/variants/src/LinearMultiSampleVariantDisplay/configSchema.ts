import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { SHOW_LABELS_MODES } from '@jbrowse/plugin-canvas'

import sharedVariantConfigFactory from '../shared/SharedVariantConfigSchema.ts'
import { DEFAULT_VARIANT_LANE_HEIGHT } from '../shared/variantTopBands.ts'

/**
 * #config LinearMultiSampleVariantDisplay
 *
 * #example
 * Minimal `VariantTrack` config selecting this display type. The `displays`
 * array form is required here (rather than the object shorthand) because
 * this is a non-default display type — see
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'cohort',
 *   name: 'Cohort variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/cohort.vcf.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearMultiSampleVariantDisplay',
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * Preloading sample metadata: point the adapter's `samplesTsvLocation` at a TSV
 * whose first column is the sample name and whose other columns are per-sample
 * attributes (e.g. `population`), then `colorBy` one of those attributes to
 * color the sidebar rows on load. `showReferenceAlleles: false` paints the
 * background solid grey and draws only ALT alleles on top, which makes
 * overlapping structural variants easier to see. This is the 1000 Genomes
 * "colored by population" demo config:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'cohort',
 *   name: 'Cohort variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/cohort.vcf.gz',
 *     samplesTsvLocation: { uri: 'https://example.com/samples.tsv' },
 *   },
 *   displays: [
 *     {
 *       type: 'LinearMultiSampleVariantDisplay',
 *       height: 800,
 *       colorBy: 'population',
 *       showReferenceAlleles: false,
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * Phased haplotype rows, two per sample. Sample colors and group labels come
 * from the adapter's `samplesTsvLocation` above — the display's own `layout`
 * holds the row arrangement the user drags into place, so it is session state
 * rather than a config slot:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'cohort',
 *   name: 'Cohort variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/cohort.vcf.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearMultiSampleVariantDisplay',
 *       height: 400,
 *       renderingMode: 'phased',
 *     },
 *   ],
 * }
 * ```
 */

export default function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearMultiSampleVariantDisplay',
    {
      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 200,
        description:
          'Starting height in pixels for the genotype rows; drag-resizable, and the rows divide it while row height is on auto-fit',
      },
      /**
       * #slot
       * Widen each alt-carrying cell of an insertion to a marker sized by the
       * inserted bp, the same one `plugins/alignments` and `plugins/maf` draw,
       * with the bp count when the row is tall enough.
       *
       * A cell is drawn across the reference the record covers, with a 2px floor.
       * That is right for a SNP and right for a deletion, but an insertion
       * consumes almost no reference, so a 65 kb insertion and a SNP both land on
       * that floor and the structural tier of a pangenome callset becomes
       * unreadable. Only cells whose genotype carries the allele widen, and each
       * keeps its genotype color, so the marker adds length without displacing
       * what the color already says.
       *
       * This display only: it draws every cell at its genomic position, so a
       * width there is a claim about length.
       * `LinearMultiSampleVariantMatrixDisplay` lays its columns out by feature
       * index at a uniform width, so it has no such width to correct.
       */
      showInsertionGlyphs: {
        type: 'boolean',
        defaultValue: true,
        description:
          'widen insertion cells to a marker sized by the inserted bp, instead of drawing them at the 2px floor like a SNP',
      },
      /**
       * #slot
       * Draw a `LinearVariantDisplay`-style lane above the genotype rows: one
       * mark per record at its genomic span, colored by whatever "Color by →
       * Cells" is set to. It answers "which variant am I looking at" without a
       * second track, the relationship the coverage band has to a pileup —
       * `shared/variantTopBands.ts` holds the band stack.
       *
       * It *is* that display's band, drawn by the same code: overlapping records
       * stack onto rows rather than overdrawing one another, and the band
       * compacts to fit the height it is given — dropping descriptions, then
       * thinning IDs, then packing bodies alone. Hovering a mark reports the
       * record (its ID, alleles, length and description), clicking opens its
       * details, and right-clicking opens the same menu a genotype cell does,
       * including the split view for a breakend.
       *
       * One thing it does NOT do that the cells below it do: widen an insertion
       * to its inserted length. A box is its reference span there, so the length
       * of a large `<INS>` is carried by `showInsertionGlyphs` on the rows.
       *
       * Off by default: on, it takes `variantLaneHeight` px away from the rows,
       * so defaulting it on would resize every existing display and every
       * committed figure.
       *
       * This display only, for now: it draws every cell at its genomic
       * position, so the lane above lines up with the cells below it column for
       * column. `LinearMultiSampleVariantMatrixDisplay` lays its columns out by
       * feature index and ties them to the genome with connector lines instead;
       * the band geometry is already shared with it (`topBands`), but nothing
       * paints the lane there yet.
       */
      showVariantLane: {
        type: 'boolean',
        defaultValue: false,
        description:
          'draw a lane of the variants themselves above the genotype rows, at their genomic positions',
      },
      /**
       * #slot
       * Height of the variant lane, spent only while `showVariantLane` is on.
       * On the config rather than a prop for the same reason `height` and
       * `lineZoneHeight` are: a drag-resize outlives the display instance, so
       * unticking and reticking the track keeps the lane the user sized.
       */
      variantLaneHeight: {
        type: 'number',
        defaultValue: DEFAULT_VARIANT_LANE_HEIGHT,
        advanced: true,
      },
      /**
       * #slot
       * Letter the lane's marks with each record's VCF ID and/or its
       * description, in plugin-canvas's label font at its measured widths and
       * in its two colors — the same text a `LinearVariantDisplay` puts under
       * the same record, under the same enum it spells the choice with.
       *
       * What the band has room for is decided by the same fit ladder that display
       * uses in fit mode, so asking for both kinds is a preference and not a
       * promise: descriptions go first, then IDs are thinned to the records with
       * room for them, then dropped entirely so the boxes can keep their height.
       * Zooming in therefore letters more, and a taller band letters more, both
       * continuously.
       */
      variantLaneLabels: {
        type: 'stringEnum',
        model: types.enumeration('variantLaneLabels', [...SHOW_LABELS_MODES]),
        defaultValue: 'auto',
        description:
          "which label text the variant lane draws beside each mark: the record's ID and/or its description, in plugin-canvas's own vocabulary. 'auto' admits both — the lane has no density thresholds of its own, so adaptivity is its collision cull",
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: sharedVariantConfigFactory(),
      explicitlyTyped: true,
    },
  )
}

export type LinearMultiSampleVariantDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
