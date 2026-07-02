import { useMemo } from 'react'

import { serializeStyles } from '@emotion/serialize'
import { getRegisteredStyles, insertStyles } from '@emotion/utils'

import { classnames } from './tools/classnames.ts'

import type { Css, Cx } from './types.ts'
import type { EmotionCache } from '@emotion/cache'
import type { RegisteredCache } from '@emotion/serialize'

// NOTE: upstream tss-react wraps `cx`/`css` in a workaround (issue #27) that
// re-wraps combined classes' media-query rules in `&&` for specificity. We
// intentionally omit it: no `cx()` call in this codebase combines an
// `@media`-bearing class with another (the only `@media (hover: none)` rules
// are applied as standalone classNames), so the workaround never changed any
// output while costing a per-render WeakMap walk in every multi-arg `cx()` and
// an unbounded per-cache Map. If you ever `cx()` together a class containing a
// media query, re-introduce it from upstream.

export const { createCssAndCx } = (() => {
  function merge(registered: RegisteredCache, css: Css, className: string) {
    const registeredStyles: string[] = []

    const rawClassName = getRegisteredStyles(
      registered,
      registeredStyles,
      className,
    )

    if (registeredStyles.length < 2) {
      return className
    }

    return rawClassName + css(registeredStyles)
  }

  function createCssAndCx(params: { cache: EmotionCache }) {
    const { cache } = params

    const css: Css = (...args) => {
      const serialized = serializeStyles(args, cache.registered)
      insertStyles(cache, serialized, false)
      return `${cache.key}-${serialized.name}`
    }

    const cx: Cx = (...args) => merge(cache.registered, css, classnames(args))

    return { css, cx }
  }

  return { createCssAndCx }
})()

export function createUseCssAndCx(params: { useCache: () => EmotionCache }) {
  const { useCache } = params

  function useCssAndCx() {
    const cache = useCache()

    const { css, cx } = useMemo(() => createCssAndCx({ cache }), [cache])

    return { css, cx }
  }

  return { useCssAndCx }
}
