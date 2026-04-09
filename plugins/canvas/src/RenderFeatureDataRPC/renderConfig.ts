import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'

import type { Feature } from '@jbrowse/core/util'

function resolveValue(config: Record<string, unknown>, key: string | string[]) {
  if (Array.isArray(key)) {
    let val: unknown = config
    for (const k of key) {
      val = (val as Record<string, unknown>)?.[k]
    }
    return val
  }
  return config[key]
}

export function readConfigValue<T>(
  config: Record<string, unknown>,
  key: string | string[],
  feature?: Feature,
): T {
  const raw = resolveValue(config, key)
  if (typeof raw === 'string' && raw.startsWith('jexl:')) {
    if (!feature) {
      return undefined as T
    }
    return stringToJexlExpression(raw).eval({ feature }) as T
  }
  return raw as T
}

export interface RenderConfigContext {
  config: Record<string, unknown>

  displayMode: string
  subfeatureLabels: string

  transcriptTypes: string[]
  containerTypes: string[]

  geneGlyphMode: string
  displayDirectionalChevrons: boolean

  labelAllowed: boolean
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
  const displayMode = config.displayMode as string

  return {
    config,
    displayMode,
    subfeatureLabels: config.subfeatureLabels as string,
    transcriptTypes: config.transcriptTypes as string[],
    containerTypes: config.containerTypes as string[],
    geneGlyphMode: config.geneGlyphMode as string,
    displayDirectionalChevrons: config.displayDirectionalChevrons as boolean,
    labelAllowed: displayMode !== 'collapse',
    heightMultiplier: getHeightMultiplier(displayMode),
  }
}
