import idMaker from '../../util/idMaker.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'

// Cache for config models to avoid repeated MST tree instantiation in worker
// Keyed by renderer name + config snapshot hash
let configModelCache: Record<string, AnyConfigurationModel> = {}

export function getConfigCacheKey(
  rendererName: string,
  configSnapshot: Record<string, unknown>,
) {
  return `${rendererName}-${idMaker(configSnapshot)}`
}

export function getCachedConfigModel(cacheKey: string) {
  return configModelCache[cacheKey]
}

export function setCachedConfigModel(
  cacheKey: string,
  model: AnyConfigurationModel,
) {
  configModelCache[cacheKey] = model
}

export function clearConfigModelCache() {
  configModelCache = {}
}
