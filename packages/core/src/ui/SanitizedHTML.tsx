import { Suspense, lazy, useLayoutEffect, useRef } from 'react'

import escapeHTML from 'escape-html'

import { linkify } from '../util/index.ts'

// source https://github.com/sindresorhus/html-tags/blob/master/html-tags.json
// with some random uncommon ones removed. note: we just use this to run the content
// through dompurify without escaping if we see an htmlTag from this list
// otherwise we escape angle brackets and things prematurely because it might be
// something like <TRA> in VCF. Ref #657
const htmlTags = [
  'a',
  'b',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'img',
  'li',
  'p',
  'pre',
  'span',
  'small',
  'strong',
  'table',
  'tbody',
  'sup',
  'sub',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]

const DOMPurifySanitizedHTML = lazy(
  () => import('./DOMPurifySanitizedHTML.tsx'),
)

// adapted from is-html
// https://github.com/sindresorhus/is-html/blob/master/index.js
const full = new RegExp(
  htmlTags.map(tag => String.raw`<${tag}\b[^>]*>`).join('|'),
  'i',
)
function isHTML(str: string) {
  return full.test(str)
}

function needsSanitization(str: string) {
  return str.includes('<') || str.includes('://')
}

function SetHTML({ value, className }: { value: string; className?: string }) {
  const spanRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = spanRef.current
    if (el) {
      try {
        // @ts-expect-error
        el.setHTML(value)
        for (const a of el.querySelectorAll('a')) {
          a.setAttribute('rel', 'noopener noreferrer')
          a.setAttribute('target', '_blank')
        }
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
  const value = isHTML(html) ? html : escapeHTML(html)

  // @ts-expect-error
  if (typeof Element !== 'undefined' && Element.prototype.setHTML) {
    return <SetHTML value={value} className={className} />
  }

  return (
    <Suspense fallback={<span className={className} />}>
      <DOMPurifySanitizedHTML value={value} className={className} />
    </Suspense>
  )
}
