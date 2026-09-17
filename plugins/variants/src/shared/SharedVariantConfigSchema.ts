import { ConfigurationSchema, liftField } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { jexlFilterConfigSchemaFields } from '@jbrowse/display-kit/jexlFilterConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import { rowHeightConfigSchemaFields } from '@jbrowse/tree-sidebar/rowHeightConfigSchemaFields'
import {
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields'

const variantFacetSchema = ConfigurationSchema(
  'VariantFacet',
  {
    /**
     * #slot facet.field
     * Name of a sample-metadata attribute (a column in the adapter's
     * samplesTsvLocation, e.g. 'population') whose values each take their own
     * band of rows, so a group-restricted genotype pattern reads as one band
     * rather than being scattered across the matrix. Bands order by `domain`,
     * then the way every in-track grouping orders, digits by magnitude. Empty
     * means the rows keep their existing order. Writing
     * `facet: 'population'` directly on the display lands here.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description: 'sample-metadata attribute whose values take their own band',
    },
    /**
     * #slot facet.domain
     * Optional band order: the values listed come first, in this order, and
     * the rest follow sorted. Left off, the bands are every value the
     * metadata holds, sorted. A listed value the metadata lacks takes no
     * band.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'optional band order; listed values first, the rest sorted; left off, every value the metadata holds, sorted',
    },
  },
  { preProcessSnapshot: liftField },
)

/**
 * #config SharedVariantDisplay
 */
export default function sharedVariantConfigFactory() {
  return ConfigurationSchema(
    'SharedVariantDisplay',
    {
      /**
       * #slot
       * Height of the zone above the rows holding the lines that tie each
       * matrix column to its genomic position. 0 (the default here) means no
       * zone at all — only the matrix display, which lays columns out by
       * feature index rather than at their genomic positions, raises it.
       */
      lineZoneHeight: {
        type: 'number',
        defaultValue: 0,
        advanced: true,
      },
      ...jexlFilterConfigSchemaFields,
      ...rowHeightConfigSchemaFields(),
      ...treeSidebarConfigSchemaFields({
        tree: 'Show the sample clustering tree in the sidebar',
        rowLabels: 'Show the per-sample row labels in the sidebar',
      }),
      ...rowSeparatorsConfigSchemaFields(),
      /**
       * #slot
       * Show the hover tooltip naming the genotype, the sample and the record
       * under the pointer. On by default; turning it off leaves every other
       * hover affordance — the crosshairs, the highlighted cell, the
       * cross-display `session.hovered` channel — alone, so the pointer still
       * says where it is while the panel stops covering the rows beside it.
       *
       * A config slot rather than a display property, so a track config can
       * ship with it off and a figure capture keeps it off across a reload.
       * Both multi-sample displays honor it: they draw the same tooltip off the
       * same `hoveredFeature` slot.
       */
      showTooltips: {
        type: 'boolean',
        defaultValue: true,
        description:
          'show the hover tooltip over the genotype rows; the crosshairs and the hover highlight stay either way',
      },
      /**
       * #slot
       */
      renderingMode: {
        type: 'stringEnum',
        model: types.enumeration('RenderingMode', ['alleleCount', 'phased']),
        defaultValue: 'alleleCount',
        description:
          "'alleleCount' draws one row per sample colored by allele dosage; 'phased' draws one row per haplotype",
      },
      /**
       * #slot
       * Optional per-feature color for the genotype cells: a jexl expression (or
       * plain CSS color) evaluated once per variant in the worker, painting every
       * alt-carrying cell with that color while ref/no-call cells keep their
       * normal coloring so "who carries it" still reads. Empty means the default
       * genotype-based coloring (allele dosage / phasing). The "Color by..."
       * menu offers presets like consequence impact
       * (`jexl:impactColor(feature)`), but any feature jexl works, same as the
       * standard `color` slot.
       */
      featureColor: {
        type: 'string',
        defaultValue: '',
      },
      /**
       * #slot
       * Compose the cell hue with the genotype's alt dosage — the fraction of
       * its called alleles that are non-reference — so a homozygote paints the
       * hue itself and a heterozygote a lighter version of it. On by default,
       * and on in every color mode: turn it off to paint each alt-carrying cell
       * its flat hue, which reads the class or impact tier at full strength at
       * the cost of the zygosity.
       */
      shadeByDosage: {
        type: 'boolean',
        defaultValue: true,
        description:
          "shade each alt cell by the fraction of its called alleles that are non-reference, so a homozygote is darker than a heterozygote; off paints every alt cell the mode's flat hue",
      },
      /**
       * #slot
       */
      minorAlleleFrequencyFilter: {
        type: 'number',
        defaultValue: 0,
        advanced: true,
        description:
          'Hide variants whose minor allele frequency is below this threshold',
      },
      /**
       * #slot
       */
      maxMissingnessFilter: {
        type: 'number',
        defaultValue: 1,
        advanced: true,
        description:
          'Hide variants whose fraction of no-call (missing) genotypes is above this threshold; 1 keeps every variant',
      },
      /**
       * #slot
       * Whether to draw the floating legend over the display. It is clipped to
       * the display's own bounds, so while it is on it sets a floor under the
       * lane height: turn it off to size a short lane to its rows rather than
       * to its key, as for a one-record SV call genotyped across a handful of
       * carriers.
       */
      showLegend: {
        type: 'boolean',
        description:
          'Whether to show the floating legend over the display; turn it off to size a short lane to its rows rather than to its key. Defaults to on',
        defaultValue: true,
      },
      /**
       * #slot
       */
      colorBy: {
        type: 'string',
        defaultValue: '',
        description:
          "Name of a sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. 'population') to color the sidebar rows by; empty means no grouping",
      },
      /**
       * #slot
       * The row facet: a sample-metadata attribute, or an object naming it and
       * its band order, whose values each take their own contiguous band of
       * sample rows.
       */
      facet: variantFacetSchema,
      /**
       * #slot
       * Whether to paint reference alleles: 'skip' (the default) fills the row
       * background solid grey and paints only ALT alleles, which makes
       * overlapping variants easier to pick out; 'draw' paints reference
       * alleles like any other genotype.
       */
      referenceDrawingMode: {
        type: 'stringEnum',
        model: types.enumeration('ReferenceDrawingMode', ['draw', 'skip']),
        defaultValue: 'skip',
        description:
          "whether to paint reference alleles: 'skip' (the default) fills the row background solid grey and paints only ALT alleles, which makes overlapping variants easier to pick out; 'draw' paints reference alleles like any other genotype",
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

export type SharedVariantConfigModel = ReturnType<
  typeof sharedVariantConfigFactory
>
