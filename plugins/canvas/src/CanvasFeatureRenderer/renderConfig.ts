import { readConfObject } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

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
 * For feature-dependent configs (callbacks), we use CachedConfig which stores
 * both the cached value and whether it needs per-feature evaluation.
 */

/**
 * A cached config value that may need per-feature evaluation.
 * - If isCallback is false, use `value` directly (fast path)
 * - If isCallback is true, call readCachedConfig() to evaluate per-feature
 */
export interface CachedConfig<T> {
  value: T
  isCallback: boolean
}

/**
 * Read a potentially cached config value.
 * Uses cached value if not a callback, otherwise evaluates per-feature.
 */
export function readCachedConfig<T>(
  cached: CachedConfig<T>,
  config: AnyConfigurationModel,
  key: string | string[],
  feature: Feature,
): T {
  return cached.isCallback
    ? (readConfObject(config, key, { feature }) as T)
    : cached.value
}

function createCachedConfig<T>(
  config: AnyConfigurationModel,
  key: string | string[],
  defaultValue: T,
): CachedConfig<T> {
  const configSlot = Array.isArray(key)
    ? key.reduce((acc: any, k) => acc?.[k], config)
    : config[key]
  const isCallback = configSlot?.isCallback ?? false
  const value = isCallback ? defaultValue : (readConfObject(config, key) as T)
  return { value, isCallback }
}

export interface RenderConfigContext {
  // Reference to the raw config for callback evaluation
  config: AnyConfigurationModel

  displayMode: string
  showLabels: boolean
  showDescriptions: boolean
  subfeatureLabels: string

  transcriptTypes: string[]
  containerTypes: string[]

  color1: CachedConfig<string>
  color2: CachedConfig<string>
  color3: CachedConfig<string>
  outline: CachedConfig<string>

  featureHeight: CachedConfig<number>
  fontHeight: CachedConfig<number>

  labelAllowed: boolean
  geneGlyphMode: string
  displayDirectionalChevrons: boolean

  /**
   * Multiplier for feature height based on displayMode.
   * normal=1, compact=0.5
   */
  heightMultiplier: number
}

function getHeightMultiplier(displayMode: string) {
  if (displayMode === 'compact') {
    return 0.5
  }
  return 1
}

export function createRenderConfigContext(
  config: AnyConfigurationModel,
): RenderConfigContext {
  const displayMode = readConfObject(config, 'displayMode') as string

  return {
    config,
    displayMode,
    showLabels: readConfObject(config, 'showLabels') as boolean,
    showDescriptions: readConfObject(config, 'showDescriptions') as boolean,
    subfeatureLabels: readConfObject(config, 'subfeatureLabels') as string,
    transcriptTypes: readConfObject(config, 'transcriptTypes') as string[],
    containerTypes: readConfObject(config, 'containerTypes') as string[],
    geneGlyphMode: readConfObject(config, 'geneGlyphMode') as string,
    displayDirectionalChevrons: readConfObject(
      config,
      'displayDirectionalChevrons',
    ) as boolean,

    color1: createCachedConfig(config, 'color1', 'goldenrod'),
    color2: createCachedConfig(config, 'color2', '#f0f'),
    color3: createCachedConfig(config, 'color3', '#357089'),
    outline: createCachedConfig(config, 'outline', ''),

    featureHeight: createCachedConfig(config, 'height', 10),
    fontHeight: createCachedConfig(config, ['labels', 'fontSize'], 12),

    labelAllowed: displayMode !== 'collapse',
    heightMultiplier: getHeightMultiplier(displayMode),
  }
}
