'use client'

import { useMemo } from 'react'

import { __unsafe_useEmotionCache } from '@emotion/react'

import { createUseCssAndCx } from './cssAndCx.ts'
import { mergeClasses } from './mergeClasses.ts'
import { getDependencyArrayRef } from './tools/getDependencyArrayRef.ts'

import type { CSSObject } from './types.ts'
import type { EmotionCache } from '@emotion/cache'

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

        const classes = useMemo(() => {
          const cssObjectByRuleName = getCssObjectByRuleName(theme)
          const result: Record<string, string> = {}

          for (const ruleName of Object.keys(cssObjectByRuleName)) {
            const cssObject = cssObjectByRuleName[ruleName as RuleName]
            result[ruleName] = css(cssObject)
          }

          return result as Record<RuleName, string>
        }, [css, theme])

        const propsClasses = muiStyleOverridesParams?.props.classes
        const propsClassesRef = getDependencyArrayRef(propsClasses)
        const mergedClasses = useMemo(
          () =>
            propsClasses ? mergeClasses(classes, propsClasses, cx) : classes,
          // eslint-disable-next-line react-hooks/exhaustive-deps
          [classes, propsClassesRef, cx],
        )

        return { classes: mergedClasses, theme, css, cx }
      }
    }
  }

  return { makeStyles }
}
