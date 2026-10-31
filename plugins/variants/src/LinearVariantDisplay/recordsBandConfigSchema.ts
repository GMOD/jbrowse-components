import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { sectionFacetConfigSchema } from '@jbrowse/display-kit/sectionFacetConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import {
  DISPLAY_MODES,
  featureDescriptionLabelConfigSchema,
  featureGateConfigSchemaFields,
  featureMarkConfigSchema,
  featureNameLabelConfigSchema,
  featureTooltipFieldSlot,
} from '@jbrowse/plugin-features'

import { DEFAULT_RECORDS_MAX_HEIGHT } from './variantTopBands.ts'

/**
 * #config RecordsBand
 * #category display
 * The variant display's `records` band: the VCF's records, stacked as a
 * feature track stacks them, so a nested SV sits under the one holding it.
 *
 * Over genotype rows the band holds the structural variants alone, so a
 * region without SVs spends no height on it. A record is colored by its SV
 * type, keyed, or by `encoding.color` when that is set, and lettered on one
 * line with its ID, description and the share of the samples shown as rows,
 * no-calls included, that carry it. The band grows to its stack, up to
 * `maxHeight`; past that names thin and go, then boxes shrink. Past 0.2
 * records per pixel names go, past 0.1 descriptions, as on a feature track.
 * Hovering a record reports it and its carriers, and clicking opens its
 * details. At genomic positions only. On by default: a file or a region with
 * no SV spends 0 px on it.
 *
 * With no genotype rows (a VCF with no samples, or `genotypes.show` off) the
 * band is the whole display whatever `show` says: every record, an SV in its
 * SV type's color and the rest in the feature track's default, lettered as a
 * feature track letters it (the description under the name, no carrier
 * share) and sized by the display's `heightMode`. Past
 * `maxFeatureScreenDensity` records per pixel it refuses the window with the
 * region-too-large banner and its Force load, as a feature track does; over
 * genotype rows that budget is not read. Right-clicking a record offers the
 * feature track's rows on it: zoom to, get sequence, copy.
 *
 * The record settings are a feature track's, spelt as `LinearBasicDisplay`
 * spells them: `displayMode` and `mark.height` size each record, `facet`
 * stacks the records in labelled sections, one per value of a record field,
 * and `tooltip.field` names the record's line in the hover tooltip.
 *
 * #example
 * ```js
 * { type: 'LinearVariantDisplay', records: { show: false } }
 * ```
 * ```js
 * {
 *   type: 'LinearVariantDisplay',
 *   records: { displayMode: 'collapsed', facet: 'INFO.CLNSIG' },
 * }
 * ```
 */
export const recordsBandConfigSchema = ConfigurationSchema(
  'RecordsBand',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw the structural variants themselves above the genotype rows, at their genomic positions; a region with none spends no height',
    },
    /**
     * #slot
     */
    maxHeight: {
      type: 'number',
      defaultValue: DEFAULT_RECORDS_MAX_HEIGHT,
      description:
        'ceiling in pixels on the band, which grows to its stack of records and takes that height from the rows',
    },
    ...featureGateConfigSchemaFields,
    /**
     * #slot
     * Unset, `compact` over genotype rows, keeping the band over them tight,
     * and `normal` with no rows, as on a feature track.
     */
    displayMode: {
      type: 'maybeStringEnum',
      model: types.enumeration('RecordsDisplayMode', [...DISPLAY_MODES]),
      description:
        'Record height preset: `normal`, `compact` and `superCompact` shrink the rows, and `collapsed` packs every record onto one row with its labels hidden. Unset, `compact` over genotype rows and `normal` with none',
    },
    /**
     * #slot
     * The box each record draws as, a [](/docs/config/featuremark) object:
     * `{ height: 6 }`.
     */
    mark: featureMarkConfigSchema,
    /**
     * #slot facet
     * One labelled section of the band per value of a record field:
     * `"INFO.CLNSIG"`, or `{ field, sort }` with the order its sections stack
     * in. Not the display's own `facet`, which bands the sample rows.
     */
    facet: sectionFacetConfigSchema,
    /**
     * #slot tooltip
     * The record's line in the hover tooltip, a
     * [](/docs/config/featuretooltip) `field`; whether the tooltip shows is
     * the display's `tooltip.show`. A bare string is the field.
     */
    tooltip: ConfigurationSchema(
      'RecordsTooltip',
      {
        /**
         * #slot tooltip.field
         * The record's line in the hover tooltip: a field, or a `jexl:`
         * expression over `feature`. The default reads the record's name.
         */
        field: featureTooltipFieldSlot,
      },
      { shorthand: 'field', writes: 'members', closed: true },
    ),
    /**
     * #slot labels
     * `labels.name`, each record's ID, and `labels.description`, drawn after
     * it on the same line, each a [](/docs/config/featurenamelabel) and
     * [](/docs/config/featuredescriptionlabel) object.
     */
    labels: ConfigurationSchema(
      'RecordsBandLabels',
      {
        /**
         * #slot labels.name
         * Each record's ID.
         */
        name: featureNameLabelConfigSchema,
        /**
         * #slot labels.description
         * The text after each ID.
         */
        description: featureDescriptionLabelConfigSchema,
      },
      { closed: true, plot: true },
    ),
  },
  { closed: true, plot: true },
)
