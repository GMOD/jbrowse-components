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
  showSubfeatureLabels: boolean
  subfeatureLabelPosition: string

  transcriptTypes: string[]
  containerTypes: string[]

  color1?: string
  color3?: string
  isColor1Callback: boolean
  isColor3Callback: boolean

  fontHeight: number
  isFontHeightCallback: boolean

  labelAllowed: boolean

  geneGlyphMode: string
}

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
  const geneGlyphMode = readConfObject(config, 'geneGlyphMode') as string

  const isColor1Callback = config.color1?.isCallback ?? false
  const isColor3Callback = config.color3?.isCallback ?? false
  const color1 = isColor1Callback
    ? undefined
    : (readConfObject(config, 'color1') as string)
  const color3 = isColor3Callback
    ? undefined
    : (readConfObject(config, 'color3') as string)

  const isFontHeightCallback = config.labels?.fontSize?.isCallback ?? false
  const fontHeight = isFontHeightCallback
    ? 12
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
    labelAllowed: displayMode !== 'collapse',
    geneGlyphMode,
  }
}
