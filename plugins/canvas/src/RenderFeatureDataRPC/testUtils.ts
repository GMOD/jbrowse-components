import type { DisplayConfig } from './renderConfig.ts'

export function mockDisplayConfig(
  overrides: Partial<DisplayConfig> = {},
): DisplayConfig {
  return {
    featureHeight: 10,
    displayMode: 'normal',
    subfeatureLabels: 'none',
    transcriptTypes: ['mRNA'],
    containerTypes: [],
    geneGlyphMode: 'all',
    subParts: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    impliedUTRs: false,
    displayDirectionalChevrons: true,
    color1: 'goldenrod',
    color2: '#f0f',
    color3: '#357089',
    labels: {
      name: '',
      nameColor: '#f0f',
      description: '',
      descriptionColor: 'blue',
      fontSize: 12,
    },
    ...overrides,
  }
}
