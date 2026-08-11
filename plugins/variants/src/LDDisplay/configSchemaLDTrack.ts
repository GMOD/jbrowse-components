import { ConfigurationSchema } from '@jbrowse/core/configuration'

import sharedLDConfigFactory from './SharedLDConfigSchema.ts'

// Its own file, for the same reason as its sibling — see the comment there and
// the one in ./index.ts.
/**
 * #config LDTrackDisplay
 * #category display
 *
 * Linkage disequilibrium heatmap read from an `LDTrack`'s pre-computed file
 * (e.g. PLINK `--r2` output), rather than computed from genotypes. Use
 * [](/docs/config/lddisplay) instead to compute LD from a `VariantTrack`'s own
 * VCF.
 *
 * The genotype-derived filters the shared base declares
 * (`minorAlleleFrequencyFilter`, `hweFilterThreshold`, `callRateFilter`) have
 * nothing to act on here — the file's rows are already computed — so they are
 * inherited but inert.
 *
 * Every slot comes from the shared base below; this display adds none of its
 * own.
 *
 * #example
 * The pre-computed heatmap, with the legend on so the R² ramp is labelled:
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
 *       showLegend: true,
 *     },
 *   ],
 * }
 * ```
 */
export default function ldTrackDisplayConfigSchema() {
  return ConfigurationSchema(
    'LDTrackDisplay',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: sharedLDConfigFactory(),
      explicitlyTyped: true,
    },
  )
}
