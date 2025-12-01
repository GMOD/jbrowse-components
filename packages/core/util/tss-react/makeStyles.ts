'use client'
import { useMemo } from 'react'

import type { EmotionCache } from '@emotion/cache'
// @ts-expect-error: It's not declared but it's there
import { __unsafe_useEmotionCache } from '@emotion/react'
import { serializeStyles } from '@emotion/serialize'
import { getRegisteredStyles, insertStyles } from '@emotion/utils'
import { useTheme } from '@mui/material/styles'

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

const useEmotionCache: () => EmotionCache = __unsafe_useEmotionCache

function classnames(args: CxArg[]): string {
  let cls = ''
  for (const arg of args) {
    if (arg == null || typeof arg === 'boolean') {
      continue
    }
    let toAdd: string | undefined
    if (typeof arg === 'object') {
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
    } else {
      toAdd = arg
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

type Css = (...args: CSSObject[]) => string
type Cx = (...args: CxArg[]) => string

export function makeStyles<Theme = ReturnType<typeof useTheme>>() {
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
      css: Css
      cx: Cx
    } {
      const theme = useTheme() as Theme
      const cache = useEmotionCache()

      const { css, cx } = useMemo(() => createCssAndCx(cache), [cache])

      const classes = useMemo(() => {
        const cssObjectByRuleName = getCssObjectByRuleName(theme)
        const result = {} as Record<RuleName, string>
        for (const ruleName of Object.keys(cssObjectByRuleName) as RuleName[]) {
          const cssObject = cssObjectByRuleName[ruleName]
          result[ruleName] = css(cssObject)
        }
        return result
      }, [css, theme])

      return { classes, theme, css, cx }
    }
  }
}
