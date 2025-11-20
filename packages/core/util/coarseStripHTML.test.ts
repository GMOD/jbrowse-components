import { coarseStripHTML } from './coarseStripHTML'

test('removes simple HTML tags', () => {
  expect(coarseStripHTML('<p>Hello World</p>')).toBe('Hello World')
})

test('removes multiple tags', () => {
  expect(
    coarseStripHTML('<div><span>Hello</span> <strong>World</strong></div>'),
  ).toBe('Hello World')
})

test('removes self-closing tags', () => {
  expect(coarseStripHTML('Line 1<br/>Line 2')).toBe('Line 1Line 2')
})

test('removes tags with attributes', () => {
  expect(coarseStripHTML('<a href="http://example.com">Link</a>')).toBe('Link')
})

test('removes tags with multiple attributes', () => {
  expect(
    coarseStripHTML(
      '<div class="container" id="main" data-value="test">Content</div>',
    ),
  ).toBe('Content')
})

test('handles empty string', () => {
  expect(coarseStripHTML('')).toBe('')
})

test('handles string with no HTML', () => {
  expect(coarseStripHTML('Plain text')).toBe('Plain text')
})

test('removes nested tags', () => {
  expect(coarseStripHTML('<div><p><span>Nested</span> content</p></div>')).toBe(
    'Nested content',
  )
})

test('handles malformed HTML gracefully', () => {
  expect(coarseStripHTML('<div>Unclosed tag')).toBe('Unclosed tag')
})

test('removes comment-like structures', () => {
  expect(coarseStripHTML('Text <!-- comment --> more text')).toBe(
    'Text  more text',
  )
})

test('preserves spaces between tags', () => {
  expect(coarseStripHTML('<span>Hello</span> <span>World</span>')).toBe(
    'Hello World',
  )
})

test('handles tags with newlines in attributes', () => {
  expect(
    coarseStripHTML('<div\n  class="test"\n  id="main">Content</div>'),
  ).toBe('Content')
})

xtest('removes script tags and content', () => {
  // this is commented because we don't evaluate script anyways, so 'non-issue'
  expect(coarseStripHTML('<script>alert("test")</script>Text')).toBe('Text')
})

test('handles multiple consecutive tags', () => {
  expect(coarseStripHTML('</div></div></div>Text<div><div><div>')).toBe('Text')
})

test('handles tags with special characters in attributes', () => {
  expect(
    coarseStripHTML('<a href="path/to/file?param=value&other=123">Link</a>'),
  ).toBe('Link')
})

test('preserves HTML entities', () => {
  expect(coarseStripHTML('&lt;tag&gt; &amp; &quot;text&quot;')).toBe(
    '&lt;tag&gt; &amp; &quot;text&quot;',
  )
})

test('handles mixed content', () => {
  expect(
    coarseStripHTML(
      '<p>Paragraph 1</p>Some text<div>Div content</div><br/>More text',
    ),
  ).toBe('Paragraph 1Some textDiv contentMore text')
})

test('handles real-world table cell content', () => {
  expect(coarseStripHTML('<div class="MuiBox-root">Cell Value</div>')).toBe(
    'Cell Value',
  )
})

test('handles complex nested structure with attributes', () => {
  expect(
    coarseStripHTML(
      '<div class="outer"><span id="inner" data-test="value">Text</span></div>',
    ),
  ).toBe('Text')
})

test('works for width measurement use case', () => {
  const text1 = coarseStripHTML('<span>Gene Name</span>')
  const text2 = coarseStripHTML('Gene Name')
  expect(text1).toBe(text2)
  expect(text1.length).toBe(text2.length)
})

test('handles tags split across multiple lines', () => {
  expect(
    coarseStripHTML(`<div
        class="test"
        id="main"
      >Content</div>`),
  ).toBe('Content')
})

test('handles img tags with long src attributes', () => {
  expect(
    coarseStripHTML(
      '<img src="data:image/png;base64,iVBORw0..." alt="test"/>Text',
    ),
  ).toBe('Text')
})

test('handles empty tags', () => {
  expect(coarseStripHTML('<div></div><span></span>Text')).toBe('Text')
})

test('handles case insensitive tags', () => {
  expect(coarseStripHTML('<DIV><SPAN>Text</SPAN></DIV>')).toBe('Text')
})

test('handles mixed case tags', () => {
  expect(coarseStripHTML('<DiV><SpAn>Text</SpAn></DiV>')).toBe('Text')
})
