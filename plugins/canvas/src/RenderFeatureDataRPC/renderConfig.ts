// Re-export readConfigValue from core so existing canvas imports continue to work
export { readConfigValue } from '@jbrowse/core/configuration'

export interface RenderConfigContext {
  config: Record<string, unknown>
  displayMode: string
  subfeatureLabels: string
  transcriptTypes: string[]
  containerTypes: string[]
  geneGlyphMode: string
  labelAllowed: boolean
  heightMultiplier: number
  displayDirectionalChevrons: boolean
}

export function createRenderConfigContext(
  config: Record<string, unknown>,
): RenderConfigContext {
  const displayMode = config.displayMode as string
  return {
    config,
    displayMode,
    subfeatureLabels: config.subfeatureLabels as string,
    transcriptTypes: config.transcriptTypes as string[],
    containerTypes: config.containerTypes as string[],
    geneGlyphMode: config.geneGlyphMode as string,
    labelAllowed: displayMode !== 'collapse',
    heightMultiplier: displayMode === 'compact' ? 0.6 : 1,
    displayDirectionalChevrons: config.displayDirectionalChevrons !== false,
  }
}
