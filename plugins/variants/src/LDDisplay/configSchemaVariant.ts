import { ConfigurationSchema } from '@jbrowse/core/configuration'

import sharedLDConfigFactory from './SharedLDConfigSchema.ts'

// Its own file, not a shared `makeLDConfigSchema(name)` helper, because the doc
// generator keys a `#config` block to its file and refuses a second one — see
// the comment in ./index.ts for what was missing while both schemas came from
// one un-annotated helper.
/**
 * #config LDDisplay
 * #category display
 *
 * Linkage disequilibrium heatmap computed from a `VariantTrack`'s own
 * genotypes: pairwise R² (or D') over the variants in view, drawn as a
 * triangle. Use [](/docs/config/ldtrackdisplay) instead to read pre-computed LD
 * (e.g. PLINK `--r2` output) from an `LDTrack`.
 *
 * Every slot comes from the shared base below; this display adds none of its
 * own.
 *
 * #example
 * An LD display on a phased callset, opened at a wider MAF cutoff than the
 * default so low-frequency sites still contribute:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'ld_demo',
 *   name: 'LD from genotypes',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     vcfGzLocation: { uri: 'https://example.com/calls.vcf.gz' },
 *   },
 *   displays: [
 *     {
 *       type: 'LDDisplay',
 *       displayId: 'ld_demo-LDDisplay',
 *       minorAlleleFrequencyFilter: 0.05,
 *       showLegend: true,
 *     },
 *   ],
 * }
 * ```
 */
export default function ldDisplayConfigSchema() {
  return ConfigurationSchema(
    'LDDisplay',
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
