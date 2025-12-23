import { readConfObject } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * IMPORTANT: Config Reading Performance Optimization
 *
 * Reading config values via readConfObject is expensive because:
 * 1. It may involve JEXL expression evaluation
 * 2. It traverses the config tree
 * 3. It can trigger MobX reactions
 *
 * In rendering code, we process thousands of features in tight loops.
 * Calling readConfObject per-feature creates significant overhead.
 *
 * SOLUTION: Read all non-feature-dependent config values ONCE at the start
 * of the rendering pipeline and pass them through as a context object.
 *
 * For feature-dependent configs (callbacks), we check `isCallback` to determine
 * if we need to call readConfObject per-feature or can use a cached value.
 *
 * This pattern should be maintained for any new config values added.
 */

export interface RenderConfigContext {
  displayMode: string
  showLabels: boolean
  showDescriptions: boolean
  subfeatureLabels: string

  transcriptTypes: string[]
  containerTypes: string[]

  color1?: string
  color2?: string
  color3?: string
  outline?: string
  isColor1Callback: boolean
  isColor2Callback: boolean
  isColor3Callback: boolean
  isOutlineCallback: boolean

  featureHeight: number
  isHeightCallback: boolean

  fontHeight: number
  isFontHeightCallback: boolean

  labelAllowed: boolean

  geneGlyphMode: string

  displayDirectionalChevrons: boolean
}

function readColorConfig(
  config: AnyConfigurationModel,
  key: 'color1' | 'color2' | 'color3' | 'outline',
) {
  const isCallback = config[key]?.isCallback ?? false
  const value = isCallback ? undefined : (readConfObject(config, key) as string)
  return { isCallback, value }
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

  const { isCallback: isColor1Callback, value: color1 } = readColorConfig(
    config,
    'color1',
  )
  const { isCallback: isColor2Callback, value: color2 } = readColorConfig(
    config,
    'color2',
  )
  const { isCallback: isColor3Callback, value: color3 } = readColorConfig(
    config,
    'color3',
  )
  const { isCallback: isOutlineCallback, value: outline } = readColorConfig(
    config,
    'outline',
  )

  const isHeightCallback = config.height?.isCallback ?? false
  const featureHeight = isHeightCallback
    ? 10
    : (readConfObject(config, 'height') as number)

  const isFontHeightCallback = config.labels?.fontSize?.isCallback ?? false
  const fontHeight = isFontHeightCallback
    ? 12
    : (readConfObject(config, ['labels', 'fontSize']) as number)

  return {
    displayMode,
    showLabels,
    showDescriptions,
    subfeatureLabels,
    transcriptTypes,
    containerTypes,
    color1,
    color2,
    color3,
    outline,
    isColor1Callback,
    isColor2Callback,
    isColor3Callback,
    isOutlineCallback,
    featureHeight,
    isHeightCallback,
    fontHeight,
    isFontHeightCallback,
    labelAllowed: displayMode !== 'collapse',
    geneGlyphMode,
    displayDirectionalChevrons,
  }
}
