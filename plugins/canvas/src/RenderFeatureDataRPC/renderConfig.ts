import { readConfObject } from '@jbrowse/core/configuration'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

/**
 * Cached config value that may need per-feature evaluation.
 * - If isCallback is false, use `value` directly (fast path)
 * - If isCallback is true, call readCachedConfig() to evaluate per-feature
 */
export interface CachedConfig<T> {
  value: T
  isCallback: boolean
}

function resolveConfigValue(
  config: Record<string, unknown>,
  key: string | string[],
) {
  return Array.isArray(key)
    ? key.reduce((acc: unknown, k) => (acc as Record<string, unknown>)?.[k], config)
    : config[key]
}

/**
 * Read a potentially cached config value.
 * Supports both MST config models (main thread) and plain objects (worker).
 */
export function readCachedConfig<T>(
  cached: CachedConfig<T>,
  config: AnyConfigurationModel,
  key: string | string[],
  feature: Feature,
): T {
  if (cached.isCallback) {
    if (isStateTreeNode(config)) {
      return readConfObject(config, key, { feature }) as T
    }
    const raw = resolveConfigValue(
      config as unknown as Record<string, unknown>,
      key,
    )
    if (typeof raw === 'string' && raw.startsWith('jexl:')) {
      return stringToJexlExpression(raw).eval({ feature }) as T
    }
    return raw as T
  }
  return cached.value
}

function createCachedConfig<T>(
  config: Record<string, unknown>,
  key: string | string[],
  defaultValue: T,
): CachedConfig<T> {
  const configSlot = resolveConfigValue(config, key) as
    | { isCallback?: boolean }
    | string
    | undefined

  // MST config slot — has isCallback property
  if (
    configSlot !== null &&
    typeof configSlot === 'object' &&
    'isCallback' in configSlot
  ) {
    const isCallback = configSlot.isCallback ?? false
    const value = isCallback
      ? defaultValue
      : (readConfObject(config as AnyConfigurationModel, key) as T)
    return { value, isCallback }
  }

  // Plain object — detect jexl: strings directly
  if (typeof configSlot === 'string' && configSlot.startsWith('jexl:')) {
    return { value: defaultValue, isCallback: true }
  }

  return { value: (configSlot as T) ?? defaultValue, isCallback: false }
}

export interface RenderConfigContext {
  config: AnyConfigurationModel

  displayMode: string
  subfeatureLabels: string

  transcriptTypes: string[]
  containerTypes: string[]

  color1: CachedConfig<string>
  color2: CachedConfig<string>
  color3: CachedConfig<string>
  outline: CachedConfig<string>

  featureHeight: CachedConfig<number>
  fontHeight: CachedConfig<number>
  nameColor: CachedConfig<string>
  descriptionColor: CachedConfig<string>

  labelAllowed: boolean
  geneGlyphMode: string
  displayDirectionalChevrons: boolean

  heightMultiplier: number
}

function getHeightMultiplier(displayMode: string) {
  if (displayMode === 'compact') {
    return 0.6
  }
  return 1
}

export function createRenderConfigContext(
  config: Record<string, unknown>,
): RenderConfigContext {
  const displayMode =
    (config.displayMode as string | undefined) ?? 'normal'

  return {
    config: config as AnyConfigurationModel,
    displayMode,
    subfeatureLabels:
      (config.subfeatureLabels as string | undefined) ?? 'none',
    transcriptTypes: (config.transcriptTypes as string[] | undefined) ?? [
      'mRNA',
      'transcript',
      'primary_transcript',
    ],
    containerTypes: (config.containerTypes as string[] | undefined) ?? [
      'proteoform_orf',
    ],
    geneGlyphMode:
      (config.geneGlyphMode as string | undefined) ?? 'all',
    displayDirectionalChevrons:
      (config.displayDirectionalChevrons as boolean | undefined) ?? true,

    color1: createCachedConfig(config, 'color1', 'goldenrod'),
    color2: createCachedConfig(config, 'color2', '#f0f'),
    color3: createCachedConfig(config, 'color3', '#357089'),
    outline: createCachedConfig(config, 'outline', ''),

    featureHeight: createCachedConfig(config, 'featureHeight', 10),
    fontHeight: createCachedConfig(config, ['labels', 'fontSize'], 12),
    nameColor: createCachedConfig(config, ['labels', 'nameColor'], 'black'),
    descriptionColor: createCachedConfig(
      config,
      ['labels', 'descriptionColor'],
      'blue',
    ),

    labelAllowed: displayMode !== 'collapse',
    heightMultiplier: getHeightMultiplier(displayMode),
  }
}
