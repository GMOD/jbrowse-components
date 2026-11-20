import { Suspense, lazy, use, useLayoutEffect, useRef } from 'react'

import { observer } from 'mobx-react'

import { escapeHTML, looksLikeHTML } from '../util/htmlText.ts'
import { linkify } from '../util/index.ts'
import { UnreachableContext } from './UnreachableContext.ts'
import { rewriteAnchors } from './rewriteAnchors.ts'

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
  unlink,
  className,
}: {
  value: string
  unlink: boolean
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
        rewriteAnchors(el, unlink)
      } catch (e) {
        console.error(e)
      }
    }
  }, [value, unlink])
  return <span ref={spanRef} className={className} />
})

const SanitizedHTML = observer(function SanitizedHTML({
  html: pre,
  className,
}: {
  className?: string
  html: unknown
}) {
  const unlink = use(UnreachableContext)
  const str = `${pre}`
  if (!needsSanitization(str)) {
    return <span className={className}>{str}</span>
  }

  const html = unlink ? str : linkify(str)
  const value = looksLikeHTML(html) ? html : escapeHTML(html)

  if (typeof Element !== 'undefined' && canSetHTML(Element.prototype)) {
    return <SetHTML value={value} unlink={unlink} className={className} />
  }

  return (
    <Suspense fallback={<span className={className} />}>
      <DOMPurifySanitizedHTML
        value={value}
        unlink={unlink}
        className={className}
      />
    </Suspense>
  )
})

export default SanitizedHTML
