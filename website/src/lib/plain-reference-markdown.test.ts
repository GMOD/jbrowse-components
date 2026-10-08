import fs from 'node:fs'
import path from 'node:path'

import { plainReferenceMarkdown } from './plain-reference-markdown.ts'

const docs = path.join(__dirname, '../../docs')

test('a long type reads in full where its dialog was', () => {
  const cell =
    '<span id="getter-x">**x**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>Map&lt;string, …</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>Map&lt;string,&#10;&#160;&#160;number&gt;</code></pre></dialog></span>'
  expect(plainReferenceMarkdown(`| ${cell} | prose |`)).toBe(
    '| **x**<br><code>Map&lt;string, number&gt;</code> | prose |',
  )
})

test('an example keeps its label, prose and code', () => {
  const cell =
    '<span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><p>Sets it:</p><pre><code>{ a: 1 }</code></pre></dialog></span>'
  expect(plainReferenceMarkdown(cell)).toBe(
    'example: Sets it: <code>{ a: 1 }</code>',
  )
})

test('an inherited line keeps its links and drops its spans', () => {
  expect(
    plainReferenceMarkdown(
      '<span data-pagefind-ignore>From [Base](../base): <span id="getter-a">[`a`](../base#getter-a)</span>, <span id="getter-b">[`b`](../base#getter-b)</span></span>',
    ),
  ).toBe('From [Base](../base): [`a`](../base#getter-a), [`b`](../base#getter-b)')
})

// The shapes above are the generator's, restated. Against the committed pages,
// so a change to what the generator emits that this stops matching shows here.
test.each(['models/LinearAlignmentsDisplay.md', 'config/BamAdapter.md'])(
  '%s leaves no page-only HTML behind',
  file => {
    const raw = fs.readFileSync(path.join(docs, file), 'utf8')
    expect(raw).toMatch(/<span id=/)
    const plain = plainReferenceMarkdown(raw)
    expect(plain).not.toMatch(/<\/?(span|dialog|button|form)\b/)
    expect(plain.length).toBeLessThan(raw.length)
  },
)
