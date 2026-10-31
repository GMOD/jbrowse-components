import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { triangleMatrixConfigSchemaFields } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { retiredBaseDisplaySpellings } from '@jbrowse/display-kit/configSchema'
import { hiddenLegendConfigSchema } from '@jbrowse/display-kit/hiddenLegendConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import { ldEncodingConfigSchema } from './ldEncodingConfigSchema.ts'

/**
 * #config LDTrackDisplay
 * #category display
 *
 * Linkage disequilibrium heatmap read from an `LDTrack`'s pre-computed file —
 * PLINK `--r2` output and the formats that follow it. JBrowse does not compute
 * LD from genotypes; run plink (or an equivalent) and point this at the result.
 *
 * #example
 * ```js
 * {
 *   type: 'LDTrack',
 *   trackId: 'ld',
 *   name: 'Linkage disequilibrium',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'PlinkLDTabixAdapter',
 *     uri: 'https://example.com/plink.ld.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LDTrackDisplay',
 *       displayId: 'ld-LDTrackDisplay',
 *       encoding: { color: { field: 'dprime' } },
 *       legend: { show: true },
 *     },
 *   ],
 * }
 * ```
 */
export default function ldTrackDisplayConfigSchema() {
  return ConfigurationSchema(
    'LDTrackDisplay',
    {
      ...trackHeightConfigSchemaFields({
        defaultHeight: 400,
        height:
          'default height of the display, the band above the triangle included',
      }),
      ...triangleMatrixConfigSchemaFields,
      /**
       * #slot
       */
      lineZoneHeight: {
        type: 'number',
        defaultValue: 100,
        description:
          'height of the band above the triangle holding the connector lines and labels',
        advanced: true,
      },
      /**
       * #slot encoding
       * The cells' channels: `encoding.color`, the statistic the cells show,
       * `field` `r2` or `dprime`, and the linear ramp it paints through over
       * the statistic's 0 to 1.
       */
      encoding: ldEncodingConfigSchema,
      /**
       * #slot legend
       * The color ramp's key, off until asked for.
       */
      legend: hiddenLegendConfigSchema,
      /**
       * #slot guides
       * The guides a hovered cell draws across the view at its pair's
       * genomic positions.
       */
      guides: ConfigurationSchema(
        'LDGuides',
        {
          /**
           * #slot guides.show
           */
          show: {
            type: 'boolean',
            defaultValue: true,
            description:
              "on hover, draw guides across the view at the pair's genomic positions",
            advanced: true,
          },
        },
        { closed: true },
      ),
      /**
       * #slot labels
       * The text drawn at each variant's tick mark.
       */
      labels: ConfigurationSchema(
        'LDLabels',
        {
          /**
           * #slot labels.name
           * Each variant's name, above its tick mark.
           */
          name: ConfigurationSchema(
            'LDNameLabel',
            {
              /**
               * #slot labels.name.show
               */
              show: {
                type: 'boolean',
                defaultValue: false,
                description: 'draw each variant name above its tick mark',
                advanced: true,
              },
            },
            { closed: true, plot: true },
          ),
        },
        { closed: true, plot: true },
      ),
      /**
       * #slot
       */
      tickHeight: {
        type: 'number',
        defaultValue: 6,
        description: 'height of the tick marks at the genomic positions',
        advanced: true,
      },
      /**
       * #slot
       * `'columns'` draws every SNP one uniform square wide; `'genomic'` sizes
       * the cells by the genomic distance between SNPs. `LinearVariantDisplay`
       * takes the same slot for the same choice.
       */
      variantLayout: {
        type: 'stringEnum',
        model: types.enumeration('VariantLayout', ['genomic', 'columns']),
        defaultValue: 'columns',
        advanced: true,
      },
    },
    {
      explicitlyTyped: true,
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
      // v4.1-v4.3's display filtered and signed the statistic itself and
      // drew a recombination band; the file carries the statistic now.
      retired: {
        ...retiredBaseDisplaySpellings,
        ldMetric: field => ({ encoding: { color: { field } } }),
        showLegend: show => ({ legend: { show } }),
        showVerticalGuides: show => ({ guides: { show } }),
        fitToHeight: fit => ({ heightMode: fit ? 'fit' : 'fixed' }),
        // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- the retired slot's own name
        useGenomicPositions: genomic => ({
          variantLayout: genomic ? 'genomic' : 'columns',
        }),
        maxHeight: () => ({}),
        colorScheme: () => ({}),
        signedLD: () => ({}),
        showLDTriangle: () => ({}),
        showRecombination: () => ({}),
        recombinationZoneHeight: () => ({}),
        minorAlleleFrequencyFilter: () => ({}),
        lengthCutoffFilter: () => ({}),
        hweFilterThreshold: () => ({}),
        callRateFilter: () => ({}),
        showLabels: shown =>
          typeof shown === 'boolean'
            ? { labels: { name: { show: shown } } }
            : {},
      },
    },
  )
}

export type LDDisplayConfigSchema = ReturnType<
  typeof ldTrackDisplayConfigSchema
>
