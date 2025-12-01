'use client'
import { useMemo } from 'react'

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

function cx(...args: CxArg[]): string {
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

export function makeStyles() {
  return function <RuleName extends string>(
    cssObjectByRuleNameOrGetCssObjectByRuleName:
      | Record<RuleName, CSSObject>
      | ((theme: Theme) => Record<RuleName, CSSObject>),
  ) {
    const getCssObjectByRuleName =
      typeof cssObjectByRuleNameOrGetCssObjectByRuleName === 'function'
        ? cssObjectByRuleNameOrGetCssObjectByRuleName
        : () => cssObjectByRuleNameOrGetCssObjectByRuleName

    return function useStyles(): {
      classes: Record<RuleName, string>
      theme: Theme
      cx: typeof cx
    } {
      const theme = useTheme()
      const cache = __unsafe_useEmotionCache() as EmotionCache

      const classes = useMemo(() => {
        const cssObjectByRuleName = getCssObjectByRuleName(theme)
        const result = {} as Record<RuleName, string>
        for (const ruleName of Object.keys(cssObjectByRuleName) as RuleName[]) {
          const cssObject = cssObjectByRuleName[ruleName]
          const serialized = serializeStyles([cssObject], cache.registered)
          insertStyles(cache, serialized, false)
          result[ruleName] = `${cache.key}-${serialized.name}`
        }
        return result
      }, [cache, theme])

      return { classes, theme, cx }
    }
  }
}
