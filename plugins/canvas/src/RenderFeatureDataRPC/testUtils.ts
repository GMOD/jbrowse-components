import { THEME_DERIVED_COLOR } from './renderConfig.ts'

import type { DisplayConfig } from './renderConfig.ts'

export function mockDisplayConfig(
  overrides: Partial<DisplayConfig> = {},
): DisplayConfig {
  return {
    featureHeight: 10,
    subfeatureLabels: 'none',
    transcriptTypes: ['mRNA'],
    containerTypes: [],
    geneGlyphMode: 'all',
    subParts: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    impliedUTRs: false,
    displayDirectionalChevrons: true,
    mouseover: `jexl:get(feature,'name')||get(feature,'id')`,
    jexlFilters: [],
    color: 'goldenrod',
    connectorColor: THEME_DERIVED_COLOR,
    utrColor: '#357089',
    outlineColor: '',
    labels: {
      name: '',
      description: '',
    },
    ...overrides,
  }
}
