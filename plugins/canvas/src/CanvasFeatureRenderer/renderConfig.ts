import { readConfObject } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * Pre-read configuration values for the renderer.
 *
 * IMPORTANT: Reading config values via readConfObject is expensive because it
 * may involve JEXL expression evaluation. We read all needed config values once
 * upfront and pass them through the rendering pipeline to avoid repeated reads
 * in hot paths (e.g., per-feature loops).
 */
export interface RenderConfigContext {
  // Display settings
  displayMode: string
  showLabels: boolean
  showDescriptions: boolean
  showSubfeatureLabels: boolean
  subfeatureLabelPosition: string

  // Feature type classification
  transcriptTypes: string[]
  containerTypes: string[]

  // Colors (undefined if callback - will be read per-feature)
  color1?: string
  color3?: string
  isColor1Callback: boolean
  isColor3Callback: boolean

  // Font settings (undefined if callback - will be read per-feature)
  fontHeight?: number
  isFontHeightCallback: boolean

  // Derived flags
  labelAllowed: boolean
}

/**
 * Read all renderer config values upfront to avoid repeated expensive reads.
 *
 * Call this once at the start of rendering and pass the context through
 * to all functions that need config values.
 */
export function createRenderConfigContext(
  config: AnyConfigurationModel,
): RenderConfigContext {
  const displayMode = readConfObject(config, 'displayMode') as string
  const showLabels = readConfObject(config, 'showLabels') as boolean
  const showDescriptions = readConfObject(config, 'showDescriptions') as boolean
  const showSubfeatureLabels = readConfObject(
    config,
    'showSubfeatureLabels',
  ) as boolean
  const subfeatureLabelPosition = readConfObject(
    config,
    'subfeatureLabelPosition',
  ) as string
  const transcriptTypes = readConfObject(config, 'transcriptTypes') as string[]
  const containerTypes = readConfObject(config, 'containerTypes') as string[]

  // Check if colors are callbacks to avoid unnecessary per-feature reads
  const isColor1Callback = config.color1?.isCallback ?? false
  const isColor3Callback = config.color3?.isCallback ?? false
  const color1 = isColor1Callback
    ? undefined
    : (readConfObject(config, 'color1') as string)
  const color3 = isColor3Callback
    ? undefined
    : (readConfObject(config, 'color3') as string)

  // Check if fontHeight is a callback
  const isFontHeightCallback = config.labels?.fontSize?.isCallback ?? false
  const fontHeight = isFontHeightCallback
    ? undefined
    : (readConfObject(config, ['labels', 'fontSize']) as number)

  return {
    displayMode,
    showLabels,
    showDescriptions,
    showSubfeatureLabels,
    subfeatureLabelPosition,
    transcriptTypes,
    containerTypes,
    color1,
    color3,
    isColor1Callback,
    isColor3Callback,
    fontHeight,
    isFontHeightCallback,
    labelAllowed: displayMode !== 'collapsed',
  }
}
