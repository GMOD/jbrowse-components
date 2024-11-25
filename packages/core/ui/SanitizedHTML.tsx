import React from 'react'
import dompurify from 'dompurify'
import escapeHTML from 'escape-html'
import { linkify } from '../util'

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

let added = false

// adapted from is-html
// https://github.com/sindresorhus/is-html/blob/master/index.js
const full = new RegExp(htmlTags.map(tag => `<${tag}\\b[^>]*>`).join('|'), 'i')
function isHTML(str: string) {
  return full.test(str)
}

// note this is mocked during testing, see
// packages/__mocks__/@jbrowse/core/ui/SanitizedHTML something about dompurify
// behavior causes errors during tests, was seen in
// products/jbrowse-web/src/tests/Connection.test.tsx test (can delete mock to
// see)
//
export default function SanitizedHTML({
  html: pre,
  className,
}: {
  className?: string
  html: string
}) {
  // try to add links to the text first
  const html = linkify(pre)
  const value = isHTML(html) ? html : escapeHTML(html)
  if (!added) {
    added = true
    // see https://github.com/cure53/DOMPurify/issues/317
    // only have to add this once, and can't do it globally because dompurify
    // not yet initialized at global scope
    dompurify.addHook('afterSanitizeAttributes', node => {
      // @ts-expect-error
      if (node.tagName === 'A') {
        // @ts-expect-error
        node.setAttribute('rel', 'noopener noreferrer')
        // @ts-expect-error
        node.setAttribute('target', '_blank')
      }
    })
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{
        __html: dompurify.sanitize(value),
      }}
    />
  )
}
