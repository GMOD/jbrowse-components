import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { triangleMatrixConfigSchemaFields } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { retiredBaseDisplaySpellings } from '@jbrowse/display-kit/configSchema'
import { hiddenLegendConfigSchema } from '@jbrowse/display-kit/hiddenLegendConfigSchema'
import { regionTooLargeConfigSchemaFields } from '@jbrowse/display-kit/regionTooLargeConfigSchemaFields'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import { ldEncodingConfigSchema } from './ldEncodingConfigSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

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
      ...regionTooLargeConfigSchemaFields,
      /**
       * #slot
       * A pair costs about 11 compressed bytes, so 20 MB is some 1.8 million
       * pairs, and the 790k pairs of a 1,258-variant triangle fit with room.
       * The estimate is read from the tabix index, before any pair downloads.
       */
      fetchSizeLimit: {
        type: 'number',
        defaultValue: 20_000_000,
        description:
          'bytes of a tabix LD file a region may read before the display asks first',
        advanced: true,
      },
      /**
       * #slot connectors
       * The band above the triangle holding the connector lines that tie
       * each of its columns to a genomic position, and the variant names
       * when they show: `show` and `height`, taken from the display's
       * height. Off, neither the lines nor the names draw.
       */
      connectors: ConfigurationSchema(
        'LDConnectors',
        {
          /**
           * #slot connectors.show
           */
          show: {
            type: 'boolean',
            defaultValue: true,
            description:
              'draw the connector lines and the names above the triangle',
          },
          /**
           * #slot connectors.height
           */
          height: {
            type: 'number',
            defaultValue: 100,
            description:
              "height of the connector band in pixels, taken from the triangle's; its seam drag writes it",
          },
        },
        { closed: true, plot: true },
      ),
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
       * #slot labels
       * The text drawn at each variant's tick mark.
       */
      labels: ConfigurationSchema(
        'LDLabels',
        {
          /**
           * #slot labels.name
           * Each variant's name, above its tick mark. No `field`: an LD SNP
           * carries only the id its file names, its position and its MAF, so
           * the id is the one text there is to draw.
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
        showVerticalGuides: () => ({}),
        tickHeight: () => ({}),
        lineZoneHeight: height =>
          height === 0
            ? { connectors: { show: false } }
            : { connectors: { height } },
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
export interface LDDisplayConfig extends Instance<LDDisplayConfigSchema> {}
