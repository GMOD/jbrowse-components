import { Suspense, lazy, useLayoutEffect, useRef } from 'react'

import { escapeHTML, looksLikeHTML } from '../util/htmlText.ts'
import { linkify } from '../util/index.ts'
import { rewriteExternalAnchors } from './rewriteExternalAnchors.ts'

declare global {
  interface Element {
    setHTML?(html: string): void
  }
}

const DOMPurifySanitizedHTML = lazy(
  () => import('./DOMPurifySanitizedHTML.tsx'),
)

function needsSanitization(str: string) {
  return str.includes('<') || str.includes('://')
}

function SetHTML({ value, className }: { value: string; className?: string }) {
  const spanRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = spanRef.current
    if (el) {
      try {
        el.setHTML?.(value)
        rewriteExternalAnchors(el)
      } catch (e) {
        console.error(e)
      }
    }
  }, [value])
  return <span ref={spanRef} className={className} />
}

export default function SanitizedHTML({
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

  if (typeof Element !== 'undefined' && Element.prototype.setHTML) {
    return <SetHTML value={value} className={className} />
  }

  return (
    <Suspense fallback={<span className={className} />}>
      <DOMPurifySanitizedHTML value={value} className={className} />
    </Suspense>
  )
}
