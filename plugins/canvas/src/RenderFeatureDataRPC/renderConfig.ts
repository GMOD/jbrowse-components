export { readConfigValue } from '@jbrowse/core/configuration'

export interface DisplayConfig {
  [key: string]: unknown
  displayMode: 'normal' | 'compact' | 'reducedRepresentation' | 'collapse'
  geneGlyphMode: 'auto' | 'all' | 'longest' | 'longestCoding'
  subfeatureLabels: 'none' | 'below' | 'overlay'
  transcriptTypes: string[]
  containerTypes: string[]
  subParts: string
  impliedUTRs: boolean
  displayDirectionalChevrons: boolean
  featureHeight: number | string
  color1: string
  color2: string
  color3: string
  labels: {
    name: string
    nameColor: string
    description: string
    descriptionColor: string
    fontSize: number | string
  }
}

export function isLabelAllowed(config: DisplayConfig) {
  return config.displayMode !== 'collapse'
}
