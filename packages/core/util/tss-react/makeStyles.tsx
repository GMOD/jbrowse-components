'use client'

import { useMemo } from 'react'
import type { CSSObject } from './types'
import { createUseCssAndCx } from './cssAndCx'
import { getDependencyArrayRef } from './tools/getDependencyArrayRef'
import { mergeClasses } from './mergeClasses'
import type { EmotionCache } from '@emotion/cache'
import { __unsafe_useEmotionCache } from '@emotion/react'

const useContextualCache = __unsafe_useEmotionCache as () => EmotionCache

export function createMakeStyles<Theme>(params: { useTheme: () => Theme }) {
  const { useTheme } = params

  const { useCssAndCx } = createUseCssAndCx({
    useCache: useContextualCache,
  })

  function makeStyles() {
    return function <RuleName extends string>(
      cssObjectByRuleNameOrGetCssObjectByRuleName:
        | ((theme: Theme) => Record<RuleName, CSSObject>)
        | Record<RuleName, CSSObject>,
    ) {
      const getCssObjectByRuleName =
        typeof cssObjectByRuleNameOrGetCssObjectByRuleName === 'function'
          ? cssObjectByRuleNameOrGetCssObjectByRuleName
          : () => cssObjectByRuleNameOrGetCssObjectByRuleName

      return function useStyles(
        _params?: unknown,
        muiStyleOverridesParams?: {
          props: { classes?: Record<string, string> }
        },
      ) {
        const theme = useTheme()
        const { css, cx } = useCssAndCx()
        const cache = useContextualCache()

        let classes = useMemo(() => {
          const cssObjectByRuleName = getCssObjectByRuleName(theme)
          const result: Record<string, string> = {}

          for (const ruleName of Object.keys(cssObjectByRuleName)) {
            const cssObject = cssObjectByRuleName[ruleName as RuleName]
            result[ruleName] = css(cssObject)
          }

          return result as Record<RuleName, string>
        }, [cache, css, theme])

        // Merge with props.classes if provided
        {
          const propsClasses = muiStyleOverridesParams?.props?.classes
          classes = useMemo(
            () => mergeClasses(classes, propsClasses, cx),
            [classes, getDependencyArrayRef(propsClasses), cx],
          )
        }

        return { classes, theme, css, cx }
      }
    }
  }

  return { makeStyles }
}
