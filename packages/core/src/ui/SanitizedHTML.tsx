import { Suspense, lazy, useLayoutEffect, useRef } from 'react'

import { observer } from 'mobx-react'

import { escapeHTML, looksLikeHTML } from '../util/htmlText.ts'
import { linkify } from '../util/index.ts'
import { rewriteExternalAnchors } from './rewriteExternalAnchors.ts'

// The Sanitizer API ships in some browsers only. TypeScript 7.0's DOM lib has
// no setHTML and 7.1's declares it on every Element, so it is found by looking.
function canSetHTML(
  el: Element,
): el is Element & { setHTML: (html: string) => void } {
  return 'setHTML' in el && typeof el.setHTML === 'function'
}

const DOMPurifySanitizedHTML = lazy(
  () => import('./DOMPurifySanitizedHTML.tsx'),
)

function needsSanitization(str: string) {
  return str.includes('<') || str.includes('://')
}

const SetHTML = observer(function SetHTML({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const spanRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = spanRef.current
    if (el) {
      try {
        if (canSetHTML(el)) {
          el.setHTML(value)
        }
        rewriteExternalAnchors(el)
      } catch (e) {
        console.error(e)
      }
    }
  }, [value])
  return <span ref={spanRef} className={className} />
})

const SanitizedHTML = observer(function SanitizedHTML({
  html: pre,
  className,
}: {
  className?: string
  html: unknown
}) {
  const str = `${pre}`
  if (!needsSanitization(str)) {
    return <span className={className}>{str}</span>
  }

  const html = linkify(str)
  const value = looksLikeHTML(html) ? html : escapeHTML(html)

  if (typeof Element !== 'undefined' && canSetHTML(Element.prototype)) {
    return <SetHTML value={value} className={className} />
  }

  return (
    <Suspense fallback={<span className={className} />}>
      <DOMPurifySanitizedHTML value={value} className={className} />
    </Suspense>
  )
})

export default SanitizedHTML
