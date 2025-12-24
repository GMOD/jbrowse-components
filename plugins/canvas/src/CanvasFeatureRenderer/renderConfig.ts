import { readStaticConfObject } from '@jbrowse/core/configuration'

import type { Region } from '@jbrowse/core/util'

// Jexl-like interface for type safety
export interface JexlLike {
  compile: (expr: string) => { evalSync: (context: unknown) => unknown }
}

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

  regionSize: number
}

// Default values from configSchema - used when snapshot omits keys at defaults
const DEFAULTS = {
  displayMode: 'normal',
  showLabels: true,
  showDescriptions: true,
  subfeatureLabels: 'none',
  transcriptTypes: ['mRNA', 'transcript', 'primary_transcript'],
  containerTypes: ['proteoform_orf'],
  geneGlyphMode: 'all',
  displayDirectionalChevrons: true,
  height: 10,
  fontSize: 12,
}

/**
 * Create render config context from a plain config snapshot.
 * Uses static reader for zero MobX overhead.
 *
 * @param configSnapshot - Plain object snapshot of the config (not MST node)
 * @param region - The region being rendered
 */
export function createRenderConfigContext(
  configSnapshot: Record<string, any>,
  region: Region,
): RenderConfigContext {
  const displayMode =
    (readStaticConfObject(configSnapshot, 'displayMode') as string) ??
    DEFAULTS.displayMode
  const showLabels =
    (readStaticConfObject(configSnapshot, 'showLabels') as boolean) ??
    DEFAULTS.showLabels
  const showDescriptions =
    (readStaticConfObject(configSnapshot, 'showDescriptions') as boolean) ??
    DEFAULTS.showDescriptions
  const subfeatureLabels =
    (readStaticConfObject(configSnapshot, 'subfeatureLabels') as string) ??
    DEFAULTS.subfeatureLabels
  const transcriptTypes =
    (readStaticConfObject(configSnapshot, 'transcriptTypes') as string[]) ??
    DEFAULTS.transcriptTypes
  const containerTypes =
    (readStaticConfObject(configSnapshot, 'containerTypes') as string[]) ??
    DEFAULTS.containerTypes
  const geneGlyphMode =
    (readStaticConfObject(configSnapshot, 'geneGlyphMode') as string) ??
    DEFAULTS.geneGlyphMode
  const displayDirectionalChevrons =
    (readStaticConfObject(
      configSnapshot,
      'displayDirectionalChevrons',
    ) as boolean) ?? DEFAULTS.displayDirectionalChevrons

  const featureHeight =
    (readStaticConfObject(configSnapshot, 'height') as number) ??
    DEFAULTS.height
  const fontHeight =
    (readStaticConfObject(configSnapshot, ['labels', 'fontSize']) as number) ??
    DEFAULTS.fontSize

  const regionSize = region.end - region.start

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
    regionSize,
  }
}
