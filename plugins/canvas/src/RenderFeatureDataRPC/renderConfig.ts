export { readConfigValue } from '@jbrowse/core/configuration'

// Sentinel used as the config default for connectorColor (stroke) to mean
// "derive from theme text colour". The runtime check in getStrokeColor compares
// against this exact string. Using a named constant here makes both sides of
// the contract explicit.
export const THEME_DERIVED_COLOR = '#f0f'

export type DisplayMode =
  | 'normal'
  | 'compact'
  | 'superCompact'
  | 'reducedRepresentation'
  | 'collapse'

export interface DisplayConfig {
  [key: string]: unknown
  // displayMode is NOT sent to the worker — compact/superCompact scaling and
  // collapse-mode label decimation are applied on the main thread so switching
  // modes skips an RPC round-trip.
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
