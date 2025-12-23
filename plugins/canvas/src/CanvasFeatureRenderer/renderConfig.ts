import { readConfObject } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface RenderConfigContext {
  displayMode: string
  showLabels: boolean
  showDescriptions: boolean
  subfeatureLabels: string

  transcriptTypes: string[]
  containerTypes: string[]

  featureHeight: number
  fontHeight: number

  labelAllowed: boolean

  geneGlyphMode: string

  displayDirectionalChevrons: boolean
}

export function createRenderConfigContext(
  config: AnyConfigurationModel,
): RenderConfigContext {
  const displayMode = readConfObject(config, 'displayMode') as string
  const showLabels = readConfObject(config, 'showLabels') as boolean
  const showDescriptions = readConfObject(config, 'showDescriptions') as boolean
  const subfeatureLabels = readConfObject(config, 'subfeatureLabels') as string
  const transcriptTypes = readConfObject(config, 'transcriptTypes') as string[]
  const containerTypes = readConfObject(config, 'containerTypes') as string[]
  const geneGlyphMode = readConfObject(config, 'geneGlyphMode') as string
  const displayDirectionalChevrons = readConfObject(
    config,
    'displayDirectionalChevrons',
  ) as boolean

  const featureHeight = readConfObject(config, 'height') as number
  const fontHeight = readConfObject(config, ['labels', 'fontSize']) as number

  return {
    displayMode,
    showLabels,
    showDescriptions,
    subfeatureLabels,
    transcriptTypes,
    containerTypes,
    featureHeight,
    fontHeight,
    labelAllowed: displayMode !== 'collapse',
    geneGlyphMode,
    displayDirectionalChevrons,
  }
}
