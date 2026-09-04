import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { types } from '@jbrowse/mobx-state-tree'
import {
  rowHeightConfigSchemaFields,
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar'

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
       * to its key, which is what a one-record SV call genotyped across a
       * handful of carriers wants.
       */
      showLegend: {
        type: 'maybeBoolean',
        description:
          'Whether to show the floating legend over the display; turn it off to size a short lane to its rows rather than to its key. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track',
        // Promotable: `undefined` (unset) is the inherit state, `promotedBase`
        // (true) is what it resolves to when nothing is promoted. Read through
        // the resolved `showLegend` getter (resolveConf), never raw.
        promotedBase: true,
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
       */
      groupBy: {
        type: 'string',
        defaultValue: '',
        description:
          "Name of a sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. 'population') to order the sample rows by, so each group's rows are contiguous and a group-restricted genotype pattern reads as one band; empty means the rows keep their existing order",
      },
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
