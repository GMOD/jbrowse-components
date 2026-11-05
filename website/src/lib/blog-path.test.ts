import { blogExcerpt } from './blog-path.ts'

const para = (n: number) => `${'word '.repeat(n).trim()}.`

test('a short post is its own excerpt', () => {
  expect(blogExcerpt('One line.\n')).toEqual({
    text: 'One line.',
    truncated: false,
  })
})

test('a long post is cut at the last block end that fits', () => {
  const body = [para(40), para(40), `See [the release](https://example.org/${'x'.repeat(300)}).`].join('\n\n')
  const { text, truncated } = blogExcerpt(body)
  expect(truncated).toBe(true)
  expect(text).toBe(`${para(40)}\n\n${para(40)}`)
})

test('a blank line inside a code fence is not a block end', () => {
  const fence = ['```', 'a', '', 'b', '```'].join('\n')
  const body = [fence, para(200)].join('\n\n')
  expect(blogExcerpt(body).text).toBe(fence)
})
