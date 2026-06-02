export { readConfigValue } from '@jbrowse/core/configuration'

// Sentinel used as the config default for connectorColor (stroke) to mean
// "derive from theme text colour". The runtime check in getStrokeColor compares
// against this exact string. Using a named constant here makes both sides of
// the contract explicit.
export const THEME_DERIVED_COLOR = '#f0f'

export interface DisplayConfig {
  [key: string]: unknown
  displayMode:
    | 'normal'
    | 'compact'
    | 'superCompact'
    | 'reducedRepresentation'
    | 'collapse'
  geneGlyphMode: 'auto' | 'all' | 'longestCoding'
  subfeatureLabels: 'none' | 'below' | 'overlay'
  transcriptTypes: string[]
  containerTypes: string[]
  subParts: string
  impliedUTRs: boolean
  displayDirectionalChevrons: boolean
  featureHeight: number
  color: string
  connectorColor: string
  utrColor: string
  outlineColor: string
  labels: {
    name: string
    description: string
  }
}

export function isLabelAllowed(config: DisplayConfig) {
  return config.displayMode !== 'collapse'
}
