'use client'
import { useMemo } from 'react'

// this is the standard way to access Emotion's cache in a hook-based API when
// using MUI. MUI's ThemeProvider wraps Emotion's CacheProvider, so the cache is
// always available. this approach is used by tss-react and other MUI styling
// libraries
// @ts-expect-error not in the types but exists at runtime
import { __unsafe_useEmotionCache } from '@emotion/react'
import { serializeStyles } from '@emotion/serialize'
import { getRegisteredStyles, insertStyles } from '@emotion/utils'
import { useTheme } from '@mui/material/styles'

import type { EmotionCache } from '@emotion/cache'
import type { CSSObject as CSSObjectBase } from '@emotion/serialize'
import type { Theme } from '@mui/material/styles'

export { keyframes } from '@emotion/react'

type CxArg =
  | undefined
  | null
  | string
  | boolean
  | Record<string, boolean | null | undefined>
  | readonly CxArg[]

interface CSSObject extends CSSObjectBase {
  label?: string
}

function classnames(args: CxArg[]): string {
  const len = args.length
  let i = 0
  let cls = ''
  for (; i < len; i++) {
    const arg = args[i]
    if (arg == null) {
      continue
    }
    let toAdd: string | undefined
    switch (typeof arg) {
      case 'boolean':
        break
      case 'object': {
        if (Array.isArray(arg)) {
          toAdd = classnames(arg)
        } else {
          toAdd = ''
          for (const k in arg) {
            if (arg[k] && k) {
              toAdd && (toAdd += ' ')
              toAdd += k
            }
          }
        }
        break
      }
      default: {
        toAdd = arg
      }
    }
    if (toAdd) {
      cls && (cls += ' ')
      cls += toAdd
    }
  }
  return cls
}

function createCssAndCx(cache: EmotionCache) {
  const css = (...args: CSSObject[]) => {
    const serialized = serializeStyles(args, cache.registered)
    insertStyles(cache, serialized, false)
    return `${cache.key}-${serialized.name}`
  }

  const cx = (...args: CxArg[]) => {
    const className = classnames(args)
    const registeredStyles: string[] = []
    const rawClassName = getRegisteredStyles(
      cache.registered,
      registeredStyles,
      className,
    )
    if (registeredStyles.length < 2) {
      return className
    }
    return rawClassName + css(...(registeredStyles as unknown as CSSObject[]))
  }

  return { css, cx }
}

export function cx(...args: CxArg[]): string {
  return classnames(args)
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

    function useStyles(): { classes: Record<RuleName, string> } {
      const theme = useTheme()
      const cache = __unsafe_useEmotionCache() as EmotionCache

      const { css } = useMemo(() => createCssAndCx(cache), [cache])

      const classes = useMemo(() => {
        const cssObjectByRuleName = getCssObjectByRuleName(theme)
        const result = {} as Record<RuleName, string>
        for (const ruleName of Object.keys(cssObjectByRuleName) as RuleName[]) {
          const cssObject = cssObjectByRuleName[ruleName]
          result[ruleName] = css(cssObject)
        }
        return result
      }, [css, theme])

      return { classes }
    }

    return useStyles
  }
}
