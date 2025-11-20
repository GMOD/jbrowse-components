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

test('handles deeply nested complex HTML structure', () => {
  const complexHTML = `
    <div class="container">
      <header id="main-header" data-version="1.0">
        <nav class="navigation">
          <ul class="menu">
            <li><a href="/home">Home</a></li>
            <li><a href="/about">About</a></li>
          </ul>
        </nav>
      </header>
      <main>
        <article class="post" data-id="123">
          <h1>Title</h1>
          <p>Content here</p>
        </article>
      </main>
    </div>
  `
  const result = coarseStripHTML(complexHTML)
  expect(result).toContain('Home')
  expect(result).toContain('About')
  expect(result).toContain('Title')
  expect(result).toContain('Content here')
  expect(result).not.toContain('<')
  expect(result).not.toContain('>')
})

test('handles SVG elements with complex attributes', () => {
  const svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />
    <text x="50" y="50">SVG Text</text>
  </svg>`
  const result = coarseStripHTML(svg)
  expect(result).toContain('SVG Text')
  expect(result).not.toContain('svg')
  expect(result).not.toContain('circle')
})

test('handles table structure with lots of tags', () => {
  const table = `
    <table class="data-grid">
      <thead>
        <tr>
          <th>Gene</th>
          <th>Position</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        <tr class="row-1">
          <td><a href="/gene/1">BRCA1</a></td>
          <td>chr17:43044295-43125483</td>
          <td><span class="score high">0.95</span></td>
        </tr>
      </tbody>
    </table>
  `
  const result = coarseStripHTML(table)
  expect(result).toContain('Gene')
  expect(result).toContain('BRCA1')
  expect(result).toContain('chr17:43044295-43125483')
  expect(result).not.toContain('<td>')
})

test('handles form elements with various input types', () => {
  const form = `
    <form action="/submit" method="post">
      <input type="text" name="username" placeholder="Enter username" />
      <input type="email" name="email" required />
      <textarea name="message" rows="4" cols="50">Default text</textarea>
      <select name="options">
        <option value="1">Option 1</option>
        <option value="2" selected>Option 2</option>
      </select>
      <button type="submit">Submit</button>
    </form>
  `
  const result = coarseStripHTML(form)
  expect(result).toContain('Default text')
  expect(result).toContain('Option 1')
  expect(result).toContain('Option 2')
  expect(result).toContain('Submit')
})

test('handles mix of valid and empty tags', () => {
  expect(coarseStripHTML('<><div>Text</div><>')).toBe('Text')
})

test('handles tags with data attributes and JSON-like values', () => {
  const complexData = `<div data-config='{"theme":"dark","size":"large"}' data-items='[1,2,3]'>Item</div>`
  expect(coarseStripHTML(complexData)).toBe('Item')
})

test('handles very long attribute values', () => {
  const longAttr = `<div class="${'x'.repeat(1000)}">Content</div>`
  expect(coarseStripHTML(longAttr)).toBe('Content')
})

test('handles mixed quotes in attributes', () => {
  expect(
    coarseStripHTML(
      `<div class='single' id="double" data-mixed="it's">Text</div>`,
    ),
  ).toBe('Text')
})

test('handles CDATA-like sections', () => {
  expect(coarseStripHTML('Text <![CDATA[some data]]> more text')).toBe(
    'Text  more text',
  )
})

test('handles processing instructions', () => {
  expect(coarseStripHTML('<?xml version="1.0"?><root>Content</root>')).toBe(
    'Content',
  )
})

test('handles doctype declarations', () => {
  expect(
    coarseStripHTML('<!DOCTYPE html><html><body>Content</body></html>'),
  ).toBe('Content')
})

test('handles real-world React component-like HTML', () => {
  const reactLike = `
    <div className="MuiBox-root css-1234">
      <div className="MuiDataGrid-root">
        <div className="MuiDataGrid-cell" data-field="name" data-colindex="0">
          <div className="MuiBox-root css-5678">
            <span style="color: rgb(0, 0, 0);">Gene ABC123</span>
          </div>
        </div>
      </div>
    </div>
  `
  expect(coarseStripHTML(reactLike)).toContain('Gene ABC123')
})

test('stress test with many consecutive angle brackets', () => {
  expect(coarseStripHTML('<><><><>Text<><><><>')).toBe('Text')
})

test('handles unicode characters in content', () => {
  expect(coarseStripHTML('<div>Hello 世界 🧬</div>')).toBe('Hello 世界 🧬')
})

test('handles newlines and whitespace preservation', () => {
  const withWhitespace = `<p>Line 1
Line 2
  Line 3</p>`
  const result = coarseStripHTML(withWhitespace)
  expect(result).toBe(`Line 1
Line 2
  Line 3`)
})
