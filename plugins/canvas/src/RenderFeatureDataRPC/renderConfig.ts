export { readConfigValue } from '@jbrowse/core/configuration'

// Sentinel used as the config default for color2 (stroke) and labels.nameColor
// to mean "derive from theme text colour". The runtime check in getStrokeColor
// compares against this exact string. Using a named constant here makes both
// sides of the contract explicit. Note: labels.nameColor / descriptionColor are
// defined in the schema but not yet read by the renderer (floatingLabels.ts
// uses hardcoded colours); they exist for future per-feature colour support.
export const THEME_DERIVED_COLOR = '#f0f'

export interface DisplayConfig {
  [key: string]: unknown
  displayMode:
    | 'normal'
    | 'compact'
    | 'superCompact'
    | 'reducedRepresentation'
    | 'collapse'
  geneGlyphMode: 'auto' | 'all' | 'longest' | 'longestCoding'
  subfeatureLabels: 'none' | 'below' | 'overlay'
  transcriptTypes: string[]
  containerTypes: string[]
  subParts: string
  impliedUTRs: boolean
  displayDirectionalChevrons: boolean
  featureHeight: number
  color1: string
  color2: string
  color3: string
  outline: string
  labels: {
    name: string
    nameColor: string
    description: string
    descriptionColor: string
  }
}

export function isLabelAllowed(config: DisplayConfig) {
  return config.displayMode !== 'collapse'
}
