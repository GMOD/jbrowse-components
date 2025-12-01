'use client'
import type { EmotionCache } from '@emotion/cache'
// this is the standard way to access Emotion's cache in a hook-based API when
// using MUI. MUI's ThemeProvider wraps Emotion's CacheProvider, so the cache is
// always available. this approach is used by tss-react and other MUI styling
// libraries
import { __unsafe_useEmotionCache } from '@emotion/react'
import { serializeStyles } from '@emotion/serialize'
import { insertStyles } from '@emotion/utils'
import { useTheme, type Theme } from '@mui/material/styles'

import type { CSSObject as CSSObjectBase } from '@emotion/serialize'

type CxArg =
  | undefined
  | null
  | string
  | boolean
  | { [className: string]: boolean | null | undefined }
  | readonly CxArg[]

interface CSSObject extends CSSObjectBase {
  label?: string
}

export function cx(...args: CxArg[]): string {
  let cls = ''
  for (const arg of args) {
    if (!arg) {
      continue
    }
    if (typeof arg === 'string') {
      cls = cls ? `${cls} ${arg}` : arg
    } else if (Array.isArray(arg)) {
      const nested = cx(...arg)
      if (nested) {
        cls = cls ? `${cls} ${nested}` : nested
      }
    } else if (typeof arg === 'object') {
      for (const k in arg) {
        if ((arg as Record<string, boolean | null | undefined>)[k]) {
          cls = cls ? `${cls} ${k}` : k
        }
      }
    }
  }
  return cls
}

// cache serialized styles per cssObject reference to avoid recomputation on
// re-mounts. uses WeakMap so entries are garbage collected when the style
// object is no longer referenced
const styleCache = new WeakMap<
  Record<string, CSSObject>,
  Map<EmotionCache, { classes: Record<string, string> }>
>()

function getOrCreateResult<RuleName extends string>(
  cssObjectByRuleName: Record<RuleName, CSSObject>,
  cache: EmotionCache,
): { classes: Record<RuleName, string> } {
  let cacheByEmotionCache = styleCache.get(cssObjectByRuleName)
  if (!cacheByEmotionCache) {
    cacheByEmotionCache = new Map()
    styleCache.set(cssObjectByRuleName, cacheByEmotionCache)
  }

  let result = cacheByEmotionCache.get(cache) as
    | { classes: Record<RuleName, string> }
    | undefined
  if (!result) {
    const classes = {} as Record<RuleName, string>
    for (const ruleName of Object.keys(cssObjectByRuleName) as RuleName[]) {
      const cssObject = cssObjectByRuleName[ruleName]
      const serialized = serializeStyles([cssObject], cache.registered)
      insertStyles(cache, serialized, false)
      classes[ruleName] = `${cache.key}-${serialized.name}`
    }
    result = { classes }
    cacheByEmotionCache.set(cache, result)
  }

  return result
}

export function makeStyles() {
  return function <RuleName extends string>(
    cssObjectByRuleNameOrGetCssObjectByRuleName:
      | Record<RuleName, CSSObject>
      | ((theme: Theme) => Record<RuleName, CSSObject>),
  ) {
    // for static styles, compute classes once outside the hook
    const isStatic =
      typeof cssObjectByRuleNameOrGetCssObjectByRuleName !== 'function'

    // cache for dynamic styles keyed by theme reference
    const dynamicCache = isStatic
      ? null
      : new WeakMap<Theme, Record<RuleName, CSSObject>>()

    function useStyles(): { classes: Record<RuleName, string> } {
      const theme = useTheme()
      const cache = __unsafe_useEmotionCache() as EmotionCache

      let cssObjectByRuleName: Record<RuleName, CSSObject>
      if (isStatic) {
        cssObjectByRuleName = cssObjectByRuleNameOrGetCssObjectByRuleName
      } else {
        // check if we already computed styles for this theme
        let cached = dynamicCache!.get(theme)
        if (!cached) {
          cached = (
            cssObjectByRuleNameOrGetCssObjectByRuleName as (
              theme: Theme,
            ) => Record<RuleName, CSSObject>
          )(theme)
          dynamicCache!.set(theme, cached)
        }
        cssObjectByRuleName = cached
      }

      return getOrCreateResult(cssObjectByRuleName, cache)
    }

    return useStyles
  }
}
